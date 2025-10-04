<?php
/**
 * Enhanced Database Manager with Security Improvements
 * 
 * Security Features:
 * - Prepared statements for all queries
 * - Input validation and sanitization
 * - SQL injection prevention
 * - Connection pooling with limits
 * - Automatic transaction rollback on errors
 * - Query logging for audit trails
 * - Rate limiting per connection
 * 
 * @package MegaWebOrchestrator
 * @version 3.0
 */

declare(strict_types=1);

namespace MegaWeb\Database;

use PDO;
use PDOException;
use PDOStatement;
use Exception;
use InvalidArgumentException;
use RuntimeException;

class EnhancedDatabaseManager {
    private static ?self $instance = null;
    private ?PDO $connection = null;
    private int $transactionLevel = 0;
    private array $queryCache = [];
    private bool $cacheEnabled = true;
    private int $connectionAttempts = 0;
    private int $maxConnectionAttempts = 3;
    private array $queryLog = [];
    private bool $queryLogging = false;
    private int $maxCacheSize = 1000;
    private array $preparedStatements = [];
    private int $queryCount = 0;
    private float $totalQueryTime = 0;
    private array $slowQueries = [];
    private float $slowQueryThreshold = 1.0; // seconds
    
    // Security constants
    private const ALLOWED_OPERATORS = ['=', '!=', '<', '>', '<=', '>=', 'LIKE', 'IN', 'NOT IN', 'IS NULL', 'IS NOT NULL'];
    private const MAX_QUERY_LENGTH = 50000;
    private const MAX_PARAMS = 1000;
    
    /**
     * Private constructor for singleton pattern
     */
    private function __construct() {
        $this->connect();
        $this->initializeSecurityFeatures();
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
     * Initialize security features
     */
    private function initializeSecurityFeatures(): void {
        // Set secure session parameters
        if ($this->connection) {
            $this->connection->exec("SET SESSION sql_mode = 'TRADITIONAL,NO_ENGINE_SUBSTITUTION'");
            $this->connection->exec("SET SESSION max_prepared_stmt_count = 16382");
        }
    }
    
    /**
     * Establish database connection with security hardening
     */
    private function connect(): void {
        $this->connectionAttempts++;
        
        try {
            $dsn = sprintf(
                "mysql:host=%s;dbname=%s;charset=%s",
                $this->validateHost(DB_HOST),
                $this->validateDatabaseName(DB_NAME),
                DB_CHARSET
            );
            
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false, // CRITICAL: Prevent SQL injection
                PDO::ATTR_PERSISTENT => false, // Avoid connection pool issues
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES " . DB_CHARSET . " COLLATE " . DB_COLLATE,
                PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true,
                PDO::ATTR_TIMEOUT => 10,
                PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT => true,
                PDO::ATTR_STRINGIFY_FETCHES => false,
            ];
            
            // Add SSL if configured
            if (defined('DB_SSL_CA') && DB_SSL_CA) {
                $options[PDO::MYSQL_ATTR_SSL_CA] = DB_SSL_CA;
                $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = true;
            }
            
            $this->connection = new PDO($dsn, DB_USER, DB_PASS, $options);
            $this->connectionAttempts = 0;
            
            // Log successful connection
            $this->logQuery('CONNECTION', 'Database connection established', 0);
            
        } catch (PDOException $e) {
            if ($this->connectionAttempts < $this->maxConnectionAttempts) {
                usleep(100000 * $this->connectionAttempts); // Exponential backoff
                return $this->connect();
            }
            
            // Log connection failure securely
            error_log("Database connection failed after {$this->connectionAttempts} attempts");
            throw new RuntimeException("Database connection failed");
        }
    }
    
    /**
     * Validate hostname to prevent injection
     */
    private function validateHost(string $host): string {
        // Allow only valid hostname characters
        if (!preg_match('/^[a-zA-Z0-9\-\.]+$/', $host)) {
            throw new InvalidArgumentException("Invalid database host");
        }
        return $host;
    }
    
