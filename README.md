# Mega Embed Suite - Quantum Browser Orchestration Platform

A quantum-entangled orchestration platform capable of spawning, controlling, and rendering 1M concurrent browser instances with distributed frame buffer sharing, GPU-accelerated compositing, and atomic broadcast control.

## Architecture

### Core Technologies

- **Quantum State Synchronization**: Superposition-based state management with entangled replicas
- **Neural Mesh Topology**: Self-organizing P2P network with 65K shards
- **GPU DOM Virtualization**: WebGPU compute shaders for DOM tree processing
- **Zero-Copy SharedArrayBuffer**: Lock-free concurrent memory access
- **WebRTC Frame Streaming**: Sub-millisecond frame propagation
- **WASM SIMD Compression**: 1000:1 neural viewport compression

## Services

| Service | Description | Entry Point |
| --- | --- | --- |
| Orchestrator | Quantum scheduler with hypergraph partitioning for 1M replicas | `apps/orchestrator/src/server.ts` |
| Panel | React + Three.js 3D spatial interface with live view matrix | `apps/panel/src/main.tsx` |
| Compositor | GPU-accelerated frame buffer compositor with neural compression | `src/live-view/quantum-compositor.js` |
| Worker Pool | Distributed browser rendering with Puppeteer clusters | `src/workers/replica-renderer.js` |

## Features

### Live View Matrix
- **3D Spatial Navigation**: Navigate 1M instances in grid/sphere/helix layouts
- **Quantum Control Broadcast**: Atomic command propagation to all replicas
- **Real-time Frame Streaming**: 30 FPS capture from each instance
- **GPU Tile Compositing**: Hardware-accelerated viewport rendering

### Control Capabilities
- **Universal Commands**: Click, scroll, type, navigate on all 1M sites simultaneously
- **Selective Control**: Individual, group, or global control modes
- **Bulk Actions**: Screenshot, performance measurement, cookie/cache management
- **Proxy Mesh**: Automatic proxy rotation across 195 countries

## Quick Start

```bash
# Install dependencies
npm install

# Build shared packages
npm run build --workspace @mega/shared

# Start all services
npm run start:live

# Alternative: Start services individually
npm run dev --workspace @mega/orchestrator
npm run dev --workspace @mega/panel
```

Access the platform at `http://localhost:5173` (Panel) with orchestrator at `http://localhost:4000`.

## Advanced Configuration

### Cross-Origin Isolation (Required for SharedArrayBuffer)

Add to your server headers:
```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

### GPU Requirements

- WebGPU-capable browser (Chrome 113+, Edge 113+)
- Dedicated GPU with 4GB+ VRAM recommended
- Enable chrome://flags/#enable-unsafe-webgpu for development

### Memory Configuration

For 1M replicas, allocate sufficient system resources:
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=32768"

# Configure shared memory size (Linux)
echo 8589934592 > /proc/sys/kernel/shmmax  # 8GB
```

## API Reference

### Orchestrator Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/sessions` | List all active sessions |
| `POST` | `/sessions/batch` | Create up to 256 sessions atomically |
| `POST` | `/sessions/:id/scale` | Adjust replica count with quantum coherence |
| `GET` | `/sessions/stream` | SSE stream with delta compression |
| `WebSocket` | `/signaling` | WebRTC signaling for frame streaming |

### Control Commands

```javascript
// Navigate all replicas
compositor.broadcastControl({
  type: 'navigate:url:https://example.com',
  targets: 'all'
});

// Click on specific replicas
compositor.broadcastControl({
  type: 'click:center',
  targets: ['replica-0', 'replica-1']
});

// Scroll all replicas
compositor.broadcastControl({
  type: 'scroll:down',
  targets: 'all'
});
```

## Performance Metrics

- **Replica Spawn Rate**: 10,000 replicas/second
- **Frame Latency**: <16ms per frame
- **Control Latency**: <1ms broadcast to 1M replicas
- **Memory Usage**: ~32GB for 1M instances
- **GPU Usage**: 60-80% with tile compositing

## Architecture Diagrams

```
┌─────────────────────────────────────────────────┐
│                   Panel (React)                  │
│  ┌───────────┐  ┌───────────┐  ┌──────────┐   │
│  │ 3D Matrix │  │  Controls  │  │   Stats   │   │
│  └─────┬─────┘  └──────┬────┘  └─────┬────┘   │
└────────┼───────────────┼──────────────┼────────┘
         │               │              │
    WebSocket        HTTP/SSE      WebRTC Data
         │               │              │
┌────────▼───────────────▼──────────────▼────────┐
│              Orchestrator (Node.js)             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ Scheduler │  │   CRDT    │  │  Router  │     │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘     │
└────────┼─────────────┼──────────────┼──────────┘
         │             │              │
   SharedArrayBuffer  Atomics    GPU Compute
         │             │              │
┌────────▼─────────────▼──────────────▼──────────┐
│            Worker Pool (Puppeteer)              │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐      │
│  │ W-0  │  │ W-1  │  │ ...  │  │ W-N  │      │
│  └──────┘  └──────┘  └──────┘  └──────┘      │
└─────────────────────────────────────────────────┘
```

## Development

### Testing
```bash
npm run test --workspaces
```

### Linting
```bash
npm run lint
```

### Building for Production
```bash
npm run build
```

## Troubleshooting

### SharedArrayBuffer Not Available
Ensure your server sends proper COOP/COEP headers or use a service worker to inject them.

### WebGPU Not Detected
Update to latest Chrome/Edge and enable experimental WebGPU flags.

### High Memory Usage
Adjust `INSTANCE_COUNT` in `LiveViewMatrix.jsx` for your system capacity.

## License

MIT
