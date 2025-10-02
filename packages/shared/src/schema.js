import { z } from "zod";
const viewportSchema = z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    deviceScaleFactor: z.number().min(0.1).max(5).default(1)
});
const executionProfileSchema = z.object({
    engine: z.enum(["chromium-headless", "chromium-headful", "webgpu", "remote-render", "hypermedia-virtual"]).default("chromium-headless"),
    concurrencyClass: z.enum(["single", "burst", "massive"]).default("single"),
    viewport: viewportSchema.default({ width: 1280, height: 720, deviceScaleFactor: 1 }),
    navigationTimeoutMs: z.number().int().positive().default(45000),
    scriptTimeoutMs: z.number().int().positive().default(10000),
    sandbox: z.boolean().default(true),
    captureVideo: z.boolean().default(false),
    captureScreenshots: z.boolean().default(true),
    emulateMedia: z.enum(["none", "screen", "print"]).default("none"),
    userAgent: z.string().min(1).optional()
});
export const networkShapingSchema = z.object({
    bandwidthKbps: z.number().int().positive().default(50000),
    latencyMs: z.number().int().nonnegative().default(40),
    jitterMs: z.number().int().nonnegative().default(5),
    packetLoss: z.number().min(0).max(1).default(0)
});
export const proxyRequirementSchema = z.object({
    poolId: z.string().optional(),
    regions: z.array(z.string()).default([]),
    countries: z.array(z.string()).default([]),
    rotationStrategy: z.enum(["round-robin", "sticky", "burst"]).default("round-robin"),
    rotationSeconds: z.number().int().positive().default(60),
    failoverPoolIds: z.array(z.string()).default([])
});
export const sessionTargetSchema = z.object({
    id: z.string().uuid().optional(),
    label: z.string().min(1),
    url: z.string().url(),
    initialPath: z.string().optional(),
    headers: z.record(z.string(), z.string()).default({}),
    scriptInjections: z.array(z.string()).default([]),
    rendering: executionProfileSchema.default({
        engine: "chromium-headless",
        concurrencyClass: "single",
        viewport: { width: 1280, height: 720, deviceScaleFactor: 1 },
        navigationTimeoutMs: 45000,
        scriptTimeoutMs: 10000,
        sandbox: true,
        captureVideo: false,
        captureScreenshots: true,
        emulateMedia: "none"
    }),
    network: networkShapingSchema.default({
        bandwidthKbps: 50000,
        latencyMs: 40,
        jitterMs: 5,
        packetLoss: 0
    }),
    proxy: proxyRequirementSchema.default({
        rotationStrategy: "round-robin",
        rotationSeconds: 60,
        regions: [],
        countries: [],
        failoverPoolIds: []
    }),
    geoAffinity: z.array(z.string()).default([])
});
export const replicaPolicySchema = z.object({
    targetReplicaCount: z.number().int().nonnegative(),
    maxReplicaBurst: z.number().int().nonnegative().default(0),
    sampleRate: z.number().min(0).max(1).default(0.001)
});
export const replicaShardSchema = z.object({
    id: z.string().uuid(),
    label: z.string(),
    region: z.string(),
    capacity: z.number().int().positive(),
    warmPool: z.number().int().nonnegative().default(0),
    proxyPoolId: z.string().optional(),
    latencyBudgetMs: z.number().int().positive().default(500),
    autoscaleWindowSec: z.number().int().positive().default(30)
});
export const sessionDefinitionSchema = z.object({
    target: sessionTargetSchema,
    policy: replicaPolicySchema,
    shards: z.array(replicaShardSchema).default([]),
    tags: z.array(z.string()).default([]),
    metadata: z.record(z.string(), z.unknown()).optional()
});
export const sessionBlueprintSchema = z.object({
    id: z.string().uuid(),
    definition: sessionDefinitionSchema,
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
    version: z.number().int().min(1),
    status: z.enum(["draft", "steady", "scaling", "degraded", "terminated"]).default("draft"),
    metricsTtlMs: z.number().int().positive().default(5000)
});
//# sourceMappingURL=schema.js.map