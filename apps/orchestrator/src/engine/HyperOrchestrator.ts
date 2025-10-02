import { v4 as uuid } from "uuid";
import type {
  SessionBlueprint,
  SessionDefinition,
  ReplicaShard,
  MetricsSnapshot
} from "@mega/shared";
import { ReplicaTopologyPlanner } from "./ReplicaTopologyPlanner.js";
import type { ReplicaSampleOptions } from "./ReplicaTopologyPlanner.js";
import { ProxyPoolManager } from "./ProxyPoolManager.js";
import type { ProxyNode, ProxyPool, ProxyMetricsSnapshot } from "./ProxyPoolManager.js";
import { HypermediaSessionEngine } from "./HypermediaSessionEngine.js";
import type { HypermediaSession } from "./HypermediaSessionEngine.js";
import { SessionHypergridSynthesizer, type HypergridSnapshot } from "./SessionHypergridSynthesizer.js";
import { SyntheticContentFactory, type SyntheticFallbackStrategy } from "./SyntheticContentFactory.js";

interface BlueprintIndexes {
  regions: Map<string, ReplicaShard>;
  proxies: Set<string>;
}

interface AdvancedEmbedRequest {
  urls: string[];
  bulkOptions?: {
    batchSize: number;
    parallelProcessing: boolean;
    fallbackStrategy: SyntheticFallbackStrategy;
  };
  proxyRequirements?: {
    enableGlobalRotation: boolean;
    preferredRegions: string[];
    preferredCountries?: string[];
    maxConcurrentPerProxy: number;
  };
  renderingOptions?: {
    engine: "hypermedia-virtual" | "chromium-headless" | "webgpu";
    viewport: { width: number; height: number };
    enableOptimizations: boolean;
  };
}

export class HyperOrchestrator {
  private planner = new ReplicaTopologyPlanner();
  private proxyManager: ProxyPoolManager;
  private sessionEngine: HypermediaSessionEngine;

  private blueprints = new Map<string, SessionBlueprint>();
  private hypermediaSessions = new Map<string, HypermediaSession>();
  private metrics = new Map<string, MetricsSnapshot>();
  private indexes = new Map<string, BlueprintIndexes>();
  private globalProxyPools = new Map<string, ProxyPool>();
  private hypergridSynthesizer = new SessionHypergridSynthesizer();
  private hypergridCache: { snapshot: HypergridSnapshot; computedAt: number } | null = null;
  private contentFactory = new SyntheticContentFactory({ baseHost: "https://synthetic.mega.local" });
  
  constructor() {
    this.proxyManager = new ProxyPoolManager({
      healthCheckIntervalMs: 30000,
      rotationIntervalMs: 60000,
      globalMaxConcurrent: 100000,
      enableAdaptiveRouting: true,
      geoAffinityWeight: 0.3
    });

    this.sessionEngine = new HypermediaSessionEngine({
      maxConcurrentSessions: 1000000,
      memoryLimitMB: 1024 * 1024, // 1TB
      virtualDomUpdateIntervalMs: 1000,
      metricsCollectionIntervalMs: 2000,
      resourceCacheMaxSize: 10000,
      enableAdvancedOptimizations: true
    }, this.contentFactory);

    this.initializeGlobalProxyPools();
  }

  listBlueprints() {
    return Array.from(this.blueprints.values()).sort((a, b) =>
      a.definition.target.label.localeCompare(b.definition.target.label)
    );
  }

  getBlueprint(sessionId: string) {
    return this.blueprints.get(sessionId);
  }

