<?php
/**
 * MegaWeb Orchestrator - Core Orchestration Engine
 * Advanced session management for 1M concurrent sites
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/database.php';

class HyperOrchestrator {
    private $db;
    private $eventStore;
    
    public function __construct() {
        $this->db = DatabaseManager::getInstance();
        $this->eventStore = new EventStore();
    }
    
    /**
     * Get all session blueprints
     */
    public function getBlueprintSnapshot($filters = []) {
        $where = [];
        $params = [];
        
        if (!empty($filters['status'])) {
            $where[] = "status = ?";
            $params[] = $filters['status'];
        }
        
        if (!empty($filters['region'])) {
            $where[] = "region = ?";
            $params[] = $filters['region'];
        }
        
        if (!empty($filters['proxy_pool_id'])) {
            $where[] = "proxy_pool_id = ?";
            $params[] = $filters['proxy_pool_id'];
        }
        
        $whereClause = !empty($where) ? implode(' AND ', $where) : '1=1';
        
        $sessions = $this->db->query(
            "SELECT * FROM sessions WHERE $whereClause ORDER BY created_at DESC",
            $params
        );
        
        return array_map([$this, 'formatSessionBlueprint'], $sessions);
    }
    
    /**
     * Create a single session
     */
    public function createSession($definition) {
        $sessionId = $this->db->uuid();
        
        $data = [
            'id' => $sessionId,
            'url' => $definition['url'],
            'status' => $definition['status'] ?? 'draft',
            'region' => $definition['region'] ?? null,
            'proxy_pool_id' => $definition['proxy_pool_id'] ?? DEFAULT_PROXY_POOL,
            'target_replica_count' => $definition['target_replica_count'] ?? 1,
            'current_replica_count' => 0,
            'max_replica_burst' => $definition['max_replica_burst'] ?? 0,
            'sample_rate' => $definition['sample_rate'] ?? 0.001,
            'engine' => $definition['engine'] ?? 'chromium-headless',
            'concurrency_class' => $definition['concurrency_class'] ?? 'single',
            'viewport_width' => $definition['viewport_width'] ?? 1280,
            'viewport_height' => $definition['viewport_height'] ?? 720,
            'device_scale_factor' => $definition['device_scale_factor'] ?? 1.0,
            'navigation_timeout_ms' => $definition['navigation_timeout_ms'] ?? 45000,
            'script_timeout_ms' => $definition['script_timeout_ms'] ?? 10000,
            'sandbox' => $definition['sandbox'] ?? true,
            'capture_video' => $definition['capture_video'] ?? false,
            'capture_screenshots' => $definition['capture_screenshots'] ?? true,
        ];
        
        $this->db->insert('sessions', $data);
        
        // Emit event
        $this->eventStore->emit('session.created', $sessionId, 'session', [
            'url' => $definition['url'],
            'replica_count' => $data['target_replica_count']
        ]);
        
        // Scale to target replicas if specified
        if ($data['target_replica_count'] > 0) {
            $this->scaleSession($sessionId, $data['target_replica_count']);
        }
        
        return $this->getSessionById($sessionId);
    }
    
    /**
     * Bulk create sessions
     */
    public function bulkUpsert($definitions) {
        $successes = [];
        $failures = [];
        
        $this->db->beginTransaction();
        
        try {
            foreach ($definitions as $definition) {
                try {
                    $session = $this->createSession($definition);
                    $successes[] = $session;
                } catch (Exception $e) {
                    $failures[] = [
                        'definition' => $definition,
                        'error' => $e->getMessage()
                    ];
                }
            }
            
            $this->db->commit();
            
        } catch (Exception $e) {
            $this->db->rollback();
            throw $e;
        }
        
        return [
            'successes' => $successes,
            'failures' => $failures
        ];
    }
    
    /**
     * Create bulk embeds with advanced options
     */
    public function createBulkEmbeds($request) {
        $urls = $request['urls'];
        $bulkOptions = $request['bulkOptions'] ?? [];
        $proxyRequirements = $request['proxyRequirements'] ?? [];
        $renderingOptions = $request['renderingOptions'] ?? [];
        
        $successful = [];
        $failed = [];
        $totalProcessed = 0;
        
        $this->db->beginTransaction();
        
        try {
            foreach ($urls as $url) {
                $totalProcessed++;
                
                try {
                    $definition = [
                        'url' => $url,
                        'status' => 'steady',
                        'region' => $bulkOptions['region'] ?? null,
                        'proxy_pool_id' => $proxyRequirements['poolId'] ?? DEFAULT_PROXY_POOL,
                        'target_replica_count' => $bulkOptions['replicasPerUrl'] ?? 1,
                        'concurrency_class' => $bulkOptions['concurrencyClass'] ?? 'single',
                        'viewport_width' => $renderingOptions['viewport']['width'] ?? 1280,
                        'viewport_height' => $renderingOptions['viewport']['height'] ?? 720,
                        'capture_screenshots' => $renderingOptions['captureScreenshots'] ?? true,
                    ];
                    
                    $session = $this->createSession($definition);
                    $successful[] = $session;
                    
                } catch (Exception $e) {
                    $failed[] = [
                        'url' => $url,
                        'error' => $e->getMessage()
                    ];
                }
            }
            
            $this->db->commit();
            
        } catch (Exception $e) {
            $this->db->rollback();
            throw $e;
        }
        
        return [
            'totalProcessed' => $totalProcessed,
            'successful' => $successful,
            'failed' => $failed
        ];
    }
    
    /**
     * Scale to 1 million sessions
     */
    public function scaleToMillion($targetSessions = 1000000) {
        $startTime = microtime(true);
        $currentSessions = $this->getSessionCount();
        $sessionsToCreate = max(0, $targetSessions - $currentSessions);
        
        $createdSessionIds = [];
        $failedSessionCount = 0;
        
        // Batch creation for performance
        $batchSize = 1000;
        $batches = ceil($sessionsToCreate / $batchSize);
        
        try {
            for ($i = 0; $i < $batches; $i++) {
                $count = min($batchSize, $sessionsToCreate - ($i * $batchSize));
                
                for ($j = 0; $j < $count; $j++) {
                    try {
                        $session = $this->createSession([
                            'url' => "https://example.com/site-" . ($i * $batchSize + $j),
                            'status' => 'steady',
                            'target_replica_count' => 1,
                            'concurrency_class' => 'massive'
                        ]);
                        $createdSessionIds[] = $session['id'];
                    } catch (Exception $e) {
                        $failedSessionCount++;
                    }
                }
                
                // Prevent timeout
                if ($i % 10 === 0) {
                    usleep(10000); // 10ms pause every 10 batches
                }
            }
        } catch (Exception $e) {
            error_log("Scale to million failed: " . $e->getMessage());
        }
        
        $scalingTimeMs = round((microtime(true) - $startTime) * 1000);
        $finalSessionCount = $this->getSessionCount();
        
        return [
            'targetReached' => $finalSessionCount >= $targetSessions,
            'currentSessions' => $finalSessionCount,
            'targetSessions' => $targetSessions,
            'scalingTimeMs' => $scalingTimeMs,
            'createdSessionIds' => $createdSessionIds,
            'failedSessionCount' => $failedSessionCount,
            'resourceUtilization' => $this->getResourceUtilization()
        ];
    }
    
    /**
     * Scale a specific session's replicas
     */
    public function scaleSession($sessionId, $targetReplicas) {
        try {
            $this->db->callProcedure('sp_scale_session_replicas', [
                $sessionId,
                $targetReplicas
            ]);
            
            // Emit event
            $this->eventStore->emit('session.scaled', $sessionId, 'session', [
                'target_replicas' => $targetReplicas
            ]);
            
            return true;
        } catch (Exception $e) {
            error_log("Scale session failed: " . $e->getMessage());
            throw $e;
        }
    }
    
    /**
     * Get session by ID
     */
    public function getSessionById($sessionId) {
        $sessions = $this->db->query(
            "SELECT * FROM sessions WHERE id = ?",
            [$sessionId]
        );
        
        if (empty($sessions)) {
            throw new Exception("Session not found: $sessionId");
        }
        
        return $this->formatSessionBlueprint($sessions[0]);
    }
    
    /**
     * Update session
     */
    public function updateSession($sessionId, $updates) {
        $allowedFields = [
            'status', 'region', 'proxy_pool_id', 'target_replica_count',
            'max_replica_burst', 'sample_rate'
        ];
        
        $updateData = [];
        foreach ($updates as $key => $value) {
            if (in_array($key, $allowedFields)) {
                $updateData[$key] = $value;
            }
        }
        
        if (empty($updateData)) {
            return false;
        }
        
        $this->db->update('sessions', $updateData, 'id = ?', [$sessionId]);
        
        // Emit event
        $this->eventStore->emit('session.updated', $sessionId, 'session', $updateData);
        
        return true;
    }
    
    /**
     * Delete session
     */
    public function deleteSession($sessionId) {
        // Replicas will be auto-deleted by foreign key cascade
        $this->db->delete('sessions', 'id = ?', [$sessionId]);
        
        // Emit event
        $this->eventStore->emit('session.deleted', $sessionId, 'session', []);
        
        return true;
    }
    
    /**
     * Get global metrics
     */
    public function getGlobalMetrics() {
        $metrics = $this->db->query("SELECT * FROM v_global_metrics")[0] ?? [];
        
        $statusDistribution = $this->db->query(
            "SELECT status, COUNT(*) as count 
             FROM sessions 
             GROUP BY status"
        );
        
        $replicasByRegion = $this->db->query(
            "SELECT region, COUNT(*) as count 
             FROM replicas 
             WHERE status IN ('running', 'initializing')
             GROUP BY region"
        );
        
        return [
            'totalSessions' => (int)($metrics['active_sessions'] ?? 0),
            'totalReplicas' => (int)($metrics['active_replicas'] ?? 0),
            'totalProxies' => (int)($metrics['active_proxies'] ?? 0),
            'countriesCovered' => (int)($metrics['countries_covered'] ?? 0),
            'avgLatencyMs' => (float)($metrics['avg_latency_ms'] ?? 0),
            'eventsLastHour' => (int)($metrics['events_last_hour'] ?? 0),
            'statusDistribution' => $statusDistribution,
            'replicasByRegion' => $replicasByRegion,
            'timestamp' => time()
        ];
    }
    
    /**
     * Get hypergrid snapshot
     */
    public function getHypergridSnapshot() {
        $tiles = $this->db->query(
            "SELECT * FROM hypergrid_tiles 
             WHERE updated_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
             ORDER BY x, y, z"
        );
        
        $countryStats = $this->db->query(
            "SELECT 
                p.country,
                COUNT(DISTINCT r.id) as replica_count
             FROM replicas r
             JOIN proxies p ON r.proxy_id = p.id
             WHERE r.status IN ('running', 'initializing')
             GROUP BY p.country
             ORDER BY replica_count DESC
             LIMIT 10"
        );
        
        return [
            'tiles' => array_map(function($tile) {
                $tile['session_ids'] = json_decode($tile['session_ids'] ?? '[]', true);
                $tile['snapshot_data'] = json_decode($tile['snapshot_data'] ?? '{}', true);
                return $tile;
            }, $tiles),
            'totalSessions' => $this->getSessionCount(),
            'totalReplicas' => $this->getReplicaCount(),
            'countryStats' => $countryStats,
            'timestamp' => time()
        ];
    }
    
    /**
     * Get session count
     */
    private function getSessionCount() {
        $result = $this->db->query(
            "SELECT COUNT(*) as count FROM sessions WHERE status IN ('steady', 'scaling')"
        );
        return (int)($result[0]['count'] ?? 0);
    }
    
    /**
     * Get replica count
     */
    private function getReplicaCount() {
        $result = $this->db->query(
            "SELECT COUNT(*) as count FROM replicas WHERE status IN ('running', 'initializing')"
        );
        return (int)($result[0]['count'] ?? 0);
    }
    
    /**
     * Get resource utilization
     */
    private function getResourceUtilization() {
        return [
            'cpu' => $this->getCpuUsage(),
            'memory' => $this->getMemoryUsage(),
            'disk' => $this->getDiskUsage()
        ];
    }
    
    private function getCpuUsage() {
        $load = sys_getloadavg();
        return [
            '1min' => $load[0],
            '5min' => $load[1],
            '15min' => $load[2]
        ];
    }
    
    private function getMemoryUsage() {
        return [
            'used' => memory_get_usage(true),
            'peak' => memory_get_peak_usage(true),
            'limit' => ini_get('memory_limit')
        ];
    }
    
    private function getDiskUsage() {
        return [
            'free' => disk_free_space('.'),
            'total' => disk_total_space('.')
        ];
    }
    
    /**
     * Format session blueprint for API response
     */
    private function formatSessionBlueprint($session) {
        return [
            'id' => $session['id'],
            'definition' => [
                'url' => $session['url'],
                'region' => $session['region'],
                'proxy_pool_id' => $session['proxy_pool_id'],
                'target_replica_count' => (int)$session['target_replica_count'],
                'engine' => $session['engine'],
                'concurrency_class' => $session['concurrency_class'],
                'viewport' => [
                    'width' => (int)$session['viewport_width'],
                    'height' => (int)$session['viewport_height'],
                    'deviceScaleFactor' => (float)$session['device_scale_factor']
                ],
                'timeouts' => [
                    'navigation' => (int)$session['navigation_timeout_ms'],
                    'script' => (int)$session['script_timeout_ms']
                ],
                'capture' => [
                    'video' => (bool)$session['capture_video'],
                    'screenshots' => (bool)$session['capture_screenshots']
                ]
            ],
            'status' => $session['status'],
            'current_replica_count' => (int)$session['current_replica_count'],
            'created_at' => $session['created_at'],
            'updated_at' => $session['updated_at']
        ];
    }
}

