<?php
/**
 * MegaWeb Orchestrator - REST API Router
 * Advanced RESTful API for orchestration
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../includes/database.php';
require_once __DIR__ . '/../includes/orchestrator.php';
require_once __DIR__ . '/../includes/custom-proxy-engine.php';

class APIRouter {
    private $orchestrator;
    private $method;
    private $path;
    private $requestData;
    
    public function __construct() {
        $this->orchestrator = new HyperOrchestrator();
        $this->method = $_SERVER['REQUEST_METHOD'];
        $this->path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
        $this->requestData = $this->getRequestData();
        
        // Set CORS headers
        $this->setCorsHeaders();
        
        // Handle OPTIONS request
        if ($this->method === 'OPTIONS') {
            http_response_code(200);
            exit;
        }
    }
    
    private function setCorsHeaders() {
        header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
        header('Access-Control-Allow-Methods: ' . CORS_ALLOWED_METHODS);
        header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);
        header('Content-Type: application/json; charset=utf-8');
    }
    
    private function getRequestData() {
        $data = file_get_contents('php://input');
        return json_decode($data, true) ?? [];
    }
    
    public function route() {
        try {
            // Remove /api prefix if present
            $path = preg_replace('#^/api#', '', $this->path);
            
            // Route to appropriate handler
            if ($path === '/sessions' && $this->method === 'GET') {
                return $this->getSessions();
            }
            
            if ($path === '/sessions' && $this->method === 'POST') {
                return $this->createSession();
            }
            
            if (preg_match('#^/sessions/([a-f0-9-]+)$#', $path, $matches) && $this->method === 'GET') {
                return $this->getSession($matches[1]);
            }
            
            if (preg_match('#^/sessions/([a-f0-9-]+)$#', $path, $matches) && $this->method === 'PUT') {
                return $this->updateSession($matches[1]);
            }
            
            if (preg_match('#^/sessions/([a-f0-9-]+)$#', $path, $matches) && $this->method === 'DELETE') {
                return $this->deleteSession($matches[1]);
            }
            
            if (preg_match('#^/sessions/([a-f0-9-]+)/scale$#', $path, $matches) && $this->method === 'POST') {
                return $this->scaleSession($matches[1]);
            }
            
            if ($path === '/sessions/batch' && $this->method === 'POST') {
                return $this->batchCreateSessions();
            }
            
            if ($path === '/embed/bulk' && $this->method === 'POST') {
                return $this->bulkEmbed();
            }
            
            if ($path === '/embed/scale-million' && $this->method === 'POST') {
                return $this->scaleToMillion();
            }
            
            if ($path === '/metrics/global' && $this->method === 'GET') {
                return $this->getGlobalMetrics();
            }
            
            if ($path === '/hypergrid' && $this->method === 'GET') {
                return $this->getHypergrid();
            }
            
            if ($path === '/events' && $this->method === 'GET') {
                return $this->getEvents();
            }
            
            if ($path === '/proxies' && $this->method === 'GET') {
                return $this->getProxies();
            }
            
            if ($path === '/proxies' && $this->method === 'POST') {
                return $this->createCustomProxyConnection();
            }
            
            if (preg_match('#^/proxies/connections/([^/]+)$#', $path, $matches) && $this->method === 'GET') {
                return $this->getConnectionStats($matches[1]);
            }
            
            if (preg_match('#^/proxies/connections/([^/]+)/execute$#', $path, $matches) && $this->method === 'POST') {
                return $this->executeProxyRequest($matches[1]);
            }
            
            if (preg_match('#^/proxies/connections/([^/]+)/rotate$#', $path, $matches) && $this->method === 'POST') {
                return $this->rotateConnectionIp($matches[1]);
            }
            
            if (preg_match('#^/proxies/connections/([^/]+)/close$#', $path, $matches) && $this->method === 'POST') {
                return $this->closeProxyConnection($matches[1]);
            }
            
            if ($path === '/proxies/connections' && $this->method === 'GET') {
                return $this->getActiveConnections();
            }
            
            if ($path === '/proxies/servers' && $this->method === 'POST') {
                return $this->addProxyServer();
            }
            
            if ($path === '/proxies/ip-pool' && $this->method === 'POST') {
                return $this->addIpToPool();
            }
            
            if ($path === '/proxies/ip-pool' && $this->method === 'GET') {
                return $this->getIpPoolStats();
            }
            
            if ($path === '/health' && $this->method === 'GET') {
                return $this->healthCheck();
            }
            
            // Not found
            $this->sendResponse(['error' => 'Endpoint not found'], 404);
            
        } catch (Exception $e) {
            $this->handleException($e);
        }
    }
    
    private function getSessions() {
        $filters = [
            'status' => $_GET['status'] ?? null,
            'region' => $_GET['region'] ?? null,
            'proxy_pool_id' => $_GET['proxy_pool_id'] ?? null
        ];
        
        $blueprints = $this->orchestrator->getBlueprintSnapshot(array_filter($filters));
        
        $this->sendResponse([
            'sessions' => array_map(function($bp) {
                return $bp['definition'];
            }, $blueprints),
            'blueprints' => $blueprints,
            'total' => count($blueprints)
        ]);
    }
    
    private function createSession() {
        if (empty($this->requestData['url'])) {
            $this->sendResponse(['error' => 'URL is required'], 400);
        }
        
        $session = $this->orchestrator->createSession($this->requestData);
        $this->sendResponse($session, 201);
    }
    
    private function getSession($sessionId) {
        try {
            $session = $this->orchestrator->getSessionById($sessionId);
            $this->sendResponse($session);
        } catch (Exception $e) {
            $this->sendResponse(['error' => 'Session not found'], 404);
        }
    }
    
    private function updateSession($sessionId) {
        $updated = $this->orchestrator->updateSession($sessionId, $this->requestData);
        
        if ($updated) {
            $session = $this->orchestrator->getSessionById($sessionId);
            $this->sendResponse($session);
        } else {
            $this->sendResponse(['error' => 'No valid fields to update'], 400);
        }
    }
    
    private function deleteSession($sessionId) {
        $this->orchestrator->deleteSession($sessionId);
        $this->sendResponse(['success' => true, 'id' => $sessionId]);
    }
    
    private function scaleSession($sessionId) {
        $targetReplicas = $this->requestData['target_replicas'] ?? 1;
        $this->orchestrator->scaleSession($sessionId, $targetReplicas);
        
        $session = $this->orchestrator->getSessionById($sessionId);
        $this->sendResponse($session);
    }
    
    private function batchCreateSessions() {
        $definitions = $this->requestData;
        
        if (!is_array($definitions) || count($definitions) === 0) {
            $this->sendResponse(['error' => 'Payload must contain session definitions'], 400);
        }
        
        if (count($definitions) > MAX_BULK_OPERATIONS) {
            $this->sendResponse(['error' => 'Batch limit exceeded'], 400);
        }
        
        $result = $this->orchestrator->bulkUpsert($definitions);
        
        $this->sendResponse([
            'created' => $result['successes'],
            'failed' => $result['failures'],
            'total' => count($definitions),
            'success_count' => count($result['successes']),
            'failure_count' => count($result['failures'])
        ]);
    }
    
    private function bulkEmbed() {
        $urls = $this->requestData['urls'] ?? [];
        
        if (!is_array($urls) || count($urls) === 0) {
            $this->sendResponse(['error' => 'urls must be a non-empty array'], 400);
        }
        
        $startTime = microtime(true);
        
        $result = $this->orchestrator->createBulkEmbeds($this->requestData);
        
        $this->sendResponse([
            'totalProcessed' => $result['totalProcessed'],
            'createdSessionIds' => array_map(function($s) {
                return $s['id'];
            }, $result['successful']),
            'failedEntries' => array_map(function($f) {
                return [
                    'url' => $f['url'],
                    'reason' => $f['error']
                ];
            }, $result['failed']),
            'processingTimeMs' => round((microtime(true) - $startTime) * 1000)
        ]);
    }
    
    private function scaleToMillion() {
        $targetSessions = $this->requestData['targetSessions'] ?? 1000000;
        
        $result = $this->orchestrator->scaleToMillion($targetSessions);
        
        $this->sendResponse([
            'targetReached' => $result['targetReached'],
            'currentSessions' => $result['currentSessions'],
            'targetSessions' => $targetSessions,
            'scalingTimeMs' => $result['scalingTimeMs'],
            'failedSessionCount' => $result['failedSessionCount'],
            'resourceUtilization' => $result['resourceUtilization']
        ]);
    }
    
    private function getGlobalMetrics() {
        $metrics = $this->orchestrator->getGlobalMetrics();
        $this->sendResponse($metrics);
    }
    
    private function getHypergrid() {
        $hypergrid = $this->orchestrator->getHypergridSnapshot();
        $this->sendResponse($hypergrid);
    }
    
    private function getEvents() {
        $eventStore = new EventStore();
        $filters = [
            'aggregate_id' => $_GET['aggregate_id'] ?? null,
            'event_type' => $_GET['event_type'] ?? null,
            'since' => $_GET['since'] ?? null
        ];
        
        $events = $eventStore->getEvents(array_filter($filters));
        
        $this->sendResponse([
            'events' => $events,
            'total' => count($events)
        ]);
    }
    
    private function getProxies() {
        $db = DatabaseManager::getInstance();
        $proxies = $db->query("SELECT * FROM v_proxy_performance ORDER BY success_rate DESC");
        
        $this->sendResponse([
            'proxies' => $proxies,
            'total' => count($proxies)
        ]);
    }
    
    private function createCustomProxyConnection() {
        $targetUrl = $this->requestData['target_url'] ?? null;
        
        if (!$targetUrl) {
            $this->sendResponse(['error' => 'target_url is required'], 400);
        }
        
        $options = [
            'protocol' => $this->requestData['protocol'] ?? 'https',
            'encryption' => $this->requestData['encryption'] ?? 'tls1.3',
            'ip_rotation' => $this->requestData['ip_rotation'] ?? true,
            'tunnel_type' => $this->requestData['tunnel_type'] ?? 'dynamic',
            'geo_target' => $this->requestData['geo_target'] ?? null,
            'anonymity_level' => $this->requestData['anonymity_level'] ?? 'elite',
            'hop_count' => $this->requestData['hop_count'] ?? 5,
            'timeout' => $this->requestData['timeout'] ?? 30,
            'retry_strategy' => $this->requestData['retry_strategy'] ?? 'exponential',
            'max_retries' => $this->requestData['max_retries'] ?? 3,
            'custom_headers' => $this->requestData['custom_headers'] ?? []
        ];
        
        try {
            $proxyEngine = new CustomProxyEngine();
            $connection = $proxyEngine->createProxyConnection($targetUrl, $options);
            
            $this->sendResponse([
                'connection_id' => $connection['id'],
                'status' => $connection['status'],
                'route' => [
                    'source_ip' => $connection['route']['source_ip'],
                    'hop_count' => count($connection['route']['tunnel_chain']),
                    'encryption_layers' => count($connection['route']['encryption_layers'])
                ],
                'success' => true
            ], 201);
        } catch (Exception $e) {
            $this->sendResponse(['error' => $e->getMessage()], 500);
        }
    }
    
    private function getConnectionStats($connectionId) {
        try {
            $proxyEngine = new CustomProxyEngine();
            $stats = $proxyEngine->getConnectionStats($connectionId);
            $this->sendResponse($stats);
        } catch (Exception $e) {
            $this->sendResponse(['error' => $e->getMessage()], 404);
        }
    }
    
    private function executeProxyRequest($connectionId) {
        $method = $this->requestData['method'] ?? 'GET';
        $url = $this->requestData['url'] ?? null;
        $data = $this->requestData['data'] ?? null;
        $headers = $this->requestData['headers'] ?? [];
        
        if (!$url) {
            $this->sendResponse(['error' => 'url is required'], 400);
        }
        
        try {
            $proxyEngine = new CustomProxyEngine();
            $response = $proxyEngine->executeRequest($connectionId, $method, $url, $data, $headers);
            
            $this->sendResponse([
                'response' => $response,
                'success' => true
            ]);
        } catch (Exception $e) {
            $this->sendResponse(['error' => $e->getMessage()], 500);
        }
    }
    
    private function rotateConnectionIp($connectionId) {
        try {
            $proxyEngine = new CustomProxyEngine();
            $result = $proxyEngine->rotateIpAddress($connectionId);
            
            $this->sendResponse([
                'success' => $result,
                'connection_id' => $connectionId,
                'message' => 'IP address rotated successfully'
            ]);
        } catch (Exception $e) {
            $this->sendResponse(['error' => $e->getMessage()], 500);
        }
    }
    
    private function closeProxyConnection($connectionId) {
        try {
            $proxyEngine = new CustomProxyEngine();
            $result = $proxyEngine->closeConnection($connectionId);
            
            $this->sendResponse([
                'success' => $result,
                'connection_id' => $connectionId,
                'message' => 'Connection closed successfully'
            ]);
        } catch (Exception $e) {
            $this->sendResponse(['error' => $e->getMessage()], 500);
        }
    }
    
    private function getActiveConnections() {
        try {
            $proxyEngine = new CustomProxyEngine();
            $connections = $proxyEngine->getActiveConnections();
            
            $this->sendResponse([
                'connections' => $connections,
                'total' => count($connections)
            ]);
        } catch (Exception $e) {
            $this->sendResponse(['error' => $e->getMessage()], 500);
        }
    }
    
    private function addProxyServer() {
        $db = DatabaseManager::getInstance();
        
        $required = ['server_ip', 'port'];
        foreach ($required as $field) {
            if (empty($this->requestData[$field])) {
                $this->sendResponse(['error' => "$field is required"], 400);
            }
        }
        
        $serverId = $db->uuid();
        
        $data = [
            'id' => $serverId,
            'server_ip' => $this->requestData['server_ip'],
            'port' => $this->requestData['port'],
            'protocol' => $this->requestData['protocol'] ?? 'socks5',
            'region' => $this->requestData['region'] ?? null,
            'country' => $this->requestData['country'] ?? null,
            'max_connections' => $this->requestData['max_connections'] ?? 1000,
            'priority' => $this->requestData['priority'] ?? 100,
            'server_type' => $this->requestData['server_type'] ?? 'exit',
            'encryption_support' => json_encode($this->requestData['encryption_support'] ?? ['tls1.3', 'aes256-gcm']),
            'tunnel_protocols' => json_encode($this->requestData['tunnel_protocols'] ?? ['socks5', 'http', 'https']),
            'bandwidth_capacity_mbps' => $this->requestData['bandwidth_capacity_mbps'] ?? 1000,
            'active' => true
        ];
        
        $db->insert('custom_proxy_servers', $data);
        
        $this->sendResponse(['id' => $serverId, 'success' => true], 201);
    }
    
    private function addIpToPool() {
        $db = DatabaseManager::getInstance();
        
        $required = ['ip_address'];
        foreach ($required as $field) {
            if (empty($this->requestData[$field])) {
                $this->sendResponse(['error' => "$field is required"], 400);
            }
        }
        
        $ipId = $db->uuid();
        
        $data = [
            'id' => $ipId,
            'ip_address' => $this->requestData['ip_address'],
            'subnet' => $this->requestData['subnet'] ?? '255.255.255.0',
            'gateway' => $this->requestData['gateway'] ?? null,
            'country' => $this->requestData['country'] ?? null,
            'region' => $this->requestData['region'] ?? null,
            'city' => $this->requestData['city'] ?? null,
            'isp' => $this->requestData['isp'] ?? 'Custom Infrastructure',
            'asn' => $this->requestData['asn'] ?? null,
            'reputation_score' => $this->requestData['reputation_score'] ?? 100.00,
            'allocation_type' => $this->requestData['allocation_type'] ?? 'dynamic',
            'available' => true
        ];
        
        $db->insert('dynamic_ip_pool', $data);
        
        $this->sendResponse(['id' => $ipId, 'success' => true], 201);
    }
    
    private function getIpPoolStats() {
        $db = DatabaseManager::getInstance();
        
        $stats = $db->query(
            "SELECT 
                COUNT(*) as total_ips,
                SUM(CASE WHEN available = TRUE THEN 1 ELSE 0 END) as available_ips,
                SUM(CASE WHEN blacklist_status = 'clean' THEN 1 ELSE 0 END) as clean_ips,
                AVG(reputation_score) as avg_reputation,
                COUNT(DISTINCT country) as countries_covered,
                SUM(usage_count) as total_usage
             FROM dynamic_ip_pool"
        );
        
        $byCountry = $db->query(
            "SELECT country, COUNT(*) as count
             FROM dynamic_ip_pool
             WHERE available = TRUE
             GROUP BY country
             ORDER BY count DESC
             LIMIT 10"
        );
        
        $this->sendResponse([
            'stats' => $stats[0] ?? [],
            'by_country' => $byCountry
        ]);
    }
    
    private function healthCheck() {
        $db = DatabaseManager::getInstance();
        
        try {
            $db->query("SELECT 1");
            $dbStatus = 'healthy';
        } catch (Exception $e) {
            $dbStatus = 'unhealthy';
        }
        
        // Check proxy infrastructure
        $proxyServers = $db->query("SELECT COUNT(*) as count FROM custom_proxy_servers WHERE active = TRUE");
        $ipPool = $db->query("SELECT COUNT(*) as count FROM dynamic_ip_pool WHERE available = TRUE");
        
        $this->sendResponse([
            'status' => $dbStatus === 'healthy' ? 'healthy' : 'unhealthy',
            'database' => $dbStatus,
            'proxy_servers' => $proxyServers[0]['count'] ?? 0,
            'available_ips' => $ipPool[0]['count'] ?? 0,
            'timestamp' => time(),
            'version' => '2.0.0',
            'engine' => 'CustomProxyEngine'
        ]);
    }
    
    private function sendResponse($data, $code = 200) {
        http_response_code($code);
        echo json_encode($data, JSON_OPTIONS);
        exit;
    }
    
    private function handleException($e) {
        error_log("API Error: " . $e->getMessage());
        
        $this->sendResponse([
            'error' => 'Internal server error',
            'message' => APP_DEBUG ? $e->getMessage() : 'An error occurred',
            'trace' => APP_DEBUG ? $e->getTraceAsString() : null
        ], 500);
    }
}

// Initialize and route
$router = new APIRouter();
$router->route();
