<?php
/**
 * MegaWeb Orchestrator - Advanced Admin & Control Panel
 * Combined admin utilities and session management interface
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../includes/database.php';
require_once __DIR__ . '/../includes/metrics-collector.php';

// Authentication (simple, enhance for production)
session_start();
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
            <p style="margin-top: 15px; font-size: 0.8rem; color: #0aa;">Default: admin123</p>
        </div>
    </body>
    </html>
    <?php
    exit;
}

// Admin is authenticated, show full interface
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
    <title>MegaWeb Orchestrator - Admin Control Panel</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        :root {
            --primary-cyan: #0ff;
            --bg-dark: #0a0a0a;
            --bg-overlay: rgba(0, 0, 0, 0.95);
            --grid-border: #0ff3;
        }
        
        body {
            background: var(--bg-dark);
            color: var(--primary-cyan);
            font-family: 'Courier New', monospace;
            overflow: hidden;
        }
        
        .header {
            background: var(--bg-overlay);
            border-bottom: 2px solid var(--primary-cyan);
            padding: 15px 20px;
            backdrop-filter: blur(10px);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .header h1 {
            font-size: 1.5rem;
            text-shadow: 0 0 10px var(--primary-cyan);
            letter-spacing: 2px;
        }
        
        .view-switcher {
            display: flex;
            gap: 10px;
        }
        
        .view-btn {
            background: rgba(0, 255, 255, 0.1);
            border: 1px solid var(--primary-cyan);
            color: var(--primary-cyan);
            padding: 8px 16px;
            cursor: pointer;
            transition: all 0.3s;
            font-family: inherit;
        }
        
        .view-btn:hover, .view-btn.active {
            background: var(--primary-cyan);
            color: #000;
        }
        
        .main-container {
            display: flex;
            height: calc(100vh - 70px);
        }
        
        .control-panel {
            width: 350px;
            background: var(--bg-overlay);
            border-right: 1px solid var(--primary-cyan);
            padding: 20px;
            overflow-y: auto;
        }
        
        .live-view {
            flex: 1;
            position: relative;
            background: #000;
            overflow: auto;
        }
        
        .metric-card {
            background: rgba(0, 255, 255, 0.05);
            border: 1px solid var(--primary-cyan);
            border-radius: 5px;
            padding: 12px;
            margin-bottom: 15px;
        }
        
        .metric-card h3 {
            margin-bottom: 10px;
            font-size: 1rem;
            border-bottom: 1px solid var(--primary-cyan);
            padding-bottom: 5px;
        }
        
        .metric-row {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
            font-size: 0.85rem;
        }
        
        .metric-value {
            color: #0f0;
            font-weight: bold;
        }
        
        .action-section {
            margin-top: 20px;
        }
        
        .action-btn {
            width: 100%;
            background: rgba(0, 255, 255, 0.1);
            border: 1px solid var(--primary-cyan);
            color: var(--primary-cyan);
            padding: 12px;
            margin-bottom: 10px;
            cursor: pointer;
            transition: all 0.3s;
            font-family: inherit;
            font-size: 0.9rem;
        }
        
        .action-btn:hover {
            background: var(--primary-cyan);
            color: #000;
        }
        
        .session-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
            padding: 20px;
        }
        
        .session-card {
            background: rgba(0, 255, 255, 0.05);
            border: 1px solid var(--primary-cyan);
            border-radius: 5px;
            padding: 15px;
            transition: all 0.3s;
        }
        
        .session-card:hover {
            background: rgba(0, 255, 255, 0.15);
            transform: translateY(-2px);
            box-shadow: 0 0 20px rgba(0, 255, 255, 0.3);
        }
        
        .session-url {
            font-size: 0.8rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-bottom: 8px;
        }
        
        .session-status {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 3px;
            font-size: 0.75rem;
            margin-bottom: 5px;
        }
        
        .status-steady { background: #0a4; color: #fff; }
        .status-scaling { background: #fa0; color: #000; }
        .status-degraded { background: #f40; color: #fff; }
        .status-draft { background: #888; color: #fff; }
        
        .hypergrid-container {
            padding: 20px;
            overflow: auto;
        }
        
        .hypergrid {
            display: grid;
            gap: 2px;
            background: var(--grid-border);
            padding: 2px;
        }
        
        .hypergrid-tile {
            background: #000;
            border: 1px solid var(--primary-cyan);
            padding: 5px;
            cursor: pointer;
            transition: all 0.2s;
            min-height: 60px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        }
        
        .hypergrid-tile:hover {
            background: rgba(0, 255, 255, 0.2);
            transform: scale(1.05);
            z-index: 10;
        }
        
        .tile-sessions {
            font-size: 1.2rem;
            font-weight: bold;
        }
        
        .tile-replicas {
            font-size: 0.7rem;
            color: #0aa;
        }
        
        .input-group {
            margin-bottom: 15px;
        }
        
        .input-group label {
            display: block;
            margin-bottom: 5px;
            font-size: 0.85rem;
        }
        
        .input-group input, .input-group select, .input-group textarea {
            width: 100%;
            background: rgba(0, 255, 255, 0.05);
            border: 1px solid var(--primary-cyan);
            color: var(--primary-cyan);
            padding: 8px;
            font-family: inherit;
            font-size: 0.85rem;
        }
        
        .input-group textarea {
            min-height: 100px;
            resize: vertical;
        }
        
        .progress-bar {
            width: 100%;
            height: 20px;
            background: rgba(0, 255, 255, 0.1);
            border: 1px solid var(--primary-cyan);
            border-radius: 3px;
            overflow: hidden;
            margin: 10px 0;
        }
        
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #0ff, #0f0);
            transition: width 0.3s;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            margin-top: 10px;
        }
        
        .stat-box {
            background: rgba(0, 255, 255, 0.05);
            border: 1px solid var(--primary-cyan);
            padding: 10px;
            text-align: center;
        }
        
        .stat-value {
            font-size: 1.5rem;
            color: #0f0;
            font-weight: bold;
        }
        
        .stat-label {
            font-size: 0.75rem;
            margin-top: 5px;
        }
        
        .loading {
            text-align: center;
            padding: 50px;
            font-size: 1.2rem;
        }
        
        .loading::after {
            content: '...';
            animation: dots 1.5s infinite;
        }
        
        @keyframes dots {
            0%, 20% { content: '.'; }
            40% { content: '..'; }
            60%, 100% { content: '...'; }
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
            margin: 20px;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        
        th, td {
            border: 1px solid var(--primary-cyan);
            padding: 8px;
            text-align: left;
            font-size: 0.85rem;
        }
        
        th {
            background: rgba(0, 255, 255, 0.2);
        }
        
        .admin-content {
            padding: 20px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🛠️ MEGAWEB ADMIN & CONTROL PANEL</h1>
        <div class="view-switcher">
            <button class="view-btn active" data-view="sessions">📊 Sessions</button>
            <button class="view-btn" data-view="hypergrid">🎯 Hypergrid</button>
            <button class="view-btn" data-view="bulk">📦 Bulk Create</button>
            <button class="view-btn" data-view="metrics">📈 Metrics</button>
            <button class="view-btn" data-view="admin">🛠️ Admin Tools</button>
        </div>
    </div>
    
    <div class="main-container">
        <div class="control-panel">
            <div class="metric-card">
                <h3>⚡ Global Metrics</h3>
                <div class="metric-row">
                    <span>Total Sessions:</span>
                    <span class="metric-value" id="total-sessions">0</span>
                </div>
                <div class="metric-row">
                    <span>Active Replicas:</span>
                    <span class="metric-value" id="active-replicas">0</span>
                </div>
                <div class="metric-row">
                    <span>Target Capacity:</span>
                    <span class="metric-value">1,000,000</span>
                </div>
                <div class="metric-row">
                    <span>System Load:</span>
                    <span class="metric-value" id="system-load">0%</span>
                </div>
            </div>
            
            <div class="metric-card">
                <h3>🌍 Proxy Status</h3>
                <div class="metric-row">
                    <span>Active Pools:</span>
                    <span class="metric-value" id="active-pools">0</span>
                </div>
                <div class="metric-row">
                    <span>Countries:</span>
                    <span class="metric-value" id="proxy-countries">195</span>
                </div>
                <div class="metric-row">
                    <span>Proxy Nodes:</span>
                    <span class="metric-value" id="proxy-nodes">0</span>
                </div>
            </div>
            
            <div class="action-section">
                <h3 style="margin-bottom: 10px;">🎮 Quick Actions</h3>
                <button class="action-btn" onclick="createSession()">➕ Create Session</button>
                <button class="action-btn" onclick="scaleToMillion()">🚀 Scale to 1M</button>
                <button class="action-btn" onclick="refreshData()">🔄 Refresh Data</button>
                <button class="action-btn" onclick="window.location.href='?action=optimize'">🔧 Optimize DB</button>
            </div>
        </div>
        
        <div class="live-view">
            <?php if ($result): ?>
                <div class="result"><?= $result ?></div>
            <?php endif; ?>
            
            <!-- Sessions View -->
            <div id="view-sessions" class="view-content">
                <div class="session-grid" id="session-grid">
                    <div class="loading">Loading sessions</div>
                </div>
            </div>
            
            <!-- Hypergrid View -->
            <div id="view-hypergrid" class="view-content" style="display: none;">
                <div class="hypergrid-container">
                    <div id="hypergrid" class="hypergrid">
                        <div class="loading">Loading hypergrid</div>
                    </div>
                </div>
            </div>
            
            <!-- Bulk Create View -->
            <div id="view-bulk" class="view-content" style="display: none;">
                <div style="padding: 20px; max-width: 800px; margin: 0 auto;">
                    <h2>📦 Bulk Session Creation</h2>
                    <div class="input-group">
                        <label>URLs (one per line):</label>
                        <textarea id="bulk-urls" placeholder="https://example1.com&#10;https://example2.com&#10;https://example3.com"></textarea>
                    </div>
                    <div class="input-group">
                        <label>Target Replicas per URL:</label>
                        <input type="number" id="bulk-replicas" value="1" min="1" max="1000">
                    </div>
                    <div class="input-group">
                        <label>Proxy Country (optional):</label>
                        <select id="bulk-country">
                            <option value="">Auto-select</option>
                            <option value="US">United States</option>
                            <option value="GB">United Kingdom</option>
                            <option value="DE">Germany</option>
                            <option value="FR">France</option>
                            <option value="JP">Japan</option>
                            <option value="SG">Singapore</option>
                            <option value="CA">Canada</option>
                            <option value="AU">Australia</option>
                        </select>
                    </div>
                    <button class="action-btn" onclick="bulkCreate()">🚀 Create All Sessions</button>
                    <div id="bulk-progress" style="display: none;">
                        <div class="progress-bar">
                            <div class="progress-fill" id="bulk-progress-fill"></div>
                        </div>
                        <p id="bulk-status"></p>
                    </div>
                </div>
            </div>
            
            <!-- Metrics View -->
            <div id="view-metrics" class="view-content" style="display: none;">
                <div style="padding: 20px;">
                    <h2>📊 System Metrics</h2>
                    <div class="stats-grid">
                        <div class="stat-box">
                            <div class="stat-value" id="metric-total-sessions">0</div>
                            <div class="stat-label">Total Sessions</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-value" id="metric-active-sessions">0</div>
                            <div class="stat-label">Active Sessions</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-value" id="metric-total-replicas">0</div>
                            <div class="stat-label">Total Replicas</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-value" id="metric-avg-latency">0ms</div>
                            <div class="stat-label">Avg Latency</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Admin Tools View -->
            <div id="view-admin" class="view-content" style="display: none;">
                <div class="admin-content">
                    <h2>🛠️ Admin Utilities</h2>
                    
                    <div class="metric-card">
                        <h3>🏥 System Health</h3>
                        <div class="health-score <?= 
                            $healthScore['overall_score'] > 80 ? 'health-excellent' : 
                            ($healthScore['overall_score'] > 60 ? 'health-good' : 
                            ($healthScore['overall_score'] > 40 ? 'health-warning' : 'health-critical'))
                        ?>">
                            <?= round($healthScore['overall_score']) ?>%
                        </div>
                        
                        <div class="stats-grid">
                            <div class="stat-box">
                                <div>CPU Score</div>
                                <div class="stat-value"><?= round($healthScore['components']['cpu']) ?>%</div>
                                <div style="font-size: 0.7rem;">Load: <?= $healthScore['details']['cpu_load'] ?></div>
                            </div>
                            <div class="stat-box">
                                <div>Memory Score</div>
                                <div class="stat-value"><?= round($healthScore['components']['memory']) ?>%</div>
                                <div style="font-size: 0.7rem;"><?= $healthScore['details']['memory_usage_mb'] ?>MB / <?= $healthScore['details']['memory_limit_mb'] ?>MB</div>
                            </div>
                            <div class="stat-box">
                                <div>Disk Score</div>
                                <div class="stat-value"><?= round($healthScore['components']['disk']) ?>%</div>
                                <div style="font-size: 0.7rem;"><?= $healthScore['details']['disk_free_gb'] ?>GB Free</div>
                            </div>
                            <div class="stat-box">
                                <div>Error Score</div>
                                <div class="stat-value"><?= round($healthScore['components']['errors']) ?>%</div>
                                <div style="font-size: 0.7rem;"><?= $healthScore['details']['error_rate_percent'] ?>% Error Rate</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="metric-card">
                        <h3>⚙️ Maintenance Actions</h3>
                        <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                            <a href="?action=optimize" class="action-btn" style="width: auto; display: inline-block;">🔧 Optimize Database</a>
                            <a href="?action=cleanup_metrics" class="action-btn" style="width: auto; display: inline-block;">🗑️ Cleanup Old Metrics</a>
                            <a href="?action=clear_cache" class="action-btn" style="width: auto; display: inline-block;">💾 Clear Query Cache</a>
                            <a href="?action=export_metrics" class="action-btn" style="width: auto; display: inline-block;">📊 Export Metrics CSV</a>
                        </div>
                    </div>
                    
                    <div class="metric-card">
                        <h3>📊 Database Statistics</h3>
                        <div class="stats-grid">
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
                    
                    <div class="metric-card">
                        <h3>💾 Table Sizes</h3>
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
                    
                    <div class="metric-card">
                        <h3>📈 Metric Types</h3>
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
            </div>
        </div>
    </div>
    
    <script>
        const API_BASE = '/api';
        let currentView = 'sessions';
        let eventSource = null;
        
        // View switching
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                switchView(view);
            });
        });
        
        function switchView(view) {
            currentView = view;
            
            // Update buttons
            document.querySelectorAll('.view-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.view === view);
            });
            
            // Update views
            document.querySelectorAll('.view-content').forEach(content => {
                content.style.display = 'none';
            });
            document.getElementById(`view-${view}`).style.display = 'block';
            
            // Load view-specific data
            if (view === 'hypergrid') {
                loadHypergrid();
            }
        }
        
        // Real-time updates via SSE
        function connectSSE() {
            if (eventSource) {
                eventSource.close();
            }
            
            eventSource = new EventSource(`${API_BASE}/stream`);
            
            eventSource.addEventListener('snapshot', (e) => {
                const data = JSON.parse(e.data);
                updateUI(data);
            });
            
            eventSource.addEventListener('error', (e) => {
                console.error('SSE error:', e);
                setTimeout(connectSSE, 5000);
            });
        }
        
        // Update UI with data
        function updateUI(data) {
            if (data.blueprints) {
                updateSessions(data.blueprints);
            }
            
            if (data.metrics) {
                updateMetrics(data.metrics);
            }
            
            if (data.hypergrid && currentView === 'hypergrid') {
                renderHypergrid(data.hypergrid);
            }
        }
        
        // Update sessions grid
        function updateSessions(sessions) {
            const grid = document.getElementById('session-grid');
            
            if (sessions.length === 0) {
                grid.innerHTML = '<div class="loading">No sessions yet. Create one to get started!</div>';
                return;
            }
            
            grid.innerHTML = sessions.map(session => `
                <div class="session-card">
                    <div class="session-url" title="${session.url}">${session.url}</div>
                    <span class="session-status status-${session.status}">${session.status}</span>
                    <div style="font-size: 0.75rem; margin-top: 5px;">
                        <div>Replicas: ${session.current_replica_count}/${session.target_replica_count}</div>
                        <div>Region: ${session.region || 'global'}</div>
                    </div>
                </div>
            `).join('');
            
            document.getElementById('total-sessions').textContent = sessions.length.toLocaleString();
        }
        
        // Update metrics
        function updateMetrics(metrics) {
            document.getElementById('active-replicas').textContent = (metrics.totalActiveReplicas || 0).toLocaleString();
            document.getElementById('system-load').textContent = (metrics.systemLoad || 0).toFixed(1) + '%';
            document.getElementById('active-pools').textContent = (metrics.activePools || 0);
            document.getElementById('proxy-nodes').textContent = (metrics.proxyNodes || 0).toLocaleString();
            
            document.getElementById('metric-total-sessions').textContent = (metrics.totalSessions || 0).toLocaleString();
            document.getElementById('metric-active-sessions').textContent = (metrics.activeSessions || 0).toLocaleString();
            document.getElementById('metric-total-replicas').textContent = (metrics.totalActiveReplicas || 0).toLocaleString();
            document.getElementById('metric-avg-latency').textContent = (metrics.avgLatency || 0) + 'ms';
        }
        
        // Load hypergrid
        async function loadHypergrid() {
            try {
                const response = await fetch(`${API_BASE}/hypergrid`);
                const data = await response.json();
                renderHypergrid(data);
            } catch (error) {
                console.error('Failed to load hypergrid:', error);
            }
        }
        
        // Render hypergrid
        function renderHypergrid(hypergrid) {
            const container = document.getElementById('hypergrid');
            
            if (!hypergrid || !hypergrid.tiles || hypergrid.tiles.length === 0) {
                container.innerHTML = '<div class="loading">No data for hypergrid</div>';
                return;
            }
            
            const cols = hypergrid.dimensions.cols;
            container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
            
            container.innerHTML = hypergrid.tiles.map(tile => `
                <div class="hypergrid-tile" style="opacity: ${0.3 + tile.intensity * 0.7}">
                    <div class="tile-sessions">${tile.sessionCount}</div>
                    <div class="tile-replicas">${tile.replicaCount} replicas</div>
                </div>
            `).join('');
        }
        
        // Create single session
        async function createSession() {
            const url = prompt('Enter URL to embed:');
            if (!url) return;
            
            try {
                const response = await fetch(`${API_BASE}/sessions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url, status: 'steady', target_replica_count: 1 })
                });
                
                if (response.ok) {
                    alert('Session created successfully!');
                    refreshData();
                } else {
                    alert('Failed to create session');
                }
            } catch (error) {
                alert('Error: ' + error.message);
            }
        }
        
        // Scale to 1 million
        async function scaleToMillion() {
            if (!confirm('This will create up to 1 million sessions. Continue?')) return;
            
            try {
                const response = await fetch(`${API_BASE}/embed/scale-million`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ targetSessions: 1000000 })
                });
                
                const result = await response.json();
                alert(`Scaling complete!\nCurrent sessions: ${result.currentSessions}\nTime: ${result.scalingTimeMs}ms`);
                refreshData();
            } catch (error) {
                alert('Error: ' + error.message);
            }
        }
        
        // Bulk create
        async function bulkCreate() {
            const urls = document.getElementById('bulk-urls').value.split('\n').filter(u => u.trim());
            const replicas = parseInt(document.getElementById('bulk-replicas').value);
            const country = document.getElementById('bulk-country').value;
            
            if (urls.length === 0) {
                alert('Please enter at least one URL');
                return;
            }
            
            document.getElementById('bulk-progress').style.display = 'block';
            document.getElementById('bulk-progress-fill').style.width = '0%';
            
            try {
                const response = await fetch(`${API_BASE}/embed/bulk`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        urls,
                        bulkOptions: { replicasPerUrl: replicas },
                        proxyRequirements: { preferredCountries: country ? [country] : [] }
                    })
                });
                
                const result = await response.json();
                document.getElementById('bulk-progress-fill').style.width = '100%';
                document.getElementById('bulk-status').textContent = 
                    `Created ${result.successful.length}/${result.totalProcessed} sessions`;
                
                setTimeout(() => {
                    document.getElementById('bulk-progress').style.display = 'none';
                    refreshData();
                }, 2000);
            } catch (error) {
                alert('Error: ' + error.message);
                document.getElementById('bulk-progress').style.display = 'none';
            }
        }
        
        // Refresh data
        async function refreshData() {
            try {
                const response = await fetch(`${API_BASE}/sessions`);
                const data = await response.json();
                updateUI(data);
            } catch (error) {
                console.error('Failed to refresh:', error);
            }
        }
        
        // Initialize
        document.addEventListener('DOMContentLoaded', () => {
            refreshData();
            connectSSE();
            setInterval(refreshData, 5000); // Fallback polling
        });
    </script>
</body>
</html>