<?php
/**
 * MegaWeb Orchestrator - REST API Router
 * Advanced RESTful API for orchestration
 */

// Suppress errors for InfinityFree compatibility
error_reporting(E_ERROR | E_PARSE);

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
            
            if ($path === '/stream' && $this->method === 'GET') {
                return $this->streamSessions();
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
            
            // New enhanced country/region proxy endpoints
            if ($path === '/proxies/countries' && $this->method === 'GET') {
                return $this->getSupportedCountries();
            }
            
            if ($path === '/proxies/regions' && $this->method === 'GET') {
                return $this->getRegionalGroups();
            }
            
            if ($path === '/proxies/ip-pool/countries' && $this->method === 'GET') {
                return $this->getIpPoolByCountry();
            }
            
            if (preg_match('#^/proxies/servers/regions(?:/([^/]+))?$#', $path, $matches) && $this->method === 'GET') {
                return $this->getProxyServersByRegion($matches[1] ?? null);
            }
            
            if ($path === '/proxies/route/optimal' && $this->method === 'POST') {
                return $this->getOptimalRoute();
            }
            
            if ($path === '/health' && $this->method === 'GET') {
                return $this->healthCheck();
            }
            
            // Automation & Scraping Routes
            if ($path === '/automation/tasks' && $this->method === 'POST') {
                return $this->createAutomationTask();
            }
            
            if ($path === '/automation/tasks' && $this->method === 'GET') {
                return $this->getAutomationTasks();
            }
            
            if (preg_match('#^/automation/tasks/([a-zA-Z0-9_-]+)$#', $path, $matches) && $this->method === 'GET') {
                return $this->getAutomationTask($matches[1]);
            }
            
            if (preg_match('#^/automation/tasks/([a-zA-Z0-9_-]+)$#', $path, $matches) && $this->method === 'PUT') {
                return $this->updateAutomationTask($matches[1]);
            }
            
            if (preg_match('#^/automation/tasks/([a-zA-Z0-9_-]+)$#', $path, $matches) && $this->method === 'DELETE') {
                return $this->deleteAutomationTask($matches[1]);
            }
            
            if (preg_match('#^/automation/tasks/([a-zA-Z0-9_-]+)/start$#', $path, $matches) && $this->method === 'POST') {
                return $this->startAutomationTask($matches[1]);
            }
            
            if (preg_match('#^/automation/tasks/([a-zA-Z0-9_-]+)/stop$#', $path, $matches) && $this->method === 'POST') {
                return $this->stopAutomationTask($matches[1]);
            }
            
            if (preg_match('#^/automation/tasks/([a-zA-Z0-9_-]+)/pause$#', $path, $matches) && $this->method === 'POST') {
                return $this->pauseAutomationTask($matches[1]);
            }
            
            if ($path === '/scraping/execute' && $this->method === 'POST') {
                return $this->executeScraping();
            }
            
            if ($path === '/scraping/jobs' && $this->method === 'GET') {
                return $this->getScrapingJobs();
            }
            
            if (preg_match('#^/scraping/jobs/([a-zA-Z0-9_-]+)$#', $path, $matches) && $this->method === 'GET') {
                return $this->getScrapingJob($matches[1]);
            }
            
            if (preg_match('#^/scraping/jobs/([a-zA-Z0-9_-]+)/results$#', $path, $matches) && $this->method === 'GET') {
                return $this->getScrapingResults($matches[1]);
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
    
    private function getSupportedCountries() {
        try {
            $proxyEngine = new CustomProxyEngine();
            $countries = $proxyEngine->getSupportedCountries();
            
            $this->sendResponse([
                'total' => count($countries),
                'countries' => $countries,
                'message' => 'All countries supported by custom proxy infrastructure'
            ]);
        } catch (Exception $e) {
            $this->sendResponse(['error' => $e->getMessage()], 500);
        }
    }
    
    private function getRegionalGroups() {
        try {
            $proxyEngine = new CustomProxyEngine();
            $regions = $proxyEngine->getRegionalGroups();
            
            $this->sendResponse([
                'total' => count($regions),
                'regions' => $regions,
                'message' => 'Regional groupings for optimal routing'
            ]);
        } catch (Exception $e) {
            $this->sendResponse(['error' => $e->getMessage()], 500);
        }
    }
    
    private function getIpPoolByCountry() {
        try {
            $proxyEngine = new CustomProxyEngine();
            $stats = $proxyEngine->getIpPoolStatsByCountry();
            
            $this->sendResponse([
                'total_countries' => count($stats),
                'stats' => $stats,
                'message' => 'IP pool statistics by country'
            ]);
        } catch (Exception $e) {
            $this->sendResponse(['error' => $e->getMessage()], 500);
        }
    }
    
    private function getProxyServersByRegion($region = null) {
        try {
            $proxyEngine = new CustomProxyEngine();
            $stats = $proxyEngine->getProxyServersByRegion($region);
            
            $this->sendResponse([
                'region' => $region,
                'stats' => $stats,
                'message' => $region ? "Proxy servers in $region region" : 'All proxy servers by region'
            ]);
        } catch (Exception $e) {
            $this->sendResponse(['error' => $e->getMessage()], 500);
        }
    }
    
    private function getOptimalRoute() {
        try {
            $proxyEngine = new CustomProxyEngine();
            
            $sourceCountry = $this->requestData['source_country'] ?? 'US';
            $targetCountry = $this->requestData['target_country'] ?? 'US';
            $intermediatePreferences = $this->requestData['intermediate_preferences'] ?? [];
            
            $route = $proxyEngine->getOptimalRouteForCountries(
                $sourceCountry,
                $targetCountry,
                $intermediatePreferences
            );
            
            $this->sendResponse([
                'route' => $route,
                'message' => 'Optimal route calculated for geographic requirements'
            ]);
        } catch (Exception $e) {
            $this->sendResponse(['error' => $e->getMessage()], 500);
        }
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
    
    // ============================================================================
    // Automation & Scraping API Methods
    // ============================================================================
    
    private function createAutomationTask() {
        require_once __DIR__ . '/../includes/web-automation-engine.php';
        
        try {
            $db = DatabaseManager::getInstance();
            $taskId = bin2hex(random_bytes(16));
            
            // Check if automation_tasks table exists
            if (!$db->tableExists('automation_tasks')) {
                $this->createAutomationTasksTable();
            }
            
            $name = $this->requestData['name'] ?? 'Untitled Task';
            $type = $this->requestData['type'] ?? 'scraping';
            $urls = isset($this->requestData['urls']) ? json_encode($this->requestData['urls']) : null;
            $selectors = isset($this->requestData['selectors']) ? json_encode($this->requestData['selectors']) : null;
            $actions = isset($this->requestData['actions']) ? json_encode($this->requestData['actions']) : null;
            $proxyConfig = isset($this->requestData['proxy']) ? json_encode($this->requestData['proxy']) : null;
            
            $sql = "INSERT INTO automation_tasks (id, name, type, urls, selectors, actions, proxy_config, rate_limit, max_retries, concurrency, priority) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
            
            $db->query($sql, [
                $taskId,
                $name,
                $type,
                $urls,
                $selectors,
                $actions,
                $proxyConfig,
                $this->requestData['rate_limit'] ?? 100,
                $this->requestData['max_retries'] ?? 3,
                $this->requestData['concurrency'] ?? 5,
                $this->requestData['priority'] ?? 5
            ]);
            
            $this->sendResponse([
                'task_id' => $taskId,
                'message' => 'Automation task created successfully'
            ], 201);
        } catch (Exception $e) {
            $this->sendResponse(['error' => $e->getMessage()], 500);
        }
    }
    
    private function createAutomationTasksTable() {
        $db = DatabaseManager::getInstance();
        $sql = "CREATE TABLE IF NOT EXISTS `automation_tasks` (
            `id` VARCHAR(100) PRIMARY KEY,
            `name` VARCHAR(255) NOT NULL,
            `type` VARCHAR(50) NOT NULL,
            `urls` TEXT,
            `selectors` TEXT,
            `actions` TEXT,
            `proxy_config` TEXT,
            `rate_limit` INT DEFAULT 100,
            `max_retries` INT DEFAULT 3,
            `concurrency` INT DEFAULT 5,
            `priority` INT DEFAULT 5,
            `status` VARCHAR(50) DEFAULT 'pending',
            `started_at` TIMESTAMP NULL,
            `stopped_at` TIMESTAMP NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX `idx_status` (`status`),
            INDEX `idx_type` (`type`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
        $db->query($sql);
    }
    
    private function getAutomationTasks() {
        try {
            $db = DatabaseManager::getInstance();
            if (!$db->tableExists('automation_tasks')) {
                $this->sendResponse(['tasks' => [], 'count' => 0]);
                return;
            }
            $sql = "SELECT * FROM automation_tasks ORDER BY created_at DESC LIMIT 100";
            $tasks = $db->query($sql);
            
            $this->sendResponse([
                'tasks' => $tasks,
                'count' => count($tasks)
            ]);
        } catch (Exception $e) {
            $this->sendResponse(['error' => $e->getMessage()], 500);
        }
    }
    
    private function getAutomationTask($taskId) {
        try {
            $db = DatabaseManager::getInstance();
            if (!$db->tableExists('automation_tasks')) {
                $this->sendResponse(['error' => 'Task not found'], 404);
                return;
            }
            $sql = "SELECT * FROM automation_tasks WHERE id = ?";
            $tasks = $db->query($sql, [$taskId]);
            
            if (empty($tasks)) {
                $this->sendResponse(['error' => 'Task not found'], 404);
                return;
            }
            
            $this->sendResponse(['task' => $tasks[0]]);
        } catch (Exception $e) {
            $this->sendResponse(['error' => $e->getMessage()], 500);
        }
    }
    
    private function updateAutomationTask($taskId) {
        try {
            $db = DatabaseManager::getInstance();
            
            $updates = [];
            $params = [];
            
            if (isset($this->requestData['name'])) {
                $updates[] = "name = ?";
                $params[] = $this->requestData['name'];
            }
            if (isset($this->requestData['status'])) {
                $updates[] = "status = ?";
                $params[] = $this->requestData['status'];
            }
            if (isset($this->requestData['priority'])) {
                $updates[] = "priority = ?";
                $params[] = $this->requestData['priority'];
            }
            
            if (empty($updates)) {
                $this->sendResponse(['error' => 'No fields to update'], 400);
                return;
            }
            
            $params[] = $taskId;
            $sql = "UPDATE automation_tasks SET " . implode(', ', $updates) . " WHERE id = ?";
            $db->query($sql, $params);
            
            $this->sendResponse(['message' => 'Task updated successfully']);
        } catch (Exception $e) {
            $this->sendResponse(['error' => $e->getMessage()], 500);
        }
    }
    
    private function deleteAutomationTask($taskId) {
        try {
            $db = DatabaseManager::getInstance();
            $sql = "DELETE FROM automation_tasks WHERE id = ?";
            $db->query($sql, [$taskId]);
            
            $this->sendResponse(['message' => 'Task deleted successfully']);
        } catch (Exception $e) {
            $this->sendResponse(['error' => $e->getMessage()], 500);
        }
    }
    
    private function startAutomationTask($taskId) {
        try {
            $db = DatabaseManager::getInstance();
            $sql = "UPDATE automation_tasks SET status = 'running', started_at = NOW() WHERE id = ?";
            $db->query($sql, [$taskId]);
            
            $this->sendResponse(['message' => 'Task started successfully']);
        } catch (Exception $e) {
            $this->sendResponse(['error' => $e->getMessage()], 500);
        }
    }
    
    private function stopAutomationTask($taskId) {
        try {
            $db = DatabaseManager::getInstance();
            $sql = "UPDATE automation_tasks SET status = 'stopped', stopped_at = NOW() WHERE id = ?";
            $db->query($sql, [$taskId]);
            
            $this->sendResponse(['message' => 'Task stopped successfully']);
        } catch (Exception $e) {
            $this->sendResponse(['error' => $e->getMessage()], 500);
        }
    }
    
    private function pauseAutomationTask($taskId) {
        try {
            $db = DatabaseManager::getInstance();
            $sql = "UPDATE automation_tasks SET status = 'paused' WHERE id = ?";
            $db->query($sql, [$taskId]);
            
            $this->sendResponse(['message' => 'Task paused successfully']);
        } catch (Exception $e) {
            $this->sendResponse(['error' => $e->getMessage()], 500);
        }
    }
    
    private function executeScraping() {
        require_once __DIR__ . '/../includes/web-automation-engine.php';
        
        try {
            $url = $this->requestData['url'] ?? '';
            $selectors = $this->requestData['selectors'] ?? [];
            $proxyConfig = $this->requestData['proxy'] ?? [];
            
            if (empty($url)) {
                $this->sendResponse(['error' => 'URL is required'], 400);
                return;
            }
            
            $scraper = new WebAutomationEngine();
            $result = $scraper->scrape($url, [
                'selectors' => $selectors,
                'proxy' => $proxyConfig
            ]);
            
            $this->sendResponse([
                'result' => $result,
                'message' => 'Scraping executed successfully'
            ]);
        } catch (Exception $e) {
            $this->sendResponse(['error' => $e->getMessage()], 500);
        }
    }
    
    private function getScrapingJobs() {
        try {
            $db = DatabaseManager::getInstance();
            if (!$db->tableExists('scraping_jobs')) {
                $this->sendResponse(['jobs' => [], 'count' => 0]);
                return;
            }
            $sql = "SELECT * FROM scraping_jobs ORDER BY created_at DESC LIMIT 100";
            $jobs = $db->query($sql);
            
            $this->sendResponse([
                'jobs' => $jobs,
                'count' => count($jobs)
            ]);
        } catch (Exception $e) {
            $this->sendResponse(['error' => $e->getMessage()], 500);
        }
    }
    
    private function getScrapingJob($jobId) {
        try {
            $db = DatabaseManager::getInstance();
            if (!$db->tableExists('scraping_jobs')) {
                $this->sendResponse(['error' => 'Job not found'], 404);
                return;
            }
            $sql = "SELECT * FROM scraping_jobs WHERE id = ?";
            $jobs = $db->query($sql, [$jobId]);
            
            if (empty($jobs)) {
                $this->sendResponse(['error' => 'Job not found'], 404);
                return;
            }
            
            $this->sendResponse(['job' => $jobs[0]]);
        } catch (Exception $e) {
            $this->sendResponse(['error' => $e->getMessage()], 500);
        }
    }
    
    private function getScrapingResults($jobId) {
        try {
            $db = DatabaseManager::getInstance();
            if (!$db->tableExists('automation_results')) {
                $this->sendResponse(['results' => [], 'count' => 0]);
                return;
            }
            $sql = "SELECT * FROM automation_results WHERE task_id = ? ORDER BY created_at DESC LIMIT 100";
            $results = $db->query($sql, [$jobId]);
            
            $this->sendResponse([
                'results' => $results,
                'count' => count($results)
            ]);
        } catch (Exception $e) {
            $this->sendResponse(['error' => $e->getMessage()], 500);
        }
    }
    
    private function sendResponse($data, $code = 200) {
        http_response_code($code);
        echo json_encode($data, JSON_OPTIONS);
        exit;
    }
    
    private function streamSessions() {
        require_once __DIR__ . '/../includes/realtime-multiplexer.php';
        $multiplexer = new RealtimeMultiplexer();
        $multiplexer->streamSessions();
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
