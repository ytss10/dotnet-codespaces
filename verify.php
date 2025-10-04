<?php
/**
 * System Verification Script
 * Checks all components are working correctly
 */

header('Content-Type: application/json');

$results = [
    'timestamp' => date('Y-m-d H:i:s'),
    'checks' => [],
    'overall_status' => 'unknown'
];

// Check 1: PHP Version
$results['checks']['php_version'] = [
    'name' => 'PHP Version',
    'status' => version_compare(PHP_VERSION, '7.4.0', '>=') ? 'pass' : 'fail',
    'value' => PHP_VERSION,
    'required' => '7.4.0+'
];

// Check 2: Required Extensions
$required_extensions = ['pdo', 'pdo_mysql', 'json', 'curl', 'mbstring'];
$missing_extensions = [];
foreach ($required_extensions as $ext) {
    if (!extension_loaded($ext)) {
        $missing_extensions[] = $ext;
    }
}
$results['checks']['extensions'] = [
    'name' => 'PHP Extensions',
    'status' => empty($missing_extensions) ? 'pass' : 'fail',
    'missing' => $missing_extensions,
    'required' => $required_extensions
];

// Check 3: Config File
$config_exists = file_exists(__DIR__ . '/php/config/config.php');
$results['checks']['config_file'] = [
    'name' => 'Configuration File',
    'status' => $config_exists ? 'pass' : 'fail',
    'path' => __DIR__ . '/php/config/config.php'
];

// Check 4: Core Files
$core_files = [
    'php/includes/database.php',
    'php/includes/orchestrator.php',
    'php/includes/event-store.php',
    'php/includes/proxy-pool-manager.php',
    'php/api/index.php',
    'php/public/control-panel.php',
    'php/install.php'
];
$missing_files = [];
foreach ($core_files as $file) {
    if (!file_exists(__DIR__ . '/' . $file)) {
        $missing_files[] = $file;
    }
}
$results['checks']['core_files'] = [
    'name' => 'Core Files',
    'status' => empty($missing_files) ? 'pass' : 'fail',
    'missing' => $missing_files,
    'total' => count($core_files),
    'found' => count($core_files) - count($missing_files)
];

// Check 5: htaccess Files
$htaccess_files = [
    '.htaccess' => __DIR__ . '/.htaccess',
    'php/.htaccess' => __DIR__ . '/php/.htaccess'
];
$htaccess_status = [];
foreach ($htaccess_files as $name => $path) {
    $htaccess_status[$name] = file_exists($path) ? 'found' : 'missing';
}
$results['checks']['htaccess'] = [
    'name' => '.htaccess Files',
    'status' => !in_array('missing', $htaccess_status) ? 'pass' : 'warning',
    'files' => $htaccess_status
];

// Check 6: Database Connection (if config exists)
if ($config_exists) {
    require_once __DIR__ . '/php/config/config.php';
    require_once __DIR__ . '/php/includes/database.php';
    
    try {
        $db = DatabaseManager::getInstance();
        $db->query("SELECT 1");
        $results['checks']['database'] = [
            'name' => 'Database Connection',
            'status' => 'pass',
            'host' => DB_HOST,
            'database' => DB_NAME
        ];
    } catch (Exception $e) {
        $results['checks']['database'] = [
            'name' => 'Database Connection',
            'status' => 'fail',
            'error' => $e->getMessage(),
            'suggestion' => 'Run installation wizard at /php/install.php'
        ];
    }
}

// Check 7: Write Permissions
$writable_dirs = ['php/config'];
$permissions = [];
foreach ($writable_dirs as $dir) {
    $path = __DIR__ . '/' . $dir;
    if (file_exists($path)) {
        $permissions[$dir] = is_writable($path) ? 'writable' : 'not writable';
    } else {
        $permissions[$dir] = 'not found';
    }
}
$results['checks']['permissions'] = [
    'name' => 'Write Permissions',
    'status' => !in_array('not writable', $permissions) ? 'pass' : 'warning',
    'directories' => $permissions
];

// Check 8: Memory Limit
$memory_limit = ini_get('memory_limit');
$memory_bytes = 0;
if (preg_match('/^(\d+)(.)$/', $memory_limit, $matches)) {
    $memory_bytes = $matches[1];
    if ($matches[2] == 'M') {
        $memory_bytes *= 1024 * 1024;
    } elseif ($matches[2] == 'G') {
        $memory_bytes *= 1024 * 1024 * 1024;
    } elseif ($matches[2] == 'K') {
        $memory_bytes *= 1024;
    }
}
$results['checks']['memory'] = [
    'name' => 'Memory Limit',
    'status' => $memory_bytes >= 128 * 1024 * 1024 ? 'pass' : 'warning',
    'value' => $memory_limit,
    'recommended' => '256M+'
];

// Calculate Overall Status
$statuses = array_column($results['checks'], 'status');
if (in_array('fail', $statuses)) {
    $results['overall_status'] = 'fail';
} elseif (in_array('warning', $statuses)) {
    $results['overall_status'] = 'warning';
} else {
    $results['overall_status'] = 'pass';
}

$results['summary'] = [
    'total_checks' => count($results['checks']),
    'passed' => count(array_filter($statuses, function($s) { return $s === 'pass'; })),
    'warnings' => count(array_filter($statuses, function($s) { return $s === 'warning'; })),
    'failed' => count(array_filter($statuses, function($s) { return $s === 'fail'; }))
];

// Next Steps
$results['next_steps'] = [];
if ($results['overall_status'] === 'fail') {
    if (!$config_exists) {
        $results['next_steps'][] = 'Run installation wizard at /php/install.php';
    }
    if (!empty($missing_extensions)) {
        $results['next_steps'][] = 'Install missing PHP extensions: ' . implode(', ', $missing_extensions);
    }
    if (!empty($missing_files)) {
        $results['next_steps'][] = 'Upload missing files: ' . implode(', ', $missing_files);
    }
    if (isset($results['checks']['database']) && $results['checks']['database']['status'] === 'fail') {
        $results['next_steps'][] = 'Check database credentials and run installation';
    }
} elseif ($results['overall_status'] === 'warning') {
    $results['next_steps'][] = 'Review warnings above - system may still function';
} else {
    $results['next_steps'][] = 'System is ready! Access control panel at /php/public/control-panel.php';
    $results['next_steps'][] = 'Test API health at /php/api/health';
}

// Output results
echo json_encode($results, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
