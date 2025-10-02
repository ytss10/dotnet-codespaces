const { parentPort, workerData } = require('worker_threads');
const { performance } = require('perf_hooks');

class ReplicaWorker {
  constructor() {
    this.sharedMemory = new SharedArrayBuffer(workerData.memPool);
    this.ringBuffer = new RingBuffer(this.sharedMemory);
    this.simdProcessor = new SIMDProcessor();
    this.replicas = new Map();
    this.metrics = new Float64Array(new SharedArrayBuffer(1024 * 8));
    
    // Initialize WASI for WebAssembly System Interface
    this.initializeWASI();
  }
  
  async initializeWASI() {
    const { WASI } = await import('wasi');
    this.wasi = new WASI({
      args: process.argv,
      env: process.env,
      preopens: { '/sandbox': '/tmp' }
    });
  }
  
  processMessage(message) {
    const { type, sessionId, start, count, topology } = message;
    
    switch (type) {
      case 'CREATE_REPLICAS':
        this.createReplicasBatch(sessionId, start, count, topology);
        break;
      case 'UPDATE_REPLICAS':
        this.updateReplicasBatch(sessionId, message.updates);
        break;
      case 'DESTROY_REPLICAS':
        this.destroyReplicasBatch(sessionId, message.replicaIds);
        break;
      case 'COMPUTE_METRICS':
        this.computeMetricsSIMD(sessionId);
        break;
    }
  }
  
  createReplicasBatch(sessionId, start, count, topologyBuffer) {
    const topology = new Uint8Array(topologyBuffer);
    const replicas = [];
    
    // Use SIMD for parallel replica initialization
    const batchSize = 256;
    for (let i = 0; i < count; i += batchSize) {
      const batch = Math.min(batchSize, count - i);
      const simdBatch = this.simdProcessor.createReplicaBatch(
        sessionId, 
        start + i, 
        batch,
        topology
      );
      
      for (let j = 0; j < batch; j++) {
        const replica = {
          id: `${sessionId}-${start + i + j}`,
          state: new Uint8Array(1024),
          metrics: new Float32Array(256),
          connections: new Set(),
          lastUpdate: performance.now()
        };
        
        // Copy SIMD-computed initial state
        replica.state.set(simdBatch.subarray(j * 1024, (j + 1) * 1024));
        
        this.replicas.set(replica.id, replica);
        replicas.push(replica);
      }
    }
    
    // Write to ring buffer for lock-free communication
    this.ringBuffer.write({
      type: 'REPLICAS_CREATED',
      sessionId,
      count: replicas.length,
      timestamp: performance.now()
    });
    
    parentPort.postMessage({
      type: 'REPLICAS_READY',
      sessionId,
      count: replicas.length
    });
  }
  
  updateReplicasBatch(sessionId, updates) {
    // Process updates in parallel using SIMD
    const updateCount = updates.length;
    const updateBuffer = new Float32Array(updateCount * 4);
    
    updates.forEach((update, idx) => {
      const replica = this.replicas.get(update.replicaId);
      if (replica) {
        // SIMD vectorized update
        const offset = idx * 4;
        updateBuffer[offset] = update.latency || 0;
        updateBuffer[offset + 1] = update.throughput || 0;
        updateBuffer[offset + 2] = update.errorRate || 0;
        updateBuffer[offset + 3] = update.connections || 0;
      }
    });
    
    // Apply updates using SIMD
    this.simdProcessor.applyUpdates(updateBuffer);
    
    // Update ring buffer
    this.ringBuffer.write({
      type: 'REPLICAS_UPDATED',
      sessionId,
      count: updateCount,
      timestamp: performance.now()
    });
  }
  
  computeMetricsSIMD(sessionId) {
    const sessionReplicas = Array.from(this.replicas.entries())
      .filter(([id]) => id.startsWith(sessionId));
    
    if (sessionReplicas.length === 0) return;
    
    // Prepare data for SIMD processing
    const metricsCount = sessionReplicas.length;
    const latencies = new Float32Array(metricsCount);
    const throughputs = new Float32Array(metricsCount);
    const errorRates = new Float32Array(metricsCount);
    
    sessionReplicas.forEach(([_, replica], idx) => {
      latencies[idx] = replica.metrics[0];
      throughputs[idx] = replica.metrics[1];
      errorRates[idx] = replica.metrics[2];
    });
    
    // SIMD computation of percentiles
    const latencyPercentiles = this.simdProcessor.computePercentiles(latencies);
    const throughputStats = this.simdProcessor.computeStatistics(throughputs);
    const errorStats = this.simdProcessor.computeStatistics(errorRates);
    
    // Store results in shared metrics array
    this.metrics[0] = latencyPercentiles.p50;
    this.metrics[1] = latencyPercentiles.p95;
    this.metrics[2] = latencyPercentiles.p99;
    this.metrics[3] = latencyPercentiles.p999;
    this.metrics[4] = throughputStats.mean;
    this.metrics[5] = throughputStats.stddev;
    this.metrics[6] = errorStats.mean;
    this.metrics[7] = errorStats.stddev;
    
    parentPort.postMessage({
      type: 'METRICS_COMPUTED',
      sessionId,
      metrics: Array.from(this.metrics.subarray(0, 8))
    });
  }
  
  destroyReplicasBatch(sessionId, replicaIds) {
    replicaIds.forEach(id => this.replicas.delete(id));
    
    this.ringBuffer.write({
      type: 'REPLICAS_DESTROYED',
      sessionId,
      count: replicaIds.length,
      timestamp: performance.now()
    });
  }
}

