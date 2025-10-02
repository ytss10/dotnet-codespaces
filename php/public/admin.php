<?php
/**
 * MegaWeb Orchestrator - Admin Utilities
 * Advanced management and maintenance tools
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../includes/database.php';
require_once __DIR__ . '/../includes/metrics-collector.php';

// Authentication (simple, enhance for production)
$adminPassword = getenv('ADMIN_PASSWORD') ?: 'admin123';
$authenticated = false;

if (isset($_POST['password']) && $_POST['password'] === $adminPassword) {
    $_SESSION['admin_authenticated'] = true;
}

if (!isset($_SESSION['admin_authenticated']) || $_SESSION['admin_authenticated'] !== true) {
    // Show login form
    ?>
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Admin Login</title>
        <style>
            body {
                background: #0a0a0a;
                color: #0ff;
                font-family: monospace;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
            }
            .login-box {
                background: rgba(0, 0, 0, 0.9);
                border: 2px solid #0ff;
                padding: 30px;
                border-radius: 10px;
                text-align: center;
            }
            input {
                background: rgba(0, 0, 0, 0.5);
                border: 1px solid #0ff;
                color: #0ff;
                padding: 10px;
                margin: 10px 0;
                border-radius: 3px;
                width: 250px;
            }
            button {
                background: rgba(0, 255, 0, 0.3);
                border: 1px solid #0f0;
                color: #0f0;
                padding: 10px 20px;
                cursor: pointer;
                border-radius: 5px;
            }
        </style>
    </head>
    <body>
        <div class="login-box">
            <h2>🔒 Admin Access</h2>
            <form method="POST">
                <input type="password" name="password" placeholder="Admin Password" required>
                <br>
                <button type="submit">Login</button>
            </form>
        </div>
    </body>
    </html>
    <?php
    exit;
}

// Admin is authenticated, show utilities
$db = DatabaseManager::getInstance();
$metrics = new MetricsCollector();

// Handle actions
$action = $_GET['action'] ?? '';
$result = '';

if ($action === 'optimize') {
    $db->optimize();
    $result = '✓ Database optimized';
}

if ($action === 'cleanup_metrics') {
    $deleted = $metrics->cleanup();
    $result = "✓ Deleted $deleted old metrics";
}

if ($action === 'clear_cache') {
    $db->clearCache();
    $result = '✓ Query cache cleared';
}

if ($action === 'export_metrics') {
    $csv = $metrics->exportMetrics();
    header('Content-Type: text/csv');
    header('Content-Disposition: attachment; filename="metrics_' . date('Y-m-d') . '.csv"');
    echo $csv;
    exit;
}

// Get stats
$dbStats = $db->getStats();
$healthScore = $metrics->getSystemHealthScore();
$metricTypes = $metrics->getMetricTypes();

// Get table sizes
$tableSizes = $db->query(
    "SELECT 
        table_name,
        ROUND((data_length + index_length) / 1024 / 1024, 2) AS size_mb,
        table_rows
     FROM information_schema.tables 
     WHERE table_schema = ?
     ORDER BY (data_length + index_length) DESC",
    [DB_NAME]
);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Utilities - MegaWeb Orchestrator</title>
    <style>
        body {
            background: #0a0a0a;
            color: #0ff;
            font-family: monospace;
            margin: 0;
            padding: 20px;
        }
        h1 {
            text-align: center;
            text-shadow: 0 0 10px #0ff;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .card {
            background: rgba(0, 255, 255, 0.1);
            border: 1px solid #0ff;
            border-radius: 5px;
            padding: 20px;
            margin: 20px 0;
        }
        .card h2 {
            margin-top: 0;
            border-bottom: 1px solid #0ff;
            padding-bottom: 10px;
        }
        .btn {
            background: rgba(0, 255, 0, 0.3);
            border: 1px solid #0f0;
            color: #0f0;
            padding: 10px 20px;
            cursor: pointer;
            border-radius: 5px;
            text-decoration: none;
            display: inline-block;
            margin: 5px;
        }
        .btn:hover {
            background: rgba(0, 255, 0, 0.5);
        }
        .btn-danger {
            background: rgba(255, 0, 0, 0.3);
            border-color: #f00;
            color: #f00;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            border: 1px solid #0ff;
            padding: 10px;
            text-align: left;
        }
        th {
            background: rgba(0, 255, 255, 0.2);
        }
        .health-score {
            font-size: 3rem;
            text-align: center;
            margin: 20px 0;
        }
        .health-excellent { color: #0f0; }
        .health-good { color: #0ff; }
        .health-warning { color: #ff0; }
        .health-critical { color: #f00; }
        .result {
            background: rgba(0, 255, 0, 0.2);
            border: 1px solid #0f0;
            color: #0f0;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
        }
        .stat-box {
            background: rgba(0, 0, 0, 0.5);
            border: 1px solid #0ff;
            padding: 15px;
            border-radius: 5px;
            text-align: center;
        }
        .stat-value {
            font-size: 2rem;
            color: #0f0;
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🛠️ Admin Utilities</h1>
        
        <?php if ($result): ?>
            <div class="result"><?= $result ?></div>
        <?php endif; ?>
        
        <div class="card">
            <h2>🏥 System Health</h2>
            <div class="health-score <?= 
                $healthScore['overall_score'] > 80 ? 'health-excellent' : 
                ($healthScore['overall_score'] > 60 ? 'health-good' : 
                ($healthScore['overall_score'] > 40 ? 'health-warning' : 'health-critical'))
            ?>">
                <?= round($healthScore['overall_score']) ?>%
            </div>
            
            <div class="grid">
                <div class="stat-box">
                    <div>CPU Score</div>
                    <div class="stat-value"><?= round($healthScore['components']['cpu']) ?>%</div>
                    <div>Load: <?= $healthScore['details']['cpu_load'] ?></div>
                </div>
                <div class="stat-box">
                    <div>Memory Score</div>
                    <div class="stat-value"><?= round($healthScore['components']['memory']) ?>%</div>
                    <div><?= $healthScore['details']['memory_usage_mb'] ?>MB / <?= $healthScore['details']['memory_limit_mb'] ?>MB</div>
                </div>
                <div class="stat-box">
                    <div>Disk Score</div>
                    <div class="stat-value"><?= round($healthScore['components']['disk']) ?>%</div>
                    <div><?= $healthScore['details']['disk_free_gb'] ?>GB Free</div>
                </div>
                <div class="stat-box">
                    <div>Error Score</div>
                    <div class="stat-value"><?= round($healthScore['components']['errors']) ?>%</div>
                    <div><?= $healthScore['details']['error_rate_percent'] ?>% Error Rate</div>
                </div>
            </div>
        </div>
        
        <div class="card">
            <h2>⚙️ Quick Actions</h2>
            <a href="?action=optimize" class="btn">🔧 Optimize Database</a>
            <a href="?action=cleanup_metrics" class="btn">🗑️ Cleanup Old Metrics</a>
            <a href="?action=clear_cache" class="btn">💾 Clear Query Cache</a>
            <a href="?action=export_metrics" class="btn">📊 Export Metrics CSV</a>
            <a href="../public/index.php" class="btn">🏠 Back to Dashboard</a>
        </div>
        
        <div class="card">
            <h2>📊 Database Statistics</h2>
            <div class="grid">
                <div class="stat-box">
                    <div>Cache Size</div>
                    <div class="stat-value"><?= $dbStats['cache_size'] ?></div>
                </div>
                <div class="stat-box">
                    <div>Transaction Level</div>
                    <div class="stat-value"><?= $dbStats['transaction_level'] ?></div>
                </div>
                <div class="stat-box">
                    <div>Connection Attempts</div>
                    <div class="stat-value"><?= $dbStats['connection_attempts'] ?></div>
                </div>
            </div>
        </div>
        
        <div class="card">
            <h2>💾 Table Sizes</h2>
            <table>
                <thead>
                    <tr>
                        <th>Table Name</th>
                        <th>Size (MB)</th>
                        <th>Rows</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($tableSizes as $table): ?>
                        <tr>
                            <td><?= htmlspecialchars($table['table_name']) ?></td>
                            <td><?= $table['size_mb'] ?></td>
                            <td><?= number_format($table['table_rows']) ?></td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
        
        <div class="card">
            <h2>📈 Metric Types</h2>
            <table>
                <thead>
                    <tr>
                        <th>Metric Type</th>
                        <th>Count</th>
                        <th>First Recorded</th>
                        <th>Last Recorded</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($metricTypes as $type): ?>
                        <tr>
                            <td><?= htmlspecialchars($type['metric_type']) ?></td>
                            <td><?= number_format($type['count']) ?></td>
                            <td><?= $type['first_recorded'] ?></td>
                            <td><?= $type['last_recorded'] ?></td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </div>
</body>
</html>
