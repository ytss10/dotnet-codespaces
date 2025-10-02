import { EventEmitter } from 'events';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

interface Event {
  id: string;
  type: string;
  timestamp: number;
  sessionId?: string;
  data: any;
  metadata?: {
    causationId?: string;
    correlationId?: string;
    userId?: string;
  };
}

interface Snapshot {
  version: number;
  timestamp: number;
  state: any;
  eventCount: number;
  checksum: string;
}

export class EventStore extends EventEmitter {
  private events: Event[] = [];
  private snapshots: Map<number, Snapshot> = new Map();
  private currentVersion = 0;
  private eventIndex: Map<string, number> = new Map();
  
  constructor(private config: {
    snapshotInterval: number;
    compactionThreshold: number;
    retentionPeriod: number;
    enableTimeTravel: boolean;
  }) {
    super();
    this.startCompaction();
  }
  
  async append(event: Omit<Event, 'id'>): Promise<void> {
    const fullEvent: Event = {
      ...event,
      id: this.generateEventId(),
      timestamp: event.timestamp || Date.now()
    };
    
    this.events.push(fullEvent);
    this.currentVersion++;
    this.eventIndex.set(fullEvent.id, this.events.length - 1);
    
    // Create snapshot if needed
    if (this.currentVersion % this.config.snapshotInterval === 0) {
      await this.createSnapshot();
    }
    
    this.emit('event', fullEvent);
  }
  
  async getEvents(
    start?: number,
    end?: number,
    filter?: (event: Event) => boolean
  ): Promise<Event[]> {
    let events = this.events.slice(start, end);
    
    if (filter) {
      events = events.filter(filter);
    }
    
    return events;
  }
  
  async replay(
    fromVersion: number,
    toVersion?: number,
    speed: number = 1
  ): Promise<AsyncGenerator<Event>> {
    const endVersion = toVersion || this.currentVersion;
    
    // Find nearest snapshot
    let snapshotVersion = 0;
    let snapshot: Snapshot | undefined;
    
    for (const [version, snap] of this.snapshots.entries()) {
      if (version <= fromVersion && version > snapshotVersion) {
        snapshotVersion = version;
        snapshot = snap;
      }
    }
    
    // Restore from snapshot if available
    let state = snapshot ? await this.deserializeSnapshot(snapshot) : {};
    
    // Create async generator for replay
    const self = this;
    return (async function* () {
      const events = self.events.slice(snapshotVersion, endVersion);
      
      for (const event of events) {
        if (!event) {
          continue;
        }
        if (event.timestamp >= fromVersion) {
          // Apply event to state
          state = await self.applyEvent(state, event);
          
          // Control replay speed
          if (speed < 1) {
            await new Promise(resolve => setTimeout(resolve, (1 - speed) * 100));
          }
          
          yield event;
        }
      }
    })();
  }
  
  async timeTravel(targetTimestamp: number): Promise<any> {
    if (!this.config.enableTimeTravel) {
      throw new Error('Time travel is not enabled');
    }
    
    // Binary search for target timestamp
    let left = 0;
    let right = this.events.length - 1;
    let targetIndex = -1;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const event = this.events[mid];
      if (!event) {
        right = mid - 1;
        continue;
      }
      
      if (event.timestamp <= targetTimestamp) {
        targetIndex = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    
    if (targetIndex === -1) {
      return {}; // No events before target timestamp
    }
    
    // Replay events up to target
    const generator = await this.replay(0, targetIndex + 1);
    let state = {};
    
    for await (const event of generator) {
      state = await this.applyEvent(state, event);
    }
    
    return state;
  }
  
  private async createSnapshot(): Promise<void> {
    const state = await this.computeCurrentState();
    const checksum = await this.calculateChecksum(state);
    
    const snapshot: Snapshot = {
      version: this.currentVersion,
      timestamp: Date.now(),
      state: await this.serializeState(state),
      eventCount: this.events.length,
      checksum
    };
    
    this.snapshots.set(this.currentVersion, snapshot);
    
    // Cleanup old snapshots
    const cutoff = Date.now() - this.config.retentionPeriod;
    for (const [version, snap] of this.snapshots.entries()) {
      if (snap.timestamp < cutoff) {
        this.snapshots.delete(version);
      }
    }
  }
  
  private async computeCurrentState(): Promise<any> {
    let state = {};
    
    for (const event of this.events) {
      state = await this.applyEvent(state, event);
    }
    
    return state;
  }
  
  private async applyEvent(state: any, event: Event): Promise<any> {
    // Deep clone state to maintain immutability
    const newState = JSON.parse(JSON.stringify(state));
    
    switch (event.type) {
      case 'SESSION_CREATED':
        if (!newState.sessions) newState.sessions = {};
        newState.sessions[event.sessionId!] = event.data;
        break;
        
      case 'SESSION_UPDATED':
        if (newState.sessions && newState.sessions[event.sessionId!]) {
          Object.assign(newState.sessions[event.sessionId!], event.data);
        }
        break;
        
      case 'SESSION_SCALED':
        if (newState.sessions && newState.sessions[event.sessionId!]) {
          newState.sessions[event.sessionId!].replicas = event.data.newCount;
        }
        break;
        
      case 'PROXY_UPDATED':
        if (newState.sessions && newState.sessions[event.sessionId!]) {
          newState.sessions[event.sessionId!].proxyConfig = event.data.config;
        }
        break;
        
      default:
        // Unknown event type, store in metadata
        if (!newState.metadata) newState.metadata = {};
        if (!newState.metadata.unknownEvents) newState.metadata.unknownEvents = [];
        newState.metadata.unknownEvents.push(event);
    }
    
    return newState;
  }
  
  private async serializeState(state: any): Promise<Buffer> {
    const json = JSON.stringify(state);
    return await gzip(json, { level: 9 });
  }
  
  private async deserializeSnapshot(snapshot: Snapshot): Promise<any> {
    const json = await gunzip(snapshot.state);
    return JSON.parse(json.toString());
  }
  
  private async calculateChecksum(state: any): Promise<string> {
    const crypto = require('crypto');
    const json = JSON.stringify(state);
    return crypto.createHash('sha256').update(json).digest('hex');
  }
  
  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private startCompaction(): void {
    setInterval(async () => {
      if (this.events.length > this.config.compactionThreshold) {
        await this.compact();
      }
    }, 60000); // Check every minute
  }
  
  private async compact(): Promise<void> {
    // Create snapshot of current state
    await this.createSnapshot();
    
    // Find latest snapshot
    const latestSnapshot = Math.max(...this.snapshots.keys());
    
    // Remove events before latest snapshot
    const cutoffIndex = this.events.findIndex(e => 
      e.timestamp >= this.snapshots.get(latestSnapshot)!.timestamp
    );
    
    if (cutoffIndex > 0) {
      this.events = this.events.slice(cutoffIndex);
      
      // Rebuild event index
      this.eventIndex.clear();
      this.events.forEach((event, index) => {
        this.eventIndex.set(event.id, index);
      });
    }
  }
}
