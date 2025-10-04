class AdvancedControlPanel {
    constructor() {
        this.connection = null;
        this.sites = new Map();
        this.metrics = new Map();
        this.virtualScroller = null;
        this.workerPool = [];
        this.maxWorkers = navigator.hardwareConcurrency || 4;
        
        this.initializeWorkers();
        this.initializeWebSocket();
        this.initializeVirtualScroller();
        this.setupEventListeners();
    }

    initializeWorkers() {
        for (let i = 0; i < this.maxWorkers; i++) {
            const worker = new Worker('/js/site-processor.worker.js');
            worker.onmessage = (e) => this.handleWorkerMessage(e.data);
            this.workerPool.push(worker);
        }
    }

    async initializeWebSocket() {
        const connection = new signalR.HubConnectionBuilder()
            .withUrl("/ws/hub")
            .withAutomaticReconnect([0, 1000, 2000, 5000])
            .configureLogging(signalR.LogLevel.Information)
            .build();

        connection.on("SiteUpdate", (data) => this.handleSiteUpdate(data));
        connection.on("MetricsUpdate", (metrics) => this.updateMetrics(metrics));
        
        connection.onreconnecting(() => this.showReconnecting());
        connection.onreconnected(() => this.showReconnected());

        await connection.start();
        this.connection = connection;
    }

    initializeVirtualScroller() {
        this.virtualScroller = new VirtualScroller({
            container: document.getElementById('sites-container'),
            itemHeight: 180,
            buffer: 10,
            renderItem: (site) => this.renderSiteCard(site),
            onVisibilityChange: (visible) => this.handleVisibilityChange(visible)
        });
    }

    async loadSites(urls) {
        if (urls.length > 1000000) {
            throw new Error('Maximum 1M sites allowed');
        }

        // Split into chunks for processing
        const chunkSize = 10000;
        const chunks = [];
        
        for (let i = 0; i < urls.length; i += chunkSize) {
            chunks.push(urls.slice(i, i + chunkSize));
        }

        // Process chunks in parallel using workers
        const promises = chunks.map((chunk, index) => {
            const worker = this.workerPool[index % this.maxWorkers];
            return new Promise((resolve) => {
                const handler = (e) => {
                    if (e.data.type === 'chunk-processed' && e.data.chunkId === index) {
                        worker.removeEventListener('message', handler);
                        resolve(e.data.results);
                    }
                };
                worker.addEventListener('message', handler);
                worker.postMessage({ type: 'process-chunk', chunk, chunkId: index });
            });
        });

        const results = await Promise.all(promises);
        
        // Send to server
        await this.connection.invoke("LoadSites", {
            siteUrls: urls,
            options: this.getLoadOptions()
        });
    }

    renderSiteCard(site) {
        const card = document.createElement('div');
        card.className = 'site-card';
        card.dataset.siteId = site.id;
        
        // Use IntersectionObserver for lazy loading
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.loadSiteContent(site.id, card);
                        observer.unobserve(card);
                    }
                });
            });
            observer.observe(card);
        }

        card.innerHTML = `
            <div class="site-preview">
                <div class="loading-skeleton"></div>
            </div>
            <div class="site-info">
                <span class="site-url">${site.url}</span>
                <span class="site-status">${site.status}</span>
                <span class="site-proxy">${site.proxy || 'Direct'}</span>
            </div>
            <div class="site-metrics">
                <span class="metric-latency">${site.latency}ms</span>
                <span class="metric-size">${this.formatSize(site.size)}</span>
            </div>
            <div class="site-controls">
                <button onclick="panel.reloadSite('${site.id}')">↻</button>
                <button onclick="panel.changeProxy('${site.id}')">🌐</button>
                <button onclick="panel.removeSite('${site.id}')">✕</button>
            </div>
        `;
        
        return card;
    }

    async loadSiteContent(siteId, element) {
        const site = this.sites.get(siteId);
        if (!site) return;

        try {
            // Create sandboxed iframe with strict CSP
            const iframe = document.createElement('iframe');
            iframe.sandbox = 'allow-scripts allow-same-origin';
            iframe.style.cssText = 'width:100%;height:150px;border:0;';
            
            // Use blob URL for security
            const blob = new Blob([site.content], { type: 'text/html' });
            iframe.src = URL.createObjectURL(blob);
            
            element.querySelector('.loading-skeleton').replaceWith(iframe);
            
            // Clean up blob URL after load
            iframe.onload = () => URL.revokeObjectURL(iframe.src);
        } catch (error) {
            console.error('Failed to load site content:', error);
        }
    }

    updateMetrics(metrics) {
        // Update real-time metrics display
        document.getElementById('total-sites').textContent = metrics.totalSites.toLocaleString();
        document.getElementById('active-sites').textContent = metrics.activeSites.toLocaleString();
        document.getElementById('throughput').textContent = `${metrics.throughput}/s`;
        document.getElementById('avg-latency').textContent = `${metrics.avgLatency}ms`;
        document.getElementById('error-rate').textContent = `${(metrics.errorRate * 100).toFixed(2)}%`;
        
        // Update charts
        this.updateCharts(metrics);
    }

    updateCharts(metrics) {
        // Use requestAnimationFrame for smooth updates
        requestAnimationFrame(() => {
            if (this.latencyChart) {
                this.latencyChart.data.datasets[0].data.push({
                    x: Date.now(),
                    y: metrics.avgLatency
                });
                
                // Keep only last 100 points
                if (this.latencyChart.data.datasets[0].data.length > 100) {
                    this.latencyChart.data.datasets[0].data.shift();
                }
                
                this.latencyChart.update('none');
            }
        });
    }

    formatSize(bytes) {
        const sizes = ['B', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    // ...existing code...
}

// Virtual Scroller implementation
class VirtualScroller {
    constructor(options) {
        this.container = options.container;
        this.itemHeight = options.itemHeight;
        this.buffer = options.buffer;
        this.renderItem = options.renderItem;
        this.onVisibilityChange = options.onVisibilityChange;
        
        this.items = [];
        this.visibleItems = new Set();
        this.scrollTop = 0;
        this.containerHeight = 0;
        
        this.init();
    }

    init() {
        this.container.style.position = 'relative';
        this.container.style.overflow = 'auto';
        
        this.viewport = document.createElement('div');
        this.viewport.style.position = 'relative';
        this.container.appendChild(this.viewport);
        
        this.container.addEventListener('scroll', this.handleScroll.bind(this));
        this.resizeObserver = new ResizeObserver(() => this.handleResize());
        this.resizeObserver.observe(this.container);
    }

    handleScroll() {
        requestAnimationFrame(() => {
            this.scrollTop = this.container.scrollTop;
            this.render();
        });
    }

    render() {
        const startIndex = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.buffer);
        const endIndex = Math.min(
            this.items.length,
            Math.ceil((this.scrollTop + this.containerHeight) / this.itemHeight) + this.buffer
        );

        // Update viewport height
        this.viewport.style.height = `${this.items.length * this.itemHeight}px`;

        // Render visible items
        const fragment = document.createDocumentFragment();
        const newVisibleItems = new Set();

        for (let i = startIndex; i < endIndex; i++) {
            const item = this.items[i];
            if (!item) continue;

            newVisibleItems.add(item.id);
            
            if (!this.visibleItems.has(item.id)) {
                const element = this.renderItem(item);
                element.style.position = 'absolute';
                element.style.top = `${i * this.itemHeight}px`;
                element.style.height = `${this.itemHeight}px`;
                fragment.appendChild(element);
            }
        }

        // Remove items that are no longer visible
        const toRemove = [...this.visibleItems].filter(id => !newVisibleItems.has(id));
        toRemove.forEach(id => {
            const element = this.container.querySelector(`[data-site-id="${id}"]`);
            if (element) element.remove();
        });

        this.viewport.appendChild(fragment);
        this.visibleItems = newVisibleItems;
        
        if (this.onVisibilityChange) {
            this.onVisibilityChange(Array.from(newVisibleItems));
        }
    }

    // ...existing code...
}

// Initialize panel
const panel = new AdvancedControlPanel();