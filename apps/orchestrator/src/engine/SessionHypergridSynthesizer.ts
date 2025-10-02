import { createHash } from "crypto";
import type { SessionBlueprint, MetricsSnapshot } from "@mega/shared";
import type { ProxyCoverageSnapshot } from "./ProxyPoolManager.js";

const MAX_SAMPLES_PER_TILE = 12;

type GridSample = {
  sessionId: string;
  label: string;
  status: SessionBlueprint["status"];
  url: string;
  activeReplicas: number;
  averageLatencyMs: number;
};

export interface HypergridTile {
  tileId: string;
  coordinate: [number, number];
  sessionCount: number;
  statusHistogram: Record<string, number>;
  averageLatencyMs: number;
  activeReplicas: number;
  proxyCountries: Record<string, number>;
  density: number;
  samples: GridSample[];
}

export interface HypergridSnapshot {
  generatedAt: number;
  gridSize: number;
  totalSessions: number;
  maxSessionsPerTile: number;
  tiles: HypergridTile[];
  globalStats: {
    activeReplicas: number;
    avgLatencyMs: number;
    errorRate: number;
    proxyCoverage: number;
  };
}

interface TileAccumulator {
  x: number;
  y: number;
  sessionCount: number;
  latencySum: number;
  activeReplicaSum: number;
  errorSum: number;
  statusHistogram: Map<string, number>;
  proxyCountries: Map<string, number>;
  samples: Array<{ priority: number; data: GridSample }>;
}

const STATUS_DOMAIN: ReadonlyArray<SessionBlueprint["status"]> = [
  "draft",
  "steady",
  "scaling",
  "degraded",
  "terminated"
];

function ensureStatus(status: string): SessionBlueprint["status"] {
  return (STATUS_DOMAIN as ReadonlyArray<string>).includes(status)
    ? (status as SessionBlueprint["status"])
    : "steady";
}

export class SessionHypergridSynthesizer {
  computeSnapshot(params: {
    blueprints: Iterable<SessionBlueprint>;
    metrics: Map<string, MetricsSnapshot>;
    coverage: ProxyCoverageSnapshot;
  }): HypergridSnapshot {
    const list = Array.from(params.blueprints);
    const count = list.length;

    const gridSide = Math.max(
      1,
      2 ** Math.ceil(Math.log2(Math.max(1, Math.ceil(Math.sqrt(Math.max(1, count))))))
    );

    const tiles = new Map<string, TileAccumulator>();
    let globalLatency = 0;
    let globalActiveReplicas = 0;
    let globalErrors = 0;
    let maxSessionsPerTile = 0;

    for (const blueprint of list) {
      const tileKey = this.computeTileKey(blueprint.id, gridSide);
      const { x, y } = tileKey;
      const metrics = params.metrics.get(blueprint.id);

      const activeReplicas = metrics?.activeReplicas ?? blueprint.definition.policy.targetReplicaCount;
      const latencyMs = metrics?.medianLatencyMs ?? blueprint.definition.target.network.latencyMs;
      const errorsPerMinute = metrics?.errorsPerMinute ?? 0;

      const accumulator = tiles.get(tileKey.id) ?? {
        x,
        y,
        sessionCount: 0,
        latencySum: 0,
        activeReplicaSum: 0,
        errorSum: 0,
        statusHistogram: new Map<string, number>(),
        proxyCountries: new Map<string, number>(),
        samples: []
      };

      accumulator.sessionCount++;
      accumulator.latencySum += latencyMs;
      accumulator.activeReplicaSum += activeReplicas;
      accumulator.errorSum += errorsPerMinute;

      const status = ensureStatus(blueprint.status);
      accumulator.statusHistogram.set(status, (accumulator.statusHistogram.get(status) ?? 0) + 1);

      const countries = blueprint.definition.target.proxy.countries ?? [];
      if (countries.length === 0) {
        accumulator.proxyCountries.set("GLOBAL", (accumulator.proxyCountries.get("GLOBAL") ?? 0) + 1);
      } else {
        for (const country of countries) {
          const normalized = country.toUpperCase();
          accumulator.proxyCountries.set(normalized, (accumulator.proxyCountries.get(normalized) ?? 0) + 1);
        }
      }

      const sampleCandidate: GridSample = {
        sessionId: blueprint.id,
        label: blueprint.definition.target.label,
        status,
        url: blueprint.definition.target.url,
        activeReplicas,
        averageLatencyMs: latencyMs
      };

      const sampleEntropy = this.computeDeterministicEntropy(blueprint.id);
      this.updateReservoir(accumulator.samples, sampleCandidate, sampleEntropy);

      tiles.set(tileKey.id, accumulator);

      globalLatency += latencyMs;
      globalActiveReplicas += activeReplicas;
      globalErrors += errorsPerMinute;
      maxSessionsPerTile = Math.max(maxSessionsPerTile, accumulator.sessionCount);
    }

    const tilePayload: HypergridTile[] = [];

    for (const [tileId, accumulator] of tiles) {
      const averageLatencyMs = accumulator.sessionCount ? accumulator.latencySum / accumulator.sessionCount : 0;
      const density = maxSessionsPerTile ? accumulator.sessionCount / maxSessionsPerTile : 0;

      tilePayload.push({
        tileId,
        coordinate: [accumulator.x, accumulator.y],
        sessionCount: accumulator.sessionCount,
        statusHistogram: Object.fromEntries(accumulator.statusHistogram.entries()),
        averageLatencyMs,
        activeReplicas: accumulator.activeReplicaSum,
        proxyCountries: Object.fromEntries(accumulator.proxyCountries.entries()),
        density,
        samples: accumulator.samples
          .sort((a, b) => b.priority - a.priority)
          .slice(0, MAX_SAMPLES_PER_TILE)
          .map(entry => entry.data)
      });
    }

    const errorRate = Math.min(1, globalErrors / Math.max(1, globalActiveReplicas));
    const avgLatency = count ? globalLatency / count : 0;

    return {
      generatedAt: Date.now(),
      gridSize: gridSide,
      totalSessions: count,
      maxSessionsPerTile,
      tiles: tilePayload,
      globalStats: {
        activeReplicas: globalActiveReplicas,
        avgLatencyMs: avgLatency,
        errorRate,
        proxyCoverage: Math.min(1, Math.max(0, params.coverage.coverageRatio))
      }
    };
  }

  private computeTileKey(sessionId: string, gridSide: number) {
    const hash = createHash("sha256").update(sessionId).digest();
    const x = hash.readUInt32BE(0) % gridSide;
    const y = hash.readUInt32BE(4) % gridSide;
    return { id: `${x}:${y}`, x, y };
  }

  private computeDeterministicEntropy(sessionId: string) {
    const hash = createHash("sha1").update(sessionId).digest();
    return hash.readUInt32BE(0) / 0xffffffff;
  }

  private updateReservoir(
  reservoir: Array<{ priority: number; data: GridSample }>,
  candidate: GridSample,
    priority: number
  ) {
    if (reservoir.length < MAX_SAMPLES_PER_TILE) {
      reservoir.push({ priority, data: candidate });
      return;
    }

    let worstIndex = 0;
    let worstPriority = reservoir[0]?.priority ?? Number.POSITIVE_INFINITY;

    for (let index = 1; index < reservoir.length; index++) {
      const bucket = reservoir[index];
      if (bucket && bucket.priority < worstPriority) {
        worstPriority = bucket.priority;
        worstIndex = index;
      }
    }

    if (priority > worstPriority && Number.isFinite(worstPriority)) {
      reservoir[worstIndex] = { priority, data: candidate };
    }
  }
}
