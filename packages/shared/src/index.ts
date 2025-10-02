// Quantum state types
export interface QuantumState {
  id: string;
  coherence: number;
  amplitude: number;
  entangled: string[];
  timestamp: number;
}

// Replica types
export interface Replica {
  id: string;
  url: string;
  status: 'spawning' | 'active' | 'idle' | 'error';
  viewport: Viewport;
  metrics: ReplicaMetrics;
  proxyId?: string;
  workerId?: number;
}

export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

export interface ReplicaMetrics {
  fps: number;
  latency: number;
  bandwidth: number;
  cpu: number;
  memory: number;
}

// Advanced data structures
export class LockFreeQueue<T> {
  private buffer: SharedArrayBuffer;
  private head: Uint32Array;
  private tail: Uint32Array;
  private capacity: number;

  constructor(capacity: number, elementSize: number) {
    this.capacity = capacity;
    this.buffer = new SharedArrayBuffer(capacity * elementSize + 8);
    this.head = new Uint32Array(this.buffer, 0, 1);
    this.tail = new Uint32Array(this.buffer, 4, 1);
  }

  enqueue(item: T): boolean {
    const currentTail = Atomics.load(this.tail, 0);
    const nextTail = (currentTail + 1) % this.capacity;
    
    if (nextTail === Atomics.load(this.head, 0)) {
      return false; // Queue full
    }
    
    // Write item to buffer
    this.writeItem(currentTail, item);
    
    Atomics.store(this.tail, 0, nextTail);
    return true;
  }

  dequeue(): T | null {
    const currentHead = Atomics.load(this.head, 0);
    
    if (currentHead === Atomics.load(this.tail, 0)) {
      return null; // Queue empty
    }
    
    const item = this.readItem(currentHead);
    Atomics.store(this.head, 0, (currentHead + 1) % this.capacity);
    
    return item;
  }

  private writeItem(index: number, item: T): void {
    // Implementation depends on T
    const offset = 8 + index * 256; // Assuming 256 bytes per item
    new Uint8Array(this.buffer, offset, 256).set(
      new TextEncoder().encode(JSON.stringify(item))
    );
  }

  private readItem(index: number): T {
    const offset = 8 + index * 256;
    const bytes = new Uint8Array(this.buffer, offset, 256);
    const str = new TextDecoder().decode(bytes);
    return JSON.parse(str.replace(/\0/g, ''));
  }
}

// Bloom filter for efficient replica lookups
export class BloomFilter {
  private bits: Uint8Array;
  private numHashes: number;
  private size: number;

  constructor(size: number = 1000000, numHashes: number = 7) {
    this.size = size;
    this.numHashes = numHashes;
    this.bits = new Uint8Array(Math.ceil(size / 8));
  }

  add(item: string): void {
    for (let i = 0; i < this.numHashes; i++) {
      const hash = this.hash(item, i) % this.size;
      const byte = Math.floor(hash / 8);
      const bit = hash % 8;
      const segment = this.bits[byte];
      if (segment === undefined) continue;
      this.bits[byte] = segment | (1 << bit);
    }
  }

  contains(item: string): boolean {
    for (let i = 0; i < this.numHashes; i++) {
      const hash = this.hash(item, i) % this.size;
      const byte = Math.floor(hash / 8);
      const bit = hash % 8;
      const segment = this.bits[byte];
      if (segment === undefined) {
        return false;
      }
      if (!(segment & (1 << bit))) {
        return false;
      }
    }
    return true;
  }

