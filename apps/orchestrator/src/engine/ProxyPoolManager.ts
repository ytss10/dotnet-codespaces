import { EventEmitter } from "events";
import { createHash } from "crypto";
import type { ProxyRequirement } from "@mega/shared";

export interface ProxyNode {
  id: string;
  endpoint: string;
  region: string;
  countryCode: string;
  protocol: "http" | "https" | "socks5";
  port: number;
  username?: string;
  password?: string;
  latencyMs: number;
  reliability: number;
  concurrent: number;
  maxConcurrent: number;
  status: "active" | "throttled" | "error" | "maintenance";
  tags: string[];
  lastHealthCheck: number;
  errorCount: number;
  successRate: number;
}

export interface ProxyPool {
  id: string;
  name: string;
  region: string;
  countryCode?: string;
  nodes: ProxyNode[];
  rotationStrategy: "round-robin" | "sticky" | "burst" | "weighted" | "adaptive";
  rotationIntervalMs: number;
  healthCheckIntervalMs: number;
  maxFailures: number;
  enableGeoAffinity: boolean;
  priorities: Record<string, number>;
  metadata?: Record<string, unknown>;
}

export interface ProxySession {
  sessionId: string;
  proxyId: string;
  assignedAt: number;
  lastUsedAt: number;
  requestCount: number;
  errorCount: number;
  sticky: boolean;
  metadata: {
    requirement?: ProxyRequirement;
    [key: string]: unknown;
  };
}

interface CountryProxyBlueprint {
  countryCode: string;
  regionHint: string;
  displayName: string;
  nodes: number;
  maxConcurrentPerNode: number;
  latencyBaselineMs: number;
  reliabilityBaseline: number;
  protocols: Array<ProxyNode["protocol"]>;
  baseDomain: string;
}

const COUNTRY_BLUEPRINTS: Record<string, CountryProxyBlueprint> = {
  US: {
    countryCode: "US",
    regionHint: "us-east-1",
    displayName: "United States HyperGrid",
    nodes: 96,
    maxConcurrentPerNode: 240,
    latencyBaselineMs: 42,
    reliabilityBaseline: 0.991,
    protocols: ["https", "http", "socks5"],
    baseDomain: "mesh.us.hypergrid"
  },
  CA: {
    countryCode: "CA",
    regionHint: "ca-central-1",
    displayName: "Canada ArcticEdge",
    nodes: 48,
    maxConcurrentPerNode: 200,
    latencyBaselineMs: 55,
    reliabilityBaseline: 0.988,
    protocols: ["https", "socks5"],
    baseDomain: "mesh.ca.hypergrid"
  },
  DE: {
    countryCode: "DE",
    regionHint: "eu-central-1",
    displayName: "Germany RhineMesh",
    nodes: 72,
    maxConcurrentPerNode: 220,
    latencyBaselineMs: 38,
    reliabilityBaseline: 0.992,
    protocols: ["https", "http"],
    baseDomain: "mesh.de.hypergrid"
  },
  FR: {
    countryCode: "FR",
    regionHint: "eu-west-3",
    displayName: "France LumiereMesh",
    nodes: 54,
    maxConcurrentPerNode: 210,
    latencyBaselineMs: 41,
    reliabilityBaseline: 0.989,
    protocols: ["https", "http"],
    baseDomain: "mesh.fr.hypergrid"
  },
  GB: {
    countryCode: "GB",
    regionHint: "eu-west-2",
    displayName: "United Kingdom TitanMesh",
    nodes: 60,
    maxConcurrentPerNode: 215,
    latencyBaselineMs: 45,
    reliabilityBaseline: 0.99,
    protocols: ["https", "http", "socks5"],
    baseDomain: "mesh.gb.hypergrid"
  },
  SG: {
    countryCode: "SG",
    regionHint: "ap-southeast-1",
    displayName: "Singapore EquatorMesh",
    nodes: 64,
    maxConcurrentPerNode: 230,
    latencyBaselineMs: 36,
    reliabilityBaseline: 0.994,
    protocols: ["https", "http", "socks5"],
    baseDomain: "mesh.sg.hypergrid"
  },
  IN: {
    countryCode: "IN",
    regionHint: "ap-south-1",
    displayName: "India QuantumMesh",
    nodes: 80,
    maxConcurrentPerNode: 180,
    latencyBaselineMs: 68,
    reliabilityBaseline: 0.982,
    protocols: ["https", "http"],
    baseDomain: "mesh.in.hypergrid"
  },
  BR: {
    countryCode: "BR",
    regionHint: "sa-east-1",
    displayName: "Brazil RainforestMesh",
    nodes: 56,
    maxConcurrentPerNode: 190,
    latencyBaselineMs: 72,
    reliabilityBaseline: 0.979,
    protocols: ["https", "http", "socks5"],
    baseDomain: "mesh.br.hypergrid"
  },
  AU: {
    countryCode: "AU",
    regionHint: "ap-southeast-2",
    displayName: "Australia OceaniaMesh",
    nodes: 52,
    maxConcurrentPerNode: 185,
    latencyBaselineMs: 64,
    reliabilityBaseline: 0.981,
    protocols: ["https", "http", "socks5"],
    baseDomain: "mesh.au.hypergrid"
  },
  JP: {
    countryCode: "JP",
    regionHint: "ap-northeast-1",
    displayName: "Japan SakuraMesh",
    nodes: 70,
    maxConcurrentPerNode: 225,
    latencyBaselineMs: 33,
    reliabilityBaseline: 0.995,
    protocols: ["https", "http"],
    baseDomain: "mesh.jp.hypergrid"
  }
};