  upsert(definition: SessionDefinition): SessionBlueprint {
    const now = Date.now();
    const sessionId = definition.target.id ?? uuid();

    const normalizedDefinition: SessionDefinition = {
      ...definition,
      target: {
        ...definition.target,
        id: sessionId
      },
      shards: this.planner.ensureShardTopology({
        ...definition,
        target: {
          ...definition.target,
          id: sessionId
        }
      })
    };

    const existing = this.blueprints.get(sessionId);
    const version = existing ? existing.version + 1 : 1;
    const status = this.deriveStatus(existing, normalizedDefinition);

    const blueprint: SessionBlueprint = {
      id: sessionId,
      definition: normalizedDefinition,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      version,
      status,
      metricsTtlMs: existing?.metricsTtlMs ?? this.deriveMetricsTtl(normalizedDefinition)
    };

    this.blueprints.set(sessionId, blueprint);
    this.indexes.set(sessionId, this.buildIndexes(blueprint));
    this.invalidateHypergridCache();
    return blueprint;
  }

  delete(sessionId: string) {
    this.indexes.delete(sessionId);
    this.metrics.delete(sessionId);
    const deleted = this.blueprints.delete(sessionId);
    if (deleted) {
      this.invalidateHypergridCache();
    }
    return deleted;
  }

  getReplicaSample(sessionId: string, options: ReplicaSampleOptions = {}) {
    const blueprint = this.blueprints.get(sessionId);
    if (!blueprint) {
      return [];
    }

    return this.planner.sampleReplicas(blueprint, options);
  }

  getMetrics(sessionId: string) {
    const now = Date.now();
    const blueprint = this.blueprints.get(sessionId);
    if (!blueprint) {
      return undefined;
    }

    const cached = this.metrics.get(sessionId);
    if (cached && now - cached.timestamp < blueprint.metricsTtlMs) {
      return cached;
    }

    const nextSnapshot = this.planner.synthesizeMetrics(blueprint, cached);
    this.metrics.set(sessionId, nextSnapshot);
    return nextSnapshot;
  }

  bulkUpsert(definitions: SessionDefinition[]) {
    const successes: Array<{ blueprint: SessionBlueprint; isNew: boolean }> = [];
    const failures: Array<{ definition: SessionDefinition; error: Error }> = [];

    for (const definition of definitions) {
      try {
        const existing = definition.target.id ? this.blueprints.get(definition.target.id) : undefined;
        const blueprint = this.upsert(definition);
        const isNew = !existing && blueprint.version === 1;
        successes.push({ blueprint, isNew });
      } catch (error) {
        failures.push({ definition, error: error as Error });
      }
    }

    if (successes.length) {
      this.invalidateHypergridCache();
    }

    return { successes, failures };
  }

  /**
   * Advanced bulk embedding for millions of websites
   */
  async createBulkEmbeds(request: AdvancedEmbedRequest): Promise<{
    successful: SessionBlueprint[];
    failed: Array<{ url: string; error: Error }>;
    totalProcessed: number;
    avgProcessingTimeMs: number;
  }> {
    const startTime = Date.now();
    const successful: SessionBlueprint[] = [];
    const failed: Array<{ url: string; error: Error }> = [];
    const preferredCountries = (request.proxyRequirements?.preferredCountries ?? []).map(code => code.toUpperCase());
    const fallbackStrategy = request.bulkOptions?.fallbackStrategy ?? "synthesize";

    if (preferredCountries.length) {
      const realizedPools = this.proxyManager.ensureCountryPools(preferredCountries);
      for (const pool of realizedPools) {
        this.globalProxyPools.set(pool.id, pool);
      }
    }
    
    // Process URLs in batches for optimal performance
    const batchSize = request.bulkOptions?.batchSize || 100;
    const processedUrls = await this.sessionEngine.processBulkUrls(request.urls, fallbackStrategy);
    const validEntries = processedUrls.filter(item => item.valid && item.processed);

    for (const rejected of processedUrls.filter(item => !item.valid || !item.processed)) {
      failed.push({
        url: rejected.original,
        error: new Error(`Rejected input via ${fallbackStrategy} fallback`)
      });
    }
    for (let i = 0; i < validEntries.length; i += batchSize) {
      const batch = validEntries.slice(i, i + batchSize);
      
      try {
        const definitions = await this.createSessionDefinitions(batch, request);
        const proxyNodes = await this.assignProxiesForBatch(definitions, request.proxyRequirements);
        
        const sessionResults = await this.sessionEngine.createBulkSessions(definitions, proxyNodes);
        
        // Convert successful sessions to blueprints
        for (const session of sessionResults.successful) {
          const blueprint = this.convertSessionToBlueprint(session);
          successful.push(blueprint);
          this.blueprints.set(blueprint.id, blueprint);
          this.hypermediaSessions.set(session.id, session);
        }
        
        // Add failed sessions to failures
        failed.push(...sessionResults.failed.map(f => ({ url: f.definition.target.url, error: f.error })));
        
      } catch (error) {
        // If entire batch fails, mark all URLs in batch as failed
        batch.forEach(urlData => {
          failed.push({ url: urlData.original, error: error as Error });
        });
      }
      
      // Yield control between batches
      if (i + batchSize < validEntries.length) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }
    
    const processingTime = Date.now() - startTime;
    const avgProcessingTime = processingTime / Math.max(1, processedUrls.length);

    if (successful.length) {
      this.invalidateHypergridCache();
    }
    
    return {
      successful,
      failed,
      totalProcessed: processedUrls.length,
      avgProcessingTimeMs: avgProcessingTime
    };
  }

