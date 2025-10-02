<?php
/**
 * MegaWeb Orchestrator - Installation Script
 * Automated setup for InfinityFree hosting
 */

// Set to true to enable installation
define('INSTALL_ENABLED', true);

if (!INSTALL_ENABLED) {
    die('Installation is disabled. Set INSTALL_ENABLED to true in install.php');
}

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MegaWeb Orchestrator - Installation</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
            color: #0ff;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: rgba(0, 0, 0, 0.8);
            border: 2px solid #0ff;
            border-radius: 10px;
            padding: 30px;
        }
        h1 {
            text-align: center;
            text-shadow: 0 0 10px #0ff;
        }
        .step {
            background: rgba(0, 255, 255, 0.1);
            border: 1px solid #0ff;
            border-radius: 5px;
            padding: 20px;
            margin: 20px 0;
        }
        .step h2 {
            margin-top: 0;
        }
        input, textarea {
            width: 100%;
            padding: 10px;
            background: rgba(0, 0, 0, 0.5);
            border: 1px solid #0ff;
            color: #0ff;
            border-radius: 3px;
            margin: 10px 0;
        }
        button {
            background: rgba(0, 255, 0, 0.3);
            border: 1px solid #0f0;
            color: #0f0;
            padding: 15px 30px;
            cursor: pointer;
            border-radius: 5px;
            font-size: 16px;
            width: 100%;
            margin: 10px 0;
        }
        button:hover {
            background: rgba(0, 255, 0, 0.5);
        }
        .success {
            color: #0f0;
            background: rgba(0, 255, 0, 0.1);
            padding: 15px;
            border-radius: 5px;
            margin: 10px 0;
        }
        .error {
            color: #f00;
            background: rgba(255, 0, 0, 0.1);
            padding: 15px;
            border-radius: 5px;
            margin: 10px 0;
        }
        .info {
            background: rgba(255, 255, 0, 0.1);
            border-left: 3px solid #ff0;
            padding: 15px;
            margin: 10px 0;
        }
        code {
            background: rgba(0, 0, 0, 0.5);
            padding: 2px 5px;
            border-radius: 3px;
        }
        .checkbox-group {
            margin: 10px 0;
        }
        .checkbox-group label {
            display: flex;
            align-items: center;
            gap: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 MegaWeb Orchestrator Installation</h1>
        
        <div class="info">
            <strong>⚠️ Pre-Installation Checklist:</strong>
            <ul>
                <li>MySQL database created in cPanel</li>
                <li>Database credentials ready</li>
                <li>PHP 7.4+ available</li>
                <li>PDO MySQL extension enabled</li>
            </ul>
        </div>
        
        <form id="installForm">
            <div class="step">
                <h2>Step 1: Database Configuration</h2>
                <label>Database Host:</label>
                <input type="text" name="db_host" value="localhost" required>
                
                <label>Database Name:</label>
                <input type="text" name="db_name" required placeholder="e.g., epiz_12345678_megaweb">
                
                <label>Database Username:</label>
                <input type="text" name="db_user" required placeholder="e.g., epiz_12345678">
                
                <label>Database Password:</label>
                <input type="password" name="db_pass" required>
            </div>
            
            <div class="step">
                <h2>Step 2: Application Configuration</h2>
                <label>Application URL:</label>
                <input type="url" name="app_url" placeholder="https://your-site.infinityfreeapp.com" required>
                
                <label>Environment:</label>
                <select name="app_env" style="width: 100%; padding: 10px; background: rgba(0,0,0,0.5); border: 1px solid #0ff; color: #0ff; border-radius: 3px;">
                    <option value="production">Production</option>
                    <option value="development">Development</option>
                </select>
                
                <div class="checkbox-group">
                    <label>
                        <input type="checkbox" name="app_debug" value="1">
                        Enable Debug Mode (Not recommended for production)
                    </label>
                </div>
            </div>
            
            <div class="step">
                <h2>Step 3: Installation Actions</h2>
                <div class="checkbox-group">
                    <label>
                        <input type="checkbox" name="create_tables" value="1" checked>
                        Create database tables
                    </label>
                </div>
                <div class="checkbox-group">
                    <label>
                        <input type="checkbox" name="seed_data" value="1" checked>
                        Insert sample data
                    </label>
                </div>
                <div class="checkbox-group">
                    <label>
                        <input type="checkbox" name="create_config" value="1" checked>
                        Generate configuration file
                    </label>
                </div>
            </div>
            
            <button type="submit">🚀 Install Now</button>
        </form>
        
        <div id="result"></div>
    </div>
    
    <script>
        document.getElementById('installForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            
            document.getElementById('result').innerHTML = '<div class="info">⏳ Installing... Please wait...</div>';
            
            try {
                const response = await fetch('install-process.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    document.getElementById('result').innerHTML = `
                        <div class="success">
                            ✅ <strong>Installation Successful!</strong><br><br>
                            ${result.message}<br><br>
                            <strong>Next Steps:</strong><br>
                            1. Delete install.php and install-process.php for security<br>
                            2. Access your panel at: <a href="${data.app_url}" style="color: #0f0;">${data.app_url}</a><br>
                            3. Start creating sessions and scaling!
                        </div>
                    `;
                } else {
                    document.getElementById('result').innerHTML = `
                        <div class="error">
                            ❌ <strong>Installation Failed!</strong><br><br>
                            ${result.message}<br><br>
                            ${result.details || ''}
                        </div>
                    `;
                }
            } catch (error) {
                document.getElementById('result').innerHTML = `
                    <div class="error">
                        ❌ <strong>Installation Error!</strong><br><br>
                        ${error.message}
                    </div>
                `;
            }
        });
    </script>
</body>
</html>
