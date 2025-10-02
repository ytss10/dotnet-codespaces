import { useEffect, useMemo, useRef, useState } from "react";
import type { HypergridSnapshot, HypergridTile } from "@mega/shared";

interface HypergridViewProps {
  snapshot: HypergridSnapshot | null;
  onSelectTile?: (tile: HypergridTile) => void;
}

interface CoordinateIndex {
  key: string;
  tile: HypergridTile;
}

export function HypergridView({ snapshot, onSelectTile }: HypergridViewProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoverTile, setHoverTile] = useState<HypergridTile | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const coordinateIndex = useMemo(() => {
    if (!snapshot) return new Map<string, CoordinateIndex>();
    const map = new Map<string, CoordinateIndex>();
    snapshot.tiles.forEach(tile => {
      const key = `${tile.coordinate[0]}:${tile.coordinate[1]}`;
      map.set(key, { key, tile });
    });
    return map;
  }, [snapshot]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setDimensions(prev => (prev.width === width && prev.height === height ? prev : { width, height }));
    });

    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper || !snapshot) return;

    const deviceRatio = window.devicePixelRatio || 1;
    const width = dimensions.width || wrapper.clientWidth || 640;
    const height = dimensions.height || wrapper.clientHeight || 480;

    if (width <= 0 || height <= 0) {
      return;
    }

    if (canvas.width !== width * deviceRatio || canvas.height !== height * deviceRatio) {
      canvas.width = width * deviceRatio;
      canvas.height = height * deviceRatio;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.save();
  ctx.setTransform(deviceRatio, 0, 0, deviceRatio, 0, 0);
  ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#070a12";
    ctx.fillRect(0, 0, width, height);

    const cellWidth = width / snapshot.gridSize;
    const cellHeight = height / snapshot.gridSize;

    const maxDensity = snapshot.tiles.reduce((max, tile) => Math.max(max, tile.density), 0.01);

    for (const tile of snapshot.tiles) {
      const [x, y] = tile.coordinate;
      const normalizedDensity = tile.density / maxDensity;
      const heat = Math.min(1, normalizedDensity);
      const r = 35 + heat * 210;
      const g = 92 + heat * 120;
      const b = 160 + (1 - heat) * 60;
      ctx.fillStyle = `rgba(${r.toFixed(0)}, ${g.toFixed(0)}, ${b.toFixed(0)}, ${0.75 + heat * 0.2})`;
      ctx.fillRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
    }

    if (hoverTile) {
      const [hx, hy] = hoverTile.coordinate;
      ctx.strokeStyle = "#ffe082";
      ctx.lineWidth = 2;
      ctx.strokeRect(hx * cellWidth, hy * cellHeight, cellWidth, cellHeight);
    }

    ctx.restore();
  }, [dimensions.height, dimensions.width, hoverTile, snapshot]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !snapshot) return;

    const resolveTileFromPointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const cellWidth = rect.width / snapshot.gridSize;
      const cellHeight = rect.height / snapshot.gridSize;
      const cellX = Math.floor(x / cellWidth);
      const cellY = Math.floor(y / cellHeight);
      const key = `${cellX}:${cellY}`;
      return coordinateIndex.get(key)?.tile ?? null;
    };

    const handlePointer = (event: PointerEvent) => {
      const tile = resolveTileFromPointer(event);
      setHoverTile(tile);
    };

    const handleClick = (event: PointerEvent) => {
      const tile = resolveTileFromPointer(event);
      if (tile && onSelectTile) {
        onSelectTile(tile);
      }
    };

    const clearPointer = () => setHoverTile(null);

    canvas.addEventListener("pointermove", handlePointer);
    canvas.addEventListener("pointerleave", clearPointer);
    canvas.addEventListener("click", handleClick);

    return () => {
      canvas.removeEventListener("pointermove", handlePointer);
      canvas.removeEventListener("pointerleave", clearPointer);
      canvas.removeEventListener("click", handleClick);
    };
  }, [coordinateIndex, onSelectTile, snapshot]);

  const renderHoverPanel = () => {
    if (!hoverTile || !snapshot) return null;

    const statusBreakdown = Object.entries(hoverTile.statusHistogram)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    const dominantCountries = Object.entries(hoverTile.proxyCountries)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    return (
      <div className="hypergrid__hover">
        <div className="metric">
          <span className="label">Tile</span>
          <span className="value">#{hoverTile.tileId}</span>
        </div>
        <div className="metric">
          <span className="label">Sessions</span>
          <span className="value">{hoverTile.sessionCount.toLocaleString()}</span>
        </div>
        <div className="metric">
          <span className="label">Active replicas</span>
          <span className="value">{hoverTile.activeReplicas.toLocaleString()}</span>
        </div>
        <div className="metric">
          <span className="label">Latency</span>
          <span className="value">{hoverTile.averageLatencyMs.toFixed(1)} ms</span>
        </div>
        <div className="metric">
          <span className="label">Status histogram</span>
          <span className="value">
            {statusBreakdown.map(([status, count]) => `${status} ${count.toLocaleString()}`).join(" • ") || "n/a"}
          </span>
        </div>
        <div className="metric">
          <span className="label">Top routes</span>
          <span className="value">
            {dominantCountries.map(([code, count]) => `${code} ${count.toLocaleString()}`).join(" • ") || "Global"}
          </span>
        </div>
        {hoverTile.samples.length > 0 && (
          <div className="metric">
            <span className="label">Spot checks</span>
            <span className="value">
              {hoverTile.samples
                .slice(0, 3)
                .map(sample => `${sample.label} ${sample.averageLatencyMs.toFixed(0)}ms`)
                .join(" • ")}
            </span>
          </div>
        )}
        {onSelectTile && (
          <button type="button" onClick={() => onSelectTile(hoverTile)}>
            Inspect tile
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="hypergrid">
      <div ref={wrapperRef} className="hypergrid__canvas-wrapper">
        <canvas ref={canvasRef} className="hypergrid__canvas" style={{ width: "100%", height: "100%" }} />
      </div>
      {snapshot && (
        <aside className="hypergrid__sidebar">
          <h3>Hypergrid Telemetry</h3>
          <div className="hypergrid__stats">
            <div className="metric">
              <span className="hypergrid__stat-label">Concurrent sessions</span>
              <span className="hypergrid__stat-value">{snapshot.totalSessions.toLocaleString()}</span>
            </div>
            <div className="metric">
              <span className="hypergrid__stat-label">Active replicas</span>
              <span className="hypergrid__stat-value">{snapshot.globalStats.activeReplicas.toLocaleString()}</span>
            </div>
            <div className="metric">
              <span className="hypergrid__stat-label">Latency</span>
              <span className="hypergrid__stat-value">{snapshot.globalStats.avgLatencyMs.toFixed(1)} ms</span>
            </div>
            <div className="metric">
              <span className="hypergrid__stat-label">Error rate</span>
              <span className="hypergrid__stat-value">{(snapshot.globalStats.errorRate * 100).toFixed(2)}%</span>
            </div>
          </div>
          <div className="hypergrid__stats">
            <div className="metric">
              <span className="hypergrid__stat-label">Proxy coverage</span>
              <span className="hypergrid__stat-value">{(snapshot.globalStats.proxyCoverage * 100).toFixed(1)}%</span>
            </div>
            <div className="metric">
              <span className="hypergrid__stat-label">Grid</span>
              <span className="hypergrid__stat-value">
                {snapshot.gridSize} × {snapshot.gridSize}
              </span>
            </div>
          </div>
          <p className="shell-drawer__timestamp">
            refreshed {new Date(snapshot.generatedAt).toLocaleTimeString()} • peak tile {snapshot.maxSessionsPerTile.toLocaleString()} sessions
          </p>
          {renderHoverPanel()}
        </aside>
      )}
    </div>
  );
}