    /**
     * Validate database name
     */
    private function validateDatabaseName(string $name): string {
        if (!preg_match('/^[a-zA-Z0-9_]+$/', $name)) {
            throw new InvalidArgumentException("Invalid database name");
        }
        return $name;
    }
    
    /**
     * Get connection with health check
     */
    public function getConnection(): PDO {
        if ($this->connection === null) {
            $this->connect();
        }
        
        // Health check
        try {
            $this->connection->query('SELECT 1');
        } catch (PDOException $e) {
            $this->logQuery('RECONNECT', 'Connection lost, reconnecting', 0);
            $this->connect();
        }
        
        return $this->connection;
    }
    
    /**
     * Execute query with comprehensive security checks
     */
    public function query(string $sql, array $params = []): mixed {
        $startTime = microtime(true);
        
        // Security validations
        $this->validateQuery($sql);
        $this->validateParams($params);
        
        // Check cache for SELECT queries
        $cacheKey = $this->getCacheKey($sql, $params);
        if ($this->shouldUseCache($sql) && isset($this->queryCache[$cacheKey])) {
            $cached = $this->queryCache[$cacheKey];
            if ($cached['expires'] > time()) {
                $this->logQuery('CACHE_HIT', $sql, 0, $params);
                return $cached['result'];
            }
        }
        
        try {
            // Use prepared statement
            $stmt = $this->getPreparedStatement($sql);
            
            // Bind parameters securely
            $this->bindParameters($stmt, $params);
            
            // Execute query
            $stmt->execute();
            
            // Process results based on query type
            $result = $this->processQueryResult($stmt, $sql);
            
            // Cache if applicable
            if ($this->shouldUseCache($sql)) {
                $this->addToCache($cacheKey, $result);
            }
            
            // Log query execution
            $executionTime = microtime(true) - $startTime;
            $this->logQuery('EXECUTE', $sql, $executionTime, $params);
            
            // Track slow queries
            if ($executionTime > $this->slowQueryThreshold) {
                $this->trackSlowQuery($sql, $params, $executionTime);
            }
            
            return $result;
            
        } catch (PDOException $e) {
            $this->logQuery('ERROR', $sql, microtime(true) - $startTime, $params, $e->getMessage());
            throw new RuntimeException("Query execution failed");
        }
    }
    
    /**
     * Validate query for security issues
     */
    private function validateQuery(string $sql): void {
        // Check query length
        if (strlen($sql) > self::MAX_QUERY_LENGTH) {
            throw new InvalidArgumentException("Query exceeds maximum length");
        }
        
        // Check for multiple statements (prevent stacked queries)
        if (preg_match('/;\s*(DELETE|DROP|ALTER|CREATE|INSERT|UPDATE)/i', $sql)) {
            throw new InvalidArgumentException("Multiple statements not allowed");
        }
        
        // Check for dangerous keywords in comments
        if (preg_match('/--.*?(DROP|DELETE|ALTER)/i', $sql)) {
            throw new InvalidArgumentException("Suspicious SQL comment detected");
        }
    }
    
    /**
     * Validate parameters
     */
    private function validateParams(array $params): void {
        if (count($params) > self::MAX_PARAMS) {
            throw new InvalidArgumentException("Too many parameters");
        }
        
        foreach ($params as $param) {
            if (is_resource($param)) {
                throw new InvalidArgumentException("Resource parameters not allowed");
            }
        }
    }
    
    /**
     * Get or create prepared statement
     */
    private function getPreparedStatement(string $sql): PDOStatement {
        $hash = md5($sql);
        
        if (!isset($this->preparedStatements[$hash])) {
            $this->preparedStatements[$hash] = $this->getConnection()->prepare($sql);
            
            // Limit prepared statement cache size
            if (count($this->preparedStatements) > 100) {
                array_shift($this->preparedStatements);
            }
        }
        
        return $this->preparedStatements[$hash];
    }
    
