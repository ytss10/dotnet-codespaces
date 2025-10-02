import { createHash } from 'crypto';

interface ProxyNode {
  id: string;
  tier: string;
  ip: string;
  port: number;
  location: { lat: number; lon: number };
  capacity: number;
  load: number;
  vnodes: number[];
}

export class HierarchicalProxyMesh {
  private nodes: Map<string, ProxyNode> = new Map();
  private hashRing: Map<number, string> = new Map();
  private geoIndex: any; // R-tree for geo queries
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  
  constructor(private config: {
    tiers: Array<{ level: string; nodes: number; latencyTarget: number }>;
    routingAlgorithm: string;
    healthCheckInterval: number;
    circuitBreakerThreshold: number;
  }) {
    this.initializeMesh();
    this.buildHashRing();
    this.startHealthChecks();
  }
  
  private initializeMesh(): void {
    let nodeId = 0;
    
    for (const tier of this.config.tiers) {
      for (let i = 0; i < tier.nodes; i++) {
        const node: ProxyNode = {
          id: `${tier.level}-${nodeId++}`,
          tier: tier.level,
          ip: this.generateIP(nodeId),
          port: 8000 + nodeId,
          location: this.generateLocation(nodeId),
          capacity: this.calculateCapacity(tier.level),
          load: 0,
          vnodes: this.generateVirtualNodes(nodeId, tier.level)
        };
        
        this.nodes.set(node.id, node);
        this.circuitBreakers.set(node.id, new CircuitBreaker({
          threshold: this.config.circuitBreakerThreshold,
          timeout: 5000,
          resetTime: 30000
        }));
      }
    }
  }
  
  private buildHashRing(): void {
    this.hashRing.clear();
    
    for (const node of this.nodes.values()) {
      for (const vnode of node.vnodes) {
        this.hashRing.set(vnode, node.id);
      }
    }
    
    // Sort hash ring for binary search
    this.hashRing = new Map([...this.hashRing.entries()].sort((a, b) => a[0] - b[0]));
  }
  
  async optimizeRouting(params: {
    sessionId: string;
    requirements: any;
    currentTopology: any;
    geoTargets: string[];
  }): Promise<any> {
    const targetNodes: ProxyNode[] = [];
    
    // Multi-objective optimization: latency, load, cost
    for (const region of params.geoTargets) {
      const regionalNodes = this.findNodesInRegion(region);
      
      // Use simulated annealing for optimization
      const optimized = await this.simulatedAnnealing(
        regionalNodes,
        params.requirements,
        {
          temperature: 1000,
          coolingRate: 0.95,
          iterations: 1000
        }
      );
      
      targetNodes.push(...optimized);
    }
    
    // Build affinity matrix using consistent hashing
    const sessionHash = this.hash(params.sessionId);
    const primaryNode = this.findNodeByHash(sessionHash);
    
    // Calculate replication nodes
    const replicationNodes = this.findReplicationNodes(
      primaryNode,
      params.requirements.replicationFactor || 3
    );
    
    return {
      primary: primaryNode,
      replicas: replicationNodes,
      routing: this.buildRoutingTable(targetNodes),
      affinityMatrix: this.buildAffinityMatrix(targetNodes)
    };
  }
  
  private async simulatedAnnealing(
    nodes: ProxyNode[],
    requirements: any,
    config: { temperature: number; coolingRate: number; iterations: number }
  ): Promise<ProxyNode[]> {
    let current = nodes.slice(0, Math.min(10, nodes.length));
    let best = current;
    let bestCost = this.calculateCost(current, requirements);
    let temperature = config.temperature;
    
    for (let i = 0; i < config.iterations; i++) {
      // Generate neighbor solution
      const neighbor = this.generateNeighbor(current, nodes);
      const neighborCost = this.calculateCost(neighbor, requirements);
      
      // Accept or reject based on Metropolis criterion
      const delta = neighborCost - bestCost;
      if (delta < 0 || Math.random() < Math.exp(-delta / temperature)) {
        current = neighbor;
        
        if (neighborCost < bestCost) {
          best = neighbor;
          bestCost = neighborCost;
        }
      }
      
      temperature *= config.coolingRate;
    }
    
    return best;
  }
  