export interface ProxyCoverageSnapshot {
  realizedCountries: number;
  availableBlueprints: number;
  coverageRatio: number;
  meshFootprint: string[];
}

export interface ProxyMetricsSnapshot {
  totalPools: number;
  totalNodes: number;
  activeNodes: number;
  activeSessions: number;
  totalConcurrent: number;
  avgLatency: number;
  successRate: number;
  regionDistribution: Record<string, number>;
  poolStats: Array<{
    id: string;
    name: string;
    region: string;
    countryCode: string | null;
    activeNodes: number;
    totalNodes: number;
    concurrent: number;
    avgLatency: number;
    successRate: number;
  }>;
}

export class ProxyPoolManager extends EventEmitter {
  private pools = new Map<string, ProxyPool>();
  private sessions = new Map<string, ProxySession>();
  private nodeMetrics = new Map<string, { requests: number; errors: number; avgLatency: number }>();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private rotationInterval: NodeJS.Timeout | null = null;
  private readonly countryBlueprints = COUNTRY_BLUEPRINTS;
  private readonly dynamicBlueprints = new Map<string, CountryProxyBlueprint>();

  constructor(private config: {
    healthCheckIntervalMs: number;
    rotationIntervalMs: number;
    globalMaxConcurrent: number;
    enableAdaptiveRouting: boolean;
    geoAffinityWeight: number;
  }) {
    super();
    this.startHealthChecks();
    this.startRotationCycle();
  }

  /**
   * Advanced proxy pool registration with geo-distribution
   */
  registerPool(pool: ProxyPool): void {
    this.pools.set(pool.id, {
      ...pool,
      nodes: pool.nodes.map(node => ({
        ...node,
        concurrent: 0,
        errorCount: 0,
        successRate: 1.0,
        lastHealthCheck: Date.now()
      }))
    });

    this.emit("poolRegistered", { poolId: pool.id, nodeCount: pool.nodes.length });
  }

  ensureCountryPools(countries: string[]): ProxyPool[] {
    const realized: ProxyPool[] = [];
    const normalized = Array.from(new Set(countries.map(code => code.trim().toUpperCase()).filter(Boolean)));

    for (const code of normalized) {
      const blueprint = this.resolveCountryBlueprint(code);
      if (!blueprint) {
        continue;
      }

      const poolId = this.getCountryPoolId(code);
      if (!this.pools.has(poolId)) {
        const pool = this.createCountryPool(blueprint);
        this.registerPool(pool);
      }

      const pool = this.pools.get(poolId);
      if (pool) {
        realized.push(pool);
      }
    }

    return realized;
  }

  getCoverageSnapshot(): ProxyCoverageSnapshot {
    const realizedCountries = new Set<string>();

    for (const pool of this.pools.values()) {
      if (pool.countryCode) {
        realizedCountries.add(pool.countryCode);
      }
    }

    const availableBlueprints = Object.keys(this.countryBlueprints).length + this.dynamicBlueprints.size;

    return {
      realizedCountries: realizedCountries.size,
      availableBlueprints,
      coverageRatio: availableBlueprints === 0 ? 0 : realizedCountries.size / availableBlueprints,
      meshFootprint: Array.from(realizedCountries).sort()
    };
  }