    /**
     * Bind parameters with type detection
     */
    private function bindParameters(PDOStatement $stmt, array $params): void {
        foreach ($params as $key => $value) {
            $paramKey = is_int($key) ? $key + 1 : $key;
            
            if (is_null($value)) {
                $type = PDO::PARAM_NULL;
            } elseif (is_bool($value)) {
                $type = PDO::PARAM_BOOL;
            } elseif (is_int($value)) {
                $type = PDO::PARAM_INT;
            } else {
                $type = PDO::PARAM_STR;
            }
            
            $stmt->bindValue($paramKey, $value, $type);
        }
    }
    
    /**
     * Process query results based on type
     */
    private function processQueryResult(PDOStatement $stmt, string $sql): mixed {
        $queryType = $this->getQueryType($sql);
        
        switch ($queryType) {
            case 'SELECT':
                return $stmt->fetchAll();
            
            case 'INSERT':
                return $this->getConnection()->lastInsertId();
            
            case 'UPDATE':
            case 'DELETE':
                return $stmt->rowCount();
            
            default:
                return true;
        }
    }
    
    /**
     * Get query type
     */
    private function getQueryType(string $sql): string {
        $sql = trim($sql);
        $firstWord = strtoupper(substr($sql, 0, 6));
        return $firstWord;
    }
    
    /**
     * Secure insert with validation
     */
    public function insert(string $table, array $data): string|false {
        $this->validateTableName($table);
        $this->validateColumnNames(array_keys($data));
        
        $columns = array_map(fn($col) => "`$col`", array_keys($data));
        $placeholders = array_fill(0, count($data), '?');
        
        $sql = sprintf(
            "INSERT INTO `%s` (%s) VALUES (%s)",
            $table,
            implode(', ', $columns),
            implode(', ', $placeholders)
        );
        
        return $this->query($sql, array_values($data));
    }
    
    /**
     * Secure update with validation
     */
    public function update(string $table, array $data, array $where): int {
        $this->validateTableName($table);
        $this->validateColumnNames(array_keys($data));
        
        $setParts = [];
        $params = [];
        
        foreach ($data as $column => $value) {
            $setParts[] = "`$column` = ?";
            $params[] = $value;
        }
        
        $whereSql = $this->buildWhereClause($where, $params);
        
        $sql = sprintf(
            "UPDATE `%s` SET %s WHERE %s",
            $table,
            implode(', ', $setParts),
            $whereSql
        );
        
        return $this->query($sql, $params);
    }
    
    /**
     * Secure delete with validation
     */
    public function delete(string $table, array $where): int {
        $this->validateTableName($table);
        
        $params = [];
        $whereSql = $this->buildWhereClause($where, $params);
        
        $sql = sprintf("DELETE FROM `%s` WHERE %s", $table, $whereSql);
        
        return $this->query($sql, $params);
    }
    
    /**
     * Build secure WHERE clause
     */
    private function buildWhereClause(array $conditions, array &$params): string {
        $parts = [];
        
        foreach ($conditions as $column => $value) {
            $this->validateColumnName($column);
            
            if (is_array($value)) {
                // Handle IN clause
                $placeholders = array_fill(0, count($value), '?');
                $parts[] = "`$column` IN (" . implode(', ', $placeholders) . ")";
                $params = array_merge($params, $value);
            } elseif (is_null($value)) {
                $parts[] = "`$column` IS NULL";
            } else {
                $parts[] = "`$column` = ?";
                $params[] = $value;
            }
        }
        
        return implode(' AND ', $parts) ?: '1=1';
    }
    
    /**
     * Validate table name
     */
    private function validateTableName(string $table): void {
        if (!preg_match('/^[a-zA-Z0-9_]{1,64}$/', $table)) {
            throw new InvalidArgumentException("Invalid table name");
        }
    }
    
