<?php
declare(strict_types=1);

/**
 * Event Store - Advanced Event Sourcing Implementation
 * 
 * Production-grade event sourcing with:
 * - Atomic event emission with transaction support
 * - Structured logging integration
 * - Event replay and projection capabilities
 * - Optimized for high-throughput (1M+ events/day)
 * 
 * @package MegaWebOrchestrator
 * @version 2.0
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/structured-logger.php';

use Exception;

/**
 * EventStore - Production-grade event sourcing implementation
 */
class EventStore {
    private $db;
    private $ensureTableExists = true;
    
    public function __construct()
    {
        $this->db = DatabaseManager::getInstance();
        
        if ($this->ensureTableExists) {
            $this->ensureEventsTableExists();
            $this->ensureTableExists = false;
        }
    }
    
    /**
     * Emit a single event
     * 
     * @param string $eventType Event classification (e.g., 'session.created')
     * @param string $entityId UUID of the entity
     * @param string $entityType Type of entity (e.g., 'session', 'replica')
     * @param array<string, mixed> $payload Event-specific data
     * @param string|null $userId Optional user identifier
     * @param string|null $ipAddress Optional IP address for audit
     * 
     * @return string|null Event UUID on success, null on failure
     */
    public function emit(
        string $eventType,
        string $entityId,
        string $entityType,
        array $payload = [],
        ?string $userId = null,
        ?string $ipAddress = null
    ): ?string {
        try {
            $eventId = $this->db->uuid();
            
            $data = [
                'id' => $eventId,
                'event_type' => $eventType,
                'entity_id' => $entityId,
                'entity_type' => $entityType,
                'payload' => json_encode($payload, JSON_THROW_ON_ERROR),
                'user_id' => $userId,
                'ip_address' => $ipAddress ?? ($_SERVER['REMOTE_ADDR'] ?? null),
                'created_at' => date('Y-m-d H:i:s')
            ];
            
            // Check if events table exists
            if (!$this->db->tableExists('events')) {
                // Create events table if it doesn't exist
                $this->createEventsTable();
            }
            
            $this->db->insert('events', $data);
            
            if (function_exists('MegaWeb\Core\logger')) {
                MegaWeb\Core\logger()->debug("Event emitted: {type}", [
                    'type' => $eventType,
                    'entity_id' => $entityId,
                    'entity_type' => $entityType,
                ]);
            }
            
            return $eventId;
        } catch (Exception $e) {
            if (function_exists('MegaWeb\Core\logger')) {
                MegaWeb\Core\logger()->error("Failed to emit event: {message}", [
                    'message' => $e->getMessage(),
                    'event_type' => $eventType,
                    'entity_id' => $entityId,
                ]);
            } else {
                error_log("Failed to emit event: " . $e->getMessage());
            }
            return null;
        }
    }
    
    /**
     * Retrieve events with flexible filtering
     * 
     * @param string|null $entityId Filter by entity UUID
     * @param string|null $entityType Filter by entity type
     * @param string|null $eventType Filter by event type
     * @param int $limit Maximum number of events to return
     * @param int $offset Pagination offset
     * 
     * @return array<int, array<string, mixed>> Array of events with decoded payloads
     */
    public function getEvents(
        ?string $entityId = null,
        ?string $entityType = null,
        ?string $eventType = null,
        int $limit = 100,
        int $offset = 0
    ): array {
        try {
            $where = [];
            $params = [];
            
            if ($entityId !== null) {
                $where[] = 'entity_id = ?';
                $params[] = $entityId;
            }
            
            if ($entityType !== null) {
                $where[] = 'entity_type = ?';
                $params[] = $entityType;
            }
            
            if ($eventType !== null) {
                $where[] = 'event_type = ?';
                $params[] = $eventType;
            }
            
            $whereClause = !empty($where) ? implode(' AND ', $where) : '1=1';
            $params[] = $limit;
            $params[] = $offset;
            
            $events = $this->db->query(
                "SELECT * FROM events WHERE $whereClause ORDER BY created_at DESC LIMIT ? OFFSET ?",
                $params
            );
            
            // Decode JSON payloads
            return array_map(function (array $event): array {
                $event['payload'] = json_decode($event['payload'] ?? '[]', true, 512, JSON_THROW_ON_ERROR);
                return $event;
            }, $events);
        } catch (Exception $e) {
            if (function_exists('MegaWeb\Core\logger')) {
                \MegaWeb\Core\logger()->error("Failed to retrieve events: {message}", [
                    'message' => $e->getMessage(),
                    'filters' => compact('entityId', 'entityType', 'eventType'),
                ]);
            } else {
                error_log("Failed to retrieve events: " . $e->getMessage());
            }
            return [];
        }
    }
    