/**
 * Event Store for event sourcing
 */
class EventStore {
    private $db;
    
    public function __construct() {
        $this->db = DatabaseManager::getInstance();
    }
    
    public function emit($eventType, $aggregateId, $aggregateType, $payload, $metadata = []) {
        $eventId = $this->db->uuid();
        
        $this->db->insert('events', [
            'id' => $eventId,
            'event_type' => $eventType,
            'aggregate_id' => $aggregateId,
            'aggregate_type' => $aggregateType,
            'payload' => json_encode($payload, JSON_OPTIONS),
            'metadata' => json_encode($metadata, JSON_OPTIONS),
            'vector_clock' => json_encode(['node' => gethostname(), 'clock' => time()], JSON_OPTIONS)
        ]);
        
        return $eventId;
    }
    
    public function getEvents($filters = []) {
        $where = [];
        $params = [];
        
        if (!empty($filters['aggregate_id'])) {
            $where[] = "aggregate_id = ?";
            $params[] = $filters['aggregate_id'];
        }
        
        if (!empty($filters['event_type'])) {
            $where[] = "event_type = ?";
            $params[] = $filters['event_type'];
        }
        
        if (!empty($filters['since'])) {
            $where[] = "timestamp >= ?";
            $params[] = $filters['since'];
        }
        
        $whereClause = !empty($where) ? implode(' AND ', $where) : '1=1';
        
        return $this->db->query(
            "SELECT * FROM events WHERE $whereClause ORDER BY timestamp DESC LIMIT 1000",
            $params
        );
    }
}
