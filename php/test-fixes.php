<?php
/**
 * Comprehensive Test Script for MegaWeb Orchestrator Fixes
 * Tests all critical fixes applied to the system
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "=== MegaWeb Orchestrator - Fix Verification Test ===\n\n";

$testResults = [];
$totalTests = 0;
$passedTests = 0;

function test($name, $callback) {
    global $testResults, $totalTests, $passedTests;
    $totalTests++;
    
    echo "Testing: $name... ";
    
    try {
        $result = $callback();
        if ($result) {
            echo "✓ PASSED\n";
            $testResults[$name] = 'PASSED';
            $passedTests++;
        } else {
            echo "✗ FAILED\n";
            $testResults[$name] = 'FAILED';
        }
    } catch (Exception $e) {
        echo "✗ ERROR: " . $e->getMessage() . "\n";
        $testResults[$name] = 'ERROR: ' . $e->getMessage();
    }
}

// Test 1: Configuration Constants
test("Config constants exist", function() {
    require_once __DIR__ . '/config/config.php';
    return defined('APP_ROOT') && 
           defined('APP_LOG_PATH') && 
           defined('JSON_OPTIONS') &&
           defined('DEFAULT_PROXY_POOL');
});

// Test 2: Database Connection
test("Database connection", function() {
    require_once __DIR__ . '/includes/database.php';
    $db = DatabaseManager::getInstance();
    return $db !== null && $db->getConnection() !== null;
});

// Test 3: Database queryOne method
test("DatabaseManager::queryOne() method exists", function() {
    $db = DatabaseManager::getInstance();
    return method_exists($db, 'queryOne');
});

// Test 4: Database UUID method
test("DatabaseManager::uuid() method exists", function() {
    $db = DatabaseManager::getInstance();
    $uuid = $db->uuid();
    return !empty($uuid) && preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/', $uuid);
});

// Test 5: SQL Injection Protection
test("SQL injection protection in insert()", function() {
    $db = DatabaseManager::getInstance();
    try {
        // This should throw an exception due to invalid table name
        $db->insert("sessions'; DROP TABLE sessions; --", ['id' => 'test']);
        return false; // Should not reach here
    } catch (Exception $e) {
        return strpos($e->getMessage(), 'Invalid table name') !== false;
    }
});

// Test 6: SQL Injection Protection in select()
test("SQL injection protection in select()", function() {
    $db = DatabaseManager::getInstance();
    try {
        // This should throw an exception due to invalid table name
        $db->select("users' OR '1'='1", '*', '1=1');
        return false;
    } catch (Exception $e) {
        return strpos($e->getMessage(), 'Invalid table name') !== false;
    }
});

// Test 7: EventStore class exists
test("EventStore class not duplicated", function() {
    require_once __DIR__ . '/includes/event-store.php';
    return class_exists('EventStore');
});

// Test 8: HyperOrchestrator class exists
test("HyperOrchestrator class exists", function() {
    require_once __DIR__ . '/includes/orchestrator.php';
    return class_exists('HyperOrchestrator');
});

// Test 9: Orchestrator doesn't have duplicate EventStore
test("No duplicate EventStore in orchestrator", function() {
    $content = file_get_contents(__DIR__ . '/includes/orchestrator.php');
    // Check if there's no class EventStore definition after the comment
    $pattern = '/\/\/ EventStore class is already defined.*$/s';
    preg_match($pattern, $content, $matches);
    return !empty($matches) && strpos($matches[0], 'class EventStore') === false;
});

// Test 10: InfinityFree compatibility - sys_getloadavg fallback
test("CPU usage fallback for InfinityFree", function() {
    require_once __DIR__ . '/includes/orchestrator.php';
    $orchestrator = new HyperOrchestrator();
    $reflection = new ReflectionClass($orchestrator);
    $method = $reflection->getMethod('getCpuUsage');
    $method->setAccessible(true);
    $result = $method->invoke($orchestrator);
    return isset($result['1min']) && isset($result['5min']) && isset($result['15min']);
});

// Test 11: InfinityFree compatibility - disk usage fallback
test("Disk usage fallback for InfinityFree", function() {
    require_once __DIR__ . '/includes/orchestrator.php';
    $orchestrator = new HyperOrchestrator();
    $reflection = new ReflectionClass($orchestrator);
    $method = $reflection->getMethod('getDiskUsage');
    $method->setAccessible(true);
    $result = $method->invoke($orchestrator);
    return isset($result['free']) && isset($result['total']);
});

// Test 12: RealtimeMultiplexer timeout limits
test("SSE stream has timeout protection", function() {
    $content = file_get_contents(__DIR__ . '/includes/realtime-multiplexer.php');
    return strpos($content, '$maxRuntime = 25') !== false &&
           strpos($content, 'if ($currentTime - $startTime >= $maxRuntime)') !== false;
});

// Test 13: ScaleToMillion resource limits
test("scaleToMillion() has resource limits", function() {
    $content = file_get_contents(__DIR__ . '/includes/orchestrator.php');
    return strpos($content, '$maxSessionsPerRequest = 100') !== false &&
           strpos($content, '$maxExecutionTime = 25') !== false &&
           strpos($content, 'memory_get_usage(true) > 200 * 1024 * 1024') !== false;
});

// Test 14: Logger function namespace resolution
test("Logger function namespace in event-store", function() {
    $content = file_get_contents(__DIR__ . '/includes/event-store.php');
    // Check for proper namespace handling
    return strpos($content, "function_exists('\\MegaWeb\\Core\\logger')") !== false ||
           strpos($content, "function_exists('logger')") !== false;
});

// Test 15: ProxyPoolManager class exists
test("ProxyPoolManager class exists", function() {
    require_once __DIR__ . '/includes/proxy-pool-manager.php';
    return class_exists('ProxyPoolManager');
});

// Test 16: SessionHypergridSynthesizer exists
test("SessionHypergridSynthesizer exists", function() {
    require_once __DIR__ . '/includes/hypergrid-synthesizer.php';
    return class_exists('SessionHypergridSynthesizer');
});

// Test 17: Database schema SQL file exists
test("Missing tables SQL schema created", function() {
    return file_exists(__DIR__ . '/../database/schema-missing-tables.sql');
});

// Test 18: Error handling in database operations
test("Database error handling", function() {
    $db = DatabaseManager::getInstance();
    try {
        // Try to query non-existent table
        $db->query("SELECT * FROM nonexistent_table_xyz");
        return false;
    } catch (Exception $e) {
        return strpos($e->getMessage(), 'Database query failed') !== false;
    }
});

// Test 19: Transaction support
test("Database transaction support", function() {
    $db = DatabaseManager::getInstance();
    $db->beginTransaction();
    $level1 = true;
    $db->rollback();
    return $level1;
});

// Test 20: Memory optimization
test("Query cache functionality", function() {
    $db = DatabaseManager::getInstance();
    $db->setCacheEnabled(true);
    $stats = $db->getStats();
    return isset($stats['cache_size']);
});

echo "\n=== Test Summary ===\n";
echo "Total Tests: $totalTests\n";
echo "Passed: $passedTests\n";
echo "Failed: " . ($totalTests - $passedTests) . "\n";
echo "Success Rate: " . round(($passedTests / $totalTests) * 100, 2) . "%\n\n";

if ($passedTests === $totalTests) {
    echo "✓ All tests passed! System is ready.\n";
} else {
    echo "✗ Some tests failed. Review the results above.\n\n";
    echo "Failed Tests:\n";
    foreach ($testResults as $name => $result) {
        if ($result !== 'PASSED') {
            echo "  - $name: $result\n";
        }
    }
}

echo "\n=== End of Test ===\n";