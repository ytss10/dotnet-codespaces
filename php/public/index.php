<?php
/**
 * MegaWeb Orchestrator - Main Entry Point
 * Advanced control panel for 1M concurrent sites
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../includes/database.php';
require_once __DIR__ . '/../includes/orchestrator.php';

$orchestrator = new HyperOrchestrator();
$globalMetrics = $orchestrator->getGlobalMetrics();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MegaWeb Orchestrator - 1M Concurrent Sites Control Panel</title>
    <style>
        :root {
            --quantum-grid: 1fr;
            --render-layer: translateZ(0);
            --primary-color: #0ff;
            --bg-dark: #0a0a0a;
            --bg-overlay: rgba(0, 0, 0, 0.95);
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            background: var(--bg-dark);
            color: var(--primary-color);
            font-family: 'Courier New', monospace;
            overflow-x: hidden;
        }
        
        .header {
            background: var(--bg-overlay);
            border-bottom: 2px solid var(--primary-color);
            padding: 20px;
            text-align: center;
            backdrop-filter: blur(10px);
        }
        
        .header h1 {
            font-size: 2rem;
            text-shadow: 0 0 10px var(--primary-color);
            letter-spacing: 2px;
        }
        
        .header .subtitle {
            color: #0aa;
            margin-top: 5px;
        }
        
        .main-container {
            display: flex;
            height: calc(100vh - 100px);
        }
        
        .control-panel {
            width: 400px;
            background: var(--bg-overlay);
            border-right: 1px solid var(--primary-color);
            padding: 20px;
            overflow-y: auto;
            backdrop-filter: blur(10px);
        }
        
        .live-view {
            flex: 1;
            position: relative;
            background: #000;
        }
        
        .metric-card {
            background: rgba(0, 255, 255, 0.1);
            border: 1px solid var(--primary-color);
            border-radius: 5px;
            padding: 15px;
            margin-bottom: 15px;
        }
        
        .metric-card h3 {
            margin-bottom: 10px;
            font-size: 1.1rem;
            border-bottom: 1px solid var(--primary-color);
            padding-bottom: 5px;
        }
        
        .metric-row {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
            font-size: 0.9rem;
        }
        
        .metric-value {
            color: #0f0;
            font-weight: bold;
        }
        
        .btn {
            background: rgba(0, 255, 255, 0.2);
            border: 1px solid var(--primary-color);
            color: var(--primary-color);
            padding: 10px 20px;
            cursor: pointer;
            border-radius: 3px;
            font-family: inherit;
            font-size: 1rem;
            transition: all 0.3s;
            width: 100%;
            margin-bottom: 10px;
        }
        
        .btn:hover {
            background: rgba(0, 255, 255, 0.4);
            box-shadow: 0 0 10px var(--primary-color);
        }
        
        .btn-primary {
            background: rgba(0, 255, 0, 0.2);
            border-color: #0f0;
            color: #0f0;
        }
        
        .btn-danger {
            background: rgba(255, 0, 0, 0.2);
            border-color: #f00;
            color: #f00;
        }
        
        .input-group {
            margin-bottom: 15px;
        }
        
        .input-group label {
            display: block;
            margin-bottom: 5px;
            font-size: 0.9rem;
        }
        
        .input-group input,
        .input-group select,
        .input-group textarea {
            width: 100%;
            background: rgba(0, 255, 255, 0.1);
            border: 1px solid var(--primary-color);
            color: var(--primary-color);
            padding: 8px;
            border-radius: 3px;
            font-family: inherit;
        }
        
        .input-group textarea {
            resize: vertical;
            min-height: 100px;
        }
        
        .session-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 10px;
            padding: 20px;
            max-height: 100%;
            overflow-y: auto;
        }
        
        .session-tile {
            background: rgba(0, 255, 255, 0.1);
            border: 1px solid var(--primary-color);
            border-radius: 5px;
            padding: 15px;
            transition: all 0.3s;
            cursor: pointer;
        }
        
        .session-tile:hover {
            transform: scale(1.05);
            box-shadow: 0 0 15px var(--primary-color);
        }
        
        .session-tile .url {
            font-size: 0.8rem;
            color: #0aa;
            margin-bottom: 10px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .session-tile .status {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 3px;
            font-size: 0.75rem;
            margin-bottom: 5px;
        }
        
        .status-steady { background: rgba(0, 255, 0, 0.3); color: #0f0; }
        .status-scaling { background: rgba(255, 255, 0, 0.3); color: #ff0; }
        .status-degraded { background: rgba(255, 165, 0, 0.3); color: #fa0; }
        .status-terminated { background: rgba(255, 0, 0, 0.3); color: #f00; }
        .status-draft { background: rgba(128, 128, 128, 0.3); color: #888; }
        
        .session-tile .replicas {
            font-size: 0.85rem;
            margin-top: 5px;
        }
        
        .stats-bar {
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--bg-overlay);
            border: 1px solid var(--primary-color);
            padding: 15px;
            border-radius: 5px;
            z-index: 1000;
            min-width: 250px;
        }
        
        .stats-bar h4 {
            margin-bottom: 10px;
            border-bottom: 1px solid var(--primary-color);
            padding-bottom: 5px;
        }
        
        .loading {
            text-align: center;
            padding: 50px;
            font-size: 1.5rem;
            animation: pulse 1.5s infinite;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        .modal {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.9);
            z-index: 2000;
            justify-content: center;
            align-items: center;
        }
        
        .modal.active {
            display: flex;
        }
        
        .modal-content {
            background: var(--bg-dark);
            border: 2px solid var(--primary-color);
            border-radius: 10px;
            padding: 30px;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
        }
        
        .modal-header {
            margin-bottom: 20px;
            border-bottom: 1px solid var(--primary-color);
            padding-bottom: 10px;
        }
        
        .close-modal {
            float: right;
            font-size: 1.5rem;
            cursor: pointer;
        }
        
        .progress-bar {
            width: 100%;
            height: 20px;
            background: rgba(0, 255, 255, 0.1);
            border: 1px solid var(--primary-color);
            border-radius: 3px;
            overflow: hidden;
            margin: 10px 0;
        }
        
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #0ff, #0f0);
            transition: width 0.3s;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 MegaWeb Orchestrator</h1>
        <div class="subtitle">Advanced 1M Concurrent Site Management Platform</div>
    </div>
    
    <div class="main-container">
        <div class="control-panel">
            <div class="metric-card">
                <h3>📊 Global Metrics</h3>
                <div class="metric-row">
                    <span>Active Sessions:</span>
                    <span class="metric-value" id="totalSessions"><?= number_format($globalMetrics['totalSessions']) ?></span>
                </div>
                <div class="metric-row">
                    <span>Active Replicas:</span>
                    <span class="metric-value" id="totalReplicas"><?= number_format($globalMetrics['totalReplicas']) ?></span>
                </div>
                <div class="metric-row">
                    <span>Active Proxies:</span>
                    <span class="metric-value" id="totalProxies"><?= number_format($globalMetrics['totalProxies']) ?></span>
                </div>
                <div class="metric-row">
                    <span>Countries Covered:</span>
                    <span class="metric-value" id="countriesCovered"><?= $globalMetrics['countriesCovered'] ?></span>
                </div>
                <div class="metric-row">
                    <span>Avg Latency:</span>
                    <span class="metric-value" id="avgLatency"><?= round($globalMetrics['avgLatencyMs'], 2) ?>ms</span>
                </div>
            </div>
            
            <div class="metric-card">
                <h3>🎮 Quick Actions</h3>
                <button class="btn btn-primary" onclick="openBulkEmbedModal()">
                    🚀 Bulk Embed Sites
                </button>
                <button class="btn" onclick="openScaleModal()">
                    📈 Scale to 1M Sessions
                </button>
                <button class="btn" onclick="openCreateSessionModal()">
                    ➕ Create Session
                </button>
                <button class="btn" onclick="refreshMetrics()">
                    🔄 Refresh Metrics
                </button>
                <button class="btn btn-danger" onclick="deleteAllSessions()">
                    🗑️ Clear All Sessions
                </button>
            </div>
            
            <div class="metric-card">
                <h3>📡 Real-time Updates</h3>
                <div class="metric-row">
                    <span>Last Update:</span>
                    <span class="metric-value" id="lastUpdate">Just now</span>
                </div>
                <div class="metric-row">
                    <span>Auto-refresh:</span>
                    <span class="metric-value">
                        <input type="checkbox" id="autoRefresh" checked onchange="toggleAutoRefresh()"> Enabled
                    </span>
                </div>
            </div>
        </div>
        
        <div class="live-view">
            <div class="stats-bar">
                <h4>Live Sessions</h4>
                <div class="metric-row">
                    <span>Total:</span>
                    <span class="metric-value" id="liveSessionCount">0</span>
                </div>
            </div>
            
            <div class="session-grid" id="sessionGrid">
                <div class="loading">Loading sessions...</div>
            </div>
        </div>
    </div>
    
    <!-- Bulk Embed Modal -->
    <div class="modal" id="bulkEmbedModal">
        <div class="modal-content">
            <div class="modal-header">
                <span class="close-modal" onclick="closeBulkEmbedModal()">×</span>
                <h2>🚀 Bulk Embed Sites</h2>
            </div>
            <div class="input-group">
                <label>URLs (one per line):</label>
                <textarea id="bulkUrls" placeholder="https://example.com&#10;https://example2.com&#10;https://example3.com"></textarea>
            </div>
            <div class="input-group">
                <label>Replicas per URL:</label>
                <input type="number" id="replicasPerUrl" value="1" min="1" max="1000">
            </div>
            <div class="input-group">
                <label>Region:</label>
                <select id="bulkRegion">
                    <option value="">Auto</option>
                    <option value="us-east">US East</option>
                    <option value="us-west">US West</option>
                    <option value="eu-west">EU West</option>
                    <option value="asia-pacific">Asia Pacific</option>
                </select>
            </div>
            <button class="btn btn-primary" onclick="executeBulkEmbed()">Launch Sites</button>
            <div class="progress-bar" id="bulkProgress" style="display:none;">
                <div class="progress-fill" id="bulkProgressFill"></div>
            </div>
            <div id="bulkResult"></div>
        </div>
    </div>
    
    <!-- Scale Modal -->
    <div class="modal" id="scaleModal">
        <div class="modal-content">
            <div class="modal-header">
                <span class="close-modal" onclick="closeScaleModal()">×</span>
                <h2>📈 Scale to Million</h2>
            </div>
            <div class="input-group">
                <label>Target Sessions:</label>
                <input type="number" id="targetSessions" value="1000000" min="1" max="10000000">
            </div>
            <button class="btn btn-primary" onclick="executeScaleToMillion()">Start Scaling</button>
            <div class="progress-bar" id="scaleProgress" style="display:none;">
                <div class="progress-fill" id="scaleProgressFill"></div>
            </div>
            <div id="scaleResult"></div>
        </div>
    </div>
    
    <!-- Create Session Modal -->
    <div class="modal" id="createSessionModal">
        <div class="modal-content">
            <div class="modal-header">
                <span class="close-modal" onclick="closeCreateSessionModal()">×</span>
                <h2>➕ Create Session</h2>
            </div>
            <div class="input-group">
                <label>URL:</label>
                <input type="url" id="sessionUrl" placeholder="https://example.com" required>
            </div>
            <div class="input-group">
                <label>Target Replicas:</label>
                <input type="number" id="sessionReplicas" value="1" min="1" max="10000">
            </div>
            <div class="input-group">
                <label>Region:</label>
                <select id="sessionRegion">
                    <option value="">Auto</option>
                    <option value="us-east">US East</option>
                    <option value="us-west">US West</option>
                    <option value="eu-west">EU West</option>
                    <option value="asia-pacific">Asia Pacific</option>
                </select>
            </div>
            <button class="btn btn-primary" onclick="executeCreateSession()">Create Session</button>
            <div id="createSessionResult"></div>
        </div>
    </div>
    
    <script>
        const API_BASE = '/api';
        let autoRefreshInterval = null;
        
        // Load sessions on page load
        document.addEventListener('DOMContentLoaded', () => {
            loadSessions();
            startAutoRefresh();
        });
        
        async function loadSessions() {
            try {
                const response = await fetch(`${API_BASE}/sessions`);
                const data = await response.json();
                
                const grid = document.getElementById('sessionGrid');
                grid.innerHTML = '';
                
                if (data.blueprints.length === 0) {
                    grid.innerHTML = '<div class="loading">No active sessions. Create one to get started!</div>';
                    return;
                }
                
                data.blueprints.forEach(blueprint => {
                    const tile = createSessionTile(blueprint);
                    grid.appendChild(tile);
                });
                
                document.getElementById('liveSessionCount').textContent = data.blueprints.length;
                
            } catch (error) {
                console.error('Failed to load sessions:', error);
                document.getElementById('sessionGrid').innerHTML = 
                    '<div class="loading" style="color: #f00;">Error loading sessions</div>';
            }
        }
        
        function createSessionTile(blueprint) {
            const div = document.createElement('div');
            div.className = 'session-tile';
            div.innerHTML = `
                <div class="url" title="${blueprint.definition.url}">${blueprint.definition.url}</div>
                <span class="status status-${blueprint.status}">${blueprint.status}</span>
                <div class="replicas">
                    Replicas: <strong>${blueprint.current_replica_count}</strong> / ${blueprint.definition.target_replica_count}
                </div>
                <div style="font-size: 0.75rem; color: #0aa; margin-top: 5px;">
                    Region: ${blueprint.definition.region || 'Auto'}
                </div>
            `;
            
            div.onclick = () => showSessionDetails(blueprint);
            
            return div;
        }
        
        function showSessionDetails(blueprint) {
            alert(`Session: ${blueprint.id}\nURL: ${blueprint.definition.url}\nStatus: ${blueprint.status}\nReplicas: ${blueprint.current_replica_count}`);
        }
        
        async function refreshMetrics() {
            try {
                const response = await fetch(`${API_BASE}/metrics/global`);
                const metrics = await response.json();
                
                document.getElementById('totalSessions').textContent = metrics.totalSessions.toLocaleString();
                document.getElementById('totalReplicas').textContent = metrics.totalReplicas.toLocaleString();
                document.getElementById('totalProxies').textContent = metrics.totalProxies.toLocaleString();
                document.getElementById('countriesCovered').textContent = metrics.countriesCovered;
                document.getElementById('avgLatency').textContent = metrics.avgLatencyMs.toFixed(2) + 'ms';
                document.getElementById('lastUpdate').textContent = 'Just now';
                
                await loadSessions();
                
            } catch (error) {
                console.error('Failed to refresh metrics:', error);
            }
        }
        
        function startAutoRefresh() {
            if (autoRefreshInterval) return;
            autoRefreshInterval = setInterval(refreshMetrics, 5000);
        }
        
        function stopAutoRefresh() {
            if (autoRefreshInterval) {
                clearInterval(autoRefreshInterval);
                autoRefreshInterval = null;
            }
        }
        
        function toggleAutoRefresh() {
            const checkbox = document.getElementById('autoRefresh');
            if (checkbox.checked) {
                startAutoRefresh();
            } else {
                stopAutoRefresh();
            }
        }
        
        // Modal functions
        function openBulkEmbedModal() {
            document.getElementById('bulkEmbedModal').classList.add('active');
        }
        
        function closeBulkEmbedModal() {
            document.getElementById('bulkEmbedModal').classList.remove('active');
        }
        
        function openScaleModal() {
            document.getElementById('scaleModal').classList.add('active');
        }
        
        function closeScaleModal() {
            document.getElementById('scaleModal').classList.remove('active');
        }
        
        function openCreateSessionModal() {
            document.getElementById('createSessionModal').classList.add('active');
        }
        
        function closeCreateSessionModal() {
            document.getElementById('createSessionModal').classList.remove('active');
        }
        
        async function executeBulkEmbed() {
            const urls = document.getElementById('bulkUrls').value.split('\n').filter(u => u.trim());
            const replicasPerUrl = parseInt(document.getElementById('replicasPerUrl').value);
            const region = document.getElementById('bulkRegion').value;
            
            if (urls.length === 0) {
                alert('Please enter at least one URL');
                return;
            }
            
            document.getElementById('bulkProgress').style.display = 'block';
            document.getElementById('bulkProgressFill').style.width = '50%';
            
            try {
                const response = await fetch(`${API_BASE}/embed/bulk`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        urls,
                        bulkOptions: { replicasPerUrl, region },
                        proxyRequirements: {},
                        renderingOptions: {}
                    })
                });
                
                const result = await response.json();
                document.getElementById('bulkProgressFill').style.width = '100%';
                
                document.getElementById('bulkResult').innerHTML = `
                    <div style="margin-top: 20px; color: #0f0;">
                        ✓ Successfully created ${result.totalProcessed} sessions in ${result.processingTimeMs}ms
                    </div>
                `;
                
                setTimeout(() => {
                    closeBulkEmbedModal();
                    refreshMetrics();
                }, 2000);
                
            } catch (error) {
                document.getElementById('bulkResult').innerHTML = `
                    <div style="margin-top: 20px; color: #f00;">
                        ✗ Error: ${error.message}
                    </div>
                `;
            }
        }
        
        async function executeScaleToMillion() {
            const targetSessions = parseInt(document.getElementById('targetSessions').value);
            
            document.getElementById('scaleProgress').style.display = 'block';
            document.getElementById('scaleProgressFill').style.width = '10%';
            
            try {
                const response = await fetch(`${API_BASE}/embed/scale-million`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ targetSessions })
                });
                
                const result = await response.json();
                document.getElementById('scaleProgressFill').style.width = '100%';
                
                document.getElementById('scaleResult').innerHTML = `
                    <div style="margin-top: 20px; color: #0f0;">
                        ✓ Scaled to ${result.currentSessions.toLocaleString()} sessions in ${result.scalingTimeMs}ms<br>
                        Target: ${result.targetSessions.toLocaleString()}<br>
                        Failed: ${result.failedSessionCount}
                    </div>
                `;
                
                setTimeout(() => {
                    closeScaleModal();
                    refreshMetrics();
                }, 3000);
                
            } catch (error) {
                document.getElementById('scaleResult').innerHTML = `
                    <div style="margin-top: 20px; color: #f00;">
                        ✗ Error: ${error.message}
                    </div>
                `;
            }
        }
        
        async function executeCreateSession() {
            const url = document.getElementById('sessionUrl').value;
            const targetReplicas = parseInt(document.getElementById('sessionReplicas').value);
            const region = document.getElementById('sessionRegion').value;
            
            if (!url) {
                alert('Please enter a URL');
                return;
            }
            
            try {
                const response = await fetch(`${API_BASE}/sessions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url,
                        target_replica_count: targetReplicas,
                        region,
                        status: 'steady'
                    })
                });
                
                const result = await response.json();
                
                document.getElementById('createSessionResult').innerHTML = `
                    <div style="margin-top: 20px; color: #0f0;">
                        ✓ Session created successfully!<br>
                        ID: ${result.id}
                    </div>
                `;
                
                setTimeout(() => {
                    closeCreateSessionModal();
                    refreshMetrics();
                }, 2000);
                
            } catch (error) {
                document.getElementById('createSessionResult').innerHTML = `
                    <div style="margin-top: 20px; color: #f00;">
                        ✗ Error: ${error.message}
                    </div>
                `;
            }
        }
        
        async function deleteAllSessions() {
            if (!confirm('Are you sure you want to delete ALL sessions? This cannot be undone!')) {
                return;
            }
            
            try {
                const response = await fetch(`${API_BASE}/sessions`);
                const data = await response.json();
                
                for (const blueprint of data.blueprints) {
                    await fetch(`${API_BASE}/sessions/${blueprint.id}`, {
                        method: 'DELETE'
                    });
                }
                
                alert('All sessions deleted');
                refreshMetrics();
                
            } catch (error) {
                alert('Error deleting sessions: ' + error.message);
            }
        }
    </script>
</body>
</html>
