import { Fragment } from "react";
import type { ChangeEvent } from "react";
import type { SessionBlueprint } from "@mega/shared";

export interface SessionFilters {
  search: string;
  region: string;
  proxy: string;
  status: SessionBlueprint["status"] | "all";
}

interface ControlRailProps {
  filters: SessionFilters;
  onFiltersChange: (next: SessionFilters) => void;
  regionOptions: string[];
  proxyOptions: string[];
  statusOptions: SessionBlueprint["status"][];
  statusDistribution: Array<{ status: SessionBlueprint["status"]; count: number }>;
  onBulkScale: (multiplier: number) => Promise<void> | void;
  onRefresh: () => void;
  busy?: boolean;
  onLaunchEmbedHub?: () => void;
  onLaunchHypergrid?: () => void;
}

const scalePresets: Array<{ label: string; multiplier: number }> = [
  { label: "Burst +25%", multiplier: 1.25 },
  { label: "Surge +50%", multiplier: 1.5 },
  { label: "Double x2", multiplier: 2 },
  { label: "Shed -40%", multiplier: 0.6 }
];

export function ControlRail({
  filters,
  onFiltersChange,
  regionOptions,
  proxyOptions,
  statusOptions,
  statusDistribution,
  onBulkScale,
  onRefresh,
  busy = false,
  onLaunchEmbedHub,
  onLaunchHypergrid
}: ControlRailProps) {
  const handleFieldChange = (field: keyof SessionFilters) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    onFiltersChange({
      ...filters,
      [field]: event.target.value
    });
  };

  return (
    <aside className="control-rail">
      <div className="control-rail__section">
        <h3>Filters</h3>
        <label className="control-rail__label">
          <span>Search</span>
          <input
            type="search"
            placeholder="match label, hostname, tags"
            value={filters.search}
            onChange={handleFieldChange("search")}
          />
        </label>
        <label className="control-rail__label">
          <span>Region</span>
          <select value={filters.region} onChange={handleFieldChange("region")}>
            <option value="all">All regions</option>
            {regionOptions.map(region => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </label>
        <label className="control-rail__label">
          <span>Proxy mesh</span>
          <select value={filters.proxy} onChange={handleFieldChange("proxy")}>
            <option value="all">All pools</option>
            {proxyOptions.map(proxy => (
              <option key={proxy} value={proxy}>
                {proxy}
              </option>
            ))}
          </select>
        </label>
        <label className="control-rail__label">
          <span>Status</span>
          <select value={filters.status} onChange={handleFieldChange("status")}>
            <option value="all">All statuses</option>
            {statusOptions.map(status => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="control-rail__ghost" onClick={() => onFiltersChange({ search: "", region: "all", proxy: "all", status: "all" })}>
          Reset filters
        </button>
      </div>

      <div className="control-rail__section">
        <h3>Topology pulse</h3>
        <div className="control-rail__status-grid">
          {statusDistribution.map(item => (
            <div key={item.status} className={`pill pill--${item.status}`}>
              <span className="pill__label">{item.status}</span>
              <span className="pill__value">{item.count.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="control-rail__section">
        <h3>Replica orchestration</h3>
        <p className="control-rail__hint">Apply deterministic scaling multipliers across all visible blueprints.</p>
        <div className="control-rail__actions">
          {scalePresets.map(preset => (
            <button
              key={preset.label}
              type="button"
              disabled={busy}
              onClick={() => onBulkScale(preset.multiplier)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <button type="button" className="control-rail__ghost" onClick={onRefresh} disabled={busy}>
          Refresh snapshot
        </button>
      </div>

      {(onLaunchEmbedHub || onLaunchHypergrid) && (
        <div className="control-rail__section">
          <h3>Exploration pivots</h3>
          {onLaunchEmbedHub && (
            <button type="button" className="control-rail__link" onClick={onLaunchEmbedHub}>
              Launch embed observatory
            </button>
          )}
          {onLaunchHypergrid && (
            <button type="button" className="control-rail__link" onClick={onLaunchHypergrid}>
              Open hypergrid atlas
            </button>
          )}
        </div>
      )}

      <footer className="control-rail__footer">
        <span>Realtime fabric</span>
        <div className="control-rail__legend">
          {statusOptions.map(status => (
            <Fragment key={status}>
              <span className={`dot dot--${status}`} />
              <span>{status}</span>
            </Fragment>
          ))}
        </div>
      </footer>
    </aside>
  );
}
