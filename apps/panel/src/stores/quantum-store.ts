import { CRDT } from './crdt/lww-map';
import * as lz4 from 'lz4js';

export class QuantumStore {
  private shards: Map<number, SharedArrayBuffer> = new Map();
  private crdtState: CRDT;
  private indices: BigUint64Array;
  private bloom: BloomFilter;
  private compressionWorker: Worker;
  
  constructor(private config: {
    maxSessions: number;
    shardCount: number;
    enablePersistence: boolean;
    compressionLevel: number;
  }) {
    // Initialize sharded storage
    for (let i = 0; i < config.shardCount; i++) {
      const shardSize = Math.ceil(config.maxSessions / config.shardCount) * 1024;
      this.shards.set(i, new SharedArrayBuffer(shardSize));
    }
    
    // Initialize CRDT for distributed state
    this.crdtState = new CRDT({
      nodeId: this.generateNodeId(),
      vectorClock: new Map()
    });
    
    // Initialize indices with BigInt for handling large numbers
    const indexBuffer = new SharedArrayBuffer(config.maxSessions * 8);
    this.indices = new BigUint64Array(indexBuffer);
    
    // Initialize Bloom filter for fast existence checks
    this.bloom = new BloomFilter({
      size: config.maxSessions * 10,
      hashFunctions: 3
    });
    
    // Initialize compression worker
    this.compressionWorker = new Worker(
      new URL('./workers/compression-worker.js', import.meta.url),
      { type: 'module' }
    );
    
    if (config.enablePersistence) {
      this.initializePersistence();
    }
  }
  
  private async initializePersistence(): Promise<void> {
    // Use IndexedDB for persistence
    const request = indexedDB.open('QuantumStore', 1);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains('sessions')) {
        const store = db.createObjectStore('sessions', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('state', 'state', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('snapshots')) {
        db.createObjectStore('snapshots', { keyPath: 'version' });
      }
    };
    
    request.onsuccess = (event) => {
      this.db = (event.target as IDBOpenDBRequest).result;
      this.loadFromPersistence();
    };
  }
  
  private async loadFromPersistence(): Promise<void> {
    if (!this.db) return;
    
    const transaction = this.db.transaction(['sessions', 'snapshots'], 'readonly');
    const sessionStore = transaction.objectStore('sessions');
    const snapshotStore = transaction.objectStore('snapshots');
    
    // Load latest snapshot
    const snapshotRequest = snapshotStore.openCursor(null, 'prev');
    snapshotRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        this.deserializeSnapshot(cursor.value.data);
      }
    };
    
    // Load recent sessions
    const sessionRequest = sessionStore.index('timestamp').openCursor(null, 'prev');
    const sessions: any[] = [];
    
    sessionRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor && sessions.length < 1000) {
        sessions.push(cursor.value);
        cursor.continue();
      } else {
        sessions.forEach(session => this.upsertSession(session));
      }
    };
  }
  
  upsertSession(session: any): void {
    const shardId = this.calculateShardId(session.id);
    const shard = this.shards.get(shardId)!;
    
    // Update CRDT state
    this.crdtState.set(session.id, session, Date.now());
    
    // Update Bloom filter
    this.bloom.add(session.id);
    
    // Serialize and compress session data
    const serialized = this.serializeSession(session);
    const view = new DataView(shard);
    
    // Find or allocate slot
    const slot = this.findOrAllocateSlot(shardId, session.id);
    const offset = slot * 1024;
    
    // Write session data
    view.setUint32(offset, serialized.length, true);
    new Uint8Array(shard, offset + 4, serialized.length).set(serialized);
    
    // Update index
    const indexKey = this.hashSessionId(session.id);
    this.indices[indexKey] = BigInt(shardId) << 32n | BigInt(slot);
    
    // Persist if enabled
    if (this.config.enablePersistence && this.db) {
      const transaction = this.db.transaction(['sessions'], 'readwrite');
      const store = transaction.objectStore('sessions');
      store.put({
        ...session,
        timestamp: Date.now()
      });
    }
  }
  
  getSessions(): Map<string, any> {
    const sessions = new Map<string, any>();
    
    // Get all sessions from CRDT state
    for (const [id, value] of this.crdtState.entries()) {
      sessions.set(id, value);
    }
    
    return sessions;
  }
  
  deserializeSnapshot(data: ArrayBuffer): Map<string, any> {
    return new Promise((resolve, reject) => {
      this.compressionWorker.postMessage({
        type: 'decompress',
        data: data
      });
      
      this.compressionWorker.onmessage = (event) => {
        if (event.data.type === 'decompressed') {
          const decompressed = event.data.result;
          const sessions = msgpack.decode(new Uint8Array(decompressed));
          
          const sessionMap = new Map<string, any>();
          sessions.forEach((session: any) => {
            sessionMap.set(session.id, session);
            this.upsertSession(session);
          });
          
          resolve(sessionMap);
        } else if (event.data.type === 'error') {
          reject(new Error(event.data.error));
        }
      };
    });
  }
  
  applyUpdate(update: any): void {
    // Apply CRDT update
    if (update.type === 'crdt-merge') {
      this.crdtState.merge(update.state);
    } else if (update.type === 'session-update') {
      const session = this.crdtState.get(update.sessionId);
      if (session) {
        const updated = { ...session, ...update.changes };
        this.upsertSession(updated);
      }
    }
  }
  
  private calculateShardId(sessionId: string): number {
    let hash = 0;
    for (let i = 0; i < sessionId.length; i++) {
      hash = ((hash << 5) - hash) + sessionId.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % this.config.shardCount;
  }
  
  private hashSessionId(sessionId: string): number {
    // FNV-1a hash for better distribution
    let hash = 2166136261;
    for (let i = 0; i < sessionId.length; i++) {
      hash ^= sessionId.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash) % this.config.maxSessions;
  }
  
  private findOrAllocateSlot(shardId: number, sessionId: string): number {
    const shard = this.shards.get(shardId)!;
    const view = new DataView(shard);
    const slotsPerShard = shard.byteLength / 1024;
    
    // Linear probing for simplicity (could use more sophisticated method)
    const startSlot = this.hashSessionId(sessionId) % slotsPerShard;
    
    for (let i = 0; i < slotsPerShard; i++) {
      const slot = (startSlot + i) % slotsPerShard;
      const offset = slot * 1024;
      
      // Check if slot is empty or contains this session
      const size = view.getUint32(offset, true);
      if (size === 0) {
        return slot; // Empty slot
      }
      
      // Check if it's the same session
      const data = new Uint8Array(shard, offset + 4, Math.min(size, 36));
      const existingId = new TextDecoder().decode(data);
      if (existingId.startsWith(sessionId)) {
        return slot; // Same session, update in place
      }
    }
    
    throw new Error(`Shard ${shardId} is full`);
  }
  
  private serializeSession(session: any): Uint8Array {
    const json = JSON.stringify(session);
    const encoded = new TextEncoder().encode(json);
    
    // Compress if large
    if (encoded.length > 512) {
      return lz4.compress(encoded);
    }
    
    return encoded;
  }
  
  private generateNodeId(): string {
    return crypto.randomUUID();
  }
}