  async processBulkUrls(urls: string[], fallbackStrategy: SyntheticFallbackStrategy = "synthesize") {
    return this.sessionEngine.processBulkUrls(urls, fallbackStrategy);
  }

  /**
   * Real-time proxy pool management
   */
  registerProxyPool(pool: ProxyPool): void {
    this.globalProxyPools.set(pool.id, pool);
    this.proxyManager.registerPool(pool);
  }

  /**
   * Advanced session scaling for millions of concurrent sessions
   */
  async scaleToMillion(targetSessions: number): Promise<{
    currentSessions: number;
    targetReached: boolean;
    scalingTimeMs: number;
    resourceUtilization: Record<string, number>;
    createdSessionIds: string[];
    failedSessionCount: number;
  }> {
    const startTime = Date.now();
    const currentSessions = this.hypermediaSessions.size;
    
    if (targetSessions <= currentSessions) {
      return {
        currentSessions,
        targetReached: true,
        scalingTimeMs: 0,
        resourceUtilization: this.getResourceUtilization(),
        createdSessionIds: [],
        failedSessionCount: 0
      };
    }
    
    const sessionsToCreate = targetSessions - currentSessions;
    const batchSize = Math.min(1000, Math.max(50, Math.ceil(sessionsToCreate / 100))); // Adaptive batch sizing
    
    // Generate deterministic synthetic sessions for scaling
    const syntheticBatch = this.contentFactory.generateBatch(sessionsToCreate, {
      label: "million-scale",
      tags: ["auto-scale", "synthetic"],
      seed: `scale-${Date.now()}`
    });
    const defaultUrls = syntheticBatch.map(item => item.url);
    
    try {
      const result = await this.createBulkEmbeds({
        urls: defaultUrls,
        bulkOptions: {
          batchSize,
          parallelProcessing: true,
          fallbackStrategy: "synthesize"
        },
        renderingOptions: {
          engine: "hypermedia-virtual",
          viewport: { width: 1280, height: 720 },
          enableOptimizations: true
        }
      });
      
      const scalingTime = Date.now() - startTime;
      const finalSessions = this.hypermediaSessions.size;
      
      return {
        currentSessions: finalSessions,
        targetReached: finalSessions >= targetSessions * 0.95, // 95% success rate acceptable
        scalingTimeMs: scalingTime,
        resourceUtilization: this.getResourceUtilization(),
        createdSessionIds: result.successful.map(bp => bp.id),
        failedSessionCount: result.failed.length
      };
      
    } catch (error) {
      console.error("Failed to scale to target sessions:", error);
      return {
        currentSessions,
        targetReached: false,
        scalingTimeMs: Date.now() - startTime,
        resourceUtilization: this.getResourceUtilization(),
        createdSessionIds: [],
        failedSessionCount: sessionsToCreate
      };
    }
  }

