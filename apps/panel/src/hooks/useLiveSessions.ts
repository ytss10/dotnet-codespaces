import { useCallback, useMemo, useState } from "react";
import { Socket } from "socket.io-client";
import { SessionBlueprint, MetricsSnapshot, HypergridSnapshot } from "@mega/shared";

type BlueprintMap = Map<string, SessionBlueprint>;
type MetricsMap = Map<string, MetricsSnapshot>;

function cloneBlueprintMap(map: BlueprintMap) {
  return new Map(map);
}

function cloneMetricsMap(map: MetricsMap) {
  return new Map(map);
}

export function useLiveSessions() {
  const [blueprints, setBlueprints] = useState<BlueprintMap>(() => new Map());
  const [metrics, setMetrics] = useState<MetricsMap>(() => new Map());
  const [hypergrid, setHypergrid] = useState<HypergridSnapshot | null>(null);

  const upsertBlueprint = useCallback((blueprint: SessionBlueprint) => {
    setBlueprints((prev: BlueprintMap) => {
      const next = cloneBlueprintMap(prev);
      next.set(blueprint.id, blueprint);
      return next;
    });
  }, []);

  const removeBlueprint = useCallback((sessionId: string) => {
    setBlueprints((prev: BlueprintMap) => {
      const next = cloneBlueprintMap(prev);
      next.delete(sessionId);
      return next;
    });
    setMetrics((prev: MetricsMap) => {
      const next = cloneMetricsMap(prev);
      next.delete(sessionId);
      return next;
    });
  }, []);

  const upsertMetrics = useCallback((sessionId: string, snapshot: MetricsSnapshot) => {
    setMetrics((prev: MetricsMap) => {
      const next = cloneMetricsMap(prev);
      next.set(sessionId, snapshot);
      return next;
    });
  }, []);

  const ingestSnapshot = useCallback((snapshot: SessionBlueprint[]) => {
    setBlueprints(() => new Map(snapshot.map(item => [item.id, item])));
    setMetrics(prev => {
      const next = new Map<string, MetricsSnapshot>();
      snapshot.forEach(item => {
        const existing = prev.get(item.id);
        if (existing) {
          next.set(item.id, existing);
        }
      });
      return next;
    });
  }, []);

  const ingestHypergrid = useCallback((snapshot: HypergridSnapshot) => {
    setHypergrid(snapshot);
  }, []);

  const handleRealtime = useCallback(
    (eventName: string, payload: unknown) => {
      if (!payload) return;

      switch (eventName) {
        case "session/created":
        case "session/updated": {
          const candidate = (payload as { blueprint?: SessionBlueprint }).blueprint ?? (payload as SessionBlueprint);
          if (candidate) {
            upsertBlueprint(candidate);
          }
          break;
        }
        case "session/deleted": {
          const { id } = payload as { id?: string };
          if (id) {
            removeBlueprint(id);
          }
          break;
        }
        case "session/metrics": {
          const { sessionId, metrics: snapshot } = payload as {
            sessionId?: string;
            metrics?: MetricsSnapshot;
          };
          if (sessionId && snapshot) {
            upsertMetrics(sessionId, snapshot);
          }
          break;
        }
        case "hypergrid/update": {
          const snapshot = payload as HypergridSnapshot;
          if (snapshot?.gridDimensions) {
            ingestHypergrid(snapshot);
          }
          break;
        }
        default:
          break;
      }
    },
    [ingestHypergrid, removeBlueprint, upsertBlueprint, upsertMetrics]
  );

  const registerSessionEvents = useCallback(
    (socket: Socket) => {
      const relay = (eventName: string) => (payload: unknown) => handleRealtime(eventName, payload);

      const created = relay("session/created");
      const updated = relay("session/updated");
      const deleted = relay("session/deleted");
      const metricsRelay = relay("session/metrics");
      const hypergridRelay = relay("hypergrid/update");

      socket.on("session/created", created);
      socket.on("session/updated", updated);
      socket.on("session/deleted", deleted);
      socket.on("session/metrics", metricsRelay);
      socket.on("hypergrid/update", hypergridRelay);

      return () => {
        socket.off("session/created", created);
        socket.off("session/updated", updated);
        socket.off("session/deleted", deleted);
        socket.off("session/metrics", metricsRelay);
        socket.off("hypergrid/update", hypergridRelay);
      };
    },
    [handleRealtime]
  );

  const connectSessionStream = useCallback(
    (endpoint: string) => {
      const source = new EventSource(endpoint);

      const parseAndDispatch = (eventName: string) => (event: MessageEvent<string>) => {
        try {
          const data = JSON.parse(event.data);
          handleRealtime(eventName, data);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn("[panel] failed to parse stream payload", error);
        }
      };

      const handleSnapshot = (event: MessageEvent<string>) => {
        try {
          const data = JSON.parse(event.data) as { blueprints?: Array<{ blueprint: SessionBlueprint }> };
          if (Array.isArray(data.blueprints)) {
            const extracted = data.blueprints
              .map(item => item.blueprint)
              .filter(Boolean) as SessionBlueprint[];
            ingestSnapshot(extracted);
          }
        } catch (error) {
          console.warn("[panel] failed to ingest snapshot", error);
        }
      };

      const snapshotListener = handleSnapshot as EventListener;
      const createdListener = parseAndDispatch("session/created") as EventListener;
      const updatedListener = parseAndDispatch("session/updated") as EventListener;
      const deletedListener = parseAndDispatch("session/deleted") as EventListener;
      const metricsListener = parseAndDispatch("session/metrics") as EventListener;
  const hypergridListener = parseAndDispatch("hypergrid/update") as EventListener;

      source.addEventListener("snapshot", snapshotListener);
      source.addEventListener("session/created", createdListener);
      source.addEventListener("session/updated", updatedListener);
      source.addEventListener("session/deleted", deletedListener);
      source.addEventListener("session/metrics", metricsListener);
      source.addEventListener("hypergrid/update", hypergridListener);
      source.addEventListener("error", () => {
        console.warn("[panel] session stream dropped");
      });

      return () => {
        source.removeEventListener("snapshot", snapshotListener);
        source.removeEventListener("session/created", createdListener);
        source.removeEventListener("session/updated", updatedListener);
        source.removeEventListener("session/deleted", deletedListener);
        source.removeEventListener("session/metrics", metricsListener);
        source.removeEventListener("hypergrid/update", hypergridListener);
        source.close();
      };
    },
    [handleRealtime, ingestSnapshot]
  );

  const blueprintList = useMemo(
    () => (Array.from(blueprints.values()) as SessionBlueprint[]).sort((a, b) => a.definition.target.label.localeCompare(b.definition.target.label)),
    [blueprints]
  );

  return {
    blueprints: blueprintList,
    metrics,
    hypergrid,
    ingestSnapshot,
    registerSessionEvents,
    connectSessionStream
  };
}