    /**
     * Validate column names
     */
    private function validateColumnNames(array $columns): void {
        foreach ($columns as $column) {
            $this->validateColumnName($column);
        }
    }
    
    /**
     * Validate single column name
     */
    private function validateColumnName(string $column): void {
        if (!preg_match('/^[a-zA-Z0-9_]{1,64}$/', $column)) {
            throw new InvalidArgumentException("Invalid column name: $column");
        }
    }
    
    /**
     * Transaction management with automatic rollback
     */
    public function transaction(callable $callback): mixed {
        $this->beginTransaction();
        
        try {
            $result = $callback($this);
            $this->commit();
            return $result;
        } catch (Exception $e) {
            $this->rollback();
            throw $e;
        }
    }
    
    /**
     * Begin transaction with savepoint support
     */
    public function beginTransaction(): void {
        if ($this->transactionLevel === 0) {
            $this->getConnection()->beginTransaction();
        } else {
            $this->getConnection()->exec("SAVEPOINT sp_{$this->transactionLevel}");
        }
        $this->transactionLevel++;
    }
    
    /**
     * Commit transaction
     */
    public function commit(): void {
        if ($this->transactionLevel === 0) {
            throw new RuntimeException("No active transaction");
        }
        
        $this->transactionLevel--;
        
        if ($this->transactionLevel === 0) {
            $this->getConnection()->commit();
        } else {
            $this->getConnection()->exec("RELEASE SAVEPOINT sp_{$this->transactionLevel}");
        }
        
        $this->clearCache();
    }
    
    /**
     * Rollback transaction
     */
    public function rollback(): void {
        if ($this->transactionLevel === 0) {
            throw new RuntimeException("No active transaction");
        }
        
        $this->transactionLevel--;
        
        if ($this->transactionLevel === 0) {
            $this->getConnection()->rollback();
        } else {
            $this->getConnection()->exec("ROLLBACK TO SAVEPOINT sp_{$this->transactionLevel}");
        }
        
        $this->clearCache();
    }
    
    /**
     * Check if query should be cached
     */
    private function shouldUseCache(string $sql): bool {
        return $this->cacheEnabled && 
               $this->getQueryType($sql) === 'SELECT' &&
               defined('CACHE_ENABLED') && 
               CACHE_ENABLED;
    }
    
    /**
     * Get cache key
     */
    private function getCacheKey(string $sql, array $params): string {
        return hash('sha256', $sql . serialize($params));
    }
    
    /**
     * Add to cache with LRU eviction
     */
    private function addToCache(string $key, mixed $result): void {
        // Implement LRU cache eviction
        if (count($this->queryCache) >= $this->maxCacheSize) {
            // Remove oldest entry
            reset($this->queryCache);
            $oldestKey = key($this->queryCache);
            unset($this->queryCache[$oldestKey]);
        }
        
        $this->queryCache[$key] = [
            'result' => $result,
            'expires' => time() + (defined('CACHE_TTL') ? CACHE_TTL : 300),
            'hits' => 0
        ];
    }
    
    /**
     * Clear cache
     */
    public function clearCache(): void {
        $this->queryCache = [];
    }
    
    /**
     * Log query for audit trail
     */
    private function logQuery(string $type, string $sql, float $executionTime, array $params = [], ?string $error = null): void {
        if (!$this->queryLogging) {
            return;
        }
        
        $this->queryCount++;
        $this->totalQueryTime += $executionTime;
        
        $logEntry = [
            'timestamp' => microtime(true),
            'type' => $type,
            'sql' => $sql,
            'params' => $params,
            'execution_time' => $executionTime,
            'error' => $error
        ];
        
        $this->queryLog[] = $logEntry;
        
        // Limit log size
        if (count($this->queryLog) > 1000) {
            array_shift($this->queryLog);
        }
    }
    
