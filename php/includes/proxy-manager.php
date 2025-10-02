<?php
/**
 * MegaWeb Orchestrator - Advanced Proxy Manager
 * Multi-country proxy pool management with auto-rotation
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/database.php';

class ProxyPoolManager {
    private $db;
    
    public function __construct() {
        $this->db = DatabaseManager::getInstance();
    }
    
    /**
     * Get next available proxy with load balancing
     */
    public function getNextProxy($poolId = 'global-pool', $country = null, $region = null) {
        $where = ['pool_id = ?', 'active = TRUE'];
        $params = [$poolId];
        
        if ($country) {
            $where[] = 'country = ?';
            $params[] = $country;
        }
        
        if ($region) {
            $where[] = 'region = ?';
            $params[] = $region;
        }
        
        // Get least recently used proxy
        $proxies = $this->db->query(
            "SELECT * FROM proxies 
             WHERE " . implode(' AND ', $where) . "
             ORDER BY last_used_at ASC, success_count DESC
             LIMIT 1",
            $params
        );
        
        if (empty($proxies)) {
            throw new Exception("No available proxies in pool: $poolId");
        }
        
        $proxy = $proxies[0];
        
        // Update last used time
        $this->db->update('proxies', 
            ['last_used_at' => date('Y-m-d H:i:s')],
            'id = ?',
            [$proxy['id']]
        );
        
        return $proxy;
    }
    
    /**
     * Get proxy with round-robin rotation
     */
    public function getProxyRoundRobin($poolId = 'global-pool') {
        return $this->getNextProxy($poolId);
    }
    
    /**
     * Get sticky proxy (same for session)
     */
    public function getStickyProxy($sessionId, $poolId = 'global-pool') {
        // Check if session already has a proxy
        $existing = $this->db->query(
            "SELECT p.* FROM replicas r
             JOIN proxies p ON r.proxy_id = p.id
             WHERE r.session_id = ? AND p.pool_id = ? AND p.active = TRUE
             LIMIT 1",
            [$sessionId, $poolId]
        );
        
        if (!empty($existing)) {
            return $existing[0];
        }
        
        // Assign new proxy
        return $this->getNextProxy($poolId);
    }
    
    /**
     * Get burst proxies (multiple for high-throughput)
     */
    public function getBurstProxies($count, $poolId = 'global-pool', $country = null) {
        $proxies = [];
        
        for ($i = 0; $i < $count; $i++) {
            try {
                $proxies[] = $this->getNextProxy($poolId, $country);
            } catch (Exception $e) {
                break;
            }
        }
        
        return $proxies;
    }
    
    /**
     * Create proxy pool
     */
    public function createPool($poolName, $regions = [], $countries = [], $rotationStrategy = 'round-robin') {
        $poolId = $this->generatePoolId($poolName);
        
        $this->db->insert('proxy_pools', [
            'id' => $poolId,
            'pool_name' => $poolName,
            'regions' => json_encode($regions),
            'countries' => json_encode($countries),
            'rotation_strategy' => $rotationStrategy,
            'rotation_seconds' => PROXY_ROTATION_SECONDS,
            'failover_pool_ids' => json_encode([]),
            'active' => true,
            'total_proxies' => 0
        ]);
        
        return $poolId;
    }
    
    /**
     * Add proxy to pool
     */
    public function addProxy($poolId, $host, $port, $options = []) {
        $proxyId = $this->db->uuid();
        
        $data = [
            'id' => $proxyId,
            'pool_id' => $poolId,
            'host' => $host,
            'port' => $port,
            'protocol' => $options['protocol'] ?? 'http',
            'username' => $options['username'] ?? null,
            'password' => $options['password'] ?? null,
            'country' => $options['country'] ?? null,
            'region' => $options['region'] ?? null,
            'city' => $options['city'] ?? null,
            'latitude' => $options['latitude'] ?? null,
            'longitude' => $options['longitude'] ?? null,
            'active' => true
        ];
        
        $this->db->insert('proxies', $data);
        
        // Update pool total count
        $this->db->query(
            "UPDATE proxy_pools SET total_proxies = total_proxies + 1 WHERE id = ?",
            [$poolId]
        );
        
        return $proxyId;
    }
    
    /**
     * Bulk add proxies from array
     */
    public function bulkAddProxies($poolId, $proxies) {
        $added = 0;
        $failed = 0;
        
        foreach ($proxies as $proxy) {
            try {
                $this->addProxy(
                    $poolId,
                    $proxy['host'],
                    $proxy['port'],
                    $proxy
                );
                $added++;
            } catch (Exception $e) {
                $failed++;
            }
        }
        
        return [
            'added' => $added,
            'failed' => $failed
        ];
    }
    
    /**
     * Mark proxy as failed
     */
    public function markProxyFailed($proxyId) {
        $this->db->query(
            "UPDATE proxies SET failure_count = failure_count + 1 WHERE id = ?",
            [$proxyId]
        );
        
        // Deactivate if failure rate too high
        $proxy = $this->db->query("SELECT * FROM proxies WHERE id = ?", [$proxyId])[0];
        $totalAttempts = $proxy['success_count'] + $proxy['failure_count'];
        $failureRate = $totalAttempts > 0 ? $proxy['failure_count'] / $totalAttempts : 0;
        
        if ($failureRate > 0.5 && $totalAttempts > 10) {
            $this->deactivateProxy($proxyId);
        }
    }
    
    /**
     * Mark proxy as successful
     */
    public function markProxySuccess($proxyId) {
        $this->db->query(
            "UPDATE proxies SET success_count = success_count + 1 WHERE id = ?",
            [$proxyId]
        );
    }
    
    /**
     * Deactivate proxy
     */
    public function deactivateProxy($proxyId) {
        $this->db->update('proxies', ['active' => false], 'id = ?', [$proxyId]);
    }
    
    /**
     * Activate proxy
     */
    public function activateProxy($proxyId) {
        $this->db->update('proxies', ['active' => true], 'id = ?', [$proxyId]);
    }
    
    /**
     * Get proxy statistics
     */
    public function getProxyStats($proxyId) {
        $proxy = $this->db->query("SELECT * FROM v_proxy_performance WHERE id = ?", [$proxyId]);
        
        if (empty($proxy)) {
            throw new Exception("Proxy not found: $proxyId");
        }
        
        return $proxy[0];
    }
    
    /**
     * Get pool statistics
     */
    public function getPoolStats($poolId) {
        $pool = $this->db->query("SELECT * FROM proxy_pools WHERE id = ?", [$poolId]);
        
        if (empty($pool)) {
            throw new Exception("Pool not found: $poolId");
        }
        
        $poolData = $pool[0];
        
        $proxies = $this->db->query(
            "SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN active = TRUE THEN 1 ELSE 0 END) as active,
                AVG(success_count) as avg_success,
                AVG(failure_count) as avg_failure
             FROM proxies WHERE pool_id = ?",
            [$poolId]
        );
        
        $countryDistribution = $this->db->query(
            "SELECT country, COUNT(*) as count
             FROM proxies
             WHERE pool_id = ? AND active = TRUE
             GROUP BY country
             ORDER BY count DESC",
            [$poolId]
        );
        
        return [
            'pool' => $poolData,
            'stats' => $proxies[0],
            'country_distribution' => $countryDistribution
        ];
    }
    
    /**
     * Rotate proxies based on strategy
     */
    public function rotateProxies($poolId) {
        $pool = $this->db->query("SELECT * FROM proxy_pools WHERE id = ?", [$poolId])[0];
        
        $strategy = $pool['rotation_strategy'];
        $rotationSeconds = $pool['rotation_seconds'];
        
        // Find proxies that need rotation
        $cutoffTime = date('Y-m-d H:i:s', time() - $rotationSeconds);
        
        $proxies = $this->db->query(
            "SELECT id FROM proxies 
             WHERE pool_id = ? AND last_used_at < ? AND active = TRUE",
            [$poolId, $cutoffTime]
        );
        
        // Reset their priority
        foreach ($proxies as $proxy) {
            $this->db->update(
                'proxies',
                ['last_used_at' => null],
                'id = ?',
                [$proxy['id']]
            );
        }
        
        return count($proxies);
    }
    
    /**
     * Generate pool ID from name
     */
    private function generatePoolId($name) {
        return strtolower(preg_replace('/[^a-z0-9]+/i', '-', $name));
    }
    
    /**
     * Get available countries
     */
    public function getAvailableCountries($poolId = null) {
        if ($poolId) {
            return $this->db->query(
                "SELECT DISTINCT country, COUNT(*) as proxy_count
                 FROM proxies
                 WHERE pool_id = ? AND active = TRUE AND country IS NOT NULL
                 GROUP BY country
                 ORDER BY country",
                [$poolId]
            );
        }
        
        return $this->db->query(
            "SELECT DISTINCT country, COUNT(*) as proxy_count
             FROM proxies
             WHERE active = TRUE AND country IS NOT NULL
             GROUP BY country
             ORDER BY country"
        );
    }
    
    /**
     * Get available regions
     */
    public function getAvailableRegions($poolId = null) {
        if ($poolId) {
            return $this->db->query(
                "SELECT DISTINCT region, COUNT(*) as proxy_count
                 FROM proxies
                 WHERE pool_id = ? AND active = TRUE AND region IS NOT NULL
                 GROUP BY region
                 ORDER BY region",
                [$poolId]
            );
        }
        
        return $this->db->query(
            "SELECT DISTINCT region, COUNT(*) as proxy_count
             FROM proxies
             WHERE active = TRUE AND region IS NOT NULL
             GROUP BY region
             ORDER BY region"
        );
    }
    
    /**
     * Health check for all proxies in pool
     */
    public function healthCheck($poolId) {
        $proxies = $this->db->query(
            "SELECT * FROM proxies WHERE pool_id = ? AND active = TRUE",
            [$poolId]
        );
        
        $results = [
            'total' => count($proxies),
            'healthy' => 0,
            'unhealthy' => 0,
            'checked' => []
        ];
        
        foreach ($proxies as $proxy) {
            // Simple availability check (in real scenario, would test connection)
            $totalAttempts = $proxy['success_count'] + $proxy['failure_count'];
            $successRate = $totalAttempts > 0 ? $proxy['success_count'] / $totalAttempts : 0;
            
            $isHealthy = $successRate > 0.5 || $totalAttempts < 10;
            
            $results['checked'][] = [
                'id' => $proxy['id'],
                'host' => $proxy['host'],
                'healthy' => $isHealthy,
                'success_rate' => round($successRate * 100, 2)
            ];
            
            if ($isHealthy) {
                $results['healthy']++;
            } else {
                $results['unhealthy']++;
            }
        }
        
        return $results;
    }
}
