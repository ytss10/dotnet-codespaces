import * as os from 'node:os';
import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pino from 'pino';
import Redis from 'ioredis';
import {
  SessionBlueprint,
  MetricsSnapshot,
  HypergridSnapshot,
  SessionDefinition,
  BulkEmbedRequest,
  BulkEmbedResponse
} from '@mega/shared';
import { HyperOrchestrator } from "./engine/HyperOrchestrator.js";
import { EventStore } from "./event-sourcing/store.js";

class VectorClock {
  private readonly clock = new Map<string, number>();

  constructor(private readonly nodeId: string) {
    this.clock.set(nodeId, 0);
  }

  increment() {
    this.clock.set(this.nodeId, (this.clock.get(this.nodeId) ?? 0) + 1);
  }

  merge(other: VectorClock) {
    for (const [nodeId, value] of other.clock.entries()) {
      this.clock.set(nodeId, Math.max(this.clock.get(nodeId) ?? 0, value));
    }
    this.increment();
  }

  snapshot(): Record<string, number> {
    return Array.from(this.clock.entries()).reduce<Record<string, number>>((acc, [node, ts]) => {
      acc[node] = ts;
      return acc;
    }, {});
  }
}

interface BroadcastOptions {
  sessionId?: string;
  tags?: string[];
}

class RealtimeMultiplexer extends EventEmitter {
  private readonly sseClients = new Map<string, { res: Response; clock: VectorClock }>();
  private readonly sockets = new Map<string, { socket: Socket; clock: VectorClock }>();
  private shuttingDown = false;

  constructor(private readonly io: SocketIOServer, private readonly store: EventStore) {
    super();
  }

  registerSocket(socket: Socket) {
    const clock = new VectorClock(socket.id);
    this.sockets.set(socket.id, { socket, clock });
    socket.on("disconnect", () => {
      this.sockets.delete(socket.id);
    });
  }

  registerSse(res: Response): string {
    const clientId = randomUUID();
    const clock = new VectorClock(clientId);
    this.sseClients.set(clientId, { res, clock });
    return clientId;
  }

  unregisterSse(clientId: string) {
    const client = this.sseClients.get(clientId);
    if (client) {
      try {
        client.res.end();
      } catch (error) {
        console.warn("Failed to terminate SSE client", { clientId, error });
      }
      this.sseClients.delete(clientId);
    }
  }

  sendSnapshot(clientId: string, blueprints: SessionBlueprint[], hypergrid: HypergridSnapshot | null) {
    const client = this.sseClients.get(clientId);
    if (!client) return;

    const payload = {
      blueprints: blueprints.map(blueprint => ({ blueprint })),
      hypergrid
    };

    try {
      client.res.write(`event: snapshot\n`);
      client.res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (error) {
      console.warn("failed to send snapshot to client", { clientId, error });
      this.unregisterSse(clientId);
    }
  }

  async broadcast(eventName: string, payload: unknown, options: BroadcastOptions = {}) {
    if (this.shuttingDown) return;

    const envelope = {
      id: randomUUID(),
      timestamp: Date.now(),
      event: eventName,
      sessionId: options.sessionId,
      tags: options.tags ?? []
    };

    try {
      const eventRecord: Parameters<EventStore["append"]>[0] = {
        type: eventName,
        timestamp: envelope.timestamp,
        data: payload,
        metadata: { correlationId: envelope.id }
      };
      if (options.sessionId) {
        eventRecord.sessionId = options.sessionId;
      }
      await this.store.append(eventRecord);
    } catch (error) {
      console.warn("event-store append failed", { eventName, error });
    }

    for (const [clientId, client] of this.sseClients.entries()) {
      try {
        client.clock.increment();
        const ssePayload = {
          payload,
          event: envelope.event,
          timestamp: envelope.timestamp,
          vector: client.clock.snapshot(),
          eventId: envelope.id,
          tags: envelope.tags
        };
        client.res.write(`event: ${eventName}\n`);
        client.res.write(`data: ${JSON.stringify(ssePayload)}\n\n`);
      } catch (error) {
        console.warn("dropping SSE client", { clientId, error });
        this.unregisterSse(clientId);
      }
    }

    for (const { socket, clock } of this.sockets.values()) {
      clock.increment();
      socket.emit(eventName, {
        payload,
        vector: clock.snapshot(),
        eventId: envelope.id,
        timestamp: envelope.timestamp,
        tags: envelope.tags
      });
    }
  }

  close() {
    this.shuttingDown = true;
    for (const clientId of Array.from(this.sseClients.keys())) {
      this.unregisterSse(clientId);
    }
    this.sockets.clear();
  }
}

const logger = pino({ level: process.env['LOG_LEVEL'] ?? 'info' });
const orchestratorBootStartedAt = Date.now();

const redis = new Redis({
  host: process.env['REDIS_HOST'] ?? '127.0.0.1',
  port: Number(process.env['REDIS_PORT'] ?? 6379),
  ...(process.env['REDIS_USERNAME'] ? { username: process.env['REDIS_USERNAME'] } : {}),
  ...(process.env['REDIS_PASSWORD'] ? { password: process.env['REDIS_PASSWORD'] } : {}),
  maxRetriesPerRequest: 4
});

redis.on("error", error => {
  logger.warn({ err: error }, "redis connection issue");
});

redis.on("ready", () => {
  logger.info("redis ready for blueprint caching");
});

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: "*", credentials: true },
  transports: ["websocket"],
  perMessageDeflate: { threshold: 2048 },
  allowEIO3: false
});

