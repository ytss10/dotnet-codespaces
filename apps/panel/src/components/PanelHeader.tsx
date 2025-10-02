interface PanelHeaderProps {
  sessionCount: number;
  activeReplicaEstimate: number;
  errorsPerMinute: number;
  bandwidthKbps: number;
  viewModeLabel?: string | null;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
}

function formatNumber(value: number) {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

export function PanelHeader({ sessionCount, activeReplicaEstimate, errorsPerMinute, bandwidthKbps, viewModeLabel, primaryAction }: PanelHeaderProps) {
  return (
    <header className="panel-header">
      <div className="panel-header__lead">
        <h1>Mega Embed Control</h1>
        {viewModeLabel && <div className="panel-header__mode">{viewModeLabel}</div>}
        <p className="subtitle">Advanced hypermedia system for embedding millions of websites simultaneously with global proxy support.</p>
        {primaryAction && (
          <div className="panel-header__actions">
            <button type="button" onClick={primaryAction.onClick} className="panel-header__action-button">
              {primaryAction.label}
            </button>
          </div>
        )}
      </div>
      <div className="session-counter">
        <span className="label">Active sessions</span>
        <span className="value">{sessionCount.toLocaleString()}</span>
      </div>
      <div className="session-metrics">
        <div className="metric">
          <span className="label">Replica footprint</span>
          <span className="value">{formatNumber(activeReplicaEstimate)}</span>
        </div>
        <div className="metric">
          <span className="label">Errors / min</span>
          <span className="value">{formatNumber(errorsPerMinute)}</span>
        </div>
        <div className="metric">
          <span className="label">Egress</span>
          <span className="value">{formatNumber(bandwidthKbps)} kbps</span>
        </div>
      </div>
    </header>
  );
}