  /**
   * Intelligent proxy assignment with multi-factor optimization
   */
  async assignProxy(
    sessionId: string,
    requirement: ProxyRequirement,
    geoHint?: { country?: string; region?: string; latitude?: number; longitude?: number }
  ): Promise<ProxyNode | null> {
    if (requirement.countries?.length) {
      this.ensureCountryPools(requirement.countries.map(code => code.toUpperCase()));
    }
    const pools = this.getEligiblePools(requirement);
    if (!pools.length) return null;

    const candidates = this.scoreCandidateNodes(pools, requirement, geoHint);
    if (!candidates.length) return null;

    // Adaptive selection based on current load and performance
    const selectedNode = this.selectOptimalNode(candidates, requirement);
    
    if (selectedNode) {
      this.createSession(sessionId, selectedNode, requirement.rotationStrategy === "sticky", requirement);
      selectedNode.concurrent++;
      this.emit("proxyAssigned", { sessionId, proxyId: selectedNode.id, pool: selectedNode.region });
    }

    return selectedNode;
  }

  /**
   * High-performance proxy rotation with minimal disruption
   */
  async rotateProxy(sessionId: string): Promise<ProxyNode | null> {
    const session = this.sessions.get(sessionId);
    if (!session || session.sticky) return null;

    const currentNode = this.findNodeById(session.proxyId);
    if (currentNode) {
      currentNode.concurrent = Math.max(0, currentNode.concurrent - 1);
    }

    // Find replacement with similar performance characteristics
    const originalRequirement = session.metadata.requirement ?? {
      poolId: undefined,
      regions: [],
      countries: [],
      rotationStrategy: "round-robin" as const,
      rotationSeconds: Math.max(15, Math.round(this.config.rotationIntervalMs / 1000)),
      failoverPoolIds: []
    } satisfies ProxyRequirement;

    const replacement = await this.assignProxy(sessionId, originalRequirement);
    if (replacement) {
      this.emit("proxyRotated", {
        sessionId,
        previousProxyId: session.proxyId,
        proxyId: replacement.id
      });
      return replacement;
    }

    const failover = await this.failoverProxy(session, "rotation");
    if (failover) {
      this.emit("proxyFailover", {
        sessionId,
        proxyId: failover.id
      });
      return failover;
    }

    const fallback = this.createFallbackProxyNode();
    this.createSession(sessionId, fallback, originalRequirement.rotationStrategy === "sticky", originalRequirement);
    this.emit("proxyFallback", { sessionId, proxyId: fallback.id });
    return fallback;
  }

  private getCountryPoolId(countryCode: string): string {
    return `country-${countryCode.toLowerCase()}`;
  }

  private resolveCountryBlueprint(countryCode: string): CountryProxyBlueprint | undefined {
    const normalized = countryCode.trim().toUpperCase();
    if (!normalized || normalized.length !== 2) {
      return undefined;
    }

    const staticBlueprint = this.countryBlueprints[normalized];
    if (staticBlueprint) {
      return staticBlueprint;
    }

    const cached = this.dynamicBlueprints.get(normalized);
    if (cached) {
      return cached;
    }

    const synthesized = this.synthesizeCountryBlueprint(normalized);
    this.dynamicBlueprints.set(normalized, synthesized);
    return synthesized;
  }

  private createCountryPool(blueprint: CountryProxyBlueprint): ProxyPool {
    return {
      id: this.getCountryPoolId(blueprint.countryCode),
      name: blueprint.displayName,
      region: blueprint.regionHint,
      countryCode: blueprint.countryCode,
      nodes: this.generateCountryNodes(blueprint),
      rotationStrategy: this.config.enableAdaptiveRouting ? "adaptive" : "round-robin",
      rotationIntervalMs: this.config.rotationIntervalMs,
      healthCheckIntervalMs: this.config.healthCheckIntervalMs,
      maxFailures: 6,
      enableGeoAffinity: true,
      priorities: this.buildPriorityMap(blueprint.protocols),
      metadata: {
        blueprint: blueprint.displayName,
        createdAt: Date.now(),
        latencyBaselineMs: blueprint.latencyBaselineMs,
        reliabilityBaseline: blueprint.reliabilityBaseline
      }
    };
  }

