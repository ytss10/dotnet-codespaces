<?php
/**
 * MegaWeb Orchestrator - REST API Router
 * Advanced RESTful API for orchestration
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../includes/database.php';
require_once __DIR__ . '/../includes/orchestrator.php';
require_once __DIR__ . '/../includes/proxy-manager.php';

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
                return $this->createProxy();
            }
            
            if (preg_match('#^/proxies/([a-f0-9-]+)/verify$#', $path, $matches) && $this->method === 'POST') {
                return $this->verifyProxy($matches[1]);
            }
            
            if (preg_match('#^/proxies/([a-f0-9-]+)/release$#', $path, $matches) && $this->method === 'POST') {
                return $this->releaseProxy($matches[1]);
            }
            
            if (preg_match('#^/proxies/([a-f0-9-]+)/config$#', $path, $matches) && $this->method === 'PUT') {
                return $this->updateProxyConfig($matches[1]);
            }
            
            if ($path === '/proxies/providers' && $this->method === 'GET') {
                return $this->getProviderStats();
            }
            
            if (preg_match('#^/proxy-pools/([^/]+)/providers$#', $path, $matches) && $this->method === 'PUT') {
                return $this->configureProviders(urldecode($matches[1]));
            }
            
            if (preg_match('#^/proxy-pools/([^/]+)/security$#', $path, $matches) && $this->method === 'PUT') {
                return $this->configurePoolSecurity(urldecode($matches[1]));
            }
            
            if (preg_match('#^/proxy-pools/([^/]+)/verify$#', $path, $matches) && $this->method === 'POST') {
                return $this->bulkVerifyProxies(urldecode($matches[1]));
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
    
    private function createProxy() {
        $db = DatabaseManager::getInstance();
        
        $required = ['pool_id', 'host', 'port'];
        foreach ($required as $field) {
            if (empty($this->requestData[$field])) {
                $this->sendResponse(['error' => "$field is required"], 400);
            }
        }
        
        $proxyManager = new ProxyPoolManager();
        $proxyId = $proxyManager->addProxy(
            $this->requestData['pool_id'],
            $this->requestData['host'],
            $this->requestData['port'],
            $this->requestData
        );
        
        $this->sendResponse(['id' => $proxyId, 'success' => true], 201);
    }
    
    private function verifyProxy($proxyId) {
        $proxyManager = new ProxyPoolManager();
        
        try {
            $result = $proxyManager->verifyProxy($proxyId);
            $this->sendResponse($result);
        } catch (Exception $e) {
            $this->sendResponse(['error' => $e->getMessage()], 404);
        }
    }
    
    private function releaseProxy($proxyId) {
        $proxyManager = new ProxyPoolManager();
        $proxyManager->releaseProxy($proxyId);
        $this->sendResponse(['success' => true, 'id' => $proxyId]);
    }
    
    private function updateProxyConfig($proxyId) {
        $proxyManager = new ProxyPoolManager();
        
        try {
            $proxyManager->setProxyCustomConfig($proxyId, $this->requestData);
            $this->sendResponse(['success' => true, 'id' => $proxyId]);
        } catch (Exception $e) {
            $this->sendResponse(['error' => $e->getMessage()], 400);
        }
    }
    
    private function getProviderStats() {
        $proxyManager = new ProxyPoolManager();
        $stats = $proxyManager->getProviderStatistics();
        
        $this->sendResponse([
            'providers' => $stats,
            'total' => count($stats)
        ]);
    }
    
    private function configureProviders($poolId) {
        $proxyManager = new ProxyPoolManager();
        
        $allowedProviders = $this->requestData['allowed_providers'] ?? [];
        $blockedProviders = $this->requestData['blocked_providers'] ?? [];
        
        try {
            $proxyManager->configurePoolProviders($poolId, $allowedProviders, $blockedProviders);
            $this->sendResponse(['success' => true, 'pool_id' => $poolId]);
        } catch (Exception $e) {
            $this->sendResponse(['error' => $e->getMessage()], 400);
        }
    }
    
    private function configurePoolSecurity($poolId) {
        $proxyManager = new ProxyPoolManager();
        
        try {
            $proxyManager->setPoolSecurityRequirements($poolId, $this->requestData);
            $this->sendResponse(['success' => true, 'pool_id' => $poolId]);
        } catch (Exception $e) {
            $this->sendResponse(['error' => $e->getMessage()], 400);
        }
    }
    
    private function bulkVerifyProxies($poolId) {
        $proxyManager = new ProxyPoolManager();
        
        try {
            $result = $proxyManager->bulkVerifyProxies($poolId);
            $this->sendResponse($result);
        } catch (Exception $e) {
            $this->sendResponse(['error' => $e->getMessage()], 400);
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
        
        $this->sendResponse([
            'status' => $dbStatus === 'healthy' ? 'healthy' : 'unhealthy',
            'database' => $dbStatus,
            'timestamp' => time(),
            'version' => '1.0.0'
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
