import { v4 as uuid } from "uuid";
import type {
  MetricsSnapshot,
  ReplicaShard,
  ReplicaStatus,
  ReplicaSummary,
  SessionBlueprint,
  SessionDefinition
} from "@mega/shared";
import { hashToUint32, mulberry32 } from "./deterministic.js";

export interface ReplicaSampleOptions {
  limit?: number;
  includeTerminated?: boolean;
}

interface RegionPlan {
  region: string;
  weight: number;
  latencyBudgetMs: number;
  warmPool: number;
  proxyPoolId?: string;
}

const DEFAULT_REGION = "global-default";

export class ReplicaTopologyPlanner {
  deriveShards(definition: SessionDefinition): ReplicaShard[] {
    const regions = this.resolveRegions(definition);
    const desiredReplicas = Math.max(definition.policy.targetReplicaCount, regions.length);
    const regionPlans = this.buildRegionPlans(definition, regions, desiredReplicas);

    const shards: ReplicaShard[] = regionPlans.map(plan => ({
      id: uuid(),
      label: `${definition.target.label}-${plan.region}`,
      region: plan.region,
      capacity: plan.weight,
      warmPool: plan.warmPool,
      proxyPoolId: plan.proxyPoolId,
      latencyBudgetMs: plan.latencyBudgetMs,
      autoscaleWindowSec: this.resolveAutoscaleWindow(definition)
    }));

    return this.normalizeCapacity(shards, desiredReplicas);
  }

  ensureShardTopology(definition: SessionDefinition): ReplicaShard[] {
    if (!definition.shards.length) {
      return this.deriveShards(definition);
    }

    const baselineLatency = Math.max(definition.target.network.latencyMs * 3, 80);
    return this.normalizeCapacity(
      definition.shards.map(shard => ({
        ...shard,
        capacity: Math.max(1, shard.capacity),
        warmPool: Math.min(Math.max(shard.warmPool ?? 0, 0), Math.max(1, Math.floor(shard.capacity * 0.25))),
        latencyBudgetMs: Math.max(40, shard.latencyBudgetMs ?? baselineLatency),
        autoscaleWindowSec: shard.autoscaleWindowSec ?? this.resolveAutoscaleWindow(definition)
      })),
      Math.max(definition.policy.targetReplicaCount, 1)
    );
  }

  sampleReplicas(blueprint: SessionBlueprint, options: ReplicaSampleOptions = {}): ReplicaSummary[] {
    const { limit = 256, includeTerminated = false } = options;
    const shards = blueprint.definition.shards.length
      ? blueprint.definition.shards
      : this.deriveShards(blueprint.definition);

    if (!shards.length) {
      return [];
    }

    const desired = Math.max(blueprint.definition.policy.targetReplicaCount, shards.length);
    const sampleSize = Math.min(Math.max(limit, 1), Math.max(desired, 1_000_000));
    const baseSeed = hashToUint32(`${blueprint.id}:${blueprint.version}`);
    const results: ReplicaSummary[] = [];

    for (let index = 0; index < sampleSize; index += 1) {
      const shard = shards[index % shards.length]!;
      const seed = hashToUint32(`${baseSeed}:${shard.id}:${index}`);
      const rng = mulberry32(seed);
      const status = this.pickStatus(rng(), includeTerminated, blueprint.status);
      const latencyVariance = 0.35 + rng() * 1.05;

      const summary: ReplicaSummary = {
        id: uuid(),
        sessionId: blueprint.id,
        status,
        region: shard.region,
        lastSeenAt: Date.now() - Math.floor(rng() * 3_600_000),
        latencyMs: Math.max(25, Math.floor(shard.latencyBudgetMs * latencyVariance))
      };

      if (shard.proxyPoolId) {
        summary.proxyId = shard.proxyPoolId;
      }

      if (status === "error") {
        summary.errorCode = this.resolveErrorCode(rng());
      }

      results.push(summary);
    }

    return results;
  }

  synthesizeMetrics(blueprint: SessionBlueprint, previous?: MetricsSnapshot): MetricsSnapshot {
    const now = Date.now();
    const shard = blueprint.definition.shards[0];
    const baseLatency = shard?.latencyBudgetMs ?? Math.max(blueprint.definition.target.network.latencyMs * 3, 120);
    const desired = Math.max(blueprint.definition.policy.targetReplicaCount, 1);
    const seed = hashToUint32(`${blueprint.id}:${Math.floor(now / 2000)}:${desired}`);
    const rng = mulberry32(seed);

    const activeEstimate = Math.floor(desired * (0.86 + rng() * 0.12));
    const errorsPerMinute = Math.floor(desired * (0.002 + rng() * 0.0025));
    const medianLatencyMs = Math.max(30, Math.floor(baseLatency * (0.72 + rng() * 0.18)));
    const bandwidthKbps = Math.floor(desired * (110 + rng() * 90));

    const smoothed = previous
      ? {
          activeReplicas: Math.round(previous.activeReplicas * 0.6 + activeEstimate * 0.4),
          errorsPerMinute: Math.round(previous.errorsPerMinute * 0.5 + errorsPerMinute * 0.5),
          medianLatencyMs: Math.round(previous.medianLatencyMs * 0.5 + medianLatencyMs * 0.5),
          bandwidthKbps: Math.round(previous.bandwidthKbps * 0.55 + bandwidthKbps * 0.45)
        }
      : {
          activeReplicas: activeEstimate,
          errorsPerMinute,
          medianLatencyMs,
          bandwidthKbps
        };

    return {
      sessionId: blueprint.id,
      timestamp: now,
      ...smoothed
    };
  }

