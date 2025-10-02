export class ControlMatrix extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.orchestrator = null;
        this.viewport = null;
        this.updateInterval = null;
        this.charts = new Map();
    }
    
    connectedCallback() {
        this.render();
        this.initializeCharts();
        this.startUpdates();
    }
    
    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    padding: 20px;
                    font-family: 'Courier New', monospace;
                    color: #0ff;
                }
                
                .header {
                    font-size: 24px;
                    margin-bottom: 20px;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    border-bottom: 2px solid #0ff;
                    padding-bottom: 10px;
                }
                
                .metrics-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 15px;
                    margin-bottom: 30px;
                }
                
                .metric-card {
                    background: rgba(0, 255, 255, 0.05);
                    border: 1px solid #0ff;
                    padding: 15px;
                    border-radius: 4px;
                }
                
                .metric-label {
                    font-size: 12px;
                    opacity: 0.7;
                    text-transform: uppercase;
                }
                
                .metric-value {
                    font-size: 28px;
                    font-weight: bold;
                    margin: 5px 0;
                }
                
                .metric-unit {
                    font-size: 14px;
                    opacity: 0.8;
                }
                
                .controls {
                    margin: 30px 0;
                }
                
                .control-btn {
                    background: transparent;
                    border: 2px solid #0ff;
                    color: #0ff;
                    padding: 10px 20px;
                    margin: 5px;
                    cursor: pointer;
                    font-family: inherit;
                    text-transform: uppercase;
                    transition: all 0.3s;
                }
                
                .control-btn:hover {
                    background: #0ff;
                    color: #000;
                    box-shadow: 0 0 20px #0ff;
                }
                
                .chart-container {
                    height: 200px;
                    margin: 20px 0;
                    border: 1px solid #0ff;
                    position: relative;
                }
                
                .proxy-list {
                    max-height: 300px;
                    overflow-y: auto;
                    border: 1px solid #0ff;
                    padding: 10px;
                    margin-top: 20px;
                }
                
                .proxy-item {
                    padding: 5px;
                    border-bottom: 1px solid rgba(0, 255, 255, 0.2);
                    font-size: 12px;
                }
                
                .status-indicator {
                    display: inline-block;
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    margin-right: 10px;
                }
                
                .status-active {
                    background: #0f0;
                    box-shadow: 0 0 10px #0f0;
                }
                
                .status-warning {
                    background: #ff0;
                    box-shadow: 0 0 10px #ff0;
                }
                
                .status-error {
                    background: #f00;
                    box-shadow: 0 0 10px #f00;
                }
            </style>
            
            <div class="header">Quantum Control Matrix</div>
            
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-label">Active Instances</div>
                    <div class="metric-value" id="active-instances">0</div>
                    <div class="metric-unit">/ 1,000,000</div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-label">Success Rate</div>
                    <div class="metric-value" id="success-rate">0</div>
                    <div class="metric-unit">%</div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-label">Avg Latency</div>
                    <div class="metric-value" id="avg-latency">0</div>
                    <div class="metric-unit">ms</div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-label">Throughput</div>
                    <div class="metric-value" id="throughput">0</div>
                    <div class="metric-unit">req/s</div>
                </div>
            </div>
            
            <div class="controls">
                <button class="control-btn" id="btn-start">Start All</button>
                <button class="control-btn" id="btn-stop">Stop All</button>
                <button class="control-btn" id="btn-rotate">Rotate Proxies</button>
                <button class="control-btn" id="btn-optimize">Optimize</button>
            </div>
            
            <div class="chart-container" id="performance-chart"></div>
            
            <div class="proxy-list" id="proxy-list">
                <div class="metric-label">Active Proxy Regions</div>
            </div>
        `;
        
        this.attachEventListeners();
    }
    
    attachEventListeners() {
        this.shadowRoot.getElementById('btn-start')?.addEventListener('click', () => {
            this.orchestrator?.startAll();
        });
        
        this.shadowRoot.getElementById('btn-stop')?.addEventListener('click', () => {
            this.orchestrator?.stopAll();
        });
        
        this.shadowRoot.getElementById('btn-rotate')?.addEventListener('click', () => {
            this.orchestrator?.rotateProxies();
        });
        
        this.shadowRoot.getElementById('btn-optimize')?.addEventListener('click', () => {
            this.optimizePerformance();
        });
    }
    
    initializeCharts() {
        // Initialize performance visualization using Canvas
        const chartContainer = this.shadowRoot.getElementById('performance-chart');
        if (chartContainer) {
            const canvas = document.createElement('canvas');
            canvas.width = chartContainer.offsetWidth;
            canvas.height = chartContainer.offsetHeight;
            chartContainer.appendChild(canvas);
            
            this.charts.set('performance', {
                canvas,
                ctx: canvas.getContext('2d'),
                data: []
            });
        }
    }
    
    startUpdates() {
        this.updateInterval = setInterval(() => {
            this.updateMetrics();
            this.updateCharts();
            this.updateProxyList();
        }, 1000);
    }
    
    updateMetrics() {
        if (!this.orchestrator) return;
        
        const metrics = this.orchestrator.getMetrics();
        
        this.shadowRoot.getElementById('active-instances').textContent = 
            this.formatNumber(metrics.activeInstances);
        
        this.shadowRoot.getElementById('success-rate').textContent = 
            (metrics.successRate * 100).toFixed(2);
        
        this.shadowRoot.getElementById('avg-latency').textContent = 
            metrics.avgLatency.toFixed(0);
        
        this.shadowRoot.getElementById('throughput').textContent = 
            this.formatNumber(metrics.throughput);
    }
    
    updateCharts() {
        const chart = this.charts.get('performance');
        if (!chart) return;
        
        const { canvas, ctx, data } = chart;
        
        // Add new data point
        if (this.orchestrator) {
            const metrics = this.orchestrator.getMetrics();
            data.push(metrics.throughput);
            
            // Keep last 100 points
            if (data.length > 100) {
                data.shift();
            }
        }
        
        // Clear canvas
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw grid
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        
        for (let i = 0; i < 5; i++) {
            const y = (canvas.height / 5) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
        
        // Draw data
        if (data.length > 1) {
            ctx.strokeStyle = '#0ff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            const maxValue = Math.max(...data, 1);
            const xStep = canvas.width / (data.length - 1);
            
            data.forEach((value, index) => {
                const x = index * xStep;
                const y = canvas.height - (value / maxValue) * canvas.height;
                
                if (index === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });
            
            ctx.stroke();
        }
    }
    
    updateProxyList() {
        if (!this.orchestrator) return;
        
        const proxyList = this.shadowRoot.getElementById('proxy-list');
        const instances = this.orchestrator.getAllInstances().slice(0, 20);
        
        const items = instances.map(instance => `
            <div class="proxy-item">
                <span class="status-indicator status-${instance.state === 'active' ? 'active' : instance.state === 'warning' ? 'warning' : 'error'}"></span>
                <span>Instance ${instance.id} | ${instance.proxy?.ip || 'N/A'} | ${instance.proxy?.region || 'N/A'}</span>
            </div>
        `).join('');
        
        proxyList.innerHTML = `
            <div class="metric-label">Active Proxy Regions (Showing 20 of ${this.orchestrator.getMetrics().activeInstances})</div>
            ${items}
        `;
    }
    
    formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
        return num.toFixed(0);
    }
    
    optimizePerformance() {
        // Implement performance optimization logic
        console.log('Optimizing performance...');
        
        if (this.orchestrator) {
            // Trigger optimization in orchestrator
            this.orchestrator.optimize?.();
        }
    }
    
    disconnectedCallback() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
    }
}

// Register custom element
customElements.define('control-matrix', ControlMatrix);