  private hash(str: string, seed: number): number {
    let hash = seed;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

// Export utility functions
export function generateReplicaId(): string {
  return `replica-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function calculateViewportIntersection(v1: Viewport, v2: Viewport): Viewport | null {
  const x = Math.max(v1.x, v2.x);
  const y = Math.max(v1.y, v2.y);
  const x2 = Math.min(v1.x + v1.width, v2.x + v2.width);
  const y2 = Math.min(v1.y + v1.height, v2.y + v2.height);
  
  if (x2 < x || y2 < y) return null;
  
  return {
    x, y,
    width: x2 - x,
    height: y2 - y,
    scale: Math.min(v1.scale, v2.scale)
  };
}

import {
  sessionStatusSchema,
  sessionTargetSchema,
  sessionDefinitionSchema,
  sessionBlueprintSchema,
  replicaShardSchema,
  replicaPolicySchema,
  proxyRequirementSchema,
  hypergridTileSchema,
  hypergridSnapshotSchema
} from "./schema.js";

import type {
  SessionTarget as SchemaSessionTarget,
  SessionDefinition as SchemaSessionDefinition,
  SessionBlueprint as SchemaSessionBlueprint,
  ReplicaShard as SchemaReplicaShard,
  ReplicaPolicy as SchemaReplicaPolicy,
  ProxyRequirement as SchemaProxyRequirement,
  HypergridTile as SchemaHypergridTile,
  HypergridSnapshot as SchemaHypergridSnapshot
} from "./schema.js";

export {
  sessionStatusSchema,
  sessionTargetSchema,
  sessionDefinitionSchema,
  sessionBlueprintSchema,
  replicaShardSchema,
  replicaPolicySchema,
  proxyRequirementSchema,
  hypergridTileSchema,
  hypergridSnapshotSchema
};

export type {
  SchemaSessionTarget as SessionTarget,
  SchemaSessionDefinition as SessionDefinition,
  SchemaSessionBlueprint as SessionBlueprint,
  SchemaReplicaShard as ReplicaShard,
  SchemaReplicaPolicy as ReplicaPolicy,
  SchemaProxyRequirement as ProxyRequirement,
  SchemaHypergridTile as HypergridTile,
  SchemaHypergridSnapshot as HypergridSnapshot
};

// Advanced type definitions for quantum orchestration platform

export interface SessionTarget {
  url: string;
  label: string;
  metadata?: Record<string, unknown>;
}

export interface SessionShard {
  id: string;
  region: string;
  proxyPoolId?: string;
  capacity: number;
  latencyMs: number;
  status: 'active' | 'pending' | 'failed';
}

export interface SessionPolicy {
  targetReplicaCount: number;
  maxReplicaCount: number;
  minReplicaCount: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  cooldownSeconds: number;
}

export interface SessionDefinition {
  id: string;
  target: SessionTarget;
  shards: SessionShard[];
  policy: SessionPolicy;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type SessionStatus = 'steady' | 'scaling' | 'degraded' | 'terminated' | 'draft';

export interface SessionBlueprint {
  id: string;
  definition: SessionDefinition;
  status: SessionStatus;
  metrics?: SessionMetrics;
  version: number;
  checksum: string;
}

export interface SessionMetrics {
  activeReplicas: number;
  pendingReplicas: number;
  failedReplicas: number;
  errorsPerMinute: number;
  bandwidthKbps: number;
  averageLatencyMs: number;
  p99LatencyMs: number;
  cpuUsagePercent: number;
  memoryUsageMB: number;
}

export interface HypergridTile {
  tileId: number;
  x: number;
  y: number;
  sessionCount: number;
  activeReplicas: number;
  averageLatencyMs: number;
  statusHistogram: Record<SessionStatus, number>;
  proxyCountries: Record<string, number>;
  samples: Array<{
    sessionId: string;
    label: string;
    status: SessionStatus;
    averageLatencyMs: number;
  }>;
}

export interface HypergridSnapshot {
  timestamp: string;
  tiles: HypergridTile[];
  totalSessions: number;
  totalReplicas: number;
  maxSessionsPerTile: number;
  maxReplicasPerTile: number;
  gridDimensions: {
    width: number;
    height: number;
  };
}

export interface VectorClock {
  nodeId: string;
  version: bigint;
  timestamp: bigint;
  vector: Map<string, bigint>;
}

export interface ReplicaState {
  id: string;
  sessionId: string;
  shardId: string;
  status: 'spawning' | 'ready' | 'busy' | 'error' | 'terminating';
  lastHeartbeat: number;
  metrics: {
    cpuUsage: number;
    memoryMB: number;
    networkKbps: number;
  };
}

export interface ProxyEndpoint {
  id: string;
  url: string;
  country: string;
  region: string;
  latencyMs: number;
  reliability: number;
  maxConcurrent: number;
  currentLoad: number;
}

export interface BulkEmbedRequest {
  urls: string[];
  bulkOptions: {
    batchSize: number;
    parallelProcessing: boolean;
    fallbackStrategy: 'skip' | 'retry' | 'proxy-rotate';
  };
  proxyRequirements: {
    enableGlobalRotation: boolean;
    preferredRegions?: string[];
    preferredCountries?: string[];
    maxConcurrentPerProxy: number;
  };
  renderingOptions: {
    engine: 'chromium' | 'firefox' | 'webkit';
    viewport: { width: number; height: number };
    enableOptimizations: boolean;
  };
}

export interface BulkEmbedResponse {
  totalProcessed: number;
  createdSessionIds: string[];
  failedEntries: Array<{
    url: string;
    reason: string;
  }>;
  processingTimeMs: number;
}

export * from './types';