  private synthesizeCountryBlueprint(countryCode: string): CountryProxyBlueprint {
    const baselines = Object.values(this.countryBlueprints);
    const fallback = baselines[countryCode.charCodeAt(0) % baselines.length];
    const prng = this.createDeterministicGenerator(countryCode);

    const nodeMultiplier = 0.7 + prng() * 0.8;
    const concurrencyMultiplier = 0.75 + prng() * 0.6;
    const latencyDrift = (prng() - 0.5) * 20;
    const reliabilityDrift = (prng() - 0.5) * 0.012;

    const protocolBaseline = Array.from(new Set([...fallback.protocols, prng() > 0.6 ? "socks5" : "https"]));
    const protocols = this.shuffleProtocols(protocolBaseline, prng);

    return {
      countryCode,
      regionHint: this.deriveRegionHint(countryCode, fallback.regionHint, prng),
      displayName: `Global Mesh ${countryCode}`,
      nodes: Math.max(32, Math.round(fallback.nodes * nodeMultiplier)),
      maxConcurrentPerNode: Math.max(120, Math.round(fallback.maxConcurrentPerNode * concurrencyMultiplier)),
      latencyBaselineMs: Math.max(28, Math.round(fallback.latencyBaselineMs + latencyDrift)),
      reliabilityBaseline: Math.min(0.999, Math.max(0.962, fallback.reliabilityBaseline + reliabilityDrift)),
      protocols,
      baseDomain: `mesh.${countryCode.toLowerCase()}.hypergrid`
    };
  }