const orchestrator = new HyperOrchestrator();
const eventStore = new EventStore({
  snapshotInterval: 256,
  compactionThreshold: 5000,
  retentionPeriod: 1000 * 60 * 60 * 24,
  enableTimeTravel: true
});
const realtime = new RealtimeMultiplexer(io, eventStore);

const blueprintCacheKey = (sessionId: string) => `orchestrator:blueprint:${sessionId}`;

async function cacheBlueprintSnapshot(blueprint: SessionBlueprint) {
  try {
    await redis.set(blueprintCacheKey(blueprint.id), JSON.stringify(blueprint), "EX", 60);
  } catch (error) {
    logger.warn({ err: error, blueprintId: blueprint.id }, "failed to cache blueprint snapshot");
  }
}

async function dropCachedBlueprint(sessionId: string) {
  try {
    await redis.del(blueprintCacheKey(sessionId));
  } catch (error) {
    logger.warn({ err: error, sessionId }, "failed to drop cached blueprint");
  }
}

app.use(rateLimit({
  windowMs: 60_000,
  max: Number(process.env['RATE_LIMIT_MAX_REQUESTS'] ?? 5000),
  standardHeaders: true,
  legacyHeaders: false
}));
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({ origin: process.env['PANEL_ORIGIN'] ?? '*', credentials: true }));
app.use(compression());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    logger.debug({
      req: { method: req.method, url: req.originalUrl },
      res: { statusCode: res.statusCode },
      durationMs
    }, "http request completed");
  });
  next();
});

function normalizeDefinitions(payload: unknown): SessionDefinition[] {
  if (Array.isArray(payload)) {
    return payload as SessionDefinition[];
  }
  if (typeof payload === "object" && payload && Array.isArray((payload as { sessions?: unknown }).sessions)) {
    return (payload as { sessions: SessionDefinition[] }).sessions;
  }
  return [];
}

async function broadcastBlueprint(blueprint: SessionBlueprint, eventName: "session/created" | "session/updated" | "session/deleted") {
  const tags = typeof blueprint.status === "string" ? [blueprint.status] : [];
  await realtime.broadcast(eventName, { blueprint }, { sessionId: blueprint.id, tags });
  if (eventName === "session/deleted") {
    await dropCachedBlueprint(blueprint.id);
  } else {
    await cacheBlueprintSnapshot(blueprint);
  }
}

app.get("/sessions", (_req, res) => {
  const blueprints = orchestrator.getBlueprintSnapshot();
  res.json({
    sessions: blueprints.map(item => item.definition),
    blueprints
  });
});

app.get("/metrics/global", (_req, res) => {
  res.json(orchestrator.getGlobalMetrics());
});

app.get("/hypergrid", (_req, res) => {
  res.json(orchestrator.getHypergridSnapshot());
});

