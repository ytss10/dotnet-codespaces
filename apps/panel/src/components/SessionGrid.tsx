import type { CSSProperties } from "react";
import { SessionBlueprint, MetricsSnapshot } from "@mega/shared";
import { FixedSizeGrid as Grid } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import { SessionTile } from "./SessionTile";

interface SessionGridProps {
  blueprints: SessionBlueprint[];
  metrics: Map<string, MetricsSnapshot>;
  orchestratorUrl: string;
  onScaleSession?: (sessionId: string, multiplier: number) => Promise<void> | void;
}

export function SessionGrid({ blueprints, orchestratorUrl, metrics, onScaleSession }: SessionGridProps) {
  return (
    <section className="session-grid">
      <AutoSizer>
        {({ width, height }: { width: number; height: number }) => {
          const columnCount = Math.max(1, Math.floor(width / 360));
          const columnWidth = Math.max(320, width / columnCount);
          const rowCount = Math.max(Math.ceil(blueprints.length / columnCount), 1);

          return (
            <Grid
              columnCount={columnCount}
              columnWidth={columnWidth}
              height={height}
              rowCount={rowCount}
              rowHeight={260}
              width={width}
            >
              {({ columnIndex, rowIndex, style }: { columnIndex: number; rowIndex: number; style: CSSProperties }) => {
                const sessionIndex = rowIndex * columnCount + columnIndex;
                const blueprint = blueprints[sessionIndex];
                return blueprint ? (
                  <div style={style} className="grid-cell">
                    <SessionTile
                      blueprint={blueprint}
                      metrics={metrics.get(blueprint.id)}
                      orchestratorUrl={orchestratorUrl}
                      onScale={onScaleSession}
                    />
                  </div>
                ) : null;
              }}
            </Grid>
          );
        }}
      </AutoSizer>
    </section>
  );
}