class RingBuffer {
  constructor(sharedBuffer) {
    this.buffer = new Uint8Array(sharedBuffer);
    this.header = new Uint32Array(sharedBuffer, 0, 4);
    // header[0] = write position
    // header[1] = read position  
    // header[2] = size
    // header[3] = version
    
    this.dataStart = 16;
    this.capacity = this.buffer.length - this.dataStart;
    
    Atomics.store(this.header, 2, this.capacity);
    Atomics.store(this.header, 3, 1); // version
  }
  
  write(data) {
    const encoded = JSON.stringify(data);
    const bytes = new TextEncoder().encode(encoded);
    const size = bytes.length;
    
    // Wait for space
    while (!this.hasSpace(size + 4)) {
      Atomics.wait(this.header, 1, Atomics.load(this.header, 1), 1);
    }
    
    const writePos = Atomics.load(this.header, 0);
    const nextWritePos = (writePos + size + 4) % this.capacity;
    
    // Write size prefix
    this.buffer[this.dataStart + writePos] = (size >> 24) & 0xFF;
    this.buffer[this.dataStart + writePos + 1] = (size >> 16) & 0xFF;
    this.buffer[this.dataStart + writePos + 2] = (size >> 8) & 0xFF;
    this.buffer[this.dataStart + writePos + 3] = size & 0xFF;
    
    // Write data
    let dataPos = writePos + 4;
    for (let i = 0; i < bytes.length; i++) {
      this.buffer[this.dataStart + ((dataPos + i) % this.capacity)] = bytes[i];
    }
    
    // Update write position atomically
    Atomics.store(this.header, 0, nextWritePos);
    Atomics.notify(this.header, 0, 1);
  }
  
  hasSpace(size) {
    const writePos = Atomics.load(this.header, 0);
    const readPos = Atomics.load(this.header, 1);
    
    if (writePos >= readPos) {
      return (this.capacity - writePos + readPos) > size;
    } else {
      return (readPos - writePos) > size;
    }
  }
}

class SIMDProcessor {
  constructor() {
    // Check for SIMD support
    this.simdAvailable = typeof Float32x4 !== 'undefined';
  }
  
  createReplicaBatch(sessionId, start, count, topology) {
    const batchBuffer = new Uint8Array(count * 1024);
    
    if (this.simdAvailable) {
      // SIMD vectorized initialization
      for (let i = 0; i < count * 1024; i += 16) {
        // Process 16 bytes at a time using SIMD
        const vec = Float32x4(
          Math.random() * 255,
          Math.random() * 255,
          Math.random() * 255,
          Math.random() * 255
        );
        
        const bytes = new Uint8Array(Float32x4.extractLane(vec, 0));
        batchBuffer.set(bytes, i);
      }
    } else {
      // Fallback to regular initialization
      for (let i = 0; i < count * 1024; i++) {
        batchBuffer[i] = Math.floor(Math.random() * 256);
      }
    }
    
    return batchBuffer;
  }
  
  applyUpdates(updateBuffer) {
    const len = updateBuffer.length;
    
    if (this.simdAvailable && len >= 4) {
      // Process 4 floats at a time
      for (let i = 0; i < len; i += 4) {
        const vec = Float32x4.load(updateBuffer, i);
        const scaled = Float32x4.mul(vec, Float32x4(1.1, 1.1, 1.1, 1.1));
        Float32x4.store(updateBuffer, i, scaled);
      }
    } else {
      // Scalar fallback
      for (let i = 0; i < len; i++) {
        updateBuffer[i] *= 1.1;
      }
    }
  }
  
  computePercentiles(data) {
    const sorted = new Float32Array(data).sort((a, b) => a - b);
    const len = sorted.length;
    
    return {
      p50: sorted[Math.floor(len * 0.5)],
      p95: sorted[Math.floor(len * 0.95)],
      p99: sorted[Math.floor(len * 0.99)],
      p999: sorted[Math.floor(len * 0.999)]
    };
  }
  
  computeStatistics(data) {
    let sum = 0;
    let sumSquares = 0;
    
    if (this.simdAvailable && data.length >= 4) {
      // SIMD reduction for sum
      let vecSum = Float32x4(0, 0, 0, 0);
      let vecSumSq = Float32x4(0, 0, 0, 0);
      
      for (let i = 0; i < data.length - 3; i += 4) {
        const vec = Float32x4.load(data, i);
        vecSum = Float32x4.add(vecSum, vec);
        vecSumSq = Float32x4.add(vecSumSq, Float32x4.mul(vec, vec));
      }
      
      // Horizontal sum
      sum = Float32x4.extractLane(vecSum, 0) +
            Float32x4.extractLane(vecSum, 1) +
            Float32x4.extractLane(vecSum, 2) +
            Float32x4.extractLane(vecSum, 3);
            
      sumSquares = Float32x4.extractLane(vecSumSq, 0) +
                   Float32x4.extractLane(vecSumSq, 1) +
                   Float32x4.extractLane(vecSumSq, 2) +
                   Float32x4.extractLane(vecSumSq, 3);
      
      // Handle remaining elements
      for (let i = Math.floor(data.length / 4) * 4; i < data.length; i++) {
        sum += data[i];
        sumSquares += data[i] * data[i];
      }
    } else {
      // Scalar computation
      for (let i = 0; i < data.length; i++) {
        sum += data[i];
        sumSquares += data[i] * data[i];
      }
    }
    
    const mean = sum / data.length;
    const variance = (sumSquares / data.length) - (mean * mean);
    const stddev = Math.sqrt(Math.max(0, variance));
    
    return { mean, stddev, variance };
  }
}

// Initialize worker
const worker = new ReplicaWorker();

parentPort.on('message', (message) => {
  worker.processMessage(message);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  worker.replicas.clear();
  process.exit(0);
});