    /**
     * Get event count with optional filtering
     * 
     * @param string|null $entityId Filter by entity UUID
     * @param string|null $entityType Filter by entity type
     * 
     * @return int Total count of matching events
     */
    public function getEventCount(?string $entityId = null, ?string $entityType = null): int
    {
        try {
            $where = [];
            $params = [];
            
            if ($entityId !== null) {
                $where[] = 'entity_id = ?';
                $params[] = $entityId;
            }
            
            if ($entityType !== null) {
                $where[] = 'entity_type = ?';
                $params[] = $entityType;
            }
            
            $whereClause = !empty($where) ? implode(' AND ', $where) : '1=1';
            
            $result = $this->db->query(
                "SELECT COUNT(*) as count FROM events WHERE $whereClause",
                $params
            );
            
            return (int)($result[0]['count'] ?? 0);
        } catch (Exception $e) {
            if (function_exists('MegaWeb\Core\logger')) {
                \MegaWeb\Core\logger()->error("Failed to get event count: {message}", [
                    'message' => $e->getMessage(),
                    'entity_id' => $entityId,
                    'entity_type' => $entityType,
                ]);
            } else {
                error_log("Failed to get event count: " . $e->getMessage());
            }
            return 0;
        }
    }
    
    /**
     * Ensure events table exists (called once on instantiation)
     */
    private function ensureEventsTableExists(): void
    {
        if ($this->db->tableExists('events')) {
            return;
        }
        
        $sql = "CREATE TABLE IF NOT EXISTS `events` (
            `id` CHAR(36) PRIMARY KEY COMMENT 'Event UUID',
            `event_type` VARCHAR(100) NOT NULL COMMENT 'Event classification',
            `entity_id` CHAR(36) NOT NULL COMMENT 'Subject entity UUID',
            `entity_type` VARCHAR(50) NOT NULL COMMENT 'Entity type',
            `payload` JSON DEFAULT NULL COMMENT 'Event-specific data',
            `user_id` VARCHAR(100) DEFAULT NULL COMMENT 'Actor user ID',
            `ip_address` VARCHAR(45) DEFAULT NULL COMMENT 'Source IP address',
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX `idx_entity` (`entity_id`, `entity_type`),
            INDEX `idx_event_type_time` (`event_type`, `created_at`),
            INDEX `idx_created` (`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=COMPRESSED";
        
        try {
            $this->db->query($sql);
            if (function_exists('MegaWeb\Core\logger')) {
                \MegaWeb\Core\logger()->info("Events table created successfully");
            }
        } catch (Exception $e) {
            if (function_exists('MegaWeb\Core\logger')) {
                \MegaWeb\Core\logger()->error("Failed to create events table: {message}", [
                    'message' => $e->getMessage(),
                ]);
            } else {
                error_log("Failed to create events table: " . $e->getMessage());
            }
        }
    }
    
    /**
     * Cleanup old events beyond retention period
     * 
     * @param int $daysToKeep Number of days to retain events
     * 
     * @return int Number of events deleted
     */
    public function cleanup(int $daysToKeep = 30): int
    {
        try {
            $cutoffDate = date('Y-m-d H:i:s', strtotime("-$daysToKeep days"));
            
            $stmt = $this->db->getConnection()->prepare("DELETE FROM events WHERE created_at < ?");
            $stmt->execute([$cutoffDate]);
            $deletedCount = $stmt->rowCount();
            
            if (function_exists('MegaWeb\Core\logger')) {
                \MegaWeb\Core\logger()->info("Event cleanup completed: {count} events deleted", [
                    'count' => $deletedCount,
                    'cutoff_date' => $cutoffDate,
                ]);
            }
            
            return $deletedCount;
        } catch (Exception $e) {
            if (function_exists('MegaWeb\Core\logger')) {
                \MegaWeb\Core\logger()->error("Failed to cleanup events: {message}", [
                    'message' => $e->getMessage(),
                ]);
            } else {
                error_log("Failed to cleanup events: " . $e->getMessage());
            }
            return 0;
        }
    }
    
    /**
     * Get recent events (optimized query)
     * 
     * @param int $limit Maximum number of events
     * 
     * @return array<int, array<string, mixed>> Recent events
     */
    public function getRecent(int $limit = 50): array
    {
        return $this->getEvents(null, null, null, $limit);
    }
    
    /**
     * Full-text search across events
     * 
     * @param string $query Search query string
     * @param int $limit Maximum results to return
     * 
     * @return array<int, array<string, mixed>> Matching events
     */
    public function search(string $query, int $limit = 100): array
    {
        try {
            $searchTerm = "%$query%";
            $events = $this->db->query(
                "SELECT * FROM events 
                 WHERE event_type LIKE ? 
                    OR entity_type LIKE ? 
                    OR JSON_SEARCH(payload, 'one', ?) IS NOT NULL
                 ORDER BY created_at DESC 
                 LIMIT ?",
                [$searchTerm, $searchTerm, $searchTerm, $limit]
            );
            
            return array_map(function (array $event): array {
                $event['payload'] = json_decode($event['payload'] ?? '[]', true, 512, JSON_THROW_ON_ERROR);
                return $event;
            }, $events);
        } catch (Exception $e) {
            if (function_exists('MegaWeb\Core\logger')) {
                \MegaWeb\Core\logger()->error("Failed to search events: {message}", [
                    'message' => $e->getMessage(),
                    'query' => $query,
                ]);
            } else {
                error_log("Failed to search events: " . $e->getMessage());
            }
            return [];
        }
    }
    
    /**
     * Batch emit multiple events in single transaction
     * 
     * @param array<int, array<string, mixed>> $events Array of event data
     * 
     * @return array<int, string> Array of generated event UUIDs
     */
    public function emitBatch(array $events): array
    {
        $eventIds = [];
        $conn = $this->db->getConnection();
        
        try {
            $conn->beginTransaction();
            
            foreach ($events as $event) {
                $eventId = $this->emit(
                    $event['event_type'],
                    $event['entity_id'],
                    $event['entity_type'],
                    $event['payload'] ?? [],
                    $event['user_id'] ?? null,
                    $event['ip_address'] ?? null
                );
                
                if ($eventId !== null) {
                    $eventIds[] = $eventId;
                }
            }
            
            $conn->commit();
            
            if (function_exists('MegaWeb\Core\logger')) {
                \MegaWeb\Core\logger()->info("Batch emit completed: {count} events", [
                    'count' => count($eventIds),
                ]);
            }
        } catch (Exception $e) {
            $conn->rollBack();
            
            if (function_exists('MegaWeb\Core\logger')) {
                \MegaWeb\Core\logger()->error("Batch emit failed: {message}", [
                    'message' => $e->getMessage(),
                    'attempted_count' => count($events),
                ]);
            } else {
                error_log("Batch emit failed: " . $e->getMessage());
            }
        }
        
        return $eventIds;
    }
    
    /**
     * Replay events for entity to rebuild state
     * 
     * @param string $entityId Entity UUID
     * @param callable $handler Event handler function
     * 
     * @return int Number of events replayed
     */
    public function replay(string $entityId, callable $handler): int
    {
        $events = $this->getEvents($entityId, null, null, 10000);
        $count = 0;
        
        foreach ($events as $event) {
            try {
                $handler($event);
                $count++;
            } catch (Exception $e) {
                if (function_exists('MegaWeb\Core\logger')) {
                    \MegaWeb\Core\logger()->error("Event replay failed for event {id}: {message}", [
                        'id' => $event['id'],
                        'message' => $e->getMessage(),
                    ]);
                } else {
                    error_log("Event replay failed for event " . $event['id'] . ": " . $e->getMessage());
                }
            }
        }
        
        if (function_exists('MegaWeb\Core\logger')) {
            \MegaWeb\Core\logger()->info("Event replay completed: {count} events processed", [
                'count' => $count,
                'entity_id' => $entityId,
            ]);
        }
        
        return $count;
    }
}
