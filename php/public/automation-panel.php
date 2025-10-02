<?php
/**
 * Web Automation & Scraping Live View Panel
 * Real-time monitoring dashboard for automation tasks
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../includes/database.php';

// Fetch automation tasks
$db = DatabaseManager::getInstance();
$sql = "SELECT * FROM automation_tasks ORDER BY priority DESC, created_at DESC LIMIT 50";
$tasks = $db->query($sql)->fetchAll(PDO::FETCH_ASSOC);

// Get statistics
$statsQuery = "SELECT 
    status,
    COUNT(*) as count,
    SUM(requests_completed) as total_requests,
    SUM(requests_failed) as total_failures
FROM automation_tasks 
GROUP BY status";
$stats = $db->query($statsQuery)->fetchAll(PDO::FETCH_ASSOC);

$totalTasks = array_sum(array_column($stats, 'count'));
$runningTasks = 0;
$completedRequests = 0;
$failedRequests = 0;

foreach ($stats as $stat) {
    if ($stat['status'] === 'running') {
        $runningTasks = $stat['count'];
    }
    $completedRequests += $stat['total_requests'] ?? 0;
    $failedRequests += $stat['total_failures'] ?? 0;
}

$successRate = ($completedRequests + $failedRequests) > 0 
    ? number_format(($completedRequests / ($completedRequests + $failedRequests)) * 100, 1) 
    : '0.0';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Web Automation & Scraping Control Center</title>
    <style>
        :root {
            --neon-cyan: #0ff;
            --neon-magenta: #f0f;
            --neon-green: #0f0;
            --dark-bg: #0a0a0a;
            --darker-bg: #050505;
            --border-color: rgba(0, 255, 255, 0.3);
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            background: var(--dark-bg);
            color: var(--neon-cyan);
            font-family: 'Courier New', monospace;
            padding: 20px;
            min-height: 100vh;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            border: 2px solid var(--neon-cyan);
            background: rgba(0, 255, 255, 0.05);
            box-shadow: 0 0 20px rgba(0, 255, 255, 0.3);
        }
        
        .header h1 {
            font-size: 2.5em;
            text-shadow: 0 0 10px var(--neon-cyan);
            margin-bottom: 10px;
        }
        
        .header p {
            font-size: 1.1em;
            opacity: 0.8;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .stat-card {
            padding: 20px;
            border: 2px solid var(--border-color);
            background: var(--darker-bg);
            text-align: center;
            box-shadow: 0 0 15px rgba(0, 255, 255, 0.2);
            transition: all 0.3s;
        }
        
        .stat-card:hover {
            border-color: var(--neon-cyan);
            box-shadow: 0 0 25px rgba(0, 255, 255, 0.4);
            transform: translateY(-2px);
        }
        
        .stat-value {
            font-size: 3em;
            font-weight: bold;
            text-shadow: 0 0 10px currentColor;
            margin: 10px 0;
        }
        
        .stat-label {
            font-size: 0.9em;
            opacity: 0.7;
            text-transform: uppercase;
            letter-spacing: 2px;
        }
        
        .controls {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            flex-wrap: wrap;
            gap: 10px;
        }
        
        .btn {
            padding: 12px 24px;
            border: 2px solid var(--neon-cyan);
            background: rgba(0, 255, 255, 0.1);
            color: var(--neon-cyan);
            cursor: pointer;
            font-family: inherit;
            font-size: 1em;
            transition: all 0.3s;
            text-decoration: none;
            display: inline-block;
        }
        
        .btn:hover {
            background: rgba(0, 255, 255, 0.2);
            box-shadow: 0 0 15px rgba(0, 255, 255, 0.5);
            transform: scale(1.05);
        }
        
        .btn-primary {
            border-color: var(--neon-magenta);
            color: var(--neon-magenta);
        }
        
        .btn-primary:hover {
            background: rgba(255, 0, 255, 0.2);
            box-shadow: 0 0 15px rgba(255, 0, 255, 0.5);
        }
        
        .toggle-refresh {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .toggle-refresh input[type="checkbox"] {
            width: 20px;
            height: 20px;
            cursor: pointer;
        }
        
        .tasks-container {
            display: grid;
            gap: 20px;
        }
        
        .task-card {
            padding: 20px;
            border: 2px solid var(--border-color);
            background: var(--darker-bg);
            box-shadow: 0 0 10px rgba(0, 255, 255, 0.1);
            transition: all 0.3s;
        }
        
        .task-card:hover {
            border-color: var(--neon-cyan);
            box-shadow: 0 0 20px rgba(0, 255, 255, 0.3);
        }
        
        .task-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            flex-wrap: wrap;
            gap: 10px;
        }
        
        .task-name {
            font-size: 1.5em;
            font-weight: bold;
            color: var(--neon-cyan);
            text-shadow: 0 0 5px var(--neon-cyan);
        }
        
        .task-status {
            padding: 5px 15px;
            border-radius: 3px;
            font-size: 0.9em;
            font-weight: bold;
            text-transform: uppercase;
        }
        
        .status-running {
            background: rgba(0, 255, 0, 0.2);
            border: 1px solid var(--neon-green);
            color: var(--neon-green);
            animation: pulse 2s infinite;
        }
        
        .status-paused {
            background: rgba(255, 255, 0, 0.2);
            border: 1px solid #ff0;
            color: #ff0;
        }
        
        .status-stopped, .status-failed {
            background: rgba(255, 0, 0, 0.2);
            border: 1px solid #f00;
            color: #f00;
        }
        
        .status-completed {
            background: rgba(0, 255, 255, 0.2);
            border: 1px solid var(--neon-cyan);
            color: var(--neon-cyan);
        }
        
        .status-created {
            background: rgba(255, 0, 255, 0.2);
            border: 1px solid var(--neon-magenta);
            color: var(--neon-magenta);
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
        }
        
        .task-info {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 15px;
        }
        
        .info-item {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        
        .info-label {
            font-size: 0.8em;
            opacity: 0.7;
            text-transform: uppercase;
        }
        
        .info-value {
            font-size: 1.1em;
            color: var(--neon-green);
        }
        
        .task-actions {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }
        
        .btn-small {
            padding: 8px 16px;
            font-size: 0.9em;
        }
        
        .no-tasks {
            text-align: center;
            padding: 60px 20px;
            font-size: 1.2em;
            opacity: 0.6;
        }
        
        .refresh-indicator {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 20px;
            background: rgba(0, 255, 0, 0.2);
            border: 2px solid var(--neon-green);
            border-radius: 5px;
            animation: fadeIn 0.3s;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        .modal {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.9);
            z-index: 1000;
            padding: 20px;
            overflow-y: auto;
        }
        
        .modal.active {
            display: flex;
            justify-content: center;
            align-items: center;
        }
        
        .modal-content {
            background: var(--dark-bg);
            border: 2px solid var(--neon-cyan);
            padding: 30px;
            max-width: 600px;
            width: 100%;
            box-shadow: 0 0 30px rgba(0, 255, 255, 0.5);
        }
        
        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        
        .modal-title {
            font-size: 1.8em;
            text-shadow: 0 0 10px var(--neon-cyan);
        }
        
        .close-modal {
            font-size: 2em;
            cursor: pointer;
            border: none;
            background: none;
            color: var(--neon-cyan);
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-size: 0.9em;
            opacity: 0.8;
        }
        
        .form-group input,
        .form-group textarea,
        .form-group select {
            width: 100%;
            padding: 10px;
            background: var(--darker-bg);
            border: 2px solid var(--border-color);
            color: var(--neon-cyan);
            font-family: inherit;
            font-size: 1em;
        }
        
        .form-group input:focus,
        .form-group textarea:focus,
        .form-group select:focus {
            outline: none;
            border-color: var(--neon-cyan);
            box-shadow: 0 0 10px rgba(0, 255, 255, 0.3);
        }
        
        @media (max-width: 768px) {
            .header h1 {
                font-size: 1.8em;
            }
            
            .stats-grid {
                grid-template-columns: 1fr;
            }
            
            .task-header {
                flex-direction: column;
                align-items: flex-start;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>⚡ Web Automation & Scraping Control Center ⚡</h1>
        <p>Real-time monitoring and control for automation tasks</p>
    </div>
    
    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-label">Total Tasks</div>
            <div class="stat-value" style="color: var(--neon-cyan);"><?= $totalTasks ?></div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Active Tasks</div>
            <div class="stat-value" style="color: var(--neon-green);"><?= $runningTasks ?></div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Success Rate</div>
            <div class="stat-value" style="color: var(--neon-magenta);"><?= $successRate ?>%</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Total Requests</div>
            <div class="stat-value" style="color: var(--neon-green);"><?= number_format($completedRequests) ?></div>
        </div>
    </div>
    
    <div class="controls">
        <div>
            <button class="btn btn-primary" onclick="openNewTaskModal()">🚀 New Task</button>
            <a href="index.php" class="btn">← Back to Control Panel</a>
        </div>
        <div class="toggle-refresh">
            <label>
                <input type="checkbox" id="autoRefresh" checked onchange="toggleAutoRefresh()">
                Auto-refresh (5s)
            </label>
        </div>
    </div>
    
    <div class="tasks-container">
        <?php if (empty($tasks)): ?>
            <div class="no-tasks">
                No automation tasks yet. Click "New Task" to create one!
            </div>
        <?php else: ?>
            <?php foreach ($tasks as $task): ?>
                <div class="task-card">
                    <div class="task-header">
                        <div class="task-name"><?= htmlspecialchars($task['name']) ?></div>
                        <div class="task-status status-<?= $task['status'] ?>">
                            <?= strtoupper($task['status']) ?>
                        </div>
                    </div>
                    
                    <div class="task-info">
                        <div class="info-item">
                            <div class="info-label">Type</div>
                            <div class="info-value"><?= htmlspecialchars($task['type']) ?></div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Priority</div>
                            <div class="info-value"><?= $task['priority'] ?>/10</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Completed</div>
                            <div class="info-value"><?= number_format($task['requests_completed']) ?></div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Failed</div>
                            <div class="info-value" style="color: #f00;"><?= number_format($task['requests_failed']) ?></div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Concurrency</div>
                            <div class="info-value"><?= $task['concurrency'] ?></div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Created</div>
                            <div class="info-value"><?= date('M d, H:i', strtotime($task['created_at'])) ?></div>
                        </div>
                    </div>
                    
                    <div class="task-actions">
                        <?php if ($task['status'] === 'created' || $task['status'] === 'paused' || $task['status'] === 'stopped'): ?>
                            <button class="btn btn-small" onclick="controlTask('<?= $task['id'] ?>', 'start')">▶ Start</button>
                        <?php endif; ?>
                        
                        <?php if ($task['status'] === 'running'): ?>
                            <button class="btn btn-small" onclick="controlTask('<?= $task['id'] ?>', 'pause')">⏸ Pause</button>
                            <button class="btn btn-small" onclick="controlTask('<?= $task['id'] ?>', 'stop')">⏹ Stop</button>
                        <?php endif; ?>
                        
                        <button class="btn btn-small" onclick="viewResults('<?= $task['id'] ?>')">📊 Results</button>
                        <button class="btn btn-small" onclick="deleteTask('<?= $task['id'] ?>')">🗑 Delete</button>
                    </div>
                </div>
            <?php endforeach; ?>
        <?php endif; ?>
    </div>
    
    <!-- New Task Modal -->
    <div id="newTaskModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2 class="modal-title">Create New Task</h2>
                <button class="close-modal" onclick="closeModal()">&times;</button>
            </div>
            <form id="newTaskForm" onsubmit="createTask(event)">
                <div class="form-group">
                    <label>Task Name</label>
                    <input type="text" name="name" required placeholder="My Scraping Task">
                </div>
                <div class="form-group">
                    <label>Type</label>
                    <select name="type">
                        <option value="scraping">Scraping</option>
                        <option value="automation">Automation</option>
                        <option value="monitoring">Monitoring</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>URLs (one per line)</label>
                    <textarea name="urls" rows="4" placeholder="https://example.com&#10;https://example.org"></textarea>
                </div>
                <div class="form-group">
                    <label>Priority (1-10)</label>
                    <input type="number" name="priority" min="1" max="10" value="5">
                </div>
                <div class="form-group">
                    <label>Concurrency</label>
                    <input type="number" name="concurrency" min="1" max="50" value="5">
                </div>
                <div class="form-group">
                    <label>Rate Limit (requests/minute)</label>
                    <input type="number" name="rate_limit" min="1" max="1000" value="100">
                </div>
                <button type="submit" class="btn btn-primary" style="width: 100%;">Create Task</button>
            </form>
        </div>
    </div>
    
    <script>
        let autoRefreshEnabled = true;
        let refreshInterval;
        
        function toggleAutoRefresh() {
            autoRefreshEnabled = document.getElementById('autoRefresh').checked;
            if (autoRefreshEnabled) {
                startAutoRefresh();
            } else {
                stopAutoRefresh();
            }
        }
        
        function startAutoRefresh() {
            refreshInterval = setInterval(() => {
                if (autoRefreshEnabled) {
                    showRefreshIndicator();
                    setTimeout(() => location.reload(), 500);
                }
            }, 5000);
        }
        
        function stopAutoRefresh() {
            if (refreshInterval) {
                clearInterval(refreshInterval);
            }
        }
        
        function showRefreshIndicator() {
            const indicator = document.createElement('div');
            indicator.className = 'refresh-indicator';
            indicator.textContent = '🔄 Refreshing...';
            document.body.appendChild(indicator);
            setTimeout(() => indicator.remove(), 2000);
        }
        
        function openNewTaskModal() {
            document.getElementById('newTaskModal').classList.add('active');
        }
        
        function closeModal() {
            document.getElementById('newTaskModal').classList.remove('active');
        }
        
        async function createTask(e) {
            e.preventDefault();
            const formData = new FormData(e.target);
            const urls = formData.get('urls').split('\n').filter(u => u.trim());
            
            const data = {
                name: formData.get('name'),
                type: formData.get('type'),
                urls: urls,
                priority: parseInt(formData.get('priority')),
                concurrency: parseInt(formData.get('concurrency')),
                rate_limit: parseInt(formData.get('rate_limit'))
            };
            
            try {
                const response = await fetch('/api/automation/tasks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                if (response.ok) {
                    alert('Task created successfully!');
                    closeModal();
                    location.reload();
                } else {
                    alert('Error creating task');
                }
            } catch (error) {
                alert('Error: ' + error.message);
            }
        }
        
        async function controlTask(taskId, action) {
            try {
                const response = await fetch(`/api/automation/tasks/${taskId}/${action}`, {
                    method: 'POST'
                });
                
                if (response.ok) {
                    location.reload();
                } else {
                    alert('Error controlling task');
                }
            } catch (error) {
                alert('Error: ' + error.message);
            }
        }
        
        async function deleteTask(taskId) {
            if (!confirm('Are you sure you want to delete this task?')) return;
            
            try {
                const response = await fetch(`/api/automation/tasks/${taskId}`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    location.reload();
                } else {
                    alert('Error deleting task');
                }
            } catch (error) {
                alert('Error: ' + error.message);
            }
        }
        
        function viewResults(taskId) {
            window.open(`/api/scraping/jobs/${taskId}/results`, '_blank');
        }
        
        // Start auto-refresh on load
        if (autoRefreshEnabled) {
            startAutoRefresh();
        }
        
        // Close modal on ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
        });
    </script>
</body>
</html>
