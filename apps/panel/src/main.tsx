import { StrictMode, Suspense, lazy, useDeferredValue, useTransition, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';
import { atom, useAtom, Provider as JotaiProvider } from 'jotai';
import * as Comlink from 'comlink';

// Query client configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false
    }
  }
});

// Quantum state atom
const quantumStateAtom = atom({
  replicas: new Map(),
  viewport: { x: 0, y: 0, width: 0, height: 0, scale: 1 },
  selection: new Set(),
  filters: { region: null, proxy: null, status: null },
  metrics: { fps: 0, latency: 0, bandwidth: 0 }
});

// WebGL Renderer class
class WebGLRenderer {
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private instanceBuffer: WebGLBuffer | null = null;
  private maxInstances = 1_000_000;

  constructor(private canvas: HTMLCanvasElement) {}

  initialize(config: any) {
    const gl = this.canvas.getContext('webgl2', {
      powerPreference: 'high-performance',
      antialias: config.useMSAA,
      desynchronized: true
    });
    
    if (!gl) throw new Error('WebGL2 not supported');
    this.gl = gl;

    // Vertex shader
    const vsSource = `#version 300 es
      in vec3 aPosition;
      in vec3 aInstancePosition;
      in vec3 aInstanceColor;
      
      uniform mat4 uProjection;
      uniform mat4 uView;
      
      out vec3 vColor;
      
      void main() {
        vec3 position = aPosition + aInstancePosition;
        gl_Position = uProjection * uView * vec4(position, 1.0);
        vColor = aInstanceColor;
      }
    `;

    // Fragment shader
    const fsSource = `#version 300 es
      precision highp float;
      
      in vec3 vColor;
      out vec4 fragColor;
      
      void main() {
        fragColor = vec4(vColor, 1.0);
      }
    `;

    // Compile shaders
    const vertexShader = this.compileShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = this.compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
    
    if (!vertexShader || !fragmentShader) return;

    // Create program
    this.program = gl.createProgram()!;
    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);

    // Create VAO
    if (config.useVAO) {
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
    }

    // Create instance buffer
    this.instanceBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.maxInstances * 6 * 4, gl.DYNAMIC_DRAW);
  }

  private compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) return null;
    
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    
    return shader;
  }

  render(replicas: Map<string, any>, viewport: any) {
    if (!this.gl || !this.program) return;
    
    const gl = this.gl;
    
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    gl.useProgram(this.program);
    
    // Update uniforms
    // Draw instances
    if (this.vao) {
      gl.bindVertexArray(this.vao);
    }
    
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, Math.min(replicas.size, this.maxInstances));
  }

  dispose() {
    const gl = this.gl;
    if (!gl) return;
    
    if (this.instanceBuffer) gl.deleteBuffer(this.instanceBuffer);
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.program) gl.deleteProgram(this.program);
  }
}

// Offscreen Canvas Pool
class OffscreenCanvasPool {
  private pool: OffscreenCanvas[] = [];
  private inUse = new Set<OffscreenCanvas>();

  constructor(private config: any) {
    this.initialize();
  }

  private initialize() {
    for (let i = 0; i < this.config.maxSize; i++) {
      const canvas = new OffscreenCanvas(this.config.width, this.config.height);
      this.pool.push(canvas);
    }
  }

  acquire(): OffscreenCanvas | null {
    const canvas = this.pool.pop();
    if (canvas) {
      this.inUse.add(canvas);
      return canvas;
    }
    return null;
  }

  release(canvas: OffscreenCanvas) {
    if (this.inUse.delete(canvas)) {
      this.pool.push(canvas);
    }
  }
}

// Main Quantum Viewport Component
function QuantumViewport() {
  const [quantumState, setQuantumState] = useAtom(quantumStateAtom);
  const [isPending, startTransition] = useTransition();
  const deferredReplicas = useDeferredValue(quantumState.replicas);
  const [renderer, setRenderer] = useState<WebGLRenderer | null>(null);

  useEffect(() => {
    const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    
    const webglRenderer = new WebGLRenderer(canvas);
    webglRenderer.initialize({
      maxInstances: 1_000_000,
      useMSAA: true,
      useVAO: true,
      pixelRatio: window.devicePixelRatio
    });
    
    setRenderer(webglRenderer);

    const renderLoop = () => {
      startTransition(() => {
        webglRenderer.render(deferredReplicas, quantumState.viewport);
      });
      requestAnimationFrame(renderLoop);
    };
    
    renderLoop();

    return () => webglRenderer.dispose();
  }, []);

  return (
    <div className="quantum-viewport">
      <canvas id="webgl-canvas" style={{ width: '100%', height: '100%' }} />
      {isPending && <div className="loading-indicator">Quantum Coherence...</div>}
    </div>
  );
}

// Control Matrix Component
function ControlMatrix() {
  const [filters, setFilters] = useState({
    region: null as string | null,
    proxy: null as string | null,
    status: null as string | null,
    quantumState: 'all'
  });

  const [quantumState] = useAtom(quantumStateAtom);

  const handleBulkScale = async () => {
    await fetch('/api/sessions/bulk-scale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionIds: Array.from(quantumState.replicas.keys()),
        multiplier: 2.0,
        strategy: 'exponential'
      })
    });
  };

  return (
    <aside className="control-matrix">
      <div className="filter-rail">
        <select onChange={(e) => setFilters({ ...filters, region: e.target.value })}>
          <option value="">All Regions</option>
          <option value="us">United States</option>
          <option value="eu">Europe</option>
          <option value="asia">Asia</option>
        </select>
        <select onChange={(e) => setFilters({ ...filters, proxy: e.target.value })}>
          <option value="">All Proxies</option>
          <option value="proxy1">Proxy 1</option>
          <option value="proxy2">Proxy 2</option>
        </select>
        <button onClick={handleBulkScale}>Scale Selected 2x</button>
      </div>
      <div className="metrics-dashboard">
        <div>FPS: {quantumState.metrics.fps}</div>
        <div>Latency: {quantumState.metrics.latency}ms</div>
        <div>Bandwidth: {quantumState.metrics.bandwidth}MB/s</div>
      </div>
    </aside>
  );
}

// App Component
function App() {
  return (
    <div className="app-container">
      <QuantumViewport />
      <ControlMatrix />
    </div>
  );
}

// Error Fallback
function ErrorFallback({ error, resetErrorBoundary }: any) {
  return (
    <div className="error-fallback">
      <h2>Render Pipeline Error</h2>
      <pre>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Reset Pipeline</button>
    </div>
  );
}

// Root render
const root = createRoot(document.getElementById('root')!);

root.render(
  <StrictMode>
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <QueryClientProvider client={queryClient}>
        <JotaiProvider>
          <Suspense fallback={<div>Initializing Quantum State...</div>}>
            <App />
          </Suspense>
        </JotaiProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
);

// Service worker registration
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', {
    scope: '/',
    updateViaCache: 'none'
  }).catch(console.error);
}

// Check for cross-origin isolation
if (typeof SharedArrayBuffer !== 'undefined') {
  console.log('SharedArrayBuffer enabled - Cross-origin isolated');
} else {
  console.warn('SharedArrayBuffer not available - Performance may be limited');
}
