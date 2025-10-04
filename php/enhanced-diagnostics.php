<?php
/**
 * Enhanced Diagnostic Script for MegaWeb Orchestrator
 * Comprehensive validation of all system components
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

$diagnostics = [
    'timestamp' => date('Y-m-d H:i:s'),
    'php_version' => PHP_VERSION,
    'issues' => [],
    'warnings' => [],
    'info' => [],
    'critical_count' => 0,
    'warning_count' => 0
];

echo "=== MegaWeb Orchestrator Enhanced Diagnostics ===\n\n";

// Helper function to add issue
function addIssue(&$diagnostics, $type, $message, $severity = 'critical') {
    if ($severity === 'critical') {
        $diagnostics['issues'][] = "[CRITICAL] $message";
        $diagnostics['critical_count']++;
        echo "❌ [CRITICAL] $message\n";
    } elseif ($severity === 'warning') {
        $diagnostics['warnings'][] = "[WARNING] $message";
        $diagnostics['warning_count']++;
        echo "⚠️  [WARNING] $message\n";
    } else {
        $diagnostics['info'][] = "[INFO] $message";
        echo "ℹ️  [INFO] $message\n";
    }
}

// Test 1: Check PHP version compatibility
echo "[TEST 1] PHP Version Check\n";
if (version_compare(PHP_VERSION, '7.2.0', '<')) {
    addIssue($diagnostics, 'PHP', "PHP version " . PHP_VERSION . " is too old. Minimum required: 7.2.0");
} else {
    echo "✓ PHP version " . PHP_VERSION . " is compatible\n";
}
echo "\n";

// Test 2: Check required PHP extensions
echo "[TEST 2] Required PHP Extensions\n";
$required_extensions = ['pdo', 'pdo_mysql', 'json', 'mbstring', 'openssl'];
foreach ($required_extensions as $ext) {
    if (!extension_loaded($ext)) {
        addIssue($diagnostics, 'Extension', "Required PHP extension '$ext' is not loaded");
    } else {
        echo "✓ Extension '$ext' is loaded\n";
    }
}
echo "\n";

// Test 3: Check file permissions
echo "[TEST 3] File Permissions\n";
$writable_dirs = ['config', 'logs'];
foreach ($writable_dirs as $dir) {
    $path = __DIR__ . '/' . $dir;
    if (!is_dir($path)) {
        if (!@mkdir($path, 0755, true)) {
            addIssue($diagnostics, 'Permission', "Cannot create directory: $dir", 'warning');
        } else {
            echo "✓ Created directory: $dir\n";
        }
    } elseif (!is_writable($path)) {
        addIssue($diagnostics, 'Permission', "Directory not writable: $dir", 'warning');
    } else {
        echo "✓ Directory '$dir' is writable\n";
    }
}
echo "\n";

// Test 4: Configuration file check
echo "[TEST 4] Configuration Files\n";
$config_file = __DIR__ . '/config/config.php';
if (!file_exists($config_file)) {
    addIssue($diagnostics, 'Config', "Configuration file not found: config/config.php");
} else {
    require_once $config_file;
    
    // Check all required constants
    $required_constants = [
        'DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASS', 'DB_CHARSET',
        'APP_ENV', 'APP_DEBUG', 'APP_URL', 'APP_ROOT', 'APP_LOG_PATH',
        'DEFAULT_PROXY_POOL', 'JSON_OPTIONS'
    ];
    
    foreach ($required_constants as $const) {
        if (!defined($const)) {
            addIssue($diagnostics, 'Config', "Required constant '$const' is not defined");
        } else {
            echo "✓ Constant '$const' is defined\n";
        }
    }
}
echo "\n";

// Test 5: Database connectivity
echo "[TEST 5] Database Connectivity\n";
if (file_exists($config_file)) {
    try {
        require_once __DIR__ . '/includes/database.php';
        
        $db = DatabaseManager::getInstance();
        
        // Test basic query
        $result = $db->query("SELECT 1 as test");
        if ($result && isset($result[0]['test']) && $result[0]['test'] == 1) {
            echo "✓ Database connection successful\n";
            
            // Check if tables exist
            $required_tables = ['sessions', 'replicas', 'proxies', 'events', 'metrics'];
            foreach ($required_tables as $table) {
                if (!$db->tableExists($table)) {
                    addIssue($diagnostics, 'Database', "Required table '$table' does not exist", 'warning');
                } else {
                    echo "✓ Table '$table' exists\n";
                }
            }
        }
    } catch (Exception $e) {
        addIssue($diagnostics, 'Database', "Database connection failed: " . $e->getMessage());
    }
}
echo "\n";

// Test 6: Check for class loading issues
echo "[TEST 6] Class Loading\n";
$classes = [
    'DatabaseManager' => 'includes/database.php',
    'EventStore' => 'includes/event-store.php',
    'HyperOrchestrator' => 'includes/orchestrator.php',
    'ProxyPoolManager' => 'includes/proxy-pool-manager.php',
    'SessionHypergridSynthesizer' => 'includes/hypergrid-synthesizer.php',
    'RealtimeMultiplexer' => 'includes/realtime-multiplexer.php'
];

foreach ($classes as $class => $file) {
    $filepath = __DIR__ . '/' . $file;
    if (!file_exists($filepath)) {
        addIssue($diagnostics, 'Class', "File not found for class '$class': $file");
    } else {
        require_once $filepath;
        if (!class_exists($class)) {
            addIssue($diagnostics, 'Class', "Class '$class' not found in $file");
        } else {
            echo "✓ Class '$class' loaded successfully\n";
        }
    }
}
echo "\n";

// Test 7: Check for syntax errors in PHP files
echo "[TEST 7] PHP Syntax Check\n";
$php_files = glob(__DIR__ . '/includes/*.php');
$php_files[] = __DIR__ . '/config/config.php';

foreach ($php_files as $file) {
    $output = [];
    $return_var = 0;
    exec("php -l " . escapeshellarg($file) . " 2>&1", $output, $return_var);
    
    if ($return_var !== 0) {
        addIssue($diagnostics, 'Syntax', "Syntax error in " . basename($file) . ": " . implode("\n", $output));
    } else {
        echo "✓ " . basename($file) . " - No syntax errors\n";
    }
}
echo "\n";

// Test 8: Check for namespace issues
echo "[TEST 8] Namespace and Function Issues\n";
$files_to_check = [
    'includes/event-store.php',
    'includes/orchestrator.php'
];

foreach ($files_to_check as $file) {
    $filepath = __DIR__ . '/' . $file;
    if (file_exists($filepath)) {
        $content = file_get_contents($filepath);
        
        // Check for namespace issues
        if (preg_match('/namespace\s+([^;]+);/', $content, $matches)) {
            addIssue($diagnostics, 'Namespace', "Unexpected namespace in $file: " . $matches[1], 'warning');
        }
        
        // Check for logger function calls
        if (preg_match_all('/logger\(\)/', $content, $matches)) {
            $count = count($matches[0]);
            addIssue($diagnostics, 'Logger', "Found $count logger() calls in $file - verify they're properly handled", 'info');
        }
    }
}
echo "\n";

// Test 9: Check for SQL injection vulnerabilities
echo "[TEST 9] SQL Injection Vulnerability Check\n";
$vulnerable_patterns = [
    '/\$whereClause\s*=\s*implode.*WHERE\s+\$whereClause(?!\s+LIMIT|\s+ORDER)/' => 'Direct WHERE clause concatenation',
    '/\$sql\s*\.=.*\$_(GET|POST|REQUEST)/' => 'Direct user input in SQL',
    '/query\s*\(\s*"[^"]*\$[^"]*"/' => 'Variable interpolation in query',
];

foreach ($php_files as $file) {
    if (strpos($file, 'database.php') !== false) continue; // Skip database.php itself
    
    $content = file_get_contents($file);
    foreach ($vulnerable_patterns as $pattern => $description) {
        if (preg_match($pattern, $content)) {
            addIssue($diagnostics, 'Security', "$description found in " . basename($file), 'warning');
        }
    }
}
echo "✓ SQL injection scan complete\n\n";

// Test 10: Check for resource limit issues
echo "[TEST 10] Resource Limit Issues\n";
$content = file_get_contents(__DIR__ . '/includes/orchestrator.php');

// Check scaleToMillion function
if (preg_match('/function\s+scaleToMillion.*?\{(.*?)\}/s', $content, $matches)) {
    $function_content = $matches[1];
    
    if (!preg_match('/\$maxSessionsPerRequest\s*=\s*\d+/', $function_content)) {
        addIssue($diagnostics, 'Resource', "scaleToMillion() missing session limit", 'warning');
    } else {
        echo "✓ scaleToMillion() has session limit\n";
    }
    
    if (!preg_match('/memory_get_usage/', $function_content)) {
        addIssue($diagnostics, 'Resource', "scaleToMillion() missing memory check", 'warning');
    } else {
        echo "✓ scaleToMillion() has memory check\n";
    }
}

// Check SSE timeout protection
$content = file_get_contents(__DIR__ . '/includes/realtime-multiplexer.php');
if (!preg_match('/\$maxRuntime\s*=\s*\d+/', $content)) {
    addIssue($diagnostics, 'Resource', "SSE stream missing timeout protection", 'critical');
} else {
    echo "✓ SSE stream has timeout protection\n";
}
echo "\n";

// Test 11: Check for missing database methods
echo "[TEST 11] Database Method Check\n";
if (class_exists('DatabaseManager')) {
    $db = DatabaseManager::getInstance();
    $required_methods = ['uuid', 'tableExists', 'queryOne', 'beginTransaction', 'commit', 'rollback'];
    
    foreach ($required_methods as $method) {
        if (!method_exists($db, $method)) {
            addIssue($diagnostics, 'Database', "DatabaseManager missing method: $method()");
        } else {
            echo "✓ DatabaseManager::$method() exists\n";
        }
    }
}
echo "\n";

// Test 12: Check for InfinityFree compatibility
echo "[TEST 12] InfinityFree Compatibility\n";
$forbidden_functions = ['ini_set', 'sys_getloadavg', 'disk_free_space', 'disk_total_space', 'exec', 'shell_exec', 'system'];

foreach ($php_files as $file) {
    $content = file_get_contents($file);
    
    foreach ($forbidden_functions as $func) {
        if (preg_match("/\b$func\s*\(/", $content)) {
            // Check if it's wrapped in function_exists or try-catch
            if (!preg_match("/function_exists\s*\(\s*['\"]" . preg_quote($func, '/') . "['\"]\s*\)|@" . preg_quote($func, '/') . "\s*\(|try\s*{[^}]*" . preg_quote($func, '/') . "/", $content)) {
                addIssue($diagnostics, 'InfinityFree', "Unprotected use of $func() in " . basename($file), 'warning');
            }
        }
    }
}
echo "✓ InfinityFree compatibility check complete\n\n";

// Summary
echo str_repeat('=', 50) . "\n";
echo "DIAGNOSTIC SUMMARY\n";
echo str_repeat('=', 50) . "\n";
echo "Critical Issues: " . $diagnostics['critical_count'] . "\n";
echo "Warnings: " . $diagnostics['warning_count'] . "\n";
echo "Total Issues: " . (count($diagnostics['issues']) + count($diagnostics['warnings'])) . "\n\n";

if ($diagnostics['critical_count'] > 0) {
    echo "⚠️  CRITICAL ISSUES DETECTED!\n\n";
    echo "Critical Issues:\n";
    foreach ($diagnostics['issues'] as $issue) {
        echo "  • $issue\n";
    }
}

if ($diagnostics['warning_count'] > 0) {
    echo "\nWarnings:\n";
    foreach ($diagnostics['warnings'] as $warning) {
        echo "  • $warning\n";
    }
}

if (count($diagnostics['info']) > 0) {
    echo "\nInformational:\n";
    foreach ($diagnostics['info'] as $info) {
        echo "  • $info\n";
    }
}

// Save diagnostic report
$report_file = __DIR__ . '/diagnostic-report-' . date('Y-m-d-His') . '.json';
file_put_contents($report_file, json_encode($diagnostics, JSON_PRETTY_PRINT));
echo "\nDetailed report saved to: " . basename($report_file) . "\n";

// Return status
if ($diagnostics['critical_count'] === 0) {
    echo "\n✅ System appears to be ready for deployment!\n";
    exit(0);
} else {
    echo "\n❌ Critical issues must be resolved before deployment.\n";
    exit(1);
}