class BloomFilter {
  private bits: Uint8Array;
  private hashCount: number;
  
  constructor(private config: { size: number; hashFunctions: number }) {
    this.bits = new Uint8Array(Math.ceil(config.size / 8));
    this.hashCount = config.hashFunctions;
  }
  
  add(item: string): void {
    for (let i = 0; i < this.hashCount; i++) {
      const hash = this.hash(item, i);
      const index = hash % (this.bits.length * 8);
      const byteIndex = Math.floor(index / 8);
      const bitIndex = index % 8;
      this.bits[byteIndex] |= (1 << bitIndex);
    }
  }
  
  contains(item: string): boolean {
    for (let i = 0; i < this.hashCount; i++) {
      const hash = this.hash(item, i);
      const index = hash % (this.bits.length * 8);
      const byteIndex = Math.floor(index / 8);
      const bitIndex = index % 8;
      if ((this.bits[byteIndex] & (1 << bitIndex)) === 0) {
        return false;
      }
    }
    return true;
  }
  
  private hash(item: string, seed: number): number {
    let hash = seed;
    for (let i = 0; i < item.length; i++) {
      hash = Math.imul(hash ^ item.charCodeAt(i), 0x5bd1e995);
      hash ^= hash >>> 15;
    }
    return Math.abs(hash);
  }
}

class CRDT {
  private state: Map<string, any> = new Map();
  private vectorClock: Map<string, number>;
  private nodeId: string;
  
  constructor(config: { nodeId: string; vectorClock: Map<string, number> }) {
    this.nodeId = config.nodeId;
    this.vectorClock = config.vectorClock;
  }
  
  set(key: string, value: any, timestamp: number): void {
    const currentClock = this.vectorClock.get(this.nodeId) || 0;
    this.vectorClock.set(this.nodeId, currentClock + 1);
    
    this.state.set(key, {
      value,
      timestamp,
      nodeId: this.nodeId,
      version: currentClock + 1
    });
  }
  
  get(key: string): any {
    const entry = this.state.get(key);
    return entry?.value;
  }
  
  entries(): IterableIterator<[string, any]> {
    return Array.from(this.state.entries()).map(([k, v]) => [k, v.value])[Symbol.iterator]();
  }
  
  merge(otherState: Map<string, any>): void {
    for (const [key, entry] of otherState.entries()) {
      const currentEntry = this.state.get(key);
      
      if (!currentEntry || this.shouldAcceptUpdate(currentEntry, entry)) {
        this.state.set(key, entry);
        
        // Update vector clock
        const otherClock = entry.version;
        const otherNode = entry.nodeId;
        const currentOtherClock = this.vectorClock.get(otherNode) || 0;
        
        if (otherClock > currentOtherClock) {
          this.vectorClock.set(otherNode, otherClock);
        }
      }
    }
  }
  
  private shouldAcceptUpdate(current: any, incoming: any): boolean {
    // Last-write-wins with timestamp tie-breaking
    if (incoming.timestamp > current.timestamp) {
      return true;
    }
    if (incoming.timestamp === current.timestamp) {
      // Tie-break using node ID
      return incoming.nodeId > current.nodeId;
    }
    return false;
  }
}