app.post("/embed/bulk", async (req: Request<{}, {}, BulkEmbedRequest>, res: Response): Promise<void> => {
  const { urls, bulkOptions, proxyRequirements, renderingOptions } = req.body ?? {};
  if (!Array.isArray(urls) || urls.length === 0) {
    res.status(400).json({ error: "urls must be a non-empty array" });
    return;
  }

  const startedAt = Date.now();

  try {
    const result = await orchestrator.createBulkEmbeds({
      urls,
      bulkOptions,
      proxyRequirements,
      renderingOptions
    });

    await Promise.all(
      result.successful.map(blueprint => broadcastBlueprint(blueprint, "session/created"))
    );

    const response: BulkEmbedResponse = {
      totalProcessed: result.totalProcessed,
      createdSessionIds: result.successful.map(item => item.id),
      failedEntries: result.failed.map(entry => ({
        url: entry.url,
        reason: entry.error.message
      })),
      processingTimeMs: Date.now() - startedAt
    };
    res.json(response);
  } catch (error) {
    logger.error({ err: error }, "bulk embed failed");
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/embed/scale-million", async (req: Request, res: Response): Promise<void> => {
  const { targetSessions } = (req.body ?? {}) as { targetSessions?: number };
  const target = typeof targetSessions === "number" && targetSessions > 0 ? targetSessions : 1_000_000;

  try {
    const outcome = await orchestrator.scaleToMillion(target);
    const createdBlueprints = orchestrator
      .getBlueprintSnapshot()
      .filter(bp => outcome.createdSessionIds.includes(bp.id));

    await Promise.all(createdBlueprints.map(bp => broadcastBlueprint(bp, "session/created")));

    res.json({
      targetReached: outcome.targetReached,
      currentSessions: outcome.currentSessions,
      targetSessions: target,
      scalingTimeMs: outcome.scalingTimeMs,
      failedSessionCount: outcome.failedSessionCount,
      resourceUtilization: outcome.resourceUtilization
    });
  } catch (error) {
    logger.error({ err: error }, "scale-to-million failed");
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/sessions/batch", async (req: Request, res: Response): Promise<void> => {
  const definitions = normalizeDefinitions(req.body);
  if (!definitions.length) {
    res.status(400).json({ error: "payload must contain session definitions" });
    return;
  }
  if (definitions.length > 512) {
    res.status(400).json({ error: "batch limit exceeded" });
    return;
  }

  try {
    const { successes, failures } = orchestrator.bulkUpsert(definitions);
    await Promise.all(successes.map(({ blueprint, isNew }) => broadcastBlueprint(blueprint, isNew ? "session/created" : "session/updated")));

    const createdIds = successes.map(({ blueprint }) => blueprint.id);
    const errors = failures.map(item => ({
      definition: item.definition,
      message: item.error.message
    }));

    res.status(207).json({
      created: createdIds.length,
      failed: errors.length,
      sessionIds: createdIds,
      errors
    });
  } catch (error) {
    logger.error({ err: error }, "sessions/batch failed");
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/sessions/:id/scale", async (req: Request, res: Response): Promise<void> => {
  const sessionId = req.params.id;
  const target = Number(req.body?.targetReplicaCount);
  if (!Number.isFinite(target) || target <= 0) {
    res.status(400).json({ error: "targetReplicaCount must be positive" });
    return;
  }

  const success = await orchestrator.scaleSession(sessionId, target);
  if (!success) {
    res.status(404).json({ error: "session not found" });
    return;
  }

  const blueprint = orchestrator.getBlueprint(sessionId);
  if (blueprint) {
    await broadcastBlueprint(blueprint, "session/updated");
  }
  res.json({ ok: true });
});

app.get("/sessions/stream", (req: Request, res: Response) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });

  res.write(`event: heartbeat\n`);
  res.write(`data: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);

  const clientId = realtime.registerSse(res);
  realtime.sendSnapshot(clientId, orchestrator.getBlueprintSnapshot(), orchestrator.getHypergridSnapshot());

  req.on("close", () => {
    realtime.unregisterSse(clientId);
  });
});

io.on("connection", socket => {
  realtime.registerSocket(socket);
  socket.emit("orchestrator:welcome", {
    node: os.hostname(),
    workerCount: os.cpus().length,
    timestamp: Date.now()
  });
});

const metricsTicker = setInterval(() => {
  void (async () => {
    const blueprints = orchestrator.getBlueprintSnapshot();
    await Promise.all(
      blueprints.map(async blueprint => {
        const snapshot = orchestrator.getMetrics(blueprint.id);
        if (snapshot) {
          await realtime.broadcast("session/metrics", { sessionId: blueprint.id, metrics: snapshot as MetricsSnapshot }, {
            sessionId: blueprint.id,
            tags: ["metrics"]
          });
        }
      })
    );
  })().catch(error => {
    console.warn("metrics ticker failure", error);
  });
}, 2000);

const hypergridTicker = setInterval(() => {
  void (async () => {
    const snapshot = orchestrator.getHypergridSnapshot();
    await realtime.broadcast("hypergrid/update", snapshot, { tags: ["hypergrid"] });
  })().catch(error => {
    console.warn("hypergrid ticker failure", error);
  });
}, 5000);

const PORT = Number(process.env['ORCHESTRATOR_PORT'] ?? 4000);

server.listen(PORT, () => {
  const bootstrapMs = Date.now() - orchestratorBootStartedAt;
  logger.info({
    port: PORT,
    bootstrapMs,
    capabilities: ["synthetic-embeds", "event-sourcing", "quantum-scheduling"]
  }, "⚡️ Hyper Orchestrator online");
});

function gracefulShutdown() {
  logger.warn("Received shutdown signal - draining orchestrator");
  clearInterval(metricsTicker);
  clearInterval(hypergridTicker);
  realtime.close();
  orchestrator.destroy();
  server.close(() => {
    logger.info("HTTP server closed - exiting process");
    process.exit(0);
  });
  if (redis.status !== "end") {
    void redis.quit().catch(error => {
      logger.warn({ err: error }, "failed to close redis connection gracefully");
    });
  }
}

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);
