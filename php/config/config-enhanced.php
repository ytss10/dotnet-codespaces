<?php
/**
 * Enhanced Configuration Management System
 * 
 * Security Features:
 * - Environment-based configuration
 * - Encrypted sensitive values
 * - Configuration validation
 * - Immutable settings
 * - Audit logging for config changes
 * - Secret rotation support
 * 
 * @package MegaWebOrchestrator
 * @version 3.0
 */

declare(strict_types=1);

namespace MegaWeb\Config;

use Exception;
use InvalidArgumentException;

/**
 * Secure Configuration Manager
 */
class ConfigurationManager {
    private static ?self $instance = null;
    private array $config = [];
    private array $immutableKeys = [];
    private array $sensitiveKeys = [];
    private bool $locked = false;
    private string $encryptionKey;
    private array $validators = [];
    private array $changeLog = [];
    
    /**
     * Private constructor for singleton
     */
    private function __construct() {
        $this->loadEnvironmentVariables();
        $this->initializeConfiguration();
        $this->validateConfiguration();
        $this->lockConfiguration();
    }
    
    /**
     * Get singleton instance
     */
    public static function getInstance(): self {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    /**
     * Load environment variables securely
     */
    private function loadEnvironmentVariables(): void {
        // Load from .env file if exists (development only)
        $envFile = dirname(__DIR__) . '/.env';
        if (file_exists($envFile) && $this->isDevEnvironment()) {
            $this->parseEnvFile($envFile);
        }
        
        // Override with actual environment variables
        $this->loadFromEnvironment();
    }
    
    /**
     * Parse .env file securely
     */
    private function parseEnvFile(string $file): void {
        $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        
        foreach ($lines as $line) {
            // Skip comments
            if (strpos(trim($line), '#') === 0) {
                continue;
            }
            
            // Parse key=value
            if (strpos($line, '=') !== false) {
                [$key, $value] = explode('=', $line, 2);
                $key = trim($key);
                $value = trim($value, " \t\n\r\0\x0B\"'");
                
                // Only set if not already in environment
                if (!isset($_ENV[$key])) {
                    putenv("$key=$value");
                    $_ENV[$key] = $value;
                }
            }
        }
    }
    
    /**
     * Load configuration from environment
     */
    private function loadFromEnvironment(): void {
        // Database configuration
        $this->config['database'] = [
            'host' => $this->getEnvRequired('DB_HOST'),
            'port' => $this->getEnvInt('DB_PORT', 3306),
            'name' => $this->getEnvRequired('DB_NAME'),
            'user' => $this->getEnvRequired('DB_USER'),
            'pass' => $this->getEnvSecure('DB_PASS'),
            'charset' => $this->getEnv('DB_CHARSET', 'utf8mb4'),
            'collate' => $this->getEnv('DB_COLLATE', 'utf8mb4_unicode_ci'),
            'ssl_ca' => $this->getEnv('DB_SSL_CA'),
            'ssl_verify' => $this->getEnvBool('DB_SSL_VERIFY', true),
            'pool_size' => $this->getEnvInt('DB_POOL_SIZE', 10),
            'timeout' => $this->getEnvInt('DB_TIMEOUT', 10)
        ];
        
        // Mark database credentials as sensitive
        $this->sensitiveKeys[] = 'database.pass';
        $this->sensitiveKeys[] = 'database.user';
        
        // Application configuration
        $this->config['app'] = [
            'env' => $this->getEnv('APP_ENV', 'production'),
            'debug' => $this->getEnvBool('APP_DEBUG', false),
            'url' => $this->getEnvRequired('APP_URL'),
            'timezone' => $this->getEnv('APP_TIMEZONE', 'UTC'),
            'locale' => $this->getEnv('APP_LOCALE', 'en'),
            'log_level' => $this->getEnv('APP_LOG_LEVEL', 'info'),
            'log_path' => $this->getEnv('APP_LOG_PATH', '/var/log/megaweb'),
            'maintenance' => $this->getEnvBool('APP_MAINTENANCE', false)
        ];
        
        // Security configuration
        $this->config['security'] = [
            'encryption_key' => $this->getEnvSecure('APP_KEY'),
            'hash_algo' => $this->getEnv('HASH_ALGO', 'sha256'),
            'password_algo' => PASSWORD_ARGON2ID,
            'password_options' => [
                'memory_cost' => $this->getEnvInt('PASSWORD_MEMORY_COST', 65536),
                'time_cost' => $this->getEnvInt('PASSWORD_TIME_COST', 4),
                'threads' => $this->getEnvInt('PASSWORD_THREADS', 1)
            ],
            'jwt_secret' => $this->getEnvSecure('JWT_SECRET'),
            'jwt_algo' => $this->getEnv('JWT_ALGO', 'HS256'),
            'jwt_ttl' => $this->getEnvInt('JWT_TTL', 3600),
            'csrf_enabled' => $this->getEnvBool('CSRF_ENABLED', true),
            'cors_enabled' => $this->getEnvBool('CORS_ENABLED', true),
            'cors_origins' => $this->getEnvArray('CORS_ORIGINS', ['*']),
            'cors_methods' => $this->getEnvArray('CORS_METHODS', ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']),
            'cors_headers' => $this->getEnvArray('CORS_HEADERS', ['Content-Type', 'Authorization']),
            'rate_limit' => $this->getEnvInt('RATE_LIMIT', 100),
            'rate_limit_window' => $this->getEnvInt('RATE_LIMIT_WINDOW', 60),
            'max_login_attempts' => $this->getEnvInt('MAX_LOGIN_ATTEMPTS', 5),
            'lockout_duration' => $this->getEnvInt('LOCKOUT_DURATION', 900)
        ];
        
        // Mark security keys as sensitive
        $this->sensitiveKeys[] = 'security.encryption_key';
        $this->sensitiveKeys[] = 'security.jwt_secret';
        
        // Performance configuration
        $this->config['performance'] = [
            'cache_enabled' => $this->getEnvBool('CACHE_ENABLED', true),
            'cache_driver' => $this->getEnv('CACHE_DRIVER', 'file'),
            'cache_ttl' => $this->getEnvInt('CACHE_TTL', 300),
            'cache_prefix' => $this->getEnv('CACHE_PREFIX', 'megaweb_'),
            'redis_host' => $this->getEnv('REDIS_HOST', '127.0.0.1'),
            'redis_port' => $this->getEnvInt('REDIS_PORT', 6379),
            'redis_pass' => $this->getEnvSecure('REDIS_PASS'),
            'redis_db' => $this->getEnvInt('REDIS_DB', 0),
            'memcached_host' => $this->getEnv('MEMCACHED_HOST', '127.0.0.1'),
            'memcached_port' => $this->getEnvInt('MEMCACHED_PORT', 11211),
            'query_cache_size' => $this->getEnvInt('QUERY_CACHE_SIZE', 1000),
            'max_memory' => $this->getEnv('MAX_MEMORY', '512M'),
            'max_execution_time' => $this->getEnvInt('MAX_EXECUTION_TIME', 60)
        ];
        
        // Mark Redis password as sensitive
        $this->sensitiveKeys[] = 'performance.redis_pass';
        
        // Session configuration
        $this->config['session'] = [
            'driver' => $this->getEnv('SESSION_DRIVER', 'file'),
            'lifetime' => $this->getEnvInt('SESSION_LIFETIME', 120),
            'expire_on_close' => $this->getEnvBool('SESSION_EXPIRE_ON_CLOSE', false),
            'encrypt' => $this->getEnvBool('SESSION_ENCRYPT', true),
            'cookie_name' => $this->getEnv('SESSION_COOKIE', 'megaweb_session'),
            'cookie_path' => $this->getEnv('SESSION_PATH', '/'),
            'cookie_domain' => $this->getEnv('SESSION_DOMAIN', null),
            'cookie_secure' => $this->getEnvBool('SESSION_SECURE_COOKIE', true),
            'cookie_httponly' => $this->getEnvBool('SESSION_HTTP_ONLY', true),
            'cookie_samesite' => $this->getEnv('SESSION_SAME_SITE', 'lax')
        ];
        
        // Proxy configuration
        $this->config['proxy'] = [
            'enabled' => $this->getEnvBool('PROXY_ENABLED', true),
            'default_pool' => $this->getEnv('PROXY_DEFAULT_POOL', 'global-pool'),
            'rotation_seconds' => $this->getEnvInt('PROXY_ROTATION_SECONDS', 60),
            'max_retries' => $this->getEnvInt('PROXY_MAX_RETRIES', 3),
            'retry_delay' => $this->getEnvInt('PROXY_RETRY_DELAY', 1000),
            'timeout' => $this->getEnvInt('PROXY_TIMEOUT', 30000),
            'verify_ssl' => $this->getEnvBool('PROXY_VERIFY_SSL', true),
            'max_concurrent' => $this->getEnvInt('PROXY_MAX_CONCURRENT', 10)
        ];
        
        // Metrics configuration
        $this->config['metrics'] = [
            'enabled' => $this->getEnvBool('METRICS_ENABLED', true),
            'retention_days' => $this->getEnvInt('METRICS_RETENTION_DAYS', 30),
            'export_interval' => $this->getEnvInt('METRICS_EXPORT_INTERVAL', 300),
            'aggregation_interval' => $this->getEnvInt('METRICS_AGGREGATION_INTERVAL', 60),
            'slow_query_threshold' => $this->getEnvFloat('SLOW_QUERY_THRESHOLD', 1.0),
            'alert_enabled' => $this->getEnvBool('METRICS_ALERT_ENABLED', true),
            'alert_email' => $this->getEnv('METRICS_ALERT_EMAIL'),
            'alert_webhook' => $this->getEnv('METRICS_ALERT_WEBHOOK')
        ];
        
        // API configuration
        $this->config['api'] = [
            'version' => $this->getEnv('API_VERSION', 'v1'),
            'prefix' => $this->getEnv('API_PREFIX', '/api'),
            'rate_limit' => $this->getEnvInt('API_RATE_LIMIT', 1000),
            'timeout' => $this->getEnvInt('API_TIMEOUT', 30),
            'max_request_size' => $this->getEnv('API_MAX_REQUEST_SIZE', '10M'),
            'api_key_required' => $this->getEnvBool('API_KEY_REQUIRED', true),
            'api_key_header' => $this->getEnv('API_KEY_HEADER', 'X-API-Key'),
            'documentation_enabled' => $this->getEnvBool('API_DOCS_ENABLED', true)
        ];
        
        // Email configuration
        $this->config['mail'] = [
            'driver' => $this->getEnv('MAIL_DRIVER', 'smtp'),
            'host' => $this->getEnv('MAIL_HOST'),
            'port' => $this->getEnvInt('MAIL_PORT', 587),
            'username' => $this->getEnv('MAIL_USERNAME'),
            'password' => $this->getEnvSecure('MAIL_PASSWORD'),
            'encryption' => $this->getEnv('MAIL_ENCRYPTION', 'tls'),
            'from_address' => $this->getEnv('MAIL_FROM_ADDRESS'),
            'from_name' => $this->getEnv('MAIL_FROM_NAME', 'MegaWeb Orchestrator')
        ];
        
        // Mark email credentials as sensitive
        $this->sensitiveKeys[] = 'mail.password';
        
        // Feature flags
        $this->config['features'] = [
            'hypergrid' => $this->getEnvBool('FEATURE_HYPERGRID', true),
            'automation' => $this->getEnvBool('FEATURE_AUTOMATION', true),
            'bulk_operations' => $this->getEnvBool('FEATURE_BULK_OPS', true),
            'real_time_sync' => $this->getEnvBool('FEATURE_REALTIME', true),
            'advanced_analytics' => $this->getEnvBool('FEATURE_ANALYTICS', true),
            'multi_tenancy' => $this->getEnvBool('FEATURE_MULTI_TENANT', false),
            'webhooks' => $this->getEnvBool('FEATURE_WEBHOOKS', true),
            'api_v2' => $this->getEnvBool('FEATURE_API_V2', false)
        ];
        
        // Limits configuration
        $this->config['limits'] = [
            'max_sessions' => $this->getEnvInt('MAX_SESSIONS', 1000000),
            'max_replicas_per_session' => $this->getEnvInt('MAX_REPLICAS_PER_SESSION', 10000),
            'max_bulk_operations' => $this->getEnvInt('MAX_BULK_OPERATIONS', 512),
            'max_upload_size' => $this->getEnv('MAX_UPLOAD_SIZE', '50M'),
            'max_connections' => $this->getEnvInt('MAX_CONNECTIONS', 1000),
            'max_queue_size' => $this->getEnvInt('MAX_QUEUE_SIZE', 10000)
        ];
    }
    
    /**
     * Initialize additional configuration
     */
    private function initializeConfiguration(): void {
        // Set encryption key
        $this->encryptionKey = $this->config['security']['encryption_key'] ?? $this->generateKey();
        
        // Set immutable keys
        $this->immutableKeys = [
            'app.env',
            'security.encryption_key',
            'security.jwt_secret'
        ];
        
        // Register validators
        $this->registerValidators();
    }
    
    /**
     * Register configuration validators
     */
    private function registerValidators(): void {
        // Database validators
        $this->validators['database.host'] = fn($v) => filter_var($v, FILTER_VALIDATE_DOMAIN, FILTER_FLAG_HOSTNAME) !== false;
        $this->validators['database.port'] = fn($v) => is_int($v) && $v > 0 && $v < 65536;
        
        // URL validators
        $this->validators['app.url'] = fn($v) => filter_var($v, FILTER_VALIDATE_URL) !== false;
        
        // Email validators
        $this->validators['mail.from_address'] = fn($v) => filter_var($v, FILTER_VALIDATE_EMAIL) !== false;
        $this->validators['metrics.alert_email'] = fn($v) => empty($v) || filter_var($v, FILTER_VALIDATE_EMAIL) !== false;
        
        // Security validators
        $this->validators['security.rate_limit'] = fn($v) => is_int($v) && $v > 0;
        $this->validators['security.max_login_attempts'] = fn($v) => is_int($v) && $v > 0 && $v <= 10;
        
        // Performance validators
        $this->validators['performance.cache_ttl'] = fn($v) => is_int($v) && $v >= 0;
        $this->validators['performance.redis_port'] = fn($v) => is_int($v) && $v > 0 && $v < 65536;
    }
    
    /**
     * Validate configuration
     */
    private function validateConfiguration(): void {
        $errors = [];
        
        foreach ($this->validators as $key => $validator) {
            $value = $this->get($key);
            if ($value !== null && !$validator($value)) {
                $errors[] = "Invalid configuration value for: $key";
            }
        }
        
        // Check required values
        $required = [
            'database.host',
            'database.name',
            'database.user',
            'app.url',
            'security.encryption_key'
        ];
        
        foreach ($required as $key) {
            if (empty($this->get($key))) {
                $errors[] = "Required configuration missing: $key";
            }
        }
        
        if (!empty($errors)) {
            throw new InvalidArgumentException("Configuration validation failed:\n" . implode("\n", $errors));
        }
    }
    
    /**
     * Lock configuration to prevent changes
     */
    private function lockConfiguration(): void {
        $this->locked = true;
    }
    
    /**
     * Get environment variable (required)
     */
    private function getEnvRequired(string $key): string {
        $value = $_ENV[$key] ?? getenv($key);
        
        if ($value === false || $value === '') {
            throw new InvalidArgumentException("Required environment variable not set: $key");
        }
        
        return $value;
    }
    
    /**
     * Get environment variable (optional)
     */
    private function getEnv(string $key, $default = null) {
        $value = $_ENV[$key] ?? getenv($key);
        
        if ($value === false || $value === '') {
            return $default;
        }
        
        return $value;
    }
    
    /**
     * Get secure environment variable (encrypted)
     */
    private function getEnvSecure(string $key, $default = null) {
        $value = $this->getEnv($key, $default);
        
        if ($value && $this->isEncrypted($value)) {
            return $this->decrypt($value);
        }
        
        return $value;
    }
    
    /**
     * Get integer environment variable
     */
    private function getEnvInt(string $key, int $default = 0): int {
        $value = $this->getEnv($key, $default);
        return (int) $value;
    }
    
    /**
     * Get float environment variable
     */
    private function getEnvFloat(string $key, float $default = 0.0): float {
        $value = $this->getEnv($key, $default);
        return (float) $value;
    }
    
    /**
     * Get boolean environment variable
     */
    private function getEnvBool(string $key, bool $default = false): bool {
        $value = $this->getEnv($key, $default);
        
        if (is_bool($value)) {
            return $value;
        }
        
        return in_array(strtolower($value), ['true', '1', 'yes', 'on']);
    }
    
    /**
     * Get array environment variable (comma-separated)
     */
    private function getEnvArray(string $key, array $default = []): array {
        $value = $this->getEnv($key);
        
        if (empty($value)) {
            return $default;
        }
        
        return array_map('trim', explode(',', $value));
    }
    
    /**
     * Get configuration value
     */
    public function get(string $key, $default = null) {
        $keys = explode('.', $key);
        $value = $this->config;
        
        foreach ($keys as $k) {
            if (!isset($value[$k])) {
                return $default;
            }
            $value = $value[$k];
        }
        
        // Log access to sensitive keys
        if (in_array($key, $this->sensitiveKeys)) {
            $this->logAccess($key, 'read');
        }
        
        return $value;
    }
    
    /**
     * Set configuration value (if not locked)
     */
    public function set(string $key, $value): void {
        if ($this->locked) {
            throw new Exception("Configuration is locked");
        }
        
        if (in_array($key, $this->immutableKeys)) {
            throw new Exception("Cannot modify immutable configuration: $key");
        }
        
        // Validate if validator exists
        if (isset($this->validators[$key]) && !$this->validators[$key]($value)) {
            throw new InvalidArgumentException("Invalid value for configuration: $key");
        }
        
        $keys = explode('.', $key);
        $config = &$this->config;
        
        foreach ($keys as $i => $k) {
            if ($i === count($keys) - 1) {
                $oldValue = $config[$k] ?? null;
                $config[$k] = $value;
                
                // Log configuration change
                $this->logChange($key, $oldValue, $value);
            } else {
                if (!isset($config[$k])) {
                    $config[$k] = [];
                }
                $config = &$config[$k];
            }
        }
    }
    
    /**
     * Check if configuration exists
     */
    public function has(string $key): bool {
        return $this->get($key) !== null;
    }
    
    /**
     * Get all configuration
     */
    public function all(): array {
        // Filter out sensitive values
        return $this->filterSensitive($this->config);
    }
    
    /**
     * Filter sensitive values for display
     */
    private function filterSensitive(array $config, string $prefix = ''): array {
        $filtered = [];
        
        foreach ($config as $key => $value) {
            $fullKey = $prefix ? "$prefix.$key" : $key;
            
            if (in_array($fullKey, $this->sensitiveKeys)) {
                $filtered[$key] = '[REDACTED]';
            } elseif (is_array($value)) {
                $filtered[$key] = $this->filterSensitive($value, $fullKey);
            } else {
                $filtered[$key] = $value;
            }
        }
        
        return $filtered;
    }
    
    /**
     * Check if environment is development
     */
    private function isDevEnvironment(): bool {
        $env = $this->getEnv('APP_ENV', 'production');
        return in_array($env, ['development', 'dev', 'local']);
    }
    
    /**
     * Check if value is encrypted
     */
    private function isEncrypted(string $value): bool {
        return strpos($value, 'enc:') === 0;
    }
    
    /**
     * Encrypt value
     */
    public function encrypt(string $value): string {
        if (!$this->encryptionKey) {
            throw new Exception("Encryption key not set");
        }
        
        $nonce = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        $encrypted = sodium_crypto_secretbox($value, $nonce, $this->encryptionKey);
        
        return 'enc:' . base64_encode($nonce . $encrypted);
    }
    
    /**
     * Decrypt value
     */
    private function decrypt(string $value): string {
        if (!$this->isEncrypted($value)) {
            return $value;
        }
        
        if (!$this->encryptionKey) {
            throw new Exception("Encryption key not set");
        }
        
        $value = substr($value, 4); // Remove 'enc:' prefix
        $decoded = base64_decode($value);
        
        $nonce = substr($decoded, 0, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        $ciphertext = substr($decoded, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        
        $decrypted = sodium_crypto_secretbox_open($ciphertext, $nonce, $this->encryptionKey);
        
        if ($decrypted === false) {
            throw new Exception("Failed to decrypt value");
        }
        
        return $decrypted;
    }
    
    /**
     * Generate secure encryption key
     */
    private function generateKey(): string {
        return sodium_crypto_secretbox_keygen();
    }
    
    /**
     * Log configuration access
     */
    private function logAccess(string $key, string $action): void {
        $this->changeLog[] = [
            'timestamp' => microtime(true),
            'action' => $action,
            'key' => $key,
            'user' => $_SERVER['REMOTE_USER'] ?? 'system',
            'ip' => $_SERVER['REMOTE_ADDR'] ?? 'localhost'
        ];
    }
    
    /**
     * Log configuration change
     */
    private function logChange(string $key, $oldValue, $newValue): void {
        // Don't log sensitive values
        if (in_array($key, $this->sensitiveKeys)) {
            $oldValue = '[REDACTED]';
            $newValue = '[REDACTED]';
        }
        
        $this->changeLog[] = [
            'timestamp' => microtime(true),
            'action' => 'change',
            'key' => $key,
            'old_value' => $oldValue,
            'new_value' => $newValue,
            'user' => $_SERVER['REMOTE_USER'] ?? 'system',
            'ip' => $_SERVER['REMOTE_ADDR'] ?? 'localhost'
        ];
    }
    
    /**
     * Get configuration change log
     */
    public function getChangeLog(): array {
        return $this->changeLog;
    }
    
    /**
     * Export configuration for debugging (filtered)
     */
    public function export(): array {
        return [
            'config' => $this->all(),
            'environment' => $this->get('app.env'),
            'debug' => $this->get('app.debug'),
            'features' => $this->get('features'),
            'limits' => $this->get('limits'),
            'validators' => array_keys($this->validators),
            'immutable_keys' => $this->immutableKeys,
            'locked' => $this->locked
        ];
    }
}

// Initialize configuration manager
try {
    $config = ConfigurationManager::getInstance();
    
    // Define global constants for backward compatibility
    define('DB_HOST', $config->get('database.host'));
    define('DB_NAME', $config->get('database.name'));
    define('DB_USER', $config->get('database.user'));
    define('DB_PASS', $config->get('database.pass'));
    define('DB_CHARSET', $config->get('database.charset'));
    define('DB_COLLATE', $config->get('database.collate'));
    define('APP_ENV', $config->get('app.env'));
    define('APP_DEBUG', $config->get('app.debug'));
    define('APP_URL', $config->get('app.url'));
    define('CACHE_ENABLED', $config->get('performance.cache_enabled'));
    define('CACHE_TTL', $config->get('performance.cache_ttl'));
    
} catch (Exception $e) {
    // Log error without exposing details
    error_log("Configuration initialization failed: " . $e->getMessage());
    
    // Return generic error in production
    if (PHP_SAPI !== 'cli') {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode([
            'error' => 'Configuration error',
            'code' => 500
        ]);
        exit;
    }
    
    throw $e;
}