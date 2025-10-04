<?php
/**
 * MegaWeb Orchestrator - Advanced Database Connection Manager
 * Optimized for InfinityFree with connection pooling and failover
 */

class DatabaseManager {
    private static $instance = null;
    private $connection = null;
    private $transactionLevel = 0;
    private $queryCache = [];
    private $cacheEnabled = true;
    private $connectionAttempts = 0;
    private $maxConnectionAttempts = 3;
    
    private function __construct() {
        $this->connect();
    }
    
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function connect() {
        $this->connectionAttempts++;
        
        try {
            $dsn = sprintf(
                "mysql:host=%s;dbname=%s;charset=%s",
                DB_HOST,
                DB_NAME,
                DB_CHARSET
            );
            
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_PERSISTENT => true,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES " . DB_CHARSET . " COLLATE " . DB_COLLATE,
                PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true,
                PDO::ATTR_TIMEOUT => 10,
            ];
            
            $this->connection = new PDO($dsn, DB_USER, DB_PASS, $options);
            $this->connectionAttempts = 0;
            
        } catch (PDOException $e) {
            if ($this->connectionAttempts < $this->maxConnectionAttempts) {
                usleep(100000); // Wait 100ms before retry
                return $this->connect();
            }
            
            error_log("Database connection failed: " . $e->getMessage());
            throw new Exception("Database connection failed: " . $e->getMessage());
        }
    }
    
    public function getConnection() {
        // Check if connection is alive
        if ($this->connection === null) {
            $this->connect();
        }
        
        try {
            $this->connection->query('SELECT 1');
        } catch (PDOException $e) {
            error_log("Connection lost, reconnecting...");
            $this->connect();
        }
        
        return $this->connection;
    }
    
    public function query($sql, $params = []) {
        $cacheKey = md5($sql . json_encode($params));
        
        // Check cache for SELECT queries
        if ($this->cacheEnabled && stripos(trim($sql), 'SELECT') === 0) {
            if (isset($this->queryCache[$cacheKey])) {
                $cached = $this->queryCache[$cacheKey];
                if ($cached['expires'] > time()) {
                    return $cached['result'];
                }
            }
        }
        
        try {
            $stmt = $this->getConnection()->prepare($sql);
            $stmt->execute($params);
            
            if (stripos(trim($sql), 'SELECT') === 0) {
                $result = $stmt->fetchAll();
                
                // Cache SELECT results
                if ($this->cacheEnabled && CACHE_ENABLED) {
                    $this->queryCache[$cacheKey] = [
                        'result' => $result,
                        'expires' => time() + CACHE_TTL
                    ];
                }
                
                return $result;
            } elseif (stripos(trim($sql), 'INSERT') === 0) {
                return $this->getConnection()->lastInsertId();
            } else {
                return $stmt->rowCount();
            }
            
        } catch (PDOException $e) {
            error_log("Query failed: " . $e->getMessage() . " SQL: " . $sql);
            throw new Exception("Database query failed: " . $e->getMessage());
        }
    }
    
    public function insert($table, $data) {
        // Validate table name
        if (!preg_match('/^[a-zA-Z0-9_]+$/', $table)) {
            throw new Exception("Invalid table name");
        }
        
        $columns = array_keys($data);
        $values = array_values($data);
        $placeholders = array_fill(0, count($values), '?');
        
        // Escape column names
        $escapedColumns = array_map(function($col) {
            if (!preg_match('/^[a-zA-Z0-9_]+$/', $col)) {
                throw new Exception("Invalid column name: $col");
            }
            return "`$col`";
        }, $columns);
        
        $sql = sprintf(
            "INSERT INTO `%s` (%s) VALUES (%s)",
            $table,
            implode(', ', $escapedColumns),
            implode(', ', $placeholders)
        );
        
        return $this->query($sql, $values);
    }
    
    public function update($table, $data, $where, $whereParams = []) {
        // Validate table name
        if (!preg_match('/^[a-zA-Z0-9_]+$/', $table)) {
            throw new Exception("Invalid table name");
        }
        
        $setParts = [];
        $values = [];
        
        foreach ($data as $column => $value) {
            if (!preg_match('/^[a-zA-Z0-9_]+$/', $column)) {
                throw new Exception("Invalid column name: $column");
            }
            $setParts[] = "`$column` = ?";
            $values[] = $value;
        }
        
        $sql = sprintf(
            "UPDATE `%s` SET %s WHERE %s",
            $table,
            implode(', ', $setParts),
            $where
        );
        
        return $this->query($sql, array_merge($values, $whereParams));
    }
    
    public function delete($table, $where, $whereParams = []) {
        // Validate table name
        if (!preg_match('/^[a-zA-Z0-9_]+$/', $table)) {
            throw new Exception("Invalid table name");
        }
        $sql = sprintf("DELETE FROM `%s` WHERE %s", $table, $where);
        return $this->query($sql, $whereParams);
    }
    
    public function select($table, $columns = '*', $where = '', $whereParams = [], $orderBy = '', $limit = '') {
        // Validate table name
        if (!preg_match('/^[a-zA-Z0-9_]+$/', $table)) {
            throw new Exception("Invalid table name");
        }
        
        // Validate columns (basic check for common cases)
        if ($columns !== '*' && !preg_match('/^[a-zA-Z0-9_,\s\.\`]+$/', $columns)) {
            throw new Exception("Invalid column specification");
        }
        
        $sql = "SELECT $columns FROM `$table`";
        
        if ($where) {
            $sql .= " WHERE $where";
        }
        
        if ($orderBy) {
            // Basic validation for ORDER BY
            if (!preg_match('/^[a-zA-Z0-9_,\s\`]+(ASC|DESC|asc|desc)?$/i', $orderBy)) {
                throw new Exception("Invalid ORDER BY clause");
            }
            $sql .= " ORDER BY $orderBy";
        }
        
        if ($limit) {
            // Validate LIMIT (must be numeric)
            if (!preg_match('/^\d+(\s*,\s*\d+)?$/', $limit)) {
                throw new Exception("Invalid LIMIT clause");
            }
            $sql .= " LIMIT $limit";
        }
        
        return $this->query($sql, $whereParams);
    }
    
    public function beginTransaction() {
        if ($this->transactionLevel === 0) {
            $this->getConnection()->beginTransaction();
        } else {
            $this->getConnection()->exec("SAVEPOINT LEVEL{$this->transactionLevel}");
        }
        $this->transactionLevel++;
    }
    
    public function commit() {
        $this->transactionLevel--;
        
        if ($this->transactionLevel === 0) {
            $this->getConnection()->commit();
        } else {
            $this->getConnection()->exec("RELEASE SAVEPOINT LEVEL{$this->transactionLevel}");
        }
        
        // Clear cache after commit
        $this->clearCache();
    }
    
    public function rollback() {
        $this->transactionLevel--;
        
        if ($this->transactionLevel === 0) {
            $this->getConnection()->rollback();
        } else {
            $this->getConnection()->exec("ROLLBACK TO SAVEPOINT LEVEL{$this->transactionLevel}");
        }
        
        // Clear cache after rollback
        $this->clearCache();
    }
    
    public function clearCache() {
        $this->queryCache = [];
    }
    
    public function setCacheEnabled($enabled) {
        $this->cacheEnabled = $enabled;
    }
    
    public function uuid() {
        // Generate UUID v4
        return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
    }
    
    public function escape($value) {
        return $this->getConnection()->quote($value);
    }
    
    public function callProcedure($name, $params = []) {
        $placeholders = array_fill(0, count($params), '?');
        $sql = sprintf("CALL %s(%s)", $name, implode(', ', $placeholders));
        return $this->query($sql, $params);
    }
    
    public function getTableInfo($table) {
        // Validate table name to prevent SQL injection
        if (!preg_match('/^[a-zA-Z0-9_]+$/', $table)) {
            throw new Exception("Invalid table name");
        }
        return $this->query("DESCRIBE `$table`");
    }
    
    public function tableExists($table) {
        $result = $this->query(
            "SELECT COUNT(*) as count FROM information_schema.tables
             WHERE table_schema = ? AND table_name = ?",
            [DB_NAME, $table]
        );
        return $result[0]['count'] > 0;
    }
    
    public function queryOne($sql, $params = []) {
        $result = $this->query($sql, $params);
        return !empty($result) ? $result[0] : null;
    }
    
    public function optimize() {
        $tables = ['sessions', 'replicas', 'proxies', 'metrics', 'events'];
        foreach ($tables as $table) {
            // Validate table name
            if (!preg_match('/^[a-zA-Z0-9_]+$/', $table)) {
                continue;
            }
            try {
                $this->query("OPTIMIZE TABLE `$table`");
            } catch (Exception $e) {
                error_log("Failed to optimize table $table: " . $e->getMessage());
            }
        }
    }
    
    public function getStats() {
        return [
            'cache_size' => count($this->queryCache),
            'transaction_level' => $this->transactionLevel,
            'connection_attempts' => $this->connectionAttempts,
        ];
    }
    
    public function __destruct() {
        $this->connection = null;
    }
}

// Initialize database connection
try {
    $db = DatabaseManager::getInstance();
} catch (Exception $e) {
    http_response_code(503);
    echo json_encode([
        'error' => 'Service unavailable',
        'message' => APP_DEBUG ? $e->getMessage() : 'Database connection failed'
    ], JSON_OPTIONS);
    exit;
}
