import { useEffect, useRef, useState, useCallback, useMemo, startTransition } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, InstancedMesh } from '@react-three/drei';
import { useGesture } from '@use-gesture/react';
import { animated, useSpring } from '@react-spring/three';
import * as THREE from 'three';
import { QuantumLiveCompositor } from '../live-view/quantum-compositor.js';
import { useQuantumState } from '../hooks/useQuantumState';
import { useVirtualization } from '../hooks/useVirtualization';

const GRID_SIZE = 100; // 100x100x10 = 1M positions
const INSTANCE_COUNT = 1_000_000;

export function LiveViewMatrix() {
  const [compositor] = useState(() => new QuantumLiveCompositor());
  const [selectedReplicas, setSelectedReplicas] = useState(new Set());
  const [viewMode, setViewMode] = useState('grid'); // grid, sphere, helix, random
  const [controlMode, setControlMode] = useState('individual'); // individual, group, all
  const meshRef = useRef();
  const [quantum, dispatchQuantum] = useQuantumState();
  
  // Initialize compositor
  useEffect(() => {
    compositor.addEventListener('frame', handleFrameUpdate);
    compositor.addEventListener('control-broadcast', handleControlBroadcast);
    
    return () => {
      compositor.dispose();
    };
  }, []);

  const handleFrameUpdate = useCallback((event) => {
    startTransition(() => {
      // Update instance matrix for live replica
      if (meshRef.current) {
        const { replicaId, frameIndex } = event.detail;
        const instanceId = parseInt(replicaId.split('-')[1]);
        
        // Update color based on activity
        const color = new THREE.Color();
        color.setHSL(frameIndex / 1000 % 1, 1, 0.5);
        meshRef.current.setColorAt(instanceId, color);
        meshRef.current.instanceColor.needsUpdate = true;
      }
    });
  }, []);

  const handleControlBroadcast = useCallback((event) => {
    console.log('Control broadcast:', event.detail);
  }, []);

  // Spatial instance renderer
  const InstanceCloud = () => {
    const { camera } = useThree();
    const instancedMesh = useRef();
    const dummy = useMemo(() => new THREE.Object3D(), []);
    
    // Virtualization for 1M instances
    const { visibleIndices, updateVisibility } = useVirtualization({
      totalCount: INSTANCE_COUNT,
      viewportSize: 10000,
      overscan: 1000
    });

    // Initialize positions
    useEffect(() => {
      if (!instancedMesh.current) return;
      
      const positions = generatePositions(viewMode, INSTANCE_COUNT);
      const color = new THREE.Color();
      
      for (let i = 0; i < INSTANCE_COUNT; i++) {
        dummy.position.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        
        instancedMesh.current.setMatrixAt(i, dummy.matrix);
        color.setHSL(i / INSTANCE_COUNT, 0.5, 0.5);
        instancedMesh.current.setColorAt(i, color);
      }
      
      instancedMesh.current.instanceMatrix.needsUpdate = true;
      instancedMesh.current.instanceColor.needsUpdate = true;
    }, [viewMode]);

    // Update visible instances based on camera frustum
    useFrame(() => {
      if (!instancedMesh.current) return;
      
      const frustum = new THREE.Frustum();
      const matrix = new THREE.Matrix4().multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse
      );
      frustum.setFromProjectionMatrix(matrix);
      
      updateVisibility((index) => {
        instancedMesh.current.getMatrixAt(index, dummy.matrix);
        dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
        return frustum.containsPoint(dummy.position);
      });
    });

    return (
      <instancedMesh
        ref={(ref) => {
          instancedMesh.current = ref;
          meshRef.current = ref;
        }}
        args={[null, null, INSTANCE_COUNT]}
        frustumCulled={false}
      >
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshPhongMaterial vertexColors />
      </instancedMesh>
    );
  };

  // Control panel overlay
  const ControlOverlay = () => {
    const [isExpanded, setIsExpanded] = useState(true);
    
    const handleCommand = async (command) => {
      const targets = controlMode === 'all' 
        ? Array.from({ length: INSTANCE_COUNT }, (_, i) => `replica-${i}`)
        : controlMode === 'group'
        ? Array.from(selectedReplicas)
        : [`replica-${selectedReplicas.values().next().value}`];
        
      await compositor.broadcastControl({
        type: command,
        targets,
        timestamp: Date.now()
      });
    };

    return (
      <div className="control-overlay">
        <div className="control-header">
          <h3>Quantum Controls</h3>
          <button onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? '−' : '+'}
          </button>
        </div>
        
        {isExpanded && (
          <div className="control-grid">
            <div className="control-section">
              <h4>Navigation</h4>
              <button onClick={() => handleCommand('navigate:back')}>← Back</button>
              <button onClick={() => handleCommand('navigate:forward')}>→ Forward</button>
              <button onClick={() => handleCommand('navigate:reload')}>↻ Reload</button>
              <input 
                type="url" 
                placeholder="Enter URL..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCommand(`navigate:url:${e.target.value}`);
                  }
                }}
              />
            </div>
            
            <div className="control-section">
              <h4>Interaction</h4>
              <button onClick={() => handleCommand('click:center')}>Click Center</button>
              <button onClick={() => handleCommand('scroll:down')}>↓ Scroll Down</button>
              <button onClick={() => handleCommand('scroll:up')}>↑ Scroll Up</button>
              <button onClick={() => handleCommand('type:test')}>Type "test"</button>
            </div>
            
            <div className="control-section">
              <h4>View Mode</h4>
              <select value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
                <option value="grid">Grid</option>
                <option value="sphere">Sphere</option>
                <option value="helix">Helix</option>
                <option value="random">Random</option>
              </select>
            </div>
            
            <div className="control-section">
              <h4>Control Mode</h4>
              <select value={controlMode} onChange={(e) => setControlMode(e.target.value)}>
                <option value="individual">Individual ({selectedReplicas.size})</option>
                <option value="group">Group ({selectedReplicas.size})</option>
                <option value="all">All (1M)</option>
              </select>
            </div>
            
            <div className="control-section">
              <h4>Bulk Actions</h4>
              <button onClick={() => handleCommand('screenshot:all')}>📸 Screenshot All</button>
              <button onClick={() => handleCommand('performance:measure')}>📊 Measure Performance</button>
              <button onClick={() => handleCommand('cookie:clear')}>🍪 Clear Cookies</button>
              <button onClick={() => handleCommand('cache:clear')}>🗑️ Clear Cache</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="live-view-matrix">
      <Canvas
        camera={{ position: [0, 0, 100], fov: 60 }}
        gl={{
          powerPreference: 'high-performance',
          antialias: false,
          stencil: false,
          depth: false
        }}
        dpr={[1, 2]}
        performance={{ min: 0.5 }}
      >
        <PerspectiveCamera makeDefault />
        <OrbitControls 
          enableDamping 
          dampingFactor={0.05}
          maxDistance={500}
          minDistance={10}
        />
        
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        
        <InstanceCloud />
        
        <fog attach="fog" args={['#000', 50, 500]} />
      </Canvas>
      
      <ControlOverlay />
      
      <div className="stats-overlay">
        <div>Replicas: {INSTANCE_COUNT.toLocaleString()}</div>
        <div>Selected: {selectedReplicas.size}</div>
        <div>Mode: {controlMode}</div>
        <div>FPS: {quantum.metrics?.fps || 0}</div>
      </div>
    </div>
  );
}

// Helper function to generate positions based on view mode
function generatePositions(mode, count) {
  const positions = new Float32Array(count * 3);
  
  switch (mode) {
    case 'grid': {
      const gridSize = Math.cbrt(count);
      for (let i = 0; i < count; i++) {
        const x = (i % gridSize) - gridSize / 2;
        const y = (Math.floor(i / gridSize) % gridSize) - gridSize / 2;
        const z = Math.floor(i / (gridSize * gridSize)) - gridSize / 2;
        positions[i * 3] = x * 2;
        positions[i * 3 + 1] = y * 2;
        positions[i * 3 + 2] = z * 2;
      }
      break;
    }
    
    case 'sphere': {
      for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 50 + Math.random() * 50;
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
      }
      break;
    }
    
    case 'helix': {
      for (let i = 0; i < count; i++) {
        const t = i / count * 100;
        positions[i * 3] = Math.cos(t) * 30;
        positions[i * 3 + 1] = t - 50;
        positions[i * 3 + 2] = Math.sin(t) * 30;
      }
      break;
    }
    
    case 'random': {
      for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 200;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 200;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
      }
      break;
    }
  }
  
  return positions;
}
