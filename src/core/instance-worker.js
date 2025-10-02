let sharedBuffer = null;
let workerId = null;
let instances = new Map();

// Message handler
self.addEventListener('message', async (event) => {
    const { type, ...data } = event.data;
    
    switch (type) {
        case 'setup':
            sharedBuffer = data.sharedBuffer;
            workerId = data.workerId;
            self.postMessage({ type: 'ready' });
            break;
            
        case 'init':
            await initializeInstance(data);
            break;
            
        case 'updateProxy':
            updateInstanceProxy(data);
            break;
            
        case 'destroy':
            destroyInstance(data.id);
            break;
            
        case 'fetch':
            await performFetch(data);
            break;
    }
});

async function initializeInstance(config) {
    const instance = {
        id: config.id,
        url: config.url,
        proxy: config.proxy,
        active: true,
        requestCount: 0,
        errorCount: 0
    };
    
    instances.set(config.id, instance);
    
    // Simulate initial load with proxy
    await simulateProxyRequest(instance);
    
    // Start periodic requests
    startInstanceActivity(instance);
}

async function simulateProxyRequest(instance) {
    try {
        // Simulate network delay based on proxy characteristics
        const delay = Math.random() * 200 + 50;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Simulate request headers with proxy
        const headers = new Headers({
            ...instance.proxy.headers,
            'X-Worker-Id': workerId.toString(),
            'X-Instance-Id': instance.id.toString()
        });
        
        // Simulate successful request
        instance.requestCount++;
        
        // Update shared buffer with metrics
        if (sharedBuffer) {
            const view = new Uint32Array(sharedBuffer);
            const offset = instance.id * 64; // 64 bytes per instance
            
            view[offset] = instance.requestCount;
            view[offset + 1] = instance.errorCount;
            view[offset + 2] = Date.now();
        }
        
        return {
            status: 200,
            latency: delay,
            proxy: instance.proxy.ip
        };
        
    } catch (error) {
        instance.errorCount++;
        throw error;
    }
}

function startInstanceActivity(instance) {
    const interval = setInterval(async () => {
        if (!instance.active) {
            clearInterval(interval);
            return;
        }
        
        try {
            await simulateProxyRequest(instance);
            
            // Send metrics periodically
            if (instance.requestCount % 100 === 0) {
                self.postMessage({
                    type: 'metrics',
                    data: {
                        id: instance.id,
                        requests: instance.requestCount,
                        errors: instance.errorCount,
                        load: instances.size
                    }
                });
            }
        } catch (error) {
            console.error(`Instance ${instance.id} error:`, error);
        }
    }, 5000 + Math.random() * 10000); // Random interval between 5-15 seconds
}

function updateInstanceProxy(data) {
    const instance = instances.get(data.id);
    if (instance) {
        instance.proxy = data.proxy;
    }
}

function destroyInstance(id) {
    const instance = instances.get(id);
    if (instance) {
        instance.active = false;
        instances.delete(id);
    }
}

async function performFetch(data) {
    const instance = instances.get(data.instanceId);
    if (!instance) return;
    
    try {
        const result = await simulateProxyRequest(instance);
        self.postMessage({
            type: 'fetchResult',
            data: {
                instanceId: data.instanceId,
                result
            }
        });
    } catch (error) {
        self.postMessage({
            type: 'fetchError',
            data: {
                instanceId: data.instanceId,
                error: error.message
            }
        });
    }
}

// Periodic health check
setInterval(() => {
    self.postMessage({
        type: 'health',
        data: {
            workerId,
            instanceCount: instances.size,
            totalRequests: Array.from(instances.values()).reduce((sum, inst) => sum + inst.requestCount, 0),
            totalErrors: Array.from(instances.values()).reduce((sum, inst) => sum + inst.errorCount, 0)
        }
    });
}, 30000);
