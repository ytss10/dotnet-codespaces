import * as lz4 from 'lz4js';
import { compress as brotliCompress, decompress as brotliDecompress } from 'brotli-wasm';
import init, { compress as zstdCompress, decompress as zstdDecompress } from '@oneidentity/zstd-wasm';

// Initialize WASM modules
await init();

// Compression algorithms with performance characteristics
const algorithms = {
  lz4: {
    compress: (data) => lz4.compress(data),
    decompress: (data) => lz4.decompress(data),
    speed: 500, // MB/s
    ratio: 2.1
  },
  
  brotli: {
    compress: async (data) => await brotliCompress(data, { quality: 4 }),
    decompress: async (data) => await brotliDecompress(data),
    speed: 50,
    ratio: 4.5
  },
  
  zstd: {
    compress: (data) => zstdCompress(data, 3),
    decompress: (data) => zstdDecompress(data),
    speed: 300,
    ratio: 3.2
  },
  
  snappy: {
    compress: (data) => {
      // Snappy implementation
      const output = new Uint8Array(data.length + Math.ceil(data.length / 6));
      let outPos = 0;
      let inPos = 0;
      
      while (inPos < data.length) {
        const remaining = data.length - inPos;
        const literalLen = Math.min(remaining, 60);
        
        // Literal run
        output[outPos++] = (literalLen - 1) << 2;
        for (let i = 0; i < literalLen; i++) {
          output[outPos++] = data[inPos++];
        }
      }
      
      return output.slice(0, outPos);
    },
    decompress: (data) => {
      // Snappy decompression
      const output = new Uint8Array(data.length * 4);
      let outPos = 0;
      let inPos = 0;
      
      while (inPos < data.length) {
        const tag = data[inPos++];
        const type = tag & 0x03;
        
        if (type === 0) {
          // Literal
          const len = (tag >> 2) + 1;
          for (let i = 0; i < len; i++) {
            output[outPos++] = data[inPos++];
          }
        }
      }
      
      return output.slice(0, outPos);
    },
    speed: 1000,
    ratio: 1.8
  }
};

// Adaptive compression selection
function selectAlgorithm(data, priority = 'balanced') {
  const size = data.length;
  
  if (priority === 'speed') {
    return size < 1024 ? 'lz4' : 'snappy';
  } else if (priority === 'ratio') {
    return size > 10240 ? 'brotli' : 'zstd';
  } else {
    // Balanced
    if (size < 1024) return 'lz4';
    if (size < 10240) return 'zstd';
    if (size < 102400) return 'zstd';
    return 'brotli';
  }
}

// Message handler
self.onmessage = async (event) => {
  const { type, data, algorithm, priority } = event.data;
  
  try {
    if (type === 'compress') {
      const algo = algorithm || selectAlgorithm(data, priority);
      const compressed = await algorithms[algo].compress(data);
      
      self.postMessage({
        type: 'compressed',
        result: compressed,
        algorithm: algo,
        originalSize: data.length,
        compressedSize: compressed.length,
        ratio: data.length / compressed.length
      }, [compressed.buffer]);
      
    } else if (type === 'decompress') {
      const algo = algorithm || 'zstd';
      const decompressed = await algorithms[algo].decompress(data);
      
      self.postMessage({
        type: 'decompressed',
        result: decompressed
      }, [decompressed.buffer]);
      
    } else if (type === 'benchmark') {
      // Benchmark all algorithms
      const results = {};
      
      for (const [name, algo] of Object.entries(algorithms)) {
        const start = performance.now();
        const compressed = await algo.compress(data);
        const compressTime = performance.now() - start;
        
        const decompressStart = performance.now();
        await algo.decompress(compressed);
        const decompressTime = performance.now() - decompressStart;
        
        results[name] = {
          compressTime,
          decompressTime,
          ratio: data.length / compressed.length,
          compressedSize: compressed.length
        };
      }
      
      self.postMessage({
        type: 'benchmark',
        results
      });
    }
    
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error.message
    });
  }
};

// Streaming compression for large data
class StreamCompressor {
  constructor(algorithm = 'zstd') {
    this.algorithm = algorithm;
    this.chunks = [];
  }
  
  async addChunk(chunk) {
    const compressed = await algorithms[this.algorithm].compress(chunk);
    this.chunks.push(compressed);
  }
  
  async finalize() {
    // Concatenate all chunks
    const totalLength = this.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    
    let offset = 0;
    for (const chunk of this.chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    return result;
  }
}

// Export for module usage
export { algorithms, selectAlgorithm, StreamCompressor };