  private calculateCost(nodes: ProxyNode[], requirements: any): number {
    let cost = 0;
    
    // Latency cost
    const avgLatency = nodes.reduce((sum, n) => {
      const tier = this.config.tiers.find(t => t.level === n.tier);
      return sum + (tier?.latencyTarget || 100);
    }, 0) / nodes.length;
    cost += avgLatency * (requirements.latencyWeight || 1);
    
    // Load balancing cost
    const loadVariance = this.calculateLoadVariance(nodes);
    cost += loadVariance * (requirements.loadWeight || 1);
    
    // Capacity cost
    const capacityUtilization = nodes.reduce((sum, n) => 
      sum + (n.load / n.capacity), 0) / nodes.length;
    cost += capacityUtilization * (requirements.capacityWeight || 1);
    
    return cost;
  }
  
  private calculateLoadVariance(nodes: ProxyNode[]): number {
    const loads = nodes.map(n => n.load);
    const mean = loads.reduce((a, b) => a + b, 0) / loads.length;
    const variance = loads.reduce((sum, load) => 
      sum + Math.pow(load - mean, 2), 0) / loads.length;
    return Math.sqrt(variance);
  }
  
  private generateNeighbor(current: ProxyNode[], all: ProxyNode[]): ProxyNode[] {
    const neighbor = [...current];
    const action = Math.random();
    
    if (action < 0.33 && neighbor.length > 1) {
      // Remove random node
      neighbor.splice(Math.floor(Math.random() * neighbor.length), 1);
    } else if (action < 0.66 && neighbor.length < all.length) {
      // Add random node
      const available = all.filter(n => !neighbor.includes(n));
      if (available.length > 0) {
        neighbor.push(available[Math.floor(Math.random() * available.length)]);
      }
    } else {
      // Swap random node
      if (neighbor.length > 0 && all.length > neighbor.length) {
        const idx = Math.floor(Math.random() * neighbor.length);
        const available = all.filter(n => !neighbor.includes(n));
        if (available.length > 0) {
          neighbor[idx] = available[Math.floor(Math.random() * available.length)];
        }
      }
    }
    
    return neighbor;
  }
  
  private findNodeByHash(hash: number): ProxyNode {
    // Binary search in sorted hash ring
    const keys = Array.from(this.hashRing.keys());
    let left = 0, right = keys.length - 1;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (keys[mid] === hash) {
        return this.nodes.get(this.hashRing.get(keys[mid])!)!;
      }
      if (keys[mid] < hash) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    
    // Wrap around to first node if hash is larger than all keys
    const nodeId = this.hashRing.get(keys[left % keys.length])!;
    return this.nodes.get(nodeId)!;
  }
  
  private findReplicationNodes(primary: ProxyNode, count: number): ProxyNode[] {
    const replicas: ProxyNode[] = [];
    const used = new Set([primary.id]);
    
    // Find nodes in different failure domains
    const tiers = [...new Set(Array.from(this.nodes.values()).map(n => n.tier))];
    
    for (const tier of tiers) {
      if (replicas.length >= count - 1) break;
      
      const tierNodes = Array.from(this.nodes.values())
        .filter(n => n.tier === tier && !used.has(n.id))
        .sort((a, b) => {
          // Sort by geographic distance from primary
          const distA = this.geoDistance(primary.location, a.location);
          const distB = this.geoDistance(primary.location, b.location);
          return distA - distB;
        });
      
      for (const node of tierNodes) {
        if (replicas.length >= count - 1) break;
        replicas.push(node);
        used.add(node.id);
      }
    }
    
    return replicas;
  }
  
