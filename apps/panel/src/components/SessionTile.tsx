import type { SessionBlueprint, MetricsSnapshot } from "@mega/shared";

interface SessionTileProps {
  blueprint: SessionBlueprint;
  metrics?: MetricsSnapshot;
  orchestratorUrl: string;
  onScale?: (sessionId: string, multiplier: number) => Promise<void> | void;
}

function formatLatency(value?: number) {
  if (!value) return "—";
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}s`;
  }
  return `${value}ms`;
}

function formatBandwidth(value?: number) {
  if (!value) return "—";
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)} Gbps`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)} Mbps`;
  }
  return `${value.toLocaleString()} kbps`;
}

export function SessionTile({ blueprint, metrics, orchestratorUrl }: SessionTileProps) {
  const { definition, status, version } = blueprint;
  const embedSrc = `${orchestratorUrl}/embed/${definition.target.id}`;
  const replicaGoal = definition.policy.targetReplicaCount;
  const activeReplicas = metrics?.activeReplicas ?? replicaGoal;
  const errorRate = metrics?.errorsPerMinute ?? 0;
  const bandwidth = metrics?.bandwidthKbps ?? replicaGoal * 120;

  const uniqueRegions = Array.from(new Set(definition.shards.map(shard => shard.region)));
  const uniqueProxies = Array.from(
    new Set(definition.shards.map(shard => shard.proxyPoolId).filter(Boolean) as string[])
  );

  const handlePopout = () => {
    window.open(embedSrc, "_blank", "noopener,noreferrer");
  };

  const handleScale = (multiplier: number) => {
    onScale?.(blueprint.id, multiplier);
  };

  return (
    <article className={`session-tile status-${status}`}>
      <header>
        <div>
          <h2>{definition.target.label}</h2>
          <span className="hostname">{new URL(definition.target.url).hostname}</span>
        </div>
        <div className="replica-count">
          <span className="value">{activeReplicas.toLocaleString()}</span>
          <span className="label">active / {replicaGoal.toLocaleString()}</span>
        </div>
      </header>
      <div className="tile-actions">
        <button type="button" onClick={handlePopout}>
          Popout
        </button>
        <div className="tile-actions__scalers">
          <button type="button" onClick={() => handleScale(1.2)} disabled={!onScale}>
            +20%
          </button>
          <button type="button" onClick={() => handleScale(0.8)} disabled={!onScale}>
            -20%
          </button>
        </div>
      </div>
      <div className="iframe-wrapper">
        <iframe
          src={embedSrc}
          title={definition.target.label}
          sandbox="allow-scripts allow-same-origin allow-forms"
          allow="autoplay; fullscreen; clipboard-read; clipboard-write;"
        />
      </div>
      <footer>
        <div className="meta">
          <div>
            <span className="label">Latency</span>
            <span className="value">{formatLatency(metrics?.medianLatencyMs)}</span>
          </div>
          <div>
            <span className="label">Errors/min</span>
            <span className="value">{errorRate.toLocaleString()}</span>
          </div>
          <div>
            <span className="label">Egress</span>
            <span className="value">{formatBandwidth(bandwidth)}</span>
          </div>
          <div>
            <span className="label">Blueprint v{version}</span>
            <span className="value">{status}</span>
          </div>
          <div>
            <span className="label">Regions</span>
            <span className="value">{uniqueRegions.join(", ")}</span>
          </div>
          <div>
            <span className="label">Proxies</span>
            <span className="value">{uniqueProxies.length ? uniqueProxies.join(", ") : "—"}</span>
          </div>
        </div>
      </footer>
    </article>
  );
}
