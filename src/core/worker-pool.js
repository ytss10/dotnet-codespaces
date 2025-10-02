export class DistributedWorkerPool {
    constructor(config) {
        this.maxWorkers = config.maxWorkers;
        this.sharedBuffer = config.sharedBuffer;
        this.useTransferable = config.useTransferable;
        this.workerScript = config.workerScript;
        
        this.workers = [];
        this.availableWorkers = [];
        this.busyWorkers = new Set();
        this.taskQueue = [];
        this.workerLoad = new Map();
        
        this.initialize();
    }
    
    initialize() {
        // Create worker pool
        for (let i = 0; i < this.maxWorkers; i++) {
            const worker = new Worker(this.workerScript, { type: 'module' });
            
            // Setup message handling
            worker.addEventListener('message', (e) => this.handleWorkerMessage(worker, e));
            
            // Initialize worker with shared buffer
            worker.postMessage({
                type: 'setup',
                sharedBuffer: this.sharedBuffer,
                workerId: i
            });
            
            this.workers.push(worker);
            this.availableWorkers.push(worker);
            this.workerLoad.set(worker, 0);
        }
    }
    
    async getWorker() {
        if (this.availableWorkers.length > 0) {
            const worker = this.availableWorkers.shift();
            this.busyWorkers.add(worker);
            return worker;
        }
        
        // Find least loaded worker
        let minLoad = Infinity;
        let selectedWorker = null;
        
        for (const [worker, load] of this.workerLoad) {
            if (load < minLoad) {
                minLoad = load;
                selectedWorker = worker;
            }
        }
        
        return selectedWorker;
    }
    
    releaseWorker(worker) {
        this.busyWorkers.delete(worker);
        if (!this.availableWorkers.includes(worker)) {
            this.availableWorkers.push(worker);
        }
        
        // Process queued tasks
        if (this.taskQueue.length > 0) {
            const task = this.taskQueue.shift();
            this.executeTask(task);
        }
    }
    
    handleWorkerMessage(worker, event) {
        const { type, data } = event.data;
        
        switch (type) {
            case 'ready':
                this.releaseWorker(worker);
                break;
                
            case 'metrics':
                this.workerLoad.set(worker, data.load);
                break;
                
            case 'error':
                console.error('Worker error:', data);
                this.handleWorkerError(worker, data);
                break;
        }
    }
    
    handleWorkerError(worker, error) {
        // Restart worker if critical error
        const index = this.workers.indexOf(worker);
        if (index !== -1) {
            worker.terminate();
            
            // Create replacement worker
            const newWorker = new Worker(this.workerScript, { type: 'module' });
            newWorker.addEventListener('message', (e) => this.handleWorkerMessage(newWorker, e));
            
            newWorker.postMessage({
                type: 'setup',
                sharedBuffer: this.sharedBuffer,
                workerId: index
            });
            
            this.workers[index] = newWorker;
            this.availableWorkers.push(newWorker);
            this.workerLoad.set(newWorker, 0);
            this.workerLoad.delete(worker);
        }
    }
    
    async executeTask(task) {
        const worker = await this.getWorker();
        
        if (this.useTransferable && task.transferables) {
            worker.postMessage(task.message, task.transferables);
        } else {
            worker.postMessage(task.message);
        }
        
        // Update load
        const currentLoad = this.workerLoad.get(worker) || 0;
        this.workerLoad.set(worker, currentLoad + 1);
    }
    
    queueTask(message, transferables = null) {
        this.taskQueue.push({ message, transferables });
        
        // Try to execute immediately if workers available
        if (this.availableWorkers.length > 0) {
            const task = this.taskQueue.shift();
            this.executeTask(task);
        }
    }
    
    broadcast(message) {
        this.workers.forEach(worker => {
            worker.postMessage(message);
        });
    }
    
    terminate() {
        this.workers.forEach(worker => worker.terminate());
        this.workers = [];
        this.availableWorkers = [];
        this.busyWorkers.clear();
        this.taskQueue = [];
    }
}