  private buildRoutingTable(nodes: ProxyNode[]): any {
    // Build adjacency matrix for routing
    const size = nodes.length;
    const matrix = new Float32Array(size * size);
    
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        if (i === j) {
          matrix[i * size + j] = 0;
        } else {
          // Calculate weight based on latency and capacity
          const distance = this.geoDistance(nodes[i].location, nodes[j].location);
          const capacityFactor = nodes[j].capacity / (nodes[j].load + 1);
          matrix[i * size + j] = distance / capacityFactor;
        }
      }
    }
    
    // Run Floyd-Warshall for all-pairs shortest paths
    for (let k = 0; k < size; k++) {
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          const direct = matrix[i * size + j];
          const viaK = matrix[i * size + k] + matrix[k * size + j];
          if (viaK < direct) {
            matrix[i * size + j] = viaK;
          }
        }
      }
    }
    
    return { nodes: nodes.map(n => n.id), matrix };
  }
  
  private buildAffinityMatrix(nodes: ProxyNode[]): Float32Array {
    const size = nodes.length;
    const matrix = new Float32Array(size * size);
    
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        // Calculate affinity based on tier, location, and load
        const node1 = nodes[i];
        const node2 = nodes[j];
        
        let affinity = 1.0;
        
        // Same tier bonus
        if (node1.tier === node2.tier) affinity *= 1.5;
        
        // Geographic proximity
        const distance = this.geoDistance(node1.location, node2.location);
        affinity *= Math.exp(-distance / 1000); // Decay over 1000km
        
        // Load balancing factor
        const loadDiff = Math.abs(node1.load - node2.load);
        affinity *= Math.exp(-loadDiff / node1.capacity);
        
        matrix[i * size + j] = affinity;
      }
    }
    
    return matrix;
  }
  
  private geoDistance(loc1: { lat: number; lon: number }, loc2: { lat: number; lon: number }): number {
    // Haversine formula
    const R = 6371; // Earth radius in km
    const dLat = (loc2.lat - loc1.lat) * Math.PI / 180;
    const dLon = (loc2.lon - loc1.lon) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(loc1.lat * Math.PI / 180) * Math.cos(loc2.lat * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
  
  private generateVirtualNodes(nodeId: number, tier: string): number[] {
    const vnodeCount = tier === 'edge' ? 150 : tier === 'regional' ? 100 : 50;
    const vnodes: number[] = [];
    
    for (let i = 0; i < vnodeCount; i++) {
      const vnode = this.hash(`${nodeId}-${i}-${tier}`);
      vnodes.push(vnode);
    }
    
    return vnodes;
  }
  
  private hash(input: string): number {
    const hash = createHash('sha256').update(input).digest();
    return hash.readUInt32BE(0);
  }
  
  private generateIP(id: number): string {
    const a = 10;
    const b = Math.floor(id / 65536) % 256;
    const c = Math.floor(id / 256) % 256;
    const d = id % 256;
    return `${a}.${b}.${c}.${d}`;
  }
  
  private generateLocation(id: number): { lat: number; lon: number } {
    // Distribute nodes globally using Fibonacci spiral
    const phi = (1 + Math.sqrt(5)) / 2;
    const theta = 2 * Math.PI * id / phi;
    const lat = Math.asin(2 * (id / 10000) - 1) * 180 / Math.PI;
    const lon = theta * 180 / Math.PI;
    return { lat, lon };
  }
  
  private calculateCapacity(tier: string): number {
    switch (tier) {
      case 'edge': return 10000;
      case 'regional': return 50000;
      case 'backbone': return 100000;
      default: return 10000;
    }
  }
  
  private findNodesInRegion(region: string): ProxyNode[] {
    // Region to lat/lon mapping
    const regions: Record<string, { lat: number; lon: number; radius: number }> = {
      'us-east-1': { lat: 39.0458, lon: -77.6413, radius: 500 },
      'eu-west-1': { lat: 53.4129, lon: -8.2439, radius: 500 },
      'ap-southeast-1': { lat: 1.2905, lon: 103.8520, radius: 500 }
    };
    
    const regionInfo = regions[region];
    if (!regionInfo) return [];
    
    return Array.from(this.nodes.values()).filter(node => {
      const distance = this.geoDistance(node.location, regionInfo);
      return distance <= regionInfo.radius;
    });
  }
  
  private startHealthChecks(): void {
    setInterval(() => {
      for (const [nodeId, node] of this.nodes.entries()) {
        // Simulate health check
        const isHealthy = Math.random() > 0.01; // 99% healthy
        
        const breaker = this.circuitBreakers.get(nodeId)!;
        if (!isHealthy) {
          breaker.recordFailure();
        } else {
          breaker.recordSuccess();
        }
        
        // Update load based on health
        if (breaker.isOpen()) {
          node.load = node.capacity; // Mark as full if circuit is open
        } else {
          node.load = Math.random() * node.capacity * 0.8; // Simulate load
        }
      }
    }, this.config.healthCheckInterval);
  }
}

class CircuitBreaker {
  private failures = 0;
  private successes = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private lastFailureTime = 0;
  
  constructor(private config: {
    threshold: number;
    timeout: number;
    resetTime: number;
  }) {}
  
  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures / (this.failures + this.successes) > this.config.threshold) {
      this.state = 'open';
      setTimeout(() => {
        this.state = 'half-open';
      }, this.config.timeout);
    }
  }
  
  recordSuccess(): void {
    this.successes++;
    
    if (this.state === 'half-open' && this.successes > 5) {
      this.state = 'closed';
      this.reset();
    }
  }
  
  isOpen(): boolean {
    return this.state === 'open';
  }
  
  private reset(): void {
    this.failures = 0;
    this.successes = 0;
  }
}