  /**
   * Advanced metrics aggregation across millions of sessions
   */
  getGlobalMetrics(): {
    totalSessions: number;
    activeSessions: number;
    totalProxyPools: number;
    activeProxyNodes: number;
    systemPerformance: Record<string, number>;
    topRegions: Array<{ region: string; sessions: number; performance: number }>;
    alertsAndWarnings: string[];
  } {
  const systemMetrics = this.sessionEngine.getSystemMetrics();
  const proxyMetrics: ProxyMetricsSnapshot = this.proxyManager.getProxyMetrics();
    const alerts: string[] = [];
    
    // Generate alerts based on system state
    if (systemMetrics.errorRate > 0.05) {
      alerts.push(`High error rate detected: ${(systemMetrics.errorRate * 100).toFixed(1)}%`);
    }
    
    if (systemMetrics.averageLatencyMs > 1000) {
      alerts.push(`High latency detected: ${systemMetrics.averageLatencyMs.toFixed(0)}ms`);
    }
    
    // Calculate top performing regions
    const regionPerformance = new Map<string, { sessions: number; totalLatency: number }>();
    
    for (const [_, session] of this.hypermediaSessions) {
      const region = session.renderEngine.region;
      const current = regionPerformance.get(region) || { sessions: 0, totalLatency: 0 };
      current.sessions++;
      current.totalLatency += session.metrics.averageLatencyMs;
      regionPerformance.set(region, current);
    }
    
    const topRegions = Array.from(regionPerformance.entries())
      .map(([region, data]) => ({
        region,
        sessions: data.sessions,
        performance: data.sessions > 0 ? data.totalLatency / data.sessions : 0
      }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 10);
    
    return {
      totalSessions: systemMetrics.totalSessions,
      activeSessions: systemMetrics.activeSessions,
  totalProxyPools: this.globalProxyPools.size,
  activeProxyNodes: proxyMetrics.activeNodes,
      systemPerformance: {
        memoryUsageMB: systemMetrics.totalMemoryUsageMB,
        cpuUsage: systemMetrics.totalCpuUsage,
        requestsPerSecond: systemMetrics.requestsPerSecond,
        averageLatency: systemMetrics.averageLatencyMs,
        errorRate: systemMetrics.errorRate
      },
      topRegions,
      alertsAndWarnings: alerts
    };
  }

  getHypergridSnapshot(ttlMs = 2500): HypergridSnapshot {
    const now = Date.now();
    if (this.hypergridCache && now - this.hypergridCache.computedAt < ttlMs) {
      return this.hypergridCache.snapshot;
    }

    const snapshot = this.hypergridSynthesizer.computeSnapshot({
      blueprints: this.blueprints.values(),
      metrics: this.metrics,
      coverage: this.proxyManager.getCoverageSnapshot()
    });

    this.hypergridCache = { snapshot, computedAt: now };
    return snapshot;
  }

  async scaleSession(sessionId: string, targetReplicaCount: number): Promise<boolean> {
    const scaled = await this.sessionEngine.scaleSession(sessionId, targetReplicaCount);
    if (!scaled) {
      return false;
    }

    const blueprint = this.blueprints.get(sessionId);
    if (blueprint) {
      const nextDefinition: SessionDefinition = {
        ...blueprint.definition,
        policy: {
          ...blueprint.definition.policy,
          targetReplicaCount
        }
      };
      this.upsert(nextDefinition);
    }

    return true;
  }

  async terminateSession(sessionId: string): Promise<boolean> {
    const terminated = await this.sessionEngine.terminateSession(sessionId);
    if (terminated) {
      this.delete(sessionId);
    }
    return terminated;
  }

  getBlueprintSnapshot(): SessionBlueprint[] {
    return this.listBlueprints();
  }

  getRealtimeMetrics(sessionId: string) {
    return this.sessionEngine.getSessionMetrics(sessionId);
  }

  getBlueprintIndexes(sessionId: string) {
    return this.indexes.get(sessionId);
  }

  private deriveStatus(existing: SessionBlueprint | undefined, definition: SessionDefinition) {
    if (!existing) {
      return definition.policy.targetReplicaCount > 10000 ? "scaling" : "steady";
    }

    if (definition.policy.targetReplicaCount > existing.definition.policy.targetReplicaCount * 1.4) {
      return "scaling";
    }

    if (definition.policy.targetReplicaCount < existing.definition.policy.targetReplicaCount * 0.6) {
      return "degraded";
    }

    return existing.status;
  }

  private deriveMetricsTtl(definition: SessionDefinition) {
    const base = definition.policy.sampleRate > 0.01 ? 2500 : 4500;
    const latencyBias = Math.max(definition.target.network.latencyMs / 2, 400);
    return Math.round(base + latencyBias);
  }

  private invalidateHypergridCache() {
    this.hypergridCache = null;
  }

  private buildIndexes(blueprint: SessionBlueprint): BlueprintIndexes {
    const regions = new Map<string, ReplicaShard>();
    const proxies = new Set<string>();

    for (const shard of blueprint.definition.shards) {
      regions.set(shard.region, shard);
      if (shard.proxyPoolId) {
        proxies.add(shard.proxyPoolId);
      }
    }

    return { regions, proxies };
  }

  private initializeGlobalProxyPools(): void {
    const bootstrapCountries = ["US", "DE", "SG", "IN", "BR", "JP", "AU"];
    const realized = this.proxyManager.ensureCountryPools(bootstrapCountries);

    for (const pool of realized) {
      this.globalProxyPools.set(pool.id, pool);
    }
  }

  private async createSessionDefinitions(
    urlBatch: Array<{ original: string; processed: string; valid: boolean; synthetic: boolean; imprint?: string }>,
    request: AdvancedEmbedRequest
  ): Promise<SessionDefinition[]> {
    return urlBatch.map((urlData, index) => {
      const sessionId = uuid();
      const viewport = request.renderingOptions?.viewport;
      const normalizedViewport = viewport
        ? { width: viewport.width, height: viewport.height, deviceScaleFactor: 1 }
        : { width: 1280, height: 720, deviceScaleFactor: 1 };
      const renderingEngine = request.renderingOptions?.engine ?? "chromium-headless";
      const preferredRegions = request.proxyRequirements?.preferredRegions ?? [];
      const preferredCountries = (request.proxyRequirements?.preferredCountries ?? []).map(code => code.toUpperCase());

      const definition: SessionDefinition = {
        target: {
          id: sessionId,
          label: `Embed ${index + 1}`,
          url: urlData.processed,
          headers: {
            "User-Agent": "MegaEmbedSuite/1.0 (Advanced Hypermedia Engine)"
          },
          scriptInjections: [],
          rendering: {
            engine: renderingEngine,
            concurrencyClass: "massive",
            viewport: normalizedViewport,
            navigationTimeoutMs: 30000,
            scriptTimeoutMs: 10000,
            sandbox: true,
            captureVideo: false,
            captureScreenshots: true,
            emulateMedia: "none"
          },
          network: {
            bandwidthKbps: 50000,
            latencyMs: 40,
            jitterMs: 5,
            packetLoss: 0
          },
          proxy: {
            regions: preferredRegions,
            countries: preferredCountries,
            rotationStrategy: "round-robin",
            rotationSeconds: 60,
            failoverPoolIds: []
          },
          geoAffinity: preferredCountries.length ? preferredCountries : preferredRegions
        },
        policy: {
          targetReplicaCount: 1,
          maxReplicaBurst: 10,
          sampleRate: 0.001
        },
        shards: [],
        tags: ["bulk-embed", "auto-generated", urlData.synthetic ? "synthetic" : "ingested"],
        metadata: {
          originalUrl: urlData.original,
          processedUrl: urlData.processed,
          batchId: Date.now().toString(),
          createdBy: "hypermedia-engine",
          preferredRegions,
          preferredCountries,
          synthetic: urlData.synthetic,
          syntheticImprint: urlData.imprint
        }
      };

      return definition;
    });
  }

  private async assignProxiesForBatch(
    definitions: SessionDefinition[],
    _proxyRequirements?: AdvancedEmbedRequest["proxyRequirements"]
  ): Promise<ProxyNode[]> {
    const proxyNodes: ProxyNode[] = [];
    const countrySet = new Set<string>();

    for (const definition of definitions) {
      const countries = definition.target.proxy.countries ?? [];
      for (const code of countries) {
        if (typeof code === "string" && code.trim()) {
          countrySet.add(code.trim().toUpperCase());
        }
      }
    }

    if (countrySet.size) {
      const realized = this.proxyManager.ensureCountryPools(Array.from(countrySet));
      for (const pool of realized) {
        this.globalProxyPools.set(pool.id, pool);
      }
    }
    
    for (const definition of definitions) {
      try {
        const proxyNode = await this.proxyManager.assignProxy(
          definition.target.id!,
          definition.target.proxy
        );
        proxyNodes.push(proxyNode ?? this.createDefaultProxyNode());
      } catch (error) {
        console.warn(`Failed to assign proxy for session ${definition.target.id}:`, error);
        proxyNodes.push(this.createDefaultProxyNode());
      }
    }
    
    return proxyNodes;
  }

  private convertSessionToBlueprint(session: HypermediaSession): SessionBlueprint {
    const now = Date.now();
    
    return {
      id: session.id,
      definition: session.definition,
      createdAt: session.createdAt,
      updatedAt: now,
      version: 1,
      status: session.status === "active" ? "steady" : 
              session.status === "scaling" ? "scaling" : "degraded",
      metricsTtlMs: 5000
    };
  }

  private createDefaultProxyNode(): ProxyNode {
    return {
      id: `default-proxy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      endpoint: "default.proxy.mesh",
      region: "global",
      countryCode: "US",
      protocol: "https",
      port: 8443,
      latencyMs: 100,
      reliability: 0.9,
      concurrent: 0,
      maxConcurrent: 100,
      status: "active",
      tags: ["default"],
      lastHealthCheck: Date.now(),
      errorCount: 0,
      successRate: 0.9
    };
  }

  private getResourceUtilization(): Record<string, number> {
    const systemMetrics = this.sessionEngine.getSystemMetrics();
    const renderEngineUtilizationValues = Object.values(systemMetrics.renderEngineUtilization);
    const averageRenderEngineUtilization = renderEngineUtilizationValues.length
      ? renderEngineUtilizationValues.reduce((sum, util) => sum + util, 0) / renderEngineUtilizationValues.length
      : 0;
    const memoryCapacityMb = 1024 * 1024; // 1 TB expressed in MB
    
    return {
      memoryUtilization: Math.min(1, systemMetrics.totalMemoryUsageMB / memoryCapacityMb),
      cpuUtilization: Math.min(1, systemMetrics.totalCpuUsage / 100),
      networkUtilization: Math.min(1, systemMetrics.requestsPerSecond / 1_000_000),
      sessionUtilization: Math.min(1, systemMetrics.totalSessions / 1_000_000),
      renderEngineUtilization: Math.min(1, averageRenderEngineUtilization)
    };
  }

  /**
   * Clean up resources and gracefully shutdown
   */
  destroy(): void {
    this.proxyManager.destroy();
    this.sessionEngine.destroy();
    this.blueprints.clear();
    this.hypermediaSessions.clear();
    this.metrics.clear();
    this.indexes.clear();
    this.globalProxyPools.clear();
  }
}