  private resolveRegions(definition: SessionDefinition) {
    return definition.target.geoAffinity.length ? definition.target.geoAffinity : [DEFAULT_REGION];
  }

  private resolveAutoscaleWindow(definition: SessionDefinition) {
    const concurrencyBias = definition.target.rendering.concurrencyClass === "massive" ? 15 : 30;
    return Math.max(15, concurrencyBias + Math.round(definition.policy.sampleRate * 200));
  }

  private buildRegionPlans(
    definition: SessionDefinition,
    regions: string[],
    desiredReplicas: number
  ): RegionPlan[] {
    const baseLatency = Math.max(definition.target.network.latencyMs, 20);
    const proxyRegions = new Set(definition.target.proxy.regions ?? []);
    const weights: number[] = regions.map((region, index) => {
      const priorityBoost = 1 + (regions.length - index) * 0.05;
      const proxyBoost = proxyRegions.has(region) ? 0.35 : 0;
      const latencyPenalty = Math.max(0.35, 1 - baseLatency / 400);
      return Number((priorityBoost + proxyBoost) * latencyPenalty);
    });

    const totalWeight = weights.reduce((acc, value) => acc + value, 0) || regions.length;

    return regions.map((region, index) => {
      const regionalWeight = weights[index] ?? 1;
      const fractionalCapacity = (regionalWeight / totalWeight) * desiredReplicas;
      const capacity = Math.max(1, Math.floor(fractionalCapacity));
      const warmPool = Math.max(1, Math.floor(capacity * 0.08));
      const latencyBudgetMs = Math.max(
        60,
        Math.round(baseLatency * (3 + (proxyRegions.has(region) ? 0.5 : 0)))
      );

      return {
        region,
        weight: capacity,
        warmPool,
        latencyBudgetMs,
        proxyPoolId: this.resolveProxyPool(definition, region, proxyRegions)
      };
    });
  }

  private normalizeCapacity(shards: ReplicaShard[], desired: number) {
    if (!shards.length) {
      return [];
    }

    const total = shards.reduce((sum, shard) => sum + shard.capacity, 0);
    const shardsCopy = shards.map(shard => ({ ...shard }));

    if (total < desired) {
      let remaining = desired - total;
      let cursor = 0;
      while (remaining > 0) {
        const target = shardsCopy[cursor % shardsCopy.length]!;
        target.capacity += 1;
        remaining -= 1;
        cursor += 1;
      }
    } else if (total > desired) {
      let excess = total - desired;
      const sorted = shardsCopy.sort((a, b) => b.capacity - a.capacity);
      for (const shard of sorted) {
        if (excess <= 0) break;
        const reducible = Math.min(excess, Math.max(shard.capacity - 1, 0));
        shard.capacity -= reducible;
        excess -= reducible;
      }
    }

    return shardsCopy;
  }

  private resolveProxyPool(
    definition: SessionDefinition,
    region: string,
    proxyRegions: Set<string>
  ) {
    if (!definition.target.proxy.poolId) {
      return proxyRegions.has(region) ? `dynamic-${region}` : undefined;
    }

    if (!proxyRegions.size || proxyRegions.has(region)) {
      return `${definition.target.proxy.poolId}:${region}`;
    }

    const fallback = definition.target.proxy.failoverPoolIds?.[0];
    return fallback ? `${fallback}:${region}` : definition.target.proxy.poolId;
  }

  private pickStatus(value: number, includeTerminated: boolean, blueprintStatus: SessionBlueprint["status"]) {
    const baseWeights: Array<{ status: ReplicaStatus; weight: number }> = [
      { status: "active", weight: 0.86 },
      { status: "initializing", weight: 0.06 },
      { status: "throttled", weight: 0.04 },
      { status: "error", weight: 0.03 },
      { status: "terminated", weight: includeTerminated ? 0.01 : 0 }
    ];

    if (blueprintStatus === "scaling") {
      const initializing = baseWeights[1];
      if (initializing) initializing.weight += 0.04;
    } else if (blueprintStatus === "degraded") {
      const throttled = baseWeights[2];
      const errored = baseWeights[3];
      const active = baseWeights[0];
      if (throttled) throttled.weight += 0.03;
      if (errored) errored.weight += 0.03;
      if (active) active.weight = Math.max(0, active.weight - 0.04);
    } else if (blueprintStatus === "terminated") {
      return includeTerminated ? "terminated" : "error";
    }

    const total = baseWeights.reduce((acc, bucket) => acc + bucket.weight, 0);
    let cursor = 0;
    for (const bucket of baseWeights) {
      if (!includeTerminated && bucket.status === "terminated") {
        continue;
      }
      cursor += bucket.weight / total;
      if (value <= cursor) {
        return bucket.status;
      }
    }

    return includeTerminated ? "terminated" : "active";
  }

  private resolveErrorCode(value: number) {
    if (value < 0.25) return "HTTP_429";
    if (value < 0.5) return "HTTP_500";
    if (value < 0.75) return "NET_TIMEOUT";
    return "JS_EXCEPTION";
  }
}