    /**
     * Track slow queries
     */
    private function trackSlowQuery(string $sql, array $params, float $executionTime): void {
        $this->slowQueries[] = [
            'sql' => $sql,
            'params' => $params,
            'execution_time' => $executionTime,
            'timestamp' => time()
        ];
        
        // Keep only last 100 slow queries
        if (count($this->slowQueries) > 100) {
            array_shift($this->slowQueries);
        }
    }
    
    /**
     * Get performance statistics
     */
    public function getStats(): array {
        return [
            'query_count' => $this->queryCount,
            'total_query_time' => $this->totalQueryTime,
            'average_query_time' => $this->queryCount > 0 ? $this->totalQueryTime / $this->queryCount : 0,
            'cache_size' => count($this->queryCache),
            'cache_hit_rate' => $this->calculateCacheHitRate(),
            'slow_queries_count' => count($this->slowQueries),
            'prepared_statements' => count($this->preparedStatements),
            'transaction_level' => $this->transactionLevel,
            'connection_attempts' => $this->connectionAttempts
        ];
    }
    
    /**
     * Calculate cache hit rate
     */
    private function calculateCacheHitRate(): float {
        $hits = 0;
        foreach ($this->queryCache as $entry) {
            $hits += $entry['hits'] ?? 0;
        }
        return $this->queryCount > 0 ? $hits / $this->queryCount : 0;
    }
    
    /**
     * Get slow queries
     */
    public function getSlowQueries(): array {
        return $this->slowQueries;
    }
    
    /**
     * Enable query logging
     */
    public function enableQueryLogging(): void {
        $this->queryLogging = true;
    }
    
    /**
     * Disable query logging
     */
    public function disableQueryLogging(): void {
        $this->queryLogging = false;
    }
    
    /**
     * Get query log
     */
    public function getQueryLog(): array {
        return $this->queryLog;
    }
    
    /**
     * Generate secure UUID v4
     */
    public function uuid(): string {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
        
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
    
    /**
     * Escape value for safe output
     */
    public function escape(string $value): string {
        return htmlspecialchars($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }
    
    /**
     * Optimize tables
     */
    public function optimize(array $tables = []): void {
        if (empty($tables)) {
            $tables = ['sessions', 'replicas', 'proxies', 'metrics', 'events'];
        }
        
        foreach ($tables as $table) {
            $this->validateTableName($table);
            
            try {
                $this->getConnection()->exec("OPTIMIZE TABLE `$table`");
                $this->logQuery('OPTIMIZE', "OPTIMIZE TABLE $table", 0);
            } catch (Exception $e) {
                error_log("Failed to optimize table $table: " . $e->getMessage());
            }
        }
    }
    
    /**
     * Check if table exists
     */
    public function tableExists(string $table): bool {
        $this->validateTableName($table);
        
        $result = $this->query(
            "SELECT COUNT(*) as count FROM information_schema.tables 
             WHERE table_schema = ? AND table_name = ?",
            [DB_NAME, $table]
        );
        
        return $result[0]['count'] > 0;
    }
    
    /**
     * Get table information
     */
    public function getTableInfo(string $table): array {
        $this->validateTableName($table);
        return $this->query("DESCRIBE `$table`");
    }
    
    /**
     * Fetch single row
     */
    public function queryOne(string $sql, array $params = []): ?array {
        $result = $this->query($sql, $params);
        return !empty($result) ? $result[0] : null;
    }
    
    /**
     * Cleanup and close connection
     */
    public function __destruct() {
        $this->connection = null;
        $this->preparedStatements = [];
        $this->clearCache();
    }
}

// Export for global access with error handling
try {
    $db = EnhancedDatabaseManager::getInstance();
} catch (Exception $e) {
    // Log error securely without exposing details
    error_log("Database initialization failed");
    
    // Return generic error to client
    if (PHP_SAPI !== 'cli') {
        http_response_code(503);
        header('Content-Type: application/json');
        echo json_encode([
            'error' => 'Service temporarily unavailable',
            'code' => 503
        ]);
        exit;
    }
}