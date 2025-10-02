<?php
/**
 * MegaWeb Orchestrator - Installation Process Handler
 * Backend processor for installation
 */

header('Content-Type: application/json');

// Get installation parameters
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data) {
    echo json_encode([
        'success' => false,
        'message' => 'Invalid installation data'
    ]);
    exit;
}

// Extract configuration
$dbHost = $data['db_host'] ?? 'localhost';
$dbName = $data['db_name'] ?? '';
$dbUser = $data['db_user'] ?? '';
$dbPass = $data['db_pass'] ?? '';
$appUrl = $data['app_url'] ?? '';
$appEnv = $data['app_env'] ?? 'production';
$appDebug = isset($data['app_debug']) ? 'true' : 'false';

$createTables = isset($data['create_tables']);
$seedData = isset($data['seed_data']);
$createConfig = isset($data['create_config']);

// Validation
if (empty($dbName) || empty($dbUser)) {
    echo json_encode([
        'success' => false,
        'message' => 'Database name and username are required'
    ]);
    exit;
}

$errors = [];
$steps = [];

// Step 1: Test database connection
try {
    $dsn = "mysql:host=$dbHost;charset=utf8mb4";
    $pdo = new PDO($dsn, $dbUser, $dbPass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
    
    // Check if database exists, create if not
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `$dbName` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("USE `$dbName`");
    
    $steps[] = "✓ Database connection successful";
    
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Database connection failed',
        'details' => $e->getMessage()
    ]);
    exit;
}

// Step 2: Create configuration file
if ($createConfig) {
    try {
        $configContent = "<?php\n";
        $configContent .= "// MegaWeb Orchestrator - Auto-generated Configuration\n";
        $configContent .= "// Generated on: " . date('Y-m-d H:i:s') . "\n\n";
        $configContent .= "putenv('DB_HOST=$dbHost');\n";
        $configContent .= "putenv('DB_NAME=$dbName');\n";
        $configContent .= "putenv('DB_USER=$dbUser');\n";
        $configContent .= "putenv('DB_PASS=$dbPass');\n";
        $configContent .= "putenv('APP_URL=$appUrl');\n";
        $configContent .= "putenv('APP_ENV=$appEnv');\n";
        $configContent .= "putenv('APP_DEBUG=$appDebug');\n";
        
        file_put_contents(__DIR__ . '/config/env.php', $configContent);
        $steps[] = "✓ Configuration file created";
        
    } catch (Exception $e) {
        $errors[] = "Failed to create configuration file: " . $e->getMessage();
    }
}

// Step 3: Create database tables
if ($createTables) {
    try {
        // Read schema file
        $schemaFile = __DIR__ . '/../database/schema.sql';
        
        if (!file_exists($schemaFile)) {
            throw new Exception("Schema file not found");
        }
        
        $schema = file_get_contents($schemaFile);
        
        // Split into individual statements
        $statements = array_filter(
            array_map('trim', 
                preg_split('/;\s*$/m', $schema)
            ),
            function($stmt) {
                return !empty($stmt) && 
                       strpos($stmt, '--') !== 0 && 
                       strpos($stmt, 'DELIMITER') !== 0;
            }
        );
        
        // Execute each statement
        foreach ($statements as $statement) {
            if (empty($statement)) continue;
            
            try {
                $pdo->exec($statement);
            } catch (PDOException $e) {
                // Skip if table/view already exists
                if (strpos($e->getMessage(), 'already exists') === false) {
                    throw $e;
                }
            }
        }
        
        $steps[] = "✓ Database tables created successfully";
        
    } catch (Exception $e) {
        $errors[] = "Failed to create tables: " . $e->getMessage();
    }
}

// Step 4: Insert sample data
if ($seedData) {
    try {
        // Insert default proxy pool
        $pdo->exec("
            INSERT INTO proxy_pools (id, pool_name, regions, countries, active, total_proxies) 
            VALUES (
                'global-pool', 
                'Global Proxy Pool',
                JSON_ARRAY('us-east', 'eu-west', 'asia-pacific'),
                JSON_ARRAY('US', 'GB', 'DE', 'JP', 'SG'),
                TRUE, 
                0
            )
            ON DUPLICATE KEY UPDATE pool_name = VALUES(pool_name)
        ");
        
        // Insert some sample proxies
        $sampleProxies = [
            ['US', 'us-east', 'proxy1.example.com', 8080],
            ['GB', 'eu-west', 'proxy2.example.com', 8080],
            ['DE', 'eu-west', 'proxy3.example.com', 8080],
            ['JP', 'asia-pacific', 'proxy4.example.com', 8080],
            ['SG', 'asia-pacific', 'proxy5.example.com', 8080],
        ];
        
        foreach ($sampleProxies as $proxy) {
            $pdo->exec("
                INSERT INTO proxies (id, pool_id, host, port, country, region, active)
                VALUES (
                    UUID(),
                    'global-pool',
                    '{$proxy[2]}',
                    {$proxy[3]},
                    '{$proxy[0]}',
                    '{$proxy[1]}',
                    TRUE
                )
                ON DUPLICATE KEY UPDATE active = TRUE
            ");
        }
        
        $steps[] = "✓ Sample data inserted successfully";
        
    } catch (Exception $e) {
        $errors[] = "Failed to insert sample data: " . $e->getMessage();
    }
}

// Step 5: Test configuration
try {
    // Include the config to test it
    $_ENV['DB_HOST'] = $dbHost;
    $_ENV['DB_NAME'] = $dbName;
    $_ENV['DB_USER'] = $dbUser;
    $_ENV['DB_PASS'] = $dbPass;
    
    // Test query
    $result = $pdo->query("SELECT COUNT(*) as count FROM sessions")->fetch();
    $steps[] = "✓ Configuration test passed";
    
} catch (Exception $e) {
    $errors[] = "Configuration test failed: " . $e->getMessage();
}

// Final result
if (empty($errors)) {
    echo json_encode([
        'success' => true,
        'message' => 'Installation completed successfully!',
        'steps' => $steps
    ]);
} else {
    echo json_encode([
        'success' => false,
        'message' => 'Installation completed with errors',
        'steps' => $steps,
        'errors' => $errors
    ]);
}
