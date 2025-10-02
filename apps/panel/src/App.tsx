import { useState, useEffect, useCallback, useMemo } from 'react';
import io from 'socket.io-client';
import { useQuery, useQueryClient } from "react-query";
import type { SessionBlueprint, HypergridTile } from "@mega/shared";
import { SessionGrid } from "./components/SessionGrid";
import { PanelHeader } from "./components/PanelHeader";
import { ControlRail, type SessionFilters } from "./components/ControlRail";
import { EmbedHub } from "./components/EmbedHub";
import { AdvancedUrlInput, type BulkEmbedOptions } from "./components/AdvancedUrlInput";
import { SystemMetricsDashboard } from "./components/SystemMetricsDashboard";
import { HypergridView } from "./components/HypergridView";
import { useLiveSessions } from "./hooks/useLiveSessions";

const orchestratorUrl = import.meta.env.VITE_ORCHESTRATOR_URL ?? "http://localhost:4000";
const STATUS_BASELINE: SessionBlueprint["status"][] = ["steady", "scaling", "degraded", "terminated", "draft"];

type SessionsResponse = {
  sessions: SessionBlueprint["definition"][];
  blueprints: SessionBlueprint[];
};

export function App() {
  const queryClient = useQueryClient();
  const { blueprints, metrics, hypergrid, ingestSnapshot, registerSessionEvents, connectSessionStream } = useLiveSessions();
  const [filters, setFilters] = useState<SessionFilters>({ search: "", region: "all", proxy: "all", status: "all" });
  const [scaling, setScaling] = useState(false);
  const [viewMode, setViewMode] = useState<"control" | "embed" | "bulk-embed" | "metrics" | "hypergrid">("control");
  const [bulkEmbedProgress, setBulkEmbedProgress] = useState<{
    active: boolean;
    processed: number;
    total: number;
    successful: number;
    failed: number;
    timeElapsed: number;
  } | null>(null);
  const [selectedTile, setSelectedTile] = useState<HypergridTile | null>(null);
  const selectedTileStatusEntries = useMemo(() => {
    if (!selectedTile) return [] as Array<[string, number]>;
    const entries = Object.entries(selectedTile.statusHistogram) as Array<[string, number]>;
    return entries.sort((a, b) => b[1] - a[1]);
  }, [selectedTile]);
  const selectedTileCountryEntries = useMemo(() => {
    if (!selectedTile) return [] as Array<[string, number]>;
    const entries = Object.entries(selectedTile.proxyCountries) as Array<[string, number]>;
    return entries.sort((a, b) => b[1] - a[1]);
  }, [selectedTile]);

  useEffect(() => {
    const socket = io(orchestratorUrl, {
      path: "/socket.io",
      transports: ["websocket"],
      reconnectionAttempts: Infinity,
      reconnectionDelayMax: 5000
    });
    const unsubscribe = registerSessionEvents(socket);
    return () => {
      unsubscribe();
      socket.disconnect();
    };
  }, [orchestratorUrl, registerSessionEvents]);

  useEffect(() => {
    const disconnect = connectSessionStream(`${orchestratorUrl}/sessions/stream`);
    return () => {
      disconnect?.();
    };
  }, [connectSessionStream, orchestratorUrl]);

  const { data, isFetching, refetch } = useQuery<SessionsResponse>(
    ["sessions"],
    async (): Promise<SessionsResponse> => {
      const response = await fetch(`${orchestratorUrl}/sessions`);
      if (!response.ok) {
        throw new Error("Failed to fetch sessions");
      }
      return (await response.json()) as SessionsResponse;
    },
    {
      onSuccess: snapshot => {
        ingestSnapshot(snapshot.blueprints ?? []);
      }
    }
  );

  const effectiveBlueprints = blueprints.length ? blueprints : data?.blueprints ?? [];
  const regionOptions = useMemo(() => {
    const regions = new Set<string>();
    effectiveBlueprints.forEach((blueprint: SessionBlueprint) => {
      blueprint.definition.shards.forEach((shard: any) => regions.add(shard.region));
    });
    return Array.from(regions).sort();
  }, [effectiveBlueprints]);

  const proxyOptions = useMemo(() => {
    const proxies = new Set<string>();
    effectiveBlueprints.forEach((blueprint: SessionBlueprint) => {
      blueprint.definition.shards.forEach((shard: any) => {
        if (shard.proxyPoolId) {
          proxies.add(shard.proxyPoolId);
        }
      });
    });
    return Array.from(proxies).sort();
  }, [effectiveBlueprints]);

  const statusOptions = useMemo(
    () => Array.from(new Set([...STATUS_BASELINE, ...effectiveBlueprints.map(item => item.status)])).sort(),
    [effectiveBlueprints]
  );

  const visibleBlueprints = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return effectiveBlueprints.filter((blueprint: SessionBlueprint) => {
      const { definition } = blueprint;
      const matchesSearch =
        !search ||
        definition.target.label.toLowerCase().includes(search) ||
        definition.target.url.toLowerCase().includes(search) ||
        definition.tags.some((tag: string) => tag.toLowerCase().includes(search));

      const matchesRegion =
        filters.region === "all" ||
        definition.shards.some((shard: any) => shard.region === filters.region);

      const matchesProxy =
        filters.proxy === "all" ||
        definition.shards.some((shard: any) => shard.proxyPoolId === filters.proxy);

      const matchesStatus = filters.status === "all" || blueprint.status === filters.status;

      return matchesSearch && matchesRegion && matchesProxy && matchesStatus;
    });
  }, [effectiveBlueprints, filters]);

  const aggregatedMetrics = useMemo(() => {
    let activeReplicas = 0;
    let errorsPerMinute = 0;
    let bandwidthKbps = 0;

    visibleBlueprints.forEach(blueprint => {
      const snapshot = metrics.get(blueprint.id);
      if (snapshot) {
        activeReplicas += snapshot.activeReplicas;
        errorsPerMinute += snapshot.errorsPerMinute;
        bandwidthKbps += snapshot.bandwidthKbps;
      } else {
        activeReplicas += blueprint.definition.policy.targetReplicaCount;
      }
    });

    return { activeReplicas, errorsPerMinute, bandwidthKbps };
  }, [metrics, visibleBlueprints]);

  const statusDistribution = useMemo(() => {
    const counts = new Map<SessionBlueprint["status"], number>();
    visibleBlueprints.forEach(blueprint => {
      counts.set(blueprint.status, (counts.get(blueprint.status) ?? 0) + 1);
    });
    return statusOptions.map(status => ({ status, count: counts.get(status) ?? 0 }));
  }, [statusOptions, visibleBlueprints]);

  const hypergridStatusSpectrum = useMemo(() => {
    if (!hypergrid) return [] as Array<[string, number]>;
    const totals = new Map<string, number>();
    hypergrid.tiles.forEach((tile: HypergridTile) => {
      (Object.entries(tile.statusHistogram) as Array<[string, number]>).forEach(([status, count]) => {
        totals.set(status, (totals.get(status) ?? 0) + count);
      });
    });
    return Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
  }, [hypergrid]);

  const hypergridCountryInsights = useMemo(() => {
    if (!hypergrid) return { top: [] as Array<[string, number]>, total: 0 };
    const aggregate = new Map<string, number>();
    hypergrid.tiles.forEach((tile: HypergridTile) => {
      (Object.entries(tile.proxyCountries) as Array<[string, number]>).forEach(([country, count]) => {
        aggregate.set(country, (aggregate.get(country) ?? 0) + count);
      });
    });
    const entries = Array.from(aggregate.entries());
    const total = entries.reduce((sum, [, count]) => sum + count, 0);
    const top = entries.sort((a, b) => b[1] - a[1]).slice(0, 8);
    return { top, total };
  }, [hypergrid]);

  const handleFiltersChange = useCallback((next: SessionFilters) => {
    setFilters(next);
  }, []);

  const handleLaunchEmbedHub = useCallback(() => {
    setViewMode("embed");
  }, []);

  const handleLaunchBulkEmbed = useCallback(() => {
    setViewMode("bulk-embed");
  }, []);

  const handleLaunchMetrics = useCallback(() => {
    setViewMode("metrics");
  }, []);

  const handleLaunchHypergrid = useCallback(() => {
    setViewMode("hypergrid");
    setSelectedTile(null);
  }, []);

  const handleExitSpecialMode = useCallback(() => {
    setViewMode("control");
    setBulkEmbedProgress(null);
    setSelectedTile(null);
  }, []);

  const handleHypergridSelect = useCallback((tile: HypergridTile) => {
    setSelectedTile(tile);
  }, []);

  const handleClearTileSelection = useCallback(() => {
    setSelectedTile(null);
  }, []);

  const handleBulkEmbed = useCallback(async (urls: string[], options: BulkEmbedOptions) => {
    setBulkEmbedProgress({ 
      active: true, 
      processed: 0, 
      total: urls.length, 
      successful: 0, 
      failed: 0, 
      timeElapsed: 0 
    });

    const startTime = Date.now();

    try {
      const response = await fetch(`${orchestratorUrl}/embed/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls,
          bulkOptions: {
            batchSize: options.batchSize,
            parallelProcessing: options.parallelProcessing,
            fallbackStrategy: options.fallbackStrategy
          },
          proxyRequirements: {
            enableGlobalRotation: options.enableGlobalProxies,
            preferredRegions: options.preferredRegions,
            preferredCountries: options.preferredCountries,
            maxConcurrentPerProxy: 100
          },
          renderingOptions: {
            engine: options.renderEngine,
            viewport: options.viewport,
            enableOptimizations: true
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      const timeElapsed = Date.now() - startTime;

      setBulkEmbedProgress({
        active: false,
        processed: result.totalProcessed,
        total: urls.length,
        successful: Array.isArray(result.createdSessionIds)
          ? result.createdSessionIds.length
          : (typeof result.successful === "number" ? result.successful : Array.isArray(result.successful) ? result.successful.length : 0),
        failed: Array.isArray(result.failedEntries)
          ? result.failedEntries.length
          : (typeof result.failed === "number" ? result.failed : Array.isArray(result.failed) ? result.failed.length : 0),
        timeElapsed
      });

      // Refresh sessions to show new embeds
      await queryClient.invalidateQueries(["sessions"]);

      // Show success notification
      const successCount = Array.isArray(result.createdSessionIds)
        ? result.createdSessionIds.length
        : (typeof result.successful === "number" ? result.successful : Array.isArray(result.successful) ? result.successful.length : 0);
      const failureCount = Array.isArray(result.failedEntries)
        ? result.failedEntries.length
        : (typeof result.failed === "number" ? result.failed : Array.isArray(result.failed) ? result.failed.length : 0);
      alert(`Bulk embed completed! ${successCount} successful, ${failureCount} failed in ${(timeElapsed / 1000).toFixed(1)}s`);

    } catch (error) {
      console.error("Bulk embed failed:", error);
      setBulkEmbedProgress(prev => prev ? { ...prev, active: false } : null);
      alert(`Bulk embed failed: ${(error as Error).message}`);
    }
  }, [orchestratorUrl, queryClient]);

  const handleScaleToMillion = useCallback(async (targetSessions: number) => {
    setBulkEmbedProgress({ 
      active: true, 
      processed: 0, 
      total: targetSessions, 
      successful: 0, 
      failed: 0, 
      timeElapsed: 0 
    });

    const startTime = Date.now();

    try {
      const response = await fetch(`${orchestratorUrl}/embed/scale-million`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetSessions })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      const timeElapsed = Date.now() - startTime;

      setBulkEmbedProgress({
        active: false,
        processed: result.currentSessions,
        total: targetSessions,
        successful: result.currentSessions,
        failed: result.failedSessionCount ?? Math.max(0, targetSessions - result.currentSessions),
        timeElapsed
      });

      // Refresh sessions to show scaling results
      await queryClient.invalidateQueries(["sessions"]);

      const message = result.targetReached
        ? `Successfully scaled to ${result.currentSessions.toLocaleString()} sessions in ${(result.scalingTimeMs / 1000).toFixed(1)}s`
        : `Partial scaling: ${result.currentSessions.toLocaleString()} sessions created in ${(result.scalingTimeMs / 1000).toFixed(1)}s (failures: ${(result.failedSessionCount ?? 0).toLocaleString()})`;
      
      alert(message);

    } catch (error) {
      console.error("Scale operation failed:", error);
      setBulkEmbedProgress(prev => prev ? { ...prev, active: false } : null);
      alert(`Scale operation failed: ${(error as Error).message}`);
    }
  }, [orchestratorUrl, queryClient]);

  const handleBulkScale = useCallback(
    async (multiplier: number) => {
      if (!visibleBlueprints.length) return;
      setScaling(true);
      try {
        const body = visibleBlueprints.map(blueprint => ({
          ...blueprint.definition,
          target: { ...blueprint.definition.target },
          policy: {
            ...blueprint.definition.policy,
            targetReplicaCount: Math.min(
              1_000_000,
              Math.max(1, Math.round(blueprint.definition.policy.targetReplicaCount * multiplier))
            )
          }
        }));

        const response = await fetch(`${orchestratorUrl}/sessions/batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || "Failed to scale sessions");
        }

        await queryClient.invalidateQueries(["sessions"]);
      } catch (error) {
        console.error("Failed to apply bulk scaling", error);
      } finally {
        setScaling(false);
      }
    },
    [orchestratorUrl, queryClient, visibleBlueprints]
  );

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const handleSessionScale = useCallback(
    async (sessionId: string, multiplier: number) => {
      const blueprint = effectiveBlueprints.find(item => item.id === sessionId);
      if (!blueprint) {
        return;
      }

      const desired = Math.min(
        1_000_000,
        Math.max(1, Math.round(blueprint.definition.policy.targetReplicaCount * multiplier))
      );

      try {
        const response = await fetch(`${orchestratorUrl}/sessions/${sessionId}/scale`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetReplicaCount: desired })
        });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || "Failed to scale session");
        }
      } catch (error) {
        console.error(`Failed to scale session ${sessionId}`, error);
      }
    },
    [effectiveBlueprints, orchestratorUrl]
  );

  const getViewModeLabel = () => {
    switch (viewMode) {
      case "embed": return "Live Embed Viewer";
      case "bulk-embed": return "Advanced Bulk Embedding";
      case "metrics": return "System Metrics Dashboard";
      case "hypergrid": return "Hypergrid Atlas";
      default: return null;
    }
  };

  const getViewModeAction = () => {
    if (viewMode === "control") return undefined;
    return { 
      label: "← Return to Control Panel", 
      onClick: handleExitSpecialMode 
    };
  };

  const viewModeAction = getViewModeAction();

  return (
    <div className="app-shell">
      <PanelHeader
        sessionCount={visibleBlueprints.length}
        activeReplicaEstimate={aggregatedMetrics.activeReplicas}
        errorsPerMinute={aggregatedMetrics.errorsPerMinute}
        bandwidthKbps={aggregatedMetrics.bandwidthKbps}
        viewModeLabel={getViewModeLabel()}
        {...(viewModeAction ? { primaryAction: viewModeAction } : {})}
      />

      {bulkEmbedProgress?.active && (
        <div className="app-shell__progress">
          <div className="bulk-progress">
            <div className="bulk-progress__header">
              <h3>🚀 Processing Bulk Embed Operation</h3>
              <div className="bulk-progress__stats">
                {bulkEmbedProgress.processed.toLocaleString()} / {bulkEmbedProgress.total.toLocaleString()} processed
              </div>
            </div>
            <div className="bulk-progress__bar">
              <div 
                className="bulk-progress__fill" 
                style={{ width: `${Math.min(100, (bulkEmbedProgress.processed / bulkEmbedProgress.total) * 100)}%` }}
              />
            </div>
            <div className="bulk-progress__details">
              ✅ {bulkEmbedProgress.successful} successful • ❌ {bulkEmbedProgress.failed} failed • ⏱️ {(bulkEmbedProgress.timeElapsed / 1000).toFixed(1)}s elapsed
            </div>
          </div>
        </div>
      )}

      {viewMode === "control" && (
        <main className="main-shell">
          <ControlRail
            filters={filters}
            onFiltersChange={handleFiltersChange}
            regionOptions={regionOptions}
            proxyOptions={proxyOptions}
            statusOptions={statusOptions}
            statusDistribution={statusDistribution}
            onBulkScale={handleBulkScale}
            onRefresh={handleRefresh}
            busy={isFetching || scaling}
            {...(visibleBlueprints.length ? { onLaunchEmbedHub: handleLaunchEmbedHub } : {})}
            {...(hypergrid ? { onLaunchHypergrid: handleLaunchHypergrid } : {})}
          />
          <div className="main-shell__content">
            <div className="main-shell__actions">
              <button
                type="button"
                onClick={handleLaunchBulkEmbed}
                className="main-shell__action-button main-shell__action-button--primary"
              >
                🚀 Advanced Bulk Embed
              </button>
              <button
                type="button"
                onClick={handleLaunchMetrics}
                className="main-shell__action-button main-shell__action-button--secondary"
              >
                📊 System Metrics
              </button>
            </div>
            <SessionGrid
              blueprints={visibleBlueprints}
              metrics={metrics}
              orchestratorUrl={orchestratorUrl}
              onScaleSession={handleSessionScale}
            />
          </div>
        </main>
      )}

      {viewMode === "embed" && (
        <main className="embed-shell">
          <EmbedHub blueprints={visibleBlueprints} orchestratorUrl={orchestratorUrl} filters={filters} />
        </main>
      )}

      {viewMode === "bulk-embed" && (
        <main className="bulk-embed-shell">
          <AdvancedUrlInput
            onBulkEmbed={handleBulkEmbed}
            onScaleToMillion={handleScaleToMillion}
            orchestratorUrl={orchestratorUrl}
            busy={bulkEmbedProgress?.active || isFetching || scaling}
          />
        </main>
      )}

      {viewMode === "hypergrid" && (
        <main className="hypergrid-shell">
          <section className="hypergrid-shell__primary">
            <HypergridView snapshot={hypergrid} onSelectTile={handleHypergridSelect} />
            {hypergrid && (
              <div className="hypergrid-shell__panel">
                <h2>Distribution intelligence</h2>
                <div className="shell-drawer__meta">
                  <div className="item">
                    <div className="label">Tiles active</div>
                    <div className="value">{hypergrid.tiles.length.toLocaleString()}</div>
                  </div>
                  <div className="item">
                    <div className="label">Max density</div>
                    <div className="value">{hypergrid.maxSessionsPerTile.toLocaleString()} / tile</div>
                  </div>
                </div>
                <div>
                  <h4>Status spectrum</h4>
                  <ul className="shell-drawer__list">
                    {hypergridStatusSpectrum.slice(0, 6).map(([status, count]: [string, number]) => (
                      <li key={status}>
                        <span className={`pill pill--${status}`}>{status}</span>
                        <span>{count.toLocaleString()} sessions</span>
                        <span>
                          {hypergrid.totalSessions
                            ? ((count / Math.max(hypergrid.totalSessions, 1)) * 100).toFixed(2)
                            : "0.00"}
                          %
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4>Dominant countries</h4>
                  <ul className="shell-drawer__list">
                    {hypergridCountryInsights.top.map(([country, count]: [string, number]) => (
                      <li key={country}>
                        <span>{country}</span>
                        <span>{count.toLocaleString()} routes</span>
                        <span>
                          {hypergridCountryInsights.total
                            ? ((count / Math.max(hypergridCountryInsights.total, 1)) * 100).toFixed(1)
                            : "0.0"}
                          %
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </section>
          <aside className="shell-drawer">
            {selectedTile ? (
              <>
                <h3>Tile #{selectedTile.tileId}</h3>
                <div className="shell-drawer__content">
                  <div className="shell-drawer__meta">
                    <div className="item">
                      <div className="label">Sessions</div>
                      <div className="value">{selectedTile.sessionCount.toLocaleString()}</div>
                    </div>
                    <div className="item">
                      <div className="label">Active replicas</div>
                      <div className="value">{selectedTile.activeReplicas.toLocaleString()}</div>
                    </div>
                    <div className="item">
                      <div className="label">Latency</div>
                      <div className="value">{selectedTile.averageLatencyMs.toFixed(1)} ms</div>
                    </div>
                  </div>
                  <div>
                    <h4>Status distribution</h4>
                    <ul className="shell-drawer__list">
                      {selectedTileStatusEntries.map(([status, count]) => (
                        <li key={status}>
                          <span className={`pill pill--${status}`}>{status}</span>
                          <span>{count.toLocaleString()} sessions</span>
                          <span>
                            {(count / Math.max(selectedTile.sessionCount, 1) * 100).toFixed(2)}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4>Proxy countries</h4>
                    <ul className="shell-drawer__list">
                      {selectedTileCountryEntries.map(([country, count]) => (
                        <li key={country}>
                          <span>{country}</span>
                          <span>{count.toLocaleString()} routes</span>
                          <span>
                            {(count / Math.max(selectedTile.sessionCount, 1) * 100).toFixed(1)}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {selectedTile.samples.length > 0 && (
                    <div>
                      <h4>Reservoir samples</h4>
                      <ul className="shell-drawer__list">
                        {selectedTile.samples.map((sample: any) => (
                          <li key={sample.sessionId}>
                            <span className={`pill pill--${sample.status}`}>{sample.status}</span>
                            <span>{sample.label}</span>
                            <span>{sample.averageLatencyMs.toFixed(0)} ms</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="shell-drawer__actions">
                    <button type="button" onClick={handleClearTileSelection}>
                      Release focus
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="shell-drawer__content">
                <p className="shell-drawer__empty">
                  Interact with the hypergrid to inspect density clusters, latency gradients, and proxy affinity.
                </p>
              </div>
            )}
          </aside>
        </main>
      )}

      {viewMode === "metrics" && (
        <main className="metrics-shell">
          <SystemMetricsDashboard
            orchestratorUrl={orchestratorUrl}
            refreshInterval={3000}
          />
        </main>
      )}
    </div>
  );
}
