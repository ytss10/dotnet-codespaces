export class ZeroCopyMemPool {
  private pages: Map<number, SharedArrayBuffer> = new Map();
  private freeList: Uint32Array;
  private allocator: DataView;
  private numa: boolean = false;
  
  constructor(private config: {
    pageSize: number;
    maxPages: number;
    alignment: number;
    enableHugeTLB: boolean;
  }) {
    // Initialize free list using bit manipulation
    const freeListBuffer = new SharedArrayBuffer(Math.ceil(config.maxPages / 8));
    this.freeList = new Uint32Array(freeListBuffer);
    this.freeList.fill(0xFFFFFFFF); // All pages initially free
    
    // Metadata for allocator
    const allocatorBuffer = new SharedArrayBuffer(config.maxPages * 16);
    this.allocator = new DataView(allocatorBuffer);
    
    // Detect NUMA topology
    this.numa = this.detectNUMA();
    
    // Pre-allocate pages
    for (let i = 0; i < Math.min(16, config.maxPages); i++) {
      this.allocatePage(i);
    }
  }
  
  allocate(size: number): number {
    const alignedSize = Math.ceil(size / this.config.alignment) * this.config.alignment;
    const pagesNeeded = Math.ceil(alignedSize / this.config.pageSize);
    
    // Find contiguous free pages using bit manipulation
    let startPage = -1;
    let consecutive = 0;
    
    for (let i = 0; i < this.config.maxPages; i++) {
      const wordIndex = Math.floor(i / 32);
      const bitIndex = i % 32;
      const isFree = (this.freeList[wordIndex] & (1 << bitIndex)) !== 0;
      
      if (isFree) {
        if (startPage === -1) startPage = i;
        consecutive++;
        if (consecutive === pagesNeeded) break;
      } else {
        startPage = -1;
        consecutive = 0;
      }
    }
    
    if (consecutive < pagesNeeded) {
      throw new Error(`Cannot allocate ${size} bytes: out of memory`);
    }
    
    // Mark pages as allocated
    for (let i = startPage; i < startPage + pagesNeeded; i++) {
      const wordIndex = Math.floor(i / 32);
      const bitIndex = i % 32;
      this.freeList[wordIndex] &= ~(1 << bitIndex);
      
      if (!this.pages.has(i)) {
        this.allocatePage(i);
      }
    }
    
    // Store allocation metadata
    const offset = startPage * 16;
    this.allocator.setUint32(offset, startPage, true);
    this.allocator.setUint32(offset + 4, pagesNeeded, true);
    this.allocator.setUint32(offset + 8, alignedSize, true);
    this.allocator.setBigUint64(offset + 16, BigInt(Date.now()), true);
    
    return startPage * this.config.pageSize;
  }
  
  free(ptr: number): void {
    const pageIndex = Math.floor(ptr / this.config.pageSize);
    const offset = pageIndex * 16;
    
    const startPage = this.allocator.getUint32(offset, true);
    const pageCount = this.allocator.getUint32(offset + 4, true);
    
    // Mark pages as free using atomic operations
    for (let i = startPage; i < startPage + pageCount; i++) {
      const wordIndex = Math.floor(i / 32);
      const bitIndex = i % 32;
      Atomics.or(this.freeList, wordIndex, 1 << bitIndex);
    }
    
    // Clear metadata
    for (let i = offset; i < offset + 16; i += 4) {
      this.allocator.setUint32(i, 0, true);
    }
  }
  
  getSharedBuffer(): SharedArrayBuffer {
    return this.allocator.buffer as SharedArrayBuffer;
  }
  
  private allocatePage(index: number): void {
    const buffer = new SharedArrayBuffer(this.config.pageSize);
    
    // Touch all pages to force allocation (important for huge pages)
    if (this.config.enableHugeTLB) {
      const view = new Uint8Array(buffer);
      for (let i = 0; i < view.length; i += 4096) {
        view[i] = 0;
      }
    }
    
    this.pages.set(index, buffer);
  }
  
  private detectNUMA(): boolean {
    // Check if running on NUMA architecture
    try {
      const os = require('os');
      const cpus = os.cpus();
      // Simple heuristic: NUMA likely if > 32 cores
      return cpus.length > 32;
    } catch {
      return false;
    }
  }
}
