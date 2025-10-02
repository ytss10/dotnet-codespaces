import { EventEmitter } from 'events';
import * as msgpack from '@msgpack/msgpack';
import pako from 'pako';

export class WebSocketManager extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private messageQueue: ArrayBuffer[] = [];
  private decoder = new TextDecoder();
  private encoder = new TextEncoder();
  private reconnectAttempts = 0;
  
  constructor(private config: {
    url: string;
    reconnectInterval: number;
    maxReconnectAttempts: number;
    binaryProtocol: boolean;
    compression: string;
  }) {
    super();
  }
  
  connect(): void {
    // ...existing code...
    
    this.ws = new WebSocket(this.config.url, ['v2.msgpack', 'v2.binary']);
    this.ws.binaryType = 'arraybuffer';
    
    this.ws.onopen = () => {
      console.log('WebSocket connected with binary protocol');
      this.reconnectAttempts = 0;
      this.flushMessageQueue();
      this.startHeartbeat();
      this.emit('connected');
    };
    
    this.ws.onmessage = async (event) => {
      if (event.data instanceof ArrayBuffer) {
        await this.handleBinaryMessage(event.data);
      } else {
        await this.handleTextMessage(event.data);
      }
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.stopHeartbeat();
      this.emit('disconnected');
      this.scheduleReconnect();
    };
  }
  
  private async handleBinaryMessage(data: ArrayBuffer): Promise<void> {
    try {
      // Check if compressed
      const view = new DataView(data);
      const isCompressed = view.getUint8(0) === 0x78; // zlib magic number
      
      let decompressed: ArrayBuffer;
      if (isCompressed) {
        const compressed = new Uint8Array(data);
        const inflated = pako.inflate(compressed);
        decompressed = inflated.buffer;
      } else {
        decompressed = data;
      }
      
      // Decode MessagePack
      const decoded = msgpack.decode(new Uint8Array(decompressed));
      
      // Handle different message types
      if (decoded.type === 'snapshot') {
        this.emit('snapshot', decoded.data);
      } else if (decoded.type === 'delta') {
        this.emit('update', decoded.delta);
      } else if (decoded.type === 'metrics') {
        this.handleMetricsUpdate(decoded.metrics);
      }
    } catch (error) {
      console.error('Failed to decode binary message:', error);
    }
  }
  
  private async handleTextMessage(data: string): Promise<void> {
    try {
      const message = JSON.parse(data);
      this.emit('message', message);
    } catch (error) {
      console.error('Failed to parse text message:', error);
    }
  }
  
  private handleMetricsUpdate(metrics: ArrayBuffer): void {
    // Process metrics using DataView for efficiency
    const view = new DataView(metrics);
    const metricCount = view.getUint32(0, true);
    
    const parsedMetrics = [];
    let offset = 4;
    
    for (let i = 0; i < metricCount; i++) {
      const sessionIdLength = view.getUint16(offset, true);
      offset += 2;
      
      const sessionIdBytes = new Uint8Array(metrics, offset, sessionIdLength);
      const sessionId = this.decoder.decode(sessionIdBytes);
      offset += sessionIdLength;
      
      const latency = view.getFloat32(offset, true);
      offset += 4;
      
      const throughput = view.getFloat32(offset, true);
      offset += 4;
      
      const errorRate = view.getFloat32(offset, true);
      offset += 4;
      
      parsedMetrics.push({
        sessionId,
        latency,
        throughput,
        errorRate,
        timestamp: Date.now()
      });
    }
    
    this.emit('metrics', parsedMetrics);
  }
  
  send(type: string, data: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Queue message if not connected
      const encoded = msgpack.encode({ type, data });
      this.messageQueue.push(encoded.buffer as ArrayBuffer);
      return;
    }
    
    try {
      if (this.config.binaryProtocol) {
        // Encode with MessagePack
        const encoded = msgpack.encode({ type, data });
        
        // Compress if enabled
        if (this.config.compression === 'permessage-deflate') {
          const compressed = pako.deflate(encoded);
          this.ws.send(compressed.buffer);
        } else {
          this.ws.send(encoded);
        }
      } else {
        // Fallback to JSON
        this.ws.send(JSON.stringify({ type, data }));
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      this.emit('error', error);
    }
  }
  
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(message);
      } else {
        // Put it back if connection lost
        this.messageQueue.unshift(message);
        break;
      }
    }
  }
  
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Send binary heartbeat
        const heartbeat = new Uint8Array([0xFF, 0x00, 0xFF, 0x00]);
        this.ws.send(heartbeat.buffer);
      }
    }, 30000);
  }
  
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
  
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.emit('max_reconnect_exceeded');
      return;
    }
    
    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts),
      30000
    );
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }
  
  disconnect(): void {
    this.stopHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.messageQueue = [];
  }
}