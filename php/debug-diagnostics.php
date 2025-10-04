<?php
/**
 * Diagnostic Script - Validates Critical Issues
 * Run this to confirm the identified problems
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

$diagnostics = [
    'timestamp' => date('Y-m-d H:i:s'),
    'php_version' => PHP_VERSION,
    'issues_found' => [],
    'tests_passed' => [],
    'critical_count' => 0
];

echo "=== MegaWeb Orchestrator Diagnostic Tool ===\n\n";

// Test 1: Check forbidden functions
echo "[TEST 1] Checking forbidden functions...\n";
$forbidden = ['ini_set', 'sys_getloadavg', 'disk_free_space', 'disk_total_space'];
foreach ($forbidden as $func) {
    if (!function_exists($func)) {
        $diagnostics['issues_found'][] = "CRITICAL: Function '$func' is disabled";
        $diagnostics['critical_count']++;
        echo "  ❌ $func is DISABLED (InfinityFree restriction)\n";
    } else {
        echo "  ✓ $func is available\n";
    }
}

// Test 2: Check database connection
echo "\n[TEST 2] Testing database connection...\n";
$configFile = __DIR__ . '/config/config.php';
if (file_exists($configFile)) {
    try {
        require_once $configFile;
        require_once __DIR__ . '/includes/database.php';
        
        $db = DatabaseManager::getInstance();
        
        // Check if critical methods exist
        $methods = ['uuid', 'tableExists', 'callProcedure', 'queryOne'];
        foreach ($methods as $method) {
            if (!method_exists($db, $method)) {
                $diagnostics['issues_found'][] = "CRITICAL: DatabaseManager::$method() method missing";
                $diagnostics['critical_count']++;
                echo "  ❌ Method $method() does NOT exist\n";
            } else {
                echo "  ✓ Method $method() exists\n";
            }
        }
        
        // Test basic query
        $result = $db->query("SELECT 1 as test");
        if ($result) {
            echo "  ✓ Database query successful\n";
            $diagnostics['tests_passed'][] = 'Database connection working';
        }
        
    } catch (Exception $e) {
        $diagnostics['issues_found'][] = "DATABASE ERROR: " . $e->getMessage();
        $diagnostics['critical_count']++;
        echo "  ❌ Database error: " . $e->getMessage() . "\n";
    }
} else {
    echo "  ⚠️  Config file not found - run install.php first\n";
}

// Test 3: Check for duplicate class definitions
echo "\n[TEST 3] Checking for duplicate classes...\n";
$files = [
    'includes/orchestrator.php',
    'includes/event-store.php'
];

foreach ($files as $file) {
    $path = __DIR__ . '/' . $file;
    if (file_exists($path)) {
        $content = file_get_contents($path);
        preg_match_all('/class\s+(\w+)/', $content, $matches);
        $classes = $matches[1];
        $duplicates = array_count_values($classes);
        
        foreach ($duplicates as $class => $count) {
            if ($count > 1) {
                $diagnostics['issues_found'][] = "CRITICAL: Class '$class' defined $count times in $file";
                $diagnostics['critical_count']++;
                echo "  ❌ Duplicate class '$class' in $file\n";
            }
        }
    }
}

// Test 4: Check undefined constants
echo "\n[TEST 4] Checking for undefined constants...\n";
$constants = ['JSON_OPTIONS', 'DEFAULT_PROXY_POOL', 'APP_LOG_PATH', 'APP_DEBUG'];
foreach ($constants as $const) {
    if (!defined($const)) {
        $diagnostics['issues_found'][] = "WARNING: Constant '$const' not defined";
        echo "  ⚠️  Constant $const is NOT defined\n";
    } else {
        echo "  ✓ Constant $const is defined\n";
    }
}

// Test 5: Memory and execution limits
echo "\n[TEST 5] Checking resource limits...\n";
$memory_limit = ini_get('memory_limit');
$max_execution = ini_get('max_execution_time');
echo "  Memory limit: $memory_limit\n";
echo "  Max execution time: $max_execution seconds\n";

if (intval($memory_limit) < 256) {
    $diagnostics['issues_found'][] = "WARNING: Low memory limit ($memory_limit)";
    echo "  ⚠️  Memory limit may be insufficient for 1M sessions\n";
}

if (intval($max_execution) <= 30 && intval($max_execution) > 0) {
    $diagnostics['issues_found'][] = "CRITICAL: Execution time limit too low ($max_execution seconds)";
    $diagnostics['critical_count']++;
    echo "  ❌ Execution timeout will kill long operations\n";
}

// Test 6: SQL Injection vulnerabilities
echo "\n[TEST 6] Scanning for SQL injection risks...\n";
$vulnerable_files = [];
$scan_files = glob(__DIR__ . '/includes/*.php');

foreach ($scan_files as $file) {
    $content = file_get_contents($file);
    // Look for dangerous SQL patterns
    if (preg_match('/\$whereClause\s*=.*implode.*WHERE\s+\$whereClause/s', $content)) {
        $vulnerable_files[] = basename($file);
    }
}

if (!empty($vulnerable_files)) {
    $diagnostics['issues_found'][] = "SECURITY: SQL injection risk in: " . implode(', ', $vulnerable_files);
    $diagnostics['critical_count']++;
    echo "  ❌ SQL injection vulnerabilities found in: " . implode(', ', $vulnerable_files) . "\n";
} else {
    echo "  ✓ No obvious SQL injection patterns detected\n";
}

// Test 7: Check file permissions
echo "\n[TEST 7] Checking file permissions...\n";
$writable_needed = ['config'];
foreach ($writable_needed as $dir) {
    $path = __DIR__ . '/' . $dir;
    if (is_writable($path)) {
        echo "  ✓ $dir/ is writable\n";
    } else {
        $diagnostics['issues_found'][] = "WARNING: Directory '$dir' not writable";
        echo "  ⚠️  $dir/ is NOT writable\n";
    }
}

// Summary
echo "\n" . str_repeat('=', 50) . "\n";
echo "DIAGNOSTIC SUMMARY\n";
echo str_repeat('=', 50) . "\n";
echo "Critical Issues Found: " . $diagnostics['critical_count'] . "\n";
echo "Total Issues: " . count($diagnostics['issues_found']) . "\n";
echo "Tests Passed: " . count($diagnostics['tests_passed']) . "\n\n";

if ($diagnostics['critical_count'] > 0) {
    echo "⚠️  CRITICAL ISSUES DETECTED! The application will not function properly.\n\n";
    echo "Issues found:\n";
    foreach ($diagnostics['issues_found'] as $issue) {
        echo "  • $issue\n";
    }
} else {
    echo "✅ No critical issues detected.\n";
}

// Save diagnostic log
$logFile = __DIR__ . '/diagnostic-log-' . date('Y-m-d-His') . '.json';
file_put_contents($logFile, json_encode($diagnostics, JSON_PRETTY_PRINT));
echo "\nDiagnostic log saved to: " . basename($logFile) . "\n";

// Return JSON for API usage
if (php_sapi_name() !== 'cli') {
    header('Content-Type: application/json');
    echo json_encode($diagnostics);
}