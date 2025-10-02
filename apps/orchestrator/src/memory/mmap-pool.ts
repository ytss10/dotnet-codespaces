import { Worker } from 'worker_threads';
import * as fs from 'fs';
import * as path from 'path';

export class MemoryMappedPool {
  private mmapFile: string;
  private fd: number;
  private size: number;
  private view: DataView | null = null;
  private allocator: BuddyAllocator;
  
  constructor(size: number) {
    this.size = size;
    this.mmapFile = path.join('/dev/shm', `mmap-${process.pid}-${Date.now()}.bin`);
    this.allocator = new BuddyAllocator(size);
    this.initialize();
  }
  
  private initialize(): void {
    // Create memory-mapped file
    this.fd = fs.openSync(this.mmapFile, 'w+');
    fs.truncateSync(this.fd, this.size);
    
    // Map into memory using SharedArrayBuffer
    const buffer = new SharedArrayBuffer(this.size);
    this.view = new DataView(buffer);
    
    // Initialize with zeros
    for (let i = 0; i < this.size; i += 8) {
      this.view.setBigUint64(i, 0n, true);
    }
  }
  
  allocate(size: number): number {
    return this.allocator.allocate(size);
  }
  
  free(offset: number): void {
    this.allocator.free(offset);
  }
  
  read(offset: number, length: number): ArrayBuffer {
    if (!this.view) throw new Error('Pool not initialized');
    
    const result = new ArrayBuffer(length);
    const resultView = new Uint8Array(result);
    
    for (let i = 0; i < length; i++) {
      resultView[i] = this.view.getUint8(offset + i);
    }
    
    return result;
  }
  
  write(offset: number, data: ArrayBuffer): void {
    if (!this.view) throw new Error('Pool not initialized');
    
    const dataView = new Uint8Array(data);
    for (let i = 0; i < dataView.length; i++) {
      this.view.setUint8(offset + i, dataView[i]);
    }
  }
  
  getSharedBuffer(): SharedArrayBuffer {
    return this.view!.buffer as SharedArrayBuffer;
  }
  
  destroy(): void {
    fs.closeSync(this.fd);
    fs.unlinkSync(this.mmapFile);
  }
}

class BuddyAllocator {
  private freeList: Map<number, Set<number>> = new Map();
  private maxOrder: number;
  private minBlockSize: number = 64;
  
  constructor(private totalSize: number) {
    this.maxOrder = Math.floor(Math.log2(totalSize / this.minBlockSize));
    
    for (let order = 0; order <= this.maxOrder; order++) {
      this.freeList.set(order, new Set());
    }
    
    this.freeList.get(this.maxOrder)!.add(0);
  }
  
  allocate(size: number): number {
    const order = Math.max(0, Math.ceil(Math.log2(size / this.minBlockSize)));
    
    if (order > this.maxOrder) {
      throw new Error(`Cannot allocate ${size} bytes`);
    }
    
    return this.allocateBlock(order);
  }
  
  private allocateBlock(order: number): number {
    if (this.freeList.get(order)!.size > 0) {
      const block = this.freeList.get(order)!.values().next().value;
      this.freeList.get(order)!.delete(block);
      return block;
    }
    
    if (order === this.maxOrder) {
      throw new Error('Out of memory');
    }
    
    const largerBlock = this.allocateBlock(order + 1);
    const buddyOffset = largerBlock + (this.minBlockSize << order);
    this.freeList.get(order)!.add(buddyOffset);
    
    return largerBlock;
  }
  
  free(offset: number): void {
    const order = this.findOrder(offset);
    this.freeBlock(offset, order);
  }
  
  private freeBlock(offset: number, order: number): void {
    if (order === this.maxOrder) {
      this.freeList.get(order)!.add(offset);
      return;
    }
    
    const buddyOffset = this.getBuddy(offset, order);
    
    if (this.freeList.get(order)!.has(buddyOffset)) {
      this.freeList.get(order)!.delete(buddyOffset);
      const parentOffset = Math.min(offset, buddyOffset);
      this.freeBlock(parentOffset, order + 1);
    } else {
      this.freeList.get(order)!.add(offset);
    }
  }
  
  private getBuddy(offset: number, order: number): number {
    const blockSize = this.minBlockSize << order;
    return offset ^ blockSize;
  }
  
  private findOrder(offset: number): number {
    // Binary search to find order
    for (let order = 0; order <= this.maxOrder; order++) {
      const blockSize = this.minBlockSize << order;
      if (offset % blockSize === 0) {
        return order;
      }
    }
    return 0;
  }
}
