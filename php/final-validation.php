<?php
/**
 * Final Validation Script - Comprehensive System Check
 * Checks all aspects of the MegaWeb Orchestrator for issues
 */

// Prevent web access
if (php_sapi_name() !== 'cli') {
    die("This script must be run from the command line\n");
}

echo "=== MegaWeb Orchestrator Final Validation ===\n\n";

$issues_found = [];
$warnings = [];

// 1. Check PHP Version
echo "1. Checking PHP Version...\n";
if (version_compare(PHP_VERSION, '7.2.0', '<')) {
    $issues_found[] = "PHP version " . PHP_VERSION . " is below required 7.2.0";
} else {
    echo "   ✓ PHP " . PHP_VERSION . " meets requirements\n";
}

// 2. Check Required Extensions
echo "\n2. Checking Required Extensions...\n";
$required_extensions = ['pdo', 'pdo_mysql', 'curl', 'json', 'mbstring'];
foreach ($required_extensions as $ext) {
    if (!extension_loaded($ext)) {
        $issues_found[] = "Required extension '$ext' is not loaded";
    } else {
        echo "   ✓ Extension '$ext' is loaded\n";
    }
}

// 3. Check File Permissions
echo "\n3. Checking File Permissions...\n";
$writable_dirs = ['../database', '../php/config'];
foreach ($writable_dirs as $dir) {
    if (!is_writable($dir)) {
        $warnings[] = "Directory '$dir' is not writable";
    } else {
        echo "   ✓ Directory '$dir' is writable\n";
    }
}

// 4. Validate All PHP Files for Syntax
echo "\n4. Validating PHP Syntax...\n";
$php_files = glob('../php/**/*.php', GLOB_BRACE);
$php_files = array_merge($php_files, glob('../php/*.php'));
$syntax_errors = 0;

foreach ($php_files as $file) {
    $output = [];
    $return_var = 0;
    exec("php -l " . escapeshellarg($file) . " 2>&1", $output, $return_var);
    
    if ($return_var !== 0) {
        $issues_found[] = "Syntax error in $file: " . implode("\n", $output);
        $syntax_errors++;
    }
}

if ($syntax_errors === 0) {
    echo "   ✓ All " . count($php_files) . " PHP files have valid syntax\n";
}

// 5. Check for Security Issues
echo "\n5. Checking for Security Vulnerabilities...\n";
$security_checks = [
    'SQL Injection' => '/\$_(GET|POST|REQUEST|COOKIE)\[[^\]]+\][^;]*?(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)/i',
    'Command Injection' => '/(exec|system|shell_exec|passthru|eval)\s*\([^)]*\$_(GET|POST|REQUEST|COOKIE)/i',
    'File Inclusion' => '/(include|require|include_once|require_once)\s*\([^)]*\$_(GET|POST|REQUEST|COOKIE)/i',
    'Unvalidated Redirects' => '/header\s*\(["\']Location:[^)]*\$_(GET|POST|REQUEST|COOKIE)/i'
];

$security_issues = 0;
foreach ($php_files as $file) {
    $content = file_get_contents($file);
    foreach ($security_checks as $type => $pattern) {
        if (preg_match($pattern, $content, $matches)) {
            $issues_found[] = "$type vulnerability found in $file";
            $security_issues++;
        }
    }
}

if ($security_issues === 0) {
    echo "   ✓ No direct security vulnerabilities detected\n";
}

// 6. Check Configuration
echo "\n6. Checking Configuration...\n";
$config_file = '../php/config/config.php';
if (!file_exists($config_file)) {
    $issues_found[] = "Configuration file not found at $config_file";
} else {
    require_once $config_file;
    
    $required_constants = [
        'DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASS',
        'APP_DEBUG', 'APP_LOG_PATH', 'APP_ROOT',
        'JSON_OPTIONS', 'ERROR_REPORTING_LEVEL'
    ];
    
    foreach ($required_constants as $const) {
        if (!defined($const)) {
            $issues_found[] = "Required constant '$const' is not defined";
        } else {
            echo "   ✓ Constant '$const' is defined\n";
        }
    }
}

// 7. Check for InfinityFree Compatibility
echo "\n7. Checking InfinityFree Compatibility...\n";
$disabled_functions = ['ini_set', 'sys_getloadavg', 'disk_free_space', 'disk_total_space'];
$compatibility_issues = 0;

foreach ($php_files as $file) {
    $content = file_get_contents($file);
    foreach ($disabled_functions as $func) {
        if (preg_match("/\b" . preg_quote($func, '/') . "\s*\(/", $content)) {
            // Check if it's wrapped in function_exists
            $pattern = "/function_exists\s*\(\s*['\"]" . preg_quote($func, '/') . "['\"]\s*\)/";
            if (!preg_match($pattern, $content)) {
                $warnings[] = "Function '$func' used in $file without function_exists() check";
                $compatibility_issues++;
            }
        }
    }
}

if ($compatibility_issues === 0) {
    echo "   ✓ All InfinityFree-disabled functions are properly wrapped\n";
}

// 8. Check Database Schema Files
echo "\n8. Checking Database Schema Files...\n";
$schema_files = glob('../database/*.sql');
foreach ($schema_files as $schema) {
    if (file_exists($schema)) {
        echo "   ✓ Found schema file: " . basename($schema) . "\n";
    }
}

// 9. Memory and Performance Checks
echo "\n9. Checking Performance Safeguards...\n";
$performance_checks = [
    'scaleToMillion limit' => '/scaleToMillion.*?for\s*\(\s*\$i\s*=\s*0;\s*\$i\s*<\s*(\d+)/s',
    'SSE timeout protection' => '/time\(\)\s*-\s*\$startTime\s*>\s*25/',
    'Memory limit checks' => '/memory_get_usage\(\s*true\s*\)\s*[><=]/i'
];

foreach ($performance_checks as $check => $pattern) {
    $found = false;
    foreach ($php_files as $file) {
        if (preg_match($pattern, file_get_contents($file))) {
            $found = true;
            break;
        }
    }
    if ($found) {
        echo "   ✓ $check implemented\n";
    } else {
        $warnings[] = "$check not found in codebase";
    }
}

// 10. Final Summary
echo "\n=== VALIDATION SUMMARY ===\n";
echo "Total files checked: " . count($php_files) . "\n";
echo "Critical issues found: " . count($issues_found) . "\n";
echo "Warnings: " . count($warnings) . "\n\n";

if (count($issues_found) > 0) {
    echo "CRITICAL ISSUES:\n";
    foreach ($issues_found as $issue) {
        echo " ❌ $issue\n";
    }
    echo "\n";
}

if (count($warnings) > 0) {
    echo "WARNINGS:\n";
    foreach ($warnings as $warning) {
        echo " ⚠️  $warning\n";
    }
    echo "\n";
}

if (count($issues_found) === 0 && count($warnings) === 0) {
    echo "✅ ALL CHECKS PASSED! The codebase appears to be clean and ready for deployment.\n";
} elseif (count($issues_found) === 0) {
    echo "✅ No critical issues found. Address the warnings for optimal performance.\n";
} else {
    echo "❌ Critical issues detected. Please fix these before deployment.\n";
}

// Save report
$report = [
    'timestamp' => date('Y-m-d H:i:s'),
    'php_version' => PHP_VERSION,
    'files_checked' => count($php_files),
    'critical_issues' => $issues_found,
    'warnings' => $warnings,
    'status' => count($issues_found) === 0 ? 'PASSED' : 'FAILED'
];

file_put_contents('validation-report.json', json_encode($report, JSON_PRETTY_PRINT));
echo "\nDetailed report saved to validation-report.json\n";