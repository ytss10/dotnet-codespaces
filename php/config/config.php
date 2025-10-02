<?php
/**
 * MegaWeb Orchestrator - Database Configuration
 * Advanced MySQL configuration for InfinityFree hosting
 */

// Database configuration
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_NAME', getenv('DB_NAME') ?: 'megaweb_orchestrator');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('DB_PASS') ?: '');
define('DB_CHARSET', 'utf8mb4');
define('DB_COLLATE', 'utf8mb4_unicode_ci');

// Application configuration
define('APP_ENV', getenv('APP_ENV') ?: 'production');
define('APP_DEBUG', getenv('APP_DEBUG') === 'true' ? true : false);
define('APP_URL', getenv('APP_URL') ?: 'http://localhost');

// Performance configuration
define('MAX_SESSIONS', 1000000);
define('MAX_REPLICAS_PER_SESSION', 10000);
define('MAX_BULK_OPERATIONS', 512);
define('CACHE_ENABLED', true);
define('CACHE_TTL', 300); // 5 minutes

// Proxy configuration
define('DEFAULT_PROXY_POOL', 'global-pool');
define('PROXY_ROTATION_SECONDS', 60);

// Metrics configuration
define('METRICS_ENABLED', true);
define('METRICS_RETENTION_DAYS', 30);

// Hypergrid configuration
define('HYPERGRID_ENABLED', true);
define('HYPERGRID_TILE_SIZE', 1000);
define('HYPERGRID_UPDATE_INTERVAL', 5); // seconds

// API configuration
define('API_RATE_LIMIT', 1000); // requests per minute
define('API_TIMEOUT', 30); // seconds

// Session configuration
define('SESSION_COOKIE_NAME', 'MEGAWEB_SESSION');
define('SESSION_LIFETIME', 3600); // 1 hour

// CORS configuration
define('CORS_ALLOWED_ORIGINS', '*');
define('CORS_ALLOWED_METHODS', 'GET, POST, PUT, DELETE, OPTIONS');
define('CORS_ALLOWED_HEADERS', 'Content-Type, Authorization, X-Requested-With');

// File upload configuration (for bulk operations)
define('MAX_UPLOAD_SIZE', 50 * 1024 * 1024); // 50MB

// Timezone
date_default_timezone_set('UTC');

// Error reporting (disable in production)
if (APP_DEBUG) {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
} else {
    error_reporting(0);
    ini_set('display_errors', 0);
}

// Set memory limit for large operations
ini_set('memory_limit', '512M');
ini_set('max_execution_time', '60');

// JSON encoding options
define('JSON_OPTIONS', JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_NUMERIC_CHECK);

// Custom error handler for production
if (!APP_DEBUG) {
    set_error_handler(function($errno, $errstr, $errfile, $errline) {
        error_log("Error [$errno]: $errstr in $errfile on line $errline");
        return true;
    });
    
    set_exception_handler(function($exception) {
        error_log("Uncaught exception: " . $exception->getMessage());
        http_response_code(500);
        echo json_encode([
            'error' => 'Internal server error',
            'message' => APP_DEBUG ? $exception->getMessage() : 'An error occurred'
        ], JSON_OPTIONS);
        exit;
    });
}