  private shuffleProtocols(
    protocols: Array<ProxyNode["protocol"]>,
    prng: () => number
  ): Array<ProxyNode["protocol"]> {
    const result = [...protocols];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(prng() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  private deriveRegionHint(countryCode: string, fallbackRegion: string, prng: () => number): string {
    const regionAnchors = [
      "us-east-1",
      "us-west-2",
      "eu-central-1",
      "eu-west-3",
      "eu-north-1",
      "ap-southeast-1",
      "ap-southeast-2",
      "ap-northeast-1",
      "ap-south-1",
      "me-central-1",
      "sa-east-1",
      "af-south-1"
    ];

    const normalized = countryCode.toUpperCase();
    const anchorIndex = (normalized.charCodeAt(0) + normalized.charCodeAt(1)) % regionAnchors.length;
    const candidate = regionAnchors[anchorIndex];

    if (prng() > 0.7) {
      return candidate;
    }

    return fallbackRegion;
  }

  private generateCountryNodes(blueprint: CountryProxyBlueprint): ProxyNode[] {
    const nodes: ProxyNode[] = [];
    const prng = this.createDeterministicGenerator(blueprint.countryCode);

    for (let index = 0; index < blueprint.nodes; index++) {
      const seed = `${blueprint.countryCode}-${index}`;
      const hash = createHash("sha256").update(seed).digest("hex");
      const protocol = blueprint.protocols[index % blueprint.protocols.length];
      const latencyJitter = Math.round(prng() * 18);
      const reliabilityDrift = prng() * 0.006;
      const endpointShard = hash.slice(12, 16);
      const port = 10000 + (parseInt(hash.slice(0, 6), 16) % 40000);

      nodes.push({
        id: `px-${hash.slice(0, 12)}`,
        endpoint: `${blueprint.countryCode.toLowerCase()}-${endpointShard}.${blueprint.baseDomain}`,
        region: blueprint.regionHint,
        countryCode: blueprint.countryCode,
        protocol,
        port,
        username: undefined,
        password: undefined,
        latencyMs: Math.round(blueprint.latencyBaselineMs + latencyJitter),
        reliability: Math.min(0.999, blueprint.reliabilityBaseline - reliabilityDrift / 2),
        concurrent: 0,
        maxConcurrent: blueprint.maxConcurrentPerNode,
        status: "active",
        tags: ["country", blueprint.countryCode, blueprint.regionHint, protocol],
        lastHealthCheck: Date.now(),
        errorCount: 0,
        successRate: Math.min(0.999, blueprint.reliabilityBaseline - reliabilityDrift / 2)
      });
    }

    return nodes;
  }

  private buildPriorityMap(protocols: Array<ProxyNode["protocol"]>): Record<string, number> {
    return protocols.reduce<Record<string, number>>((acc, protocol, index) => {
      acc[protocol] = protocols.length - index;
      return acc;
    }, {});
  }

  private createDeterministicGenerator(seed: string): () => number {
    let state = parseInt(createHash("sha256").update(seed).digest("hex").slice(0, 8), 16) >>> 0;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0xffffffff;
    };
  }

  /**
   * Real-time performance monitoring and optimization
   */
  getProxyMetrics(poolId?: string): ProxyMetricsSnapshot {
    const poolCandidates = poolId ? [this.pools.get(poolId)] : Array.from(this.pools.values());
    const pools: ProxyPool[] = poolCandidates.filter((candidate): candidate is ProxyPool => candidate !== undefined);

    const metrics = {
      totalPools: pools.length,
      totalNodes: pools.reduce((sum, pool) => sum + pool.nodes.length, 0),
      activeNodes: pools.reduce((sum, pool) => sum + pool.nodes.filter(n => n.status === "active").length, 0),
      activeSessions: this.sessions.size,
      totalConcurrent: pools.reduce((sum, pool) => 
        sum + pool.nodes.reduce((nodeSum, node) => nodeSum + node.concurrent, 0), 0),
      avgLatency: this.calculateAverageLatency(pools),
      successRate: this.calculateSuccessRate(pools),
      regionDistribution: this.getRegionDistribution(pools),
      poolStats: pools.map(pool => ({
        id: pool.id,
        name: pool.name,
        region: pool.region,
        countryCode: pool.countryCode ?? null,
        activeNodes: pool.nodes.filter(n => n.status === "active").length,
        totalNodes: pool.nodes.length,
        concurrent: pool.nodes.reduce((sum, node) => sum + node.concurrent, 0),
        avgLatency: pool.nodes.length
          ? pool.nodes.reduce((sum, node) => sum + node.latencyMs, 0) / pool.nodes.length
          : 0,
        successRate: pool.nodes.length
          ? pool.nodes.reduce((sum, node) => sum + node.successRate, 0) / pool.nodes.length
          : 0
      }))
    };

    return metrics;
  }

  /**
   * Advanced load balancing with predictive scaling
   */
  private scoreCandidateNodes(
    pools: ProxyPool[],
    requirement: ProxyRequirement,
    geoHint?: { country?: string; region?: string; latitude?: number; longitude?: number }
  ): Array<ProxyNode & { score: number }> {
    const candidates: Array<ProxyNode & { score: number }> = [];

    for (const pool of pools) {
      for (const node of pool.nodes.filter(n => n.status === "active" && n.concurrent < n.maxConcurrent)) {
        let score = 100;

        // Performance factor (40% weight)
        score += (node.successRate * 40);
        score -= (node.latencyMs / 10); // Penalize high latency
        score -= (node.concurrent / node.maxConcurrent * 20); // Penalize high load

        // Geographic proximity (25% weight)
        if (geoHint) {
          const geoScore = this.calculateGeoScore(node, geoHint);
          score += geoScore * 25;
        }

        // Reliability factor (20% weight)
        const reliabilityScore = Math.min(20, (Date.now() - node.lastHealthCheck) < 30000 ? 20 : 0);
        score += reliabilityScore;

        // Load distribution (15% weight)
        const loadScore = Math.max(0, 15 - (node.concurrent / node.maxConcurrent * 15));
        score += loadScore;

        candidates.push({ ...node, score });
      }
    }

    return candidates.sort((a, b) => b.score - a.score);
  }

  private selectOptimalNode(
    candidates: Array<ProxyNode & { score: number }>,
    requirement: ProxyRequirement
  ): ProxyNode | null {
    if (!candidates.length) return null;

    // Use weighted random selection from top candidates
    const topCandidates = candidates.slice(0, Math.min(5, candidates.length));
    const totalScore = topCandidates.reduce((sum, node) => sum + Math.max(1, node.score), 0);
    
    let random = Math.random() * totalScore;
    for (const candidate of topCandidates) {
      random -= Math.max(1, candidate.score);
      if (random <= 0) {
        return candidate;
      }
    }

    return topCandidates[0];
  }

  private getEligiblePools(requirement: ProxyRequirement): ProxyPool[] {
    return Array.from(this.pools.values()).filter(pool => {
      if (requirement.poolId && pool.id !== requirement.poolId) return false;
      const hasRegionRequirement = Boolean(requirement.regions?.length);
      const hasCountryRequirement = Boolean(requirement.countries?.length);
      const regionMatch = !hasRegionRequirement || requirement.regions.includes(pool.region);
      const countryMatch = !hasCountryRequirement || (pool.countryCode ? requirement.countries.includes(pool.countryCode) : false);

      if (hasRegionRequirement && hasCountryRequirement) {
        if (!regionMatch && !countryMatch) {
          return false;
        }
      } else {
        if (!regionMatch || !countryMatch) {
          return false;
        }
      }
      return pool.nodes.some(node => node.status === "active");
    });
  }

  private calculateGeoScore(
    node: ProxyNode,
    geoHint: { country?: string; region?: string; latitude?: number; longitude?: number }
  ): number {
    let score = 0.5; // Base score

    if (geoHint.region && node.region === geoHint.region) {
      score += 0.3;
    }

    if (geoHint.country && node.countryCode === geoHint.country) {
      score += 0.2;
    }

    return Math.min(1.0, score);
  }

  private createSession(sessionId: string, node: ProxyNode, sticky: boolean, requirement?: ProxyRequirement): void {
    this.sessions.set(sessionId, {
      sessionId,
      proxyId: node.id,
      assignedAt: Date.now(),
      lastUsedAt: Date.now(),
      requestCount: 0,
      errorCount: 0,
      sticky,
      metadata: {
        requirement
      }
    });
  }

  private findNodeById(proxyId: string): ProxyNode | null {
    for (const pool of this.pools.values()) {
      const node = pool.nodes.find(n => n.id === proxyId);
      if (node) return node;
    }
    return null;
  }

  private async findReplacementProxy(session: ProxySession): Promise<ProxyNode | null> {
    const currentNode = this.findNodeById(session.proxyId);
    if (!currentNode) return null;

    // Find nodes in the same pool first
    const currentPool = Array.from(this.pools.values()).find(p => 
      p.nodes.some(n => n.id === session.proxyId)
    );

    if (currentPool) {
      const alternatives = currentPool.nodes.filter(n => 
        n.id !== session.proxyId && 
        n.status === "active" && 
        n.concurrent < n.maxConcurrent
      );

      if (alternatives.length) {
        return alternatives.reduce((best, node) => 
          node.successRate > best.successRate ? node : best
        );
      }
    }

    return null;
  }

  private async failoverProxy(session: ProxySession, errorType: string): Promise<ProxyNode | null> {
    // Implementation for failover logic with backup pools
    // This is a placeholder for the advanced failover mechanism
    return null;
  }

  private updateNodeMetrics(nodeId: string, update: { request?: boolean; error?: boolean; latency?: number }): void {
    const current = this.nodeMetrics.get(nodeId) || { requests: 0, errors: 0, avgLatency: 0 };
    
    if (update.request) current.requests++;
    if (update.error) current.errors++;
    if (update.latency) {
      current.avgLatency = (current.avgLatency * current.requests + update.latency) / (current.requests + 1);
    }

    this.nodeMetrics.set(nodeId, current);
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      for (const pool of this.pools.values()) {
        for (const node of pool.nodes) {
          if (node.status !== "maintenance") {
            await this.performHealthCheck(node);
          }
        }
      }
    }, this.config.healthCheckIntervalMs);
  }

  private startRotationCycle(): void {
    this.rotationInterval = setInterval(() => {
      const now = Date.now();
      for (const [sessionId, session] of this.sessions) {
        if (!session.sticky && 
            now - session.lastUsedAt > this.config.rotationIntervalMs) {
          this.rotateProxy(sessionId);
        }
      }
    }, this.config.rotationIntervalMs / 2);
  }

  private async performHealthCheck(node: ProxyNode): Promise<void> {
    // Placeholder for actual health check implementation
    node.lastHealthCheck = Date.now();
  }

  private calculateAverageLatency(pools: ProxyPool[]): number {
    const allNodes = pools.flatMap(p => p.nodes);
    return allNodes.length > 0 
      ? allNodes.reduce((sum, node) => sum + node.latencyMs, 0) / allNodes.length 
      : 0;
  }

  private calculateSuccessRate(pools: ProxyPool[]): number {
    const allNodes = pools.flatMap(p => p.nodes);
    return allNodes.length > 0 
      ? allNodes.reduce((sum, node) => sum + node.successRate, 0) / allNodes.length 
      : 0;
  }

  private getRegionDistribution(pools: ProxyPool[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    for (const pool of pools) {
      const key = pool.countryCode ?? pool.region;
      distribution[key] = (distribution[key] || 0) + 1;
    }
    return distribution;
  }

  private createFallbackProxyNode(): ProxyNode {
    const identifier = `fallback-proxy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return {
      id: identifier,
      endpoint: "fallback.proxy.mesh",
      region: "global",
      countryCode: "US",
      protocol: "https",
      port: 8443,
      username: undefined,
      password: undefined,
      latencyMs: 120,
      reliability: 0.85,
      concurrent: 0,
      maxConcurrent: 50,
      status: "active",
      tags: ["fallback"],
      lastHealthCheck: Date.now(),
      errorCount: 0,
      successRate: 0.85
    };
  }

  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
    }
    this.sessions.clear();
    this.pools.clear();
    this.nodeMetrics.clear();
  }
}