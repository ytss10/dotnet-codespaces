class AdminPanel {
    constructor() {
        this.connection = null;
        this.charts = new Map();
        this.metrics = new Map();
        this.sites = new Map();
        this.eventHandlers = new Map();
        
        this.initializeConnection();
        this.initializeCharts();
        this.setupEventListeners();
        this.startMetricsPolling();
    }

    async initializeConnection() {
        this.connection = new signalR.HubConnectionBuilder()
            .withUrl("/admin/hub", {
                accessTokenFactory: () => this.getAuthToken()
            })
            .withAutomaticReconnect({
                nextRetryDelayInMilliseconds: retryContext => {
                    if (retryContext.elapsedMilliseconds < 60000) {
                        return Math.min(retryContext.previousRetryCount * 1000, 10000);
                    }
                    return null;
                }
            })
            .configureLogging(signalR.LogLevel.Information)
            .build();

        // Register event handlers
        this.connection.on("InitialState", (state) => this.handleInitialState(state));
        this.connection.on("MetricsUpdate", (metrics) => this.updateMetrics(metrics));
        this.connection.on("SystemEvent", (event) => this.handleSystemEvent(event));
        this.connection.on("ValidationError", (errors) => this.showValidationErrors(errors));
        this.connection.on("SettingsUpdated", (settings) => this.handleSettingsUpdate(settings));

        await this.connection.start();
        console.log("Admin panel connected");
    }

    initializeCharts() {
        // Sites activity chart
        const sitesCtx = document.getElementById('sites-chart')?.getContext('2d');
        if (sitesCtx) {
            this.charts.set('sites', new Chart(sitesCtx, {
                type: 'line',
                data: {
                    datasets: [{
                        label: 'Active Sites',
                        data: [],
                        borderColor: '#4CAF50',
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { type: 'realtime', realtime: { duration: 60000, refresh: 1000 } },
                        y: { beginAtZero: true }
                    }
                }
            }));
        }

        // Throughput chart
        const throughputCtx = document.getElementById('throughput-chart')?.getContext('2d');
        if (throughputCtx) {
            this.charts.set('throughput', new Chart(throughputCtx, {
                type: 'line',
                data: {
                    datasets: [{
                        label: 'Requests/sec',
                        data: [],
                        borderColor: '#2196F3',
                        backgroundColor: 'rgba(33, 150, 243, 0.1)',
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { type: 'realtime' },
                        y: { beginAtZero: true }
                    }
                }
            }));
        }
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchSection(item.dataset.section);
            });
        });

        // Settings tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchTab(btn.dataset.tab);
            });
        });

        // Range inputs
        document.querySelectorAll('input[type="range"]').forEach(input => {
            input.addEventListener('input', (e) => {
                const valueSpan = e.target.nextElementSibling;
                if (valueSpan?.classList.contains('range-value')) {
                    valueSpan.textContent = e.target.id === 'cache-size' 
                        ? `${e.target.value} GB` 
                        : e.target.value;
                }
            });
        });

        // Site selection
        document.getElementById('select-all-sites')?.addEventListener('change', (e) => {
            document.querySelectorAll('.site-checkbox').forEach(cb => {
                cb.checked = e.target.checked;
            });
        });
    }

    async handleInitialState(state) {
        // Update metrics
        this.updateMetrics(state.SystemMetrics);
        
        // Update worker pools
        this.renderWorkerPools(state.LoadBalancerStatus);
        
        // Update proxy status
        this.updateProxyStatus(state.ProxyPoolStatus);
        
        // Load configuration
        this.loadConfiguration(state.Configuration);
        
        // Update uptime
        this.updateUptime(state.SystemUptime);
    }

    updateMetrics(metrics) {
        // Update metric cards
        document.getElementById('active-sites').textContent = metrics.activeSites?.toLocaleString() || '0';
        document.getElementById('system-load').textContent = `${Math.round(metrics.cpuUsage || 0)}%`;
        document.getElementById('throughput').textContent = `${metrics.throughput || 0} req/s`;
        document.getElementById('proxy-health').textContent = `${Math.round(metrics.proxyHealth || 100)}%`;

        // Update load bars
        this.updateLoadBar('cpu', metrics.cpuUsage);
        this.updateLoadBar('memory', metrics.memoryUsage);
        this.updateLoadBar('network', metrics.networkUsage);

        // Update charts
        const now = Date.now();
        
        const sitesChart = this.charts.get('sites');
        if (sitesChart) {
            sitesChart.data.datasets[0].data.push({
                x: now,
                y: metrics.activeSites
            });
            sitesChart.update('none');
        }

        const throughputChart = this.charts.get('throughput');
        if (throughputChart) {
            throughputChart.data.datasets[0].data.push({
                x: now,
                y: metrics.throughput
            });
            throughputChart.update('none');
        }
    }

    updateLoadBar(type, value) {
        const bar = document.querySelector(`.load-bar.${type}`);
        if (bar) {
            bar.style.width = `${value || 0}%`;
            bar.setAttribute('data-value', `${Math.round(value || 0)}%`);
            
            // Change color based on load
            if (value > 80) {
                bar.style.backgroundColor = '#f44336';
            } else if (value > 60) {
                bar.style.backgroundColor = '#ff9800';
            } else {
                bar.style.backgroundColor = '#4caf50';
            }
        }
    }

    renderWorkerPools(pools) {
        const container = document.getElementById('worker-pools');
        if (!container) return;

        container.innerHTML = pools.map(pool => `
            <div class="pool-card">
                <h4>${pool.name}</h4>
                <div class="pool-stats">
                    <div>Workers: ${pool.activeWorkers}/${pool.maxWorkers}</div>
                    <div>Queue: ${pool.queueLength}</div>
                    <div>Processed: ${pool.processedCount.toLocaleString()}</div>
                </div>
                <div class="pool-actions">
                    <button onclick="adminPanel.scalePool('${pool.id}', 'up')">Scale Up</button>
                    <button onclick="adminPanel.scalePool('${pool.id}', 'down')">Scale Down</button>
                    <button onclick="adminPanel.restartPool('${pool.id}')">Restart</button>
                </div>
            </div>
        `).join('');
    }

    async scalePool(poolId, direction) {
        const command = {
            poolId,
            targetSize: direction === 'up' ? '+10' : '-10',
            scaleStrategy: 'gradual'
        };

        try {
            const result = await this.connection.invoke("ScaleWorkerPool", command);
            if (result.success) {
                this.showNotification('Worker pool scaled successfully', 'success');
            } else {
                this.showNotification(result.error, 'error');
            }
        } catch (error) {
            console.error('Failed to scale pool:', error);
            this.showNotification('Failed to scale worker pool', 'error');
        }
    }

    async saveSettings() {
        const settings = {
            general: {
                maxConcurrentSites: parseInt(document.getElementById('max-sites').value),
                defaultTimeout: parseInt(document.getElementById('default-timeout').value),
                refreshInterval: parseInt(document.getElementById('refresh-interval').value)
            },
            performance: {
                minWorkerThreads: parseInt(document.getElementById('worker-threads').value),
                maxWorkerThreads: parseInt(document.getElementById('worker-threads').value) * 2,
                minIOThreads: 10,
                maxIOThreads: 100,
                serverGC: true,
                maxConcurrentRequests: parseInt(document.getElementById('max-sites').value),
                requestQueueLimit: 100000,
                requestTimeoutSeconds: parseInt(document.getElementById('default-timeout').value)
            },
            caching: {
                enabled: true,
                sizeGB: parseInt(document.getElementById('cache-size').value),
                compressionEnabled: document.getElementById('enable-compression').checked
            },
            rateLimiting: {
                enabled: document.getElementById('enable-auth').checked,
                requestsPerMinute: parseInt(document.getElementById('rate-limit').value)
            }
        };

        try {
            await this.connection.invoke("UpdateSystemSettings", settings);
            this.showNotification('Settings saved successfully', 'success');
        } catch (error) {
            console.error('Failed to save settings:', error);
            this.showNotification('Failed to save settings', 'error');
        }
    }

    async applySettings() {
        if (confirm('Apply settings without restart? This may cause temporary disruption.')) {
            await this.saveSettings();
            await this.connection.invoke("ExecuteSystemCommand", {
                type: 'ReloadConfiguration',
                parameters: {}
            });
        }
    }

    switchSection(sectionId) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.section === sectionId);
        });

        // Update sections
        document.querySelectorAll('.admin-section').forEach(section => {
            section.classList.toggle('active', section.id === sectionId);
        });
    }

    switchTab(tabId) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabId}-settings`);
        });
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    async getAuthToken() {
        // Implement authentication token retrieval
        return localStorage.getItem('admin-token');
    }
}

// Initialize admin panel
const adminPanel = new AdminPanel();
