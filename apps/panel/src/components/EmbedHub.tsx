import type { CSSProperties } from "react";
import { useMemo } from "react";
import type { SessionBlueprint } from "@mega/shared";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeGrid as Grid } from "react-window";
import type { SessionFilters } from "./ControlRail";

interface EmbedHubProps {
  blueprints: SessionBlueprint[];
  orchestratorUrl: string;
  filters: SessionFilters;
}

const MIN_COLUMN_WIDTH = 520;
const CELL_HEIGHT = 360;

function describeFilters(filters: SessionFilters) {
  const badges: string[] = [];
  if (filters.search.trim()) {
    badges.push(`search: “${filters.search.trim()}”`);
  }
  if (filters.region !== "all") {
    badges.push(`region: ${filters.region}`);
  }
  if (filters.proxy !== "all") {
    badges.push(`proxy: ${filters.proxy}`);
  }
  if (filters.status !== "all") {
    badges.push(`status: ${filters.status}`);
  }
  return badges;
}

export function EmbedHub({ blueprints, orchestratorUrl, filters }: EmbedHubProps) {
  const filterBadges = useMemo(() => describeFilters(filters), [filters]);

  if (!blueprints.length) {
    return (
      <section className="embed-hub embed-hub--empty">
        <div className="embed-hub__empty">
          <h2>No sessions available</h2>
          <p>Adjust your filters or provision new sessions to preview embeds.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="embed-hub">
      <header className="embed-hub__masthead">
        <div>
          <h2>Live embed fabric</h2>
          <p>
            Rendering <strong>{blueprints.length.toLocaleString()}</strong> session
            {blueprints.length === 1 ? "" : "s"} in real time.
          </p>
        </div>
        {filterBadges.length > 0 && (
          <ul className="embed-hub__filters">
            {filterBadges.map(badge => (
              <li key={badge}>{badge}</li>
            ))}
          </ul>
        )}
      </header>
      <div className="embed-hub__grid">
        <AutoSizer>
          {({ width, height }: { width: number; height: number }) => {
            const columnCount = Math.max(1, Math.floor(width / MIN_COLUMN_WIDTH));
            const columnWidth = Math.max(MIN_COLUMN_WIDTH, width / columnCount);
            const rowCount = Math.max(Math.ceil(blueprints.length / columnCount), 1);

            return (
              <Grid
                columnCount={columnCount}
                columnWidth={columnWidth}
                height={height}
                rowCount={rowCount}
                rowHeight={CELL_HEIGHT}
                width={width}
              >
                {({ columnIndex, rowIndex, style }: { columnIndex: number; rowIndex: number; style: CSSProperties }) => {
                  const sessionIndex = rowIndex * columnCount + columnIndex;
                  const blueprint = blueprints[sessionIndex];
                  if (!blueprint) {
                    return null;
                  }

                  const { definition } = blueprint;
                  const embedSrc = `${orchestratorUrl}/embed/${definition.target.id}`;
                  let hostname = "";
                  try {
                    hostname = new URL(definition.target.url).hostname;
                  } catch {
                    hostname = definition.target.url;
                  }
                  const regionCount = new Set(definition.shards.map(shard => shard.region)).size;
                  const proxyPools = new Set(
                    definition.shards.map(shard => shard.proxyPoolId).filter(Boolean) as string[]
                  );

                  return (
                    <div style={style} className="embed-hub__cell">
                      <div className="embed-hub__frame">
                        <iframe
                          src={embedSrc}
                          title={`${definition.target.label} :: embed`}
                          sandbox="allow-scripts allow-same-origin allow-forms"
                          allow="autoplay; fullscreen; clipboard-read; clipboard-write;"
                        />
                        <div className="embed-hub__overlay">
                          <div>
                            <strong>{definition.target.label}</strong>
                            <span>{hostname}</span>
                          </div>
                          <div className="embed-hub__overlay-meta">
                            <span>{regionCount} regions</span>
                            <span>{proxyPools.size ? `${proxyPools.size} proxies` : "no proxies"}</span>
                            <button
                              type="button"
                              onClick={() => window.open(embedSrc, "_blank", "noopener,noreferrer")}
                            >
                              Popout
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }}
              </Grid>
            );
          }}
        </AutoSizer>
      </div>
    </section>
  );
}
