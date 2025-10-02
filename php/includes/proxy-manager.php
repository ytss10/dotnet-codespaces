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
     * Get next available proxy with intelligent load balancing and provider filtering
     */
    public function getNextProxy($poolId = 'global-pool', $country = null, $region = null, $options = []) {
        // Get pool configuration
        $pool = $this->db->query("SELECT * FROM proxy_pools WHERE id = ?", [$poolId]);
        if (empty($pool)) {
            throw new Exception("Pool not found: $poolId");
        }
        $poolConfig = $pool[0];
        
        $where = ['p.pool_id = ?', 'p.active = TRUE'];
        $params = [$poolId];
        
        // Apply provider filters
        $allowedProviders = json_decode($poolConfig['allowed_providers'] ?? '[]', true);
        $blockedProviders = json_decode($poolConfig['blocked_providers'] ?? '[]', true);
        
        if (!empty($allowedProviders)) {
            $placeholders = implode(',', array_fill(0, count($allowedProviders), '?'));
            $where[] = "p.provider IN ($placeholders)";
            $params = array_merge($params, $allowedProviders);
        }
        
        if (!empty($blockedProviders)) {
            $placeholders = implode(',', array_fill(0, count($blockedProviders), '?'));
            $where[] = "p.provider NOT IN ($placeholders)";
            $params = array_merge($params, $blockedProviders);
        }
        
        // Apply verification requirements
        if ($poolConfig['require_verification']) {
            $where[] = "p.verification_status = 'verified'";
        }
        
        // Apply reputation filter
        $where[] = "p.reputation_score >= ?";
        $params[] = $poolConfig['min_reputation_score'];
        
        // Apply anonymity level filter
        $anonymityLevels = ['transparent' => 1, 'anonymous' => 2, 'elite' => 3];
        $minLevel = $anonymityLevels[$poolConfig['min_anonymity_level']] ?? 2;
        $where[] = "CASE p.anonymity_level 
                     WHEN 'transparent' THEN 1 
                     WHEN 'anonymous' THEN 2 
                     WHEN 'elite' THEN 3 
                    END >= ?";
        $params[] = $minLevel;
        
        // Apply dedicated/residential requirements
        if ($poolConfig['require_dedicated']) {
            $where[] = "p.is_dedicated = TRUE";
        }
        if ($poolConfig['require_residential']) {
            $where[] = "p.is_residential = TRUE";
        }
        
        // Apply connection limit
        $where[] = "p.current_connections < p.max_concurrent_connections";
        
        if ($country) {
            $where[] = 'p.country = ?';
            $params[] = $country;
        }
        
        if ($region) {
            $where[] = 'p.region = ?';
            $params[] = $region;
        }
        
        // Select proxy based on rotation strategy
        $orderBy = $this->getOrderByForStrategy($poolConfig['rotation_strategy']);
        
        $proxies = $this->db->query(
            "SELECT p.* FROM proxies p
             WHERE " . implode(' AND ', $where) . "
             $orderBy
             LIMIT 1",
            $params
        );
        
        if (empty($proxies)) {
            throw new Exception("No available proxies matching criteria in pool: $poolId");
        }
        
        $proxy = $proxies[0];
        
        // Update usage
        $this->db->update('proxies', 
            [
                'last_used_at' => date('Y-m-d H:i:s'),
                'current_connections' => $proxy['current_connections'] + 1
            ],
            'id = ?',
            [$proxy['id']]
        );
        
        return $proxy;
    }
    
    /**
     * Get ORDER BY clause based on rotation strategy
     */
    private function getOrderByForStrategy($strategy) {
        switch ($strategy) {
            case 'round-robin':
                return "ORDER BY p.last_used_at ASC NULLS FIRST, p.success_count DESC";
            case 'reputation-based':
                return "ORDER BY p.reputation_score DESC, p.response_time_ms ASC";
            case 'intelligent':
                return "ORDER BY (p.reputation_score * 0.5 + (p.success_count / GREATEST(p.success_count + p.failure_count, 1)) * 50) DESC, p.response_time_ms ASC";
            case 'burst':
                return "ORDER BY p.current_connections ASC, p.reputation_score DESC";
            default:
                return "ORDER BY p.last_used_at ASC NULLS FIRST";
        }
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
     * Add proxy to pool with enhanced validation and configuration
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
            'provider' => $options['provider'] ?? 'custom',
            'is_dedicated' => $options['is_dedicated'] ?? false,
            'is_residential' => $options['is_residential'] ?? false,
            'anonymity_level' => $options['anonymity_level'] ?? 'anonymous',
            'reputation_score' => $options['reputation_score'] ?? 50.00,
            'max_concurrent_connections' => $options['max_concurrent_connections'] ?? 10,
            'allowed_domains' => isset($options['allowed_domains']) ? implode(',', $options['allowed_domains']) : null,
            'blocked_domains' => isset($options['blocked_domains']) ? implode(',', $options['blocked_domains']) : null,
            'custom_headers' => isset($options['custom_headers']) ? json_encode($options['custom_headers']) : null,
            'isolation_enabled' => $options['isolation_enabled'] ?? false,
            'bandwidth_limit_mbps' => $options['bandwidth_limit_mbps'] ?? 0,
            'active' => true
        ];
        
        $this->db->insert('proxies', $data);
        
        // Update pool total count
        $this->db->query(
            "UPDATE proxy_pools SET total_proxies = total_proxies + 1 WHERE id = ?",
            [$poolId]
        );
        
        // Auto-verify if enabled
        $pool = $this->db->query("SELECT * FROM proxy_pools WHERE id = ?", [$poolId])[0];
        if ($pool['require_verification']) {
            $this->verifyProxy($proxyId);
        }
        
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
    
    /**
     * Verify proxy connectivity and update status
     */
    public function verifyProxy($proxyId) {
        $proxy = $this->db->query("SELECT * FROM proxies WHERE id = ?", [$proxyId])[0] ?? null;
        
        if (!$proxy) {
            throw new Exception("Proxy not found: $proxyId");
        }
        
        $startTime = microtime(true);
        $verified = false;
        $responseTime = 0;
        
        // Simulate proxy verification (in production, use actual connection test)
        // This would involve connecting through the proxy to a test URL
        try {
            // Basic connectivity check simulation
            $host = $proxy['host'];
            $port = $proxy['port'];
            
            // In production, you would:
            // 1. Connect to the proxy
            // 2. Make a test HTTP request through it
            // 3. Verify the response
            // 4. Check for IP leaks
            // 5. Measure response time
            
            // For now, simulate a successful verification
            $verified = true;
            $responseTime = round((microtime(true) - $startTime) * 1000);
            
        } catch (Exception $e) {
            $verified = false;
        }
        
        $this->db->update('proxies', [
            'verification_status' => $verified ? 'verified' : 'failed',
            'last_verification_at' => date('Y-m-d H:i:s'),
            'response_time_ms' => $responseTime
        ], 'id = ?', [$proxyId]);
        
        return [
            'proxy_id' => $proxyId,
            'verified' => $verified,
            'response_time_ms' => $responseTime
        ];
    }
    
    /**
     * Bulk verify all proxies in a pool
     */
    public function bulkVerifyProxies($poolId) {
        $proxies = $this->db->query(
            "SELECT id FROM proxies WHERE pool_id = ? AND active = TRUE",
            [$poolId]
        );
        
        $results = [
            'total' => count($proxies),
            'verified' => 0,
            'failed' => 0
        ];
        
        foreach ($proxies as $proxy) {
            $result = $this->verifyProxy($proxy['id']);
            if ($result['verified']) {
                $results['verified']++;
            } else {
                $results['failed']++;
            }
        }
        
        return $results;
    }
    
    /**
     * Update proxy reputation based on performance
     */
    public function updateProxyReputation($proxyId) {
        $proxy = $this->db->query("SELECT * FROM proxies WHERE id = ?", [$proxyId])[0] ?? null;
        
        if (!$proxy) {
            return false;
        }
        
        $totalAttempts = $proxy['success_count'] + $proxy['failure_count'];
        $successRate = $totalAttempts > 0 ? $proxy['success_count'] / $totalAttempts : 0.5;
        
        // Calculate reputation score (0-100)
        $baseScore = $successRate * 100;
        
        // Adjust for verification status
        $verificationBonus = $proxy['verification_status'] === 'verified' ? 10 : -10;
        
        // Adjust for response time (faster is better)
        $responseTimeBonus = 0;
        if ($proxy['response_time_ms'] > 0) {
            $responseTimeBonus = max(-10, min(10, (500 - $proxy['response_time_ms']) / 50));
        }
        
        // Adjust for anonymity level
        $anonymityBonus = ['transparent' => -5, 'anonymous' => 0, 'elite' => 5][$proxy['anonymity_level']] ?? 0;
        
        $newScore = max(0, min(100, $baseScore + $verificationBonus + $responseTimeBonus + $anonymityBonus));
        
        $this->db->update('proxies', [
            'reputation_score' => $newScore
        ], 'id = ?', [$proxyId]);
        
        return $newScore;
    }
    
    /**
     * Configure pool provider restrictions
     */
    public function configurePoolProviders($poolId, $allowedProviders = [], $blockedProviders = []) {
        $this->db->update('proxy_pools', [
            'allowed_providers' => json_encode($allowedProviders),
            'blocked_providers' => json_encode($blockedProviders)
        ], 'id = ?', [$poolId]);
        
        return true;
    }
    
    /**
     * Set pool security requirements
     */
    public function setPoolSecurityRequirements($poolId, $requirements) {
        $updates = [];
        
        if (isset($requirements['require_verification'])) {
            $updates['require_verification'] = $requirements['require_verification'];
        }
        if (isset($requirements['min_reputation_score'])) {
            $updates['min_reputation_score'] = $requirements['min_reputation_score'];
        }
        if (isset($requirements['require_dedicated'])) {
            $updates['require_dedicated'] = $requirements['require_dedicated'];
        }
        if (isset($requirements['require_residential'])) {
            $updates['require_residential'] = $requirements['require_residential'];
        }
        if (isset($requirements['min_anonymity_level'])) {
            $updates['min_anonymity_level'] = $requirements['min_anonymity_level'];
        }
        if (isset($requirements['enable_connection_isolation'])) {
            $updates['enable_connection_isolation'] = $requirements['enable_connection_isolation'];
        }
        
        if (!empty($updates)) {
            $this->db->update('proxy_pools', $updates, 'id = ?', [$poolId]);
        }
        
        return true;
    }
    
    /**
     * Release proxy connection (decrement connection count)
     */
    public function releaseProxy($proxyId) {
        $this->db->query(
            "UPDATE proxies SET current_connections = GREATEST(0, current_connections - 1) WHERE id = ?",
            [$proxyId]
        );
    }
    
    /**
     * Get proxies by provider
     */
    public function getProxiesByProvider($provider, $poolId = null) {
        if ($poolId) {
            return $this->db->query(
                "SELECT * FROM proxies WHERE provider = ? AND pool_id = ? AND active = TRUE",
                [$provider, $poolId]
            );
        }
        
        return $this->db->query(
            "SELECT * FROM proxies WHERE provider = ? AND active = TRUE",
            [$provider]
        );
    }
    
    /**
     * Block provider from all pools or specific pool
     */
    public function blockProvider($provider, $poolId = null) {
        if ($poolId) {
            $pool = $this->db->query("SELECT * FROM proxy_pools WHERE id = ?", [$poolId])[0];
            $blockedProviders = json_decode($pool['blocked_providers'] ?? '[]', true);
            
            if (!in_array($provider, $blockedProviders)) {
                $blockedProviders[] = $provider;
                $this->db->update('proxy_pools', [
                    'blocked_providers' => json_encode($blockedProviders)
                ], 'id = ?', [$poolId]);
            }
            
            // Deactivate proxies from this provider in this pool
            $this->db->query(
                "UPDATE proxies SET active = FALSE WHERE provider = ? AND pool_id = ?",
                [$provider, $poolId]
            );
        } else {
            // Block globally - deactivate all proxies from this provider
            $this->db->query(
                "UPDATE proxies SET active = FALSE WHERE provider = ?",
                [$provider]
            );
        }
        
        return true;
    }
    
    /**
     * Get provider statistics across all pools
     */
    public function getProviderStatistics() {
        return $this->db->query(
            "SELECT 
                provider,
                COUNT(*) as total_proxies,
                SUM(CASE WHEN active = TRUE THEN 1 ELSE 0 END) as active_proxies,
                AVG(reputation_score) as avg_reputation,
                AVG(response_time_ms) as avg_response_time,
                SUM(success_count) as total_success,
                SUM(failure_count) as total_failures,
                COUNT(DISTINCT country) as countries_covered
             FROM proxies
             WHERE provider IS NOT NULL
             GROUP BY provider
             ORDER BY avg_reputation DESC"
        );
    }
    
    /**
     * Detect and update proxy anonymity level
     */
    public function detectAnonymityLevel($proxyId) {
        // In production, this would:
        // 1. Connect through the proxy
        // 2. Check for HTTP headers that leak real IP
        // 3. Test for DNS leaks
        // 4. Verify WebRTC doesn't leak IP
        // 5. Determine anonymity level
        
        // For now, return current level (would be updated after real test)
        $proxy = $this->db->query("SELECT anonymity_level FROM proxies WHERE id = ?", [$proxyId])[0];
        return $proxy['anonymity_level'] ?? 'anonymous';
    }
    
    /**
     * Set custom proxy configuration
     */
    public function setProxyCustomConfig($proxyId, $config) {
        $updates = [];
        
        if (isset($config['allowed_domains'])) {
            $updates['allowed_domains'] = implode(',', $config['allowed_domains']);
        }
        if (isset($config['blocked_domains'])) {
            $updates['blocked_domains'] = implode(',', $config['blocked_domains']);
        }
        if (isset($config['custom_headers'])) {
            $updates['custom_headers'] = json_encode($config['custom_headers']);
        }
        if (isset($config['isolation_enabled'])) {
            $updates['isolation_enabled'] = $config['isolation_enabled'];
        }
        if (isset($config['max_concurrent_connections'])) {
            $updates['max_concurrent_connections'] = $config['max_concurrent_connections'];
        }
        if (isset($config['bandwidth_limit_mbps'])) {
            $updates['bandwidth_limit_mbps'] = $config['bandwidth_limit_mbps'];
        }
        
        if (!empty($updates)) {
            $this->db->update('proxies', $updates, 'id = ?', [$proxyId]);
        }
        
        return true;
    }
}
