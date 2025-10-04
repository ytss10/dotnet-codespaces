<?php
declare(strict_types=1);

/**
 * Advanced PHP Performance Configuration
 * 
 * Optimizes PHP runtime for high-performance web applications.
 * Apply these settings to php.ini or use ini_set() where possible.
 * 
 * @package MegaWebOrchestrator
 * @version 2.0
 */

// ============================================================================
// OPCACHE OPTIMIZATION (for production)
// ============================================================================

if (function_exists('opcache_get_status')) {
    // Enable OPcache
    ini_set('opcache.enable', '1');
    ini_set('opcache.enable_cli', '1');
    
    // Memory configuration
    ini_set('opcache.memory_consumption', '256'); // 256MB for OPcache
    ini_set('opcache.interned_strings_buffer', '32'); // 32MB for string interning
    ini_set('opcache.max_accelerated_files', '10000');
    
    // Validation and timestamps
    ini_set('opcache.validate_timestamps', '0'); // Disable in production for max performance
    ini_set('opcache.revalidate_freq', '0');
    
    // Optimization level
    ini_set('opcache.optimization_level', '0x7FFFBFFF'); // Max optimization
    ini_set('opcache.enable_file_override', '1');
    ini_set('opcache.jit', 'tracing'); // PHP 8.0+ JIT compilation
    ini_set('opcache.jit_buffer_size', '128M');
}

// ============================================================================
// MEMORY MANAGEMENT
// ============================================================================

ini_set('memory_limit', '256M'); // Adjust based on hosting limits
ini_set('max_execution_time', '30'); // InfinityFree limit
ini_set('max_input_time', '30');

// ============================================================================
// REALPATH CACHE (reduces filesystem stat calls)
// ============================================================================

ini_set('realpath_cache_size', '4M');
ini_set('realpath_cache_ttl', '3600'); // 1 hour cache

// ============================================================================
// SESSION OPTIMIZATION
// ============================================================================

ini_set('session.use_strict_mode', '1');
ini_set('session.use_cookies', '1');
ini_set('session.use_only_cookies', '1');
ini_set('session.cookie_httponly', '1');
ini_set('session.cookie_secure', '1'); // HTTPS only
ini_set('session.cookie_samesite', 'Strict');
ini_set('session.gc_probability', '1');
ini_set('session.gc_divisor', '1000'); // 0.1% chance per request
ini_set('session.gc_maxlifetime', '3600'); // 1 hour

// ============================================================================
// OUTPUT BUFFERING
// ============================================================================

ini_set('output_buffering', '4096');
ini_set('implicit_flush', '0');
ini_set('zlib.output_compression', '1'); // Enable gzip compression
ini_set('zlib.output_compression_level', '6'); // Balanced compression

// ============================================================================
// ERROR HANDLING
// ============================================================================

if (defined('APP_DEBUG') && APP_DEBUG) {
    // Development mode
    ini_set('display_errors', '1');
    ini_set('display_startup_errors', '1');
    ini_set('error_reporting', (string)E_ALL);
    ini_set('log_errors', '1');
} else {
    // Production mode
    ini_set('display_errors', '0');
    ini_set('display_startup_errors', '0');
    ini_set('error_reporting', (string)(E_ALL & ~E_DEPRECATED & ~E_STRICT));
    ini_set('log_errors', '1');
}

ini_set('error_log', '/tmp/php_errors.log');

// ============================================================================
// SECURITY HARDENING
// ============================================================================

ini_set('expose_php', '0'); // Hide PHP version
ini_set('allow_url_fopen', '1'); // Required for HTTP requests
ini_set('allow_url_include', '0'); // Security: prevent remote includes
ini_set('file_uploads', '1');
ini_set('upload_max_filesize', '10M');
ini_set('post_max_size', '10M');
ini_set('max_file_uploads', '20');

// Disable dangerous functions
if (function_exists('ini_set')) {
    @ini_set('disable_functions', implode(',', [
        'exec',
        'passthru',
        'shell_exec',
        'system',
        'proc_open',
        'popen',
        'curl_exec',
        'curl_multi_exec',
        'parse_ini_file',
        'show_source',
    ]));
}

// ============================================================================
// PDO / DATABASE OPTIMIZATION
// ============================================================================

// These are set in DatabaseManager class:
// - PDO::ATTR_PERSISTENT => true (connection pooling)
// - PDO::ATTR_EMULATE_PREPARES => false (true prepared statements)
// - PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC

// ============================================================================
// TIMEZONE
// ============================================================================

date_default_timezone_set('UTC');

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

/**
 * Track request execution time
 */
register_shutdown_function(function (): void {
    if (!defined('APP_REQUEST_START')) {
        return;
    }
    
    $executionTime = microtime(true) - APP_REQUEST_START;
    $memoryPeak = memory_get_peak_usage(true);
    
    if (defined('APP_DEBUG') && APP_DEBUG) {
        header("X-Execution-Time: {$executionTime}");
        header("X-Memory-Peak: {$memoryPeak}");
    }
    
    // Log slow requests (> 1 second)
    if ($executionTime > 1.0) {
        error_log(sprintf(
            "SLOW REQUEST: %.3fs | %s | Memory: %s",
            $executionTime,
            $_SERVER['REQUEST_URI'] ?? 'unknown',
            number_format($memoryPeak / 1024 / 1024, 2) . 'MB'
        ));
    }
});

// Mark request start time
define('APP_REQUEST_START', microtime(true));

// ============================================================================
// LAZY AUTOLOADER (PSR-4 compatible)
// ============================================================================

spl_autoload_register(function (string $className): void {
    // Convert namespace to file path
    $className = str_replace('\\', DIRECTORY_SEPARATOR, $className);
    $className = str_replace('MegaWeb' . DIRECTORY_SEPARATOR, '', $className);
    
    $possiblePaths = [
        __DIR__ . '/includes/' . $className . '.php',
        __DIR__ . '/includes/' . strtolower($className) . '.php',
        __DIR__ . '/' . $className . '.php',
    ];
    
    foreach ($possiblePaths as $path) {
        if (file_exists($path)) {
            require_once $path;
            return;
        }
    }
});

// ============================================================================
// PREFLIGHT CHECKS
// ============================================================================

// Verify PHP version
if (version_compare(PHP_VERSION, '7.4.0', '<')) {
    die('Error: PHP 7.4 or higher is required. Current version: ' . PHP_VERSION);
}

// Verify required extensions
$requiredExtensions = ['pdo', 'pdo_mysql', 'json', 'mbstring'];
foreach ($requiredExtensions as $ext) {
    if (!extension_loaded($ext)) {
        die("Error: Required PHP extension '$ext' is not loaded.");
    }
}

// Verify OPcache is available (warning only)
if (!function_exists('opcache_get_status') && defined('APP_DEBUG') && APP_DEBUG) {
    error_log('WARNING: OPcache is not available. Performance will be degraded.');
}

// ============================================================================
// READY
// ============================================================================

if (defined('APP_DEBUG') && APP_DEBUG) {
    error_log('PHP runtime optimizations loaded successfully');
}
