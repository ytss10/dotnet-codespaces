import { z } from "zod";
export declare const networkShapingSchema: z.ZodObject<{
    bandwidthKbps: z.ZodDefault<z.ZodNumber>;
    latencyMs: z.ZodDefault<z.ZodNumber>;
    jitterMs: z.ZodDefault<z.ZodNumber>;
    packetLoss: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    bandwidthKbps: number;
    latencyMs: number;
    jitterMs: number;
    packetLoss: number;
}, {
    bandwidthKbps?: number | undefined;
    latencyMs?: number | undefined;
    jitterMs?: number | undefined;
    packetLoss?: number | undefined;
}>;
export declare const proxyRequirementSchema: z.ZodObject<{
    poolId: z.ZodOptional<z.ZodString>;
    regions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    countries: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    rotationStrategy: z.ZodDefault<z.ZodEnum<["round-robin", "sticky", "burst"]>>;
    rotationSeconds: z.ZodDefault<z.ZodNumber>;
    failoverPoolIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    regions: string[];
    countries: string[];
    rotationStrategy: "round-robin" | "sticky" | "burst";
    rotationSeconds: number;
    failoverPoolIds: string[];
    poolId?: string | undefined;
}, {
    poolId?: string | undefined;
    regions?: string[] | undefined;
    countries?: string[] | undefined;
    rotationStrategy?: "round-robin" | "sticky" | "burst" | undefined;
    rotationSeconds?: number | undefined;
    failoverPoolIds?: string[] | undefined;
}>;
export declare const sessionTargetSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    label: z.ZodString;
    url: z.ZodString;
    initialPath: z.ZodOptional<z.ZodString>;
    headers: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    scriptInjections: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    rendering: z.ZodDefault<z.ZodObject<{
        engine: z.ZodDefault<z.ZodEnum<["chromium-headless", "chromium-headful", "webgpu", "remote-render", "hypermedia-virtual"]>>;
        concurrencyClass: z.ZodDefault<z.ZodEnum<["single", "burst", "massive"]>>;
        viewport: z.ZodDefault<z.ZodObject<{
            width: z.ZodNumber;
            height: z.ZodNumber;
            deviceScaleFactor: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            width: number;
            height: number;
            deviceScaleFactor: number;
        }, {
            width: number;
            height: number;
            deviceScaleFactor?: number | undefined;
        }>>;
        navigationTimeoutMs: z.ZodDefault<z.ZodNumber>;
        scriptTimeoutMs: z.ZodDefault<z.ZodNumber>;
        sandbox: z.ZodDefault<z.ZodBoolean>;
        captureVideo: z.ZodDefault<z.ZodBoolean>;
        captureScreenshots: z.ZodDefault<z.ZodBoolean>;
        emulateMedia: z.ZodDefault<z.ZodEnum<["none", "screen", "print"]>>;
        userAgent: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        engine: "chromium-headless" | "chromium-headful" | "webgpu" | "remote-render" | "hypermedia-virtual";
        concurrencyClass: "burst" | "single" | "massive";
        viewport: {
            width: number;
            height: number;
            deviceScaleFactor: number;
        };
        navigationTimeoutMs: number;
        scriptTimeoutMs: number;
        sandbox: boolean;
        captureVideo: boolean;
        captureScreenshots: boolean;
        emulateMedia: "none" | "screen" | "print";
        userAgent?: string | undefined;
    }, {
        engine?: "chromium-headless" | "chromium-headful" | "webgpu" | "remote-render" | "hypermedia-virtual" | undefined;
        concurrencyClass?: "burst" | "single" | "massive" | undefined;
        viewport?: {
            width: number;
            height: number;
            deviceScaleFactor?: number | undefined;
        } | undefined;
        navigationTimeoutMs?: number | undefined;
        scriptTimeoutMs?: number | undefined;
        sandbox?: boolean | undefined;
        captureVideo?: boolean | undefined;
        captureScreenshots?: boolean | undefined;
        emulateMedia?: "none" | "screen" | "print" | undefined;
        userAgent?: string | undefined;
    }>>;
    network: z.ZodDefault<z.ZodObject<{
        bandwidthKbps: z.ZodDefault<z.ZodNumber>;
        latencyMs: z.ZodDefault<z.ZodNumber>;
        jitterMs: z.ZodDefault<z.ZodNumber>;
        packetLoss: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        bandwidthKbps: number;
        latencyMs: number;
        jitterMs: number;
        packetLoss: number;
    }, {
        bandwidthKbps?: number | undefined;
        latencyMs?: number | undefined;
        jitterMs?: number | undefined;
        packetLoss?: number | undefined;
    }>>;
    proxy: z.ZodDefault<z.ZodObject<{
        poolId: z.ZodOptional<z.ZodString>;
        regions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        countries: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        rotationStrategy: z.ZodDefault<z.ZodEnum<["round-robin", "sticky", "burst"]>>;
        rotationSeconds: z.ZodDefault<z.ZodNumber>;
        failoverPoolIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        regions: string[];
        countries: string[];
        rotationStrategy: "round-robin" | "sticky" | "burst";
        rotationSeconds: number;
        failoverPoolIds: string[];
        poolId?: string | undefined;
    }, {
        poolId?: string | undefined;
        regions?: string[] | undefined;
        countries?: string[] | undefined;
        rotationStrategy?: "round-robin" | "sticky" | "burst" | undefined;
        rotationSeconds?: number | undefined;
        failoverPoolIds?: string[] | undefined;
    }>>;
    geoAffinity: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    label: string;
    url: string;
    headers: Record<string, string>;
    scriptInjections: string[];
    rendering: {
        engine: "chromium-headless" | "chromium-headful" | "webgpu" | "remote-render" | "hypermedia-virtual";
        concurrencyClass: "burst" | "single" | "massive";
        viewport: {
            width: number;
            height: number;
            deviceScaleFactor: number;
        };
        navigationTimeoutMs: number;
        scriptTimeoutMs: number;
        sandbox: boolean;
        captureVideo: boolean;
        captureScreenshots: boolean;
        emulateMedia: "none" | "screen" | "print";
        userAgent?: string | undefined;
    };
    network: {
        bandwidthKbps: number;
        latencyMs: number;
        jitterMs: number;
        packetLoss: number;
    };
    proxy: {
        regions: string[];
        countries: string[];
        rotationStrategy: "round-robin" | "sticky" | "burst";
        rotationSeconds: number;
        failoverPoolIds: string[];
        poolId?: string | undefined;
    };
    geoAffinity: string[];
    id?: string | undefined;
    initialPath?: string | undefined;
}, {
    label: string;
    url: string;
    id?: string | undefined;
    initialPath?: string | undefined;
    headers?: Record<string, string> | undefined;
    scriptInjections?: string[] | undefined;
    rendering?: {
        engine?: "chromium-headless" | "chromium-headful" | "webgpu" | "remote-render" | "hypermedia-virtual" | undefined;
        concurrencyClass?: "burst" | "single" | "massive" | undefined;
        viewport?: {
            width: number;
            height: number;
            deviceScaleFactor?: number | undefined;
        } | undefined;
        navigationTimeoutMs?: number | undefined;
        scriptTimeoutMs?: number | undefined;
        sandbox?: boolean | undefined;
        captureVideo?: boolean | undefined;
        captureScreenshots?: boolean | undefined;
        emulateMedia?: "none" | "screen" | "print" | undefined;
        userAgent?: string | undefined;
    } | undefined;
    network?: {
        bandwidthKbps?: number | undefined;
        latencyMs?: number | undefined;
        jitterMs?: number | undefined;
        packetLoss?: number | undefined;
    } | undefined;
    proxy?: {
        poolId?: string | undefined;
        regions?: string[] | undefined;
        countries?: string[] | undefined;
        rotationStrategy?: "round-robin" | "sticky" | "burst" | undefined;
        rotationSeconds?: number | undefined;
        failoverPoolIds?: string[] | undefined;
    } | undefined;
    geoAffinity?: string[] | undefined;
}>;
export declare const replicaPolicySchema: z.ZodObject<{
    targetReplicaCount: z.ZodNumber;
    maxReplicaBurst: z.ZodDefault<z.ZodNumber>;
    sampleRate: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    targetReplicaCount: number;
    maxReplicaBurst: number;
    sampleRate: number;
}, {
    targetReplicaCount: number;
    maxReplicaBurst?: number | undefined;
    sampleRate?: number | undefined;
}>;
export declare const replicaShardSchema: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    region: z.ZodString;
    capacity: z.ZodNumber;
    warmPool: z.ZodDefault<z.ZodNumber>;
    proxyPoolId: z.ZodOptional<z.ZodString>;
    latencyBudgetMs: z.ZodDefault<z.ZodNumber>;
    autoscaleWindowSec: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    id: string;
    label: string;
    region: string;
    capacity: number;
    warmPool: number;
    latencyBudgetMs: number;
    autoscaleWindowSec: number;
    proxyPoolId?: string | undefined;
}, {
    id: string;
    label: string;
    region: string;
    capacity: number;
    warmPool?: number | undefined;
    proxyPoolId?: string | undefined;
    latencyBudgetMs?: number | undefined;
    autoscaleWindowSec?: number | undefined;
}>;
export declare const sessionDefinitionSchema: z.ZodObject<{
    target: z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        label: z.ZodString;
        url: z.ZodString;
        initialPath: z.ZodOptional<z.ZodString>;
        headers: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
        scriptInjections: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        rendering: z.ZodDefault<z.ZodObject<{
            engine: z.ZodDefault<z.ZodEnum<["chromium-headless", "chromium-headful", "webgpu", "remote-render", "hypermedia-virtual"]>>;
            concurrencyClass: z.ZodDefault<z.ZodEnum<["single", "burst", "massive"]>>;
            viewport: z.ZodDefault<z.ZodObject<{
                width: z.ZodNumber;
                height: z.ZodNumber;
                deviceScaleFactor: z.ZodDefault<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                width: number;
                height: number;
                deviceScaleFactor: number;
            }, {
                width: number;
                height: number;
                deviceScaleFactor?: number | undefined;
            }>>;
            navigationTimeoutMs: z.ZodDefault<z.ZodNumber>;
            scriptTimeoutMs: z.ZodDefault<z.ZodNumber>;
            sandbox: z.ZodDefault<z.ZodBoolean>;
            captureVideo: z.ZodDefault<z.ZodBoolean>;
            captureScreenshots: z.ZodDefault<z.ZodBoolean>;
            emulateMedia: z.ZodDefault<z.ZodEnum<["none", "screen", "print"]>>;
            userAgent: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            engine: "chromium-headless" | "chromium-headful" | "webgpu" | "remote-render" | "hypermedia-virtual";
            concurrencyClass: "burst" | "single" | "massive";
            viewport: {
                width: number;
                height: number;
                deviceScaleFactor: number;
            };
            navigationTimeoutMs: number;
            scriptTimeoutMs: number;
            sandbox: boolean;
            captureVideo: boolean;
            captureScreenshots: boolean;
            emulateMedia: "none" | "screen" | "print";
            userAgent?: string | undefined;
        }, {
            engine?: "chromium-headless" | "chromium-headful" | "webgpu" | "remote-render" | "hypermedia-virtual" | undefined;
            concurrencyClass?: "burst" | "single" | "massive" | undefined;
            viewport?: {
                width: number;
                height: number;
                deviceScaleFactor?: number | undefined;
            } | undefined;
            navigationTimeoutMs?: number | undefined;
            scriptTimeoutMs?: number | undefined;
            sandbox?: boolean | undefined;
            captureVideo?: boolean | undefined;
            captureScreenshots?: boolean | undefined;
            emulateMedia?: "none" | "screen" | "print" | undefined;
            userAgent?: string | undefined;
        }>>;
        network: z.ZodDefault<z.ZodObject<{
            bandwidthKbps: z.ZodDefault<z.ZodNumber>;
            latencyMs: z.ZodDefault<z.ZodNumber>;
            jitterMs: z.ZodDefault<z.ZodNumber>;
            packetLoss: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            bandwidthKbps: number;
            latencyMs: number;
            jitterMs: number;
            packetLoss: number;
        }, {
            bandwidthKbps?: number | undefined;
            latencyMs?: number | undefined;
            jitterMs?: number | undefined;
            packetLoss?: number | undefined;
        }>>;
        proxy: z.ZodDefault<z.ZodObject<{
            poolId: z.ZodOptional<z.ZodString>;
            regions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            countries: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            rotationStrategy: z.ZodDefault<z.ZodEnum<["round-robin", "sticky", "burst"]>>;
            rotationSeconds: z.ZodDefault<z.ZodNumber>;
            failoverPoolIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            regions: string[];
            countries: string[];
            rotationStrategy: "round-robin" | "sticky" | "burst";
            rotationSeconds: number;
            failoverPoolIds: string[];
            poolId?: string | undefined;
        }, {
            poolId?: string | undefined;
            regions?: string[] | undefined;
            countries?: string[] | undefined;
            rotationStrategy?: "round-robin" | "sticky" | "burst" | undefined;
            rotationSeconds?: number | undefined;
            failoverPoolIds?: string[] | undefined;
        }>>;
        geoAffinity: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        label: string;
        url: string;
        headers: Record<string, string>;
        scriptInjections: string[];
        rendering: {
            engine: "chromium-headless" | "chromium-headful" | "webgpu" | "remote-render" | "hypermedia-virtual";
            concurrencyClass: "burst" | "single" | "massive";
            viewport: {
                width: number;
                height: number;
                deviceScaleFactor: number;
            };
            navigationTimeoutMs: number;
            scriptTimeoutMs: number;
            sandbox: boolean;
            captureVideo: boolean;
            captureScreenshots: boolean;
            emulateMedia: "none" | "screen" | "print";
            userAgent?: string | undefined;
        };
        network: {
            bandwidthKbps: number;
            latencyMs: number;
            jitterMs: number;
            packetLoss: number;
        };
        proxy: {
            regions: string[];
            countries: string[];
            rotationStrategy: "round-robin" | "sticky" | "burst";
            rotationSeconds: number;
            failoverPoolIds: string[];
            poolId?: string | undefined;
        };
        geoAffinity: string[];
        id?: string | undefined;
        initialPath?: string | undefined;
    }, {
        label: string;
        url: string;
        id?: string | undefined;
        initialPath?: string | undefined;
        headers?: Record<string, string> | undefined;
        scriptInjections?: string[] | undefined;
        rendering?: {
            engine?: "chromium-headless" | "chromium-headful" | "webgpu" | "remote-render" | "hypermedia-virtual" | undefined;
            concurrencyClass?: "burst" | "single" | "massive" | undefined;
            viewport?: {
                width: number;
                height: number;
                deviceScaleFactor?: number | undefined;
            } | undefined;
            navigationTimeoutMs?: number | undefined;
            scriptTimeoutMs?: number | undefined;
            sandbox?: boolean | undefined;
            captureVideo?: boolean | undefined;
            captureScreenshots?: boolean | undefined;
            emulateMedia?: "none" | "screen" | "print" | undefined;
            userAgent?: string | undefined;
        } | undefined;
        network?: {
            bandwidthKbps?: number | undefined;
            latencyMs?: number | undefined;
            jitterMs?: number | undefined;
            packetLoss?: number | undefined;
        } | undefined;
        proxy?: {
            poolId?: string | undefined;
            regions?: string[] | undefined;
            countries?: string[] | undefined;
            rotationStrategy?: "round-robin" | "sticky" | "burst" | undefined;
            rotationSeconds?: number | undefined;
            failoverPoolIds?: string[] | undefined;
        } | undefined;
        geoAffinity?: string[] | undefined;
    }>;
    policy: z.ZodObject<{
        targetReplicaCount: z.ZodNumber;
        maxReplicaBurst: z.ZodDefault<z.ZodNumber>;
        sampleRate: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        targetReplicaCount: number;
        maxReplicaBurst: number;
        sampleRate: number;
    }, {
        targetReplicaCount: number;
        maxReplicaBurst?: number | undefined;
        sampleRate?: number | undefined;
    }>;
    shards: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        region: z.ZodString;
        capacity: z.ZodNumber;
        warmPool: z.ZodDefault<z.ZodNumber>;
        proxyPoolId: z.ZodOptional<z.ZodString>;
        latencyBudgetMs: z.ZodDefault<z.ZodNumber>;
        autoscaleWindowSec: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        label: string;
        region: string;
        capacity: number;
        warmPool: number;
        latencyBudgetMs: number;
        autoscaleWindowSec: number;
        proxyPoolId?: string | undefined;
    }, {
        id: string;
        label: string;
        region: string;
        capacity: number;
        warmPool?: number | undefined;
        proxyPoolId?: string | undefined;
        latencyBudgetMs?: number | undefined;
        autoscaleWindowSec?: number | undefined;
    }>, "many">>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    target: {
        label: string;
        url: string;
        headers: Record<string, string>;
        scriptInjections: string[];
        rendering: {
            engine: "chromium-headless" | "chromium-headful" | "webgpu" | "remote-render" | "hypermedia-virtual";
            concurrencyClass: "burst" | "single" | "massive";
            viewport: {
                width: number;
                height: number;
                deviceScaleFactor: number;
            };
            navigationTimeoutMs: number;
            scriptTimeoutMs: number;
            sandbox: boolean;
            captureVideo: boolean;
            captureScreenshots: boolean;
            emulateMedia: "none" | "screen" | "print";
            userAgent?: string | undefined;
        };
        network: {
            bandwidthKbps: number;
            latencyMs: number;
            jitterMs: number;
            packetLoss: number;
        };
        proxy: {
            regions: string[];
            countries: string[];
            rotationStrategy: "round-robin" | "sticky" | "burst";
            rotationSeconds: number;
            failoverPoolIds: string[];
            poolId?: string | undefined;
        };
        geoAffinity: string[];
        id?: string | undefined;
        initialPath?: string | undefined;
    };
    policy: {
        targetReplicaCount: number;
        maxReplicaBurst: number;
        sampleRate: number;
    };
    shards: {
        id: string;
        label: string;
        region: string;
        capacity: number;
        warmPool: number;
        latencyBudgetMs: number;
        autoscaleWindowSec: number;
        proxyPoolId?: string | undefined;
    }[];
    tags: string[];
    metadata?: Record<string, unknown> | undefined;
}, {
    target: {
        label: string;
        url: string;
        id?: string | undefined;
        initialPath?: string | undefined;
        headers?: Record<string, string> | undefined;
        scriptInjections?: string[] | undefined;
        rendering?: {
            engine?: "chromium-headless" | "chromium-headful" | "webgpu" | "remote-render" | "hypermedia-virtual" | undefined;
            concurrencyClass?: "burst" | "single" | "massive" | undefined;
            viewport?: {
                width: number;
                height: number;
                deviceScaleFactor?: number | undefined;
            } | undefined;
            navigationTimeoutMs?: number | undefined;
            scriptTimeoutMs?: number | undefined;
            sandbox?: boolean | undefined;
            captureVideo?: boolean | undefined;
            captureScreenshots?: boolean | undefined;
            emulateMedia?: "none" | "screen" | "print" | undefined;
            userAgent?: string | undefined;
        } | undefined;
        network?: {
            bandwidthKbps?: number | undefined;
            latencyMs?: number | undefined;
            jitterMs?: number | undefined;
            packetLoss?: number | undefined;
        } | undefined;
        proxy?: {
            poolId?: string | undefined;
            regions?: string[] | undefined;
            countries?: string[] | undefined;
            rotationStrategy?: "round-robin" | "sticky" | "burst" | undefined;
            rotationSeconds?: number | undefined;
            failoverPoolIds?: string[] | undefined;
        } | undefined;
        geoAffinity?: string[] | undefined;
    };
    policy: {
        targetReplicaCount: number;
        maxReplicaBurst?: number | undefined;
        sampleRate?: number | undefined;
    };
    shards?: {
        id: string;
        label: string;
        region: string;
        capacity: number;
        warmPool?: number | undefined;
        proxyPoolId?: string | undefined;
        latencyBudgetMs?: number | undefined;
        autoscaleWindowSec?: number | undefined;
    }[] | undefined;
    tags?: string[] | undefined;
    metadata?: Record<string, unknown> | undefined;
}>;
export declare const sessionBlueprintSchema: z.ZodObject<{
    id: z.ZodString;
    definition: z.ZodObject<{
        target: z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
            label: z.ZodString;
            url: z.ZodString;
            initialPath: z.ZodOptional<z.ZodString>;
            headers: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
            scriptInjections: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            rendering: z.ZodDefault<z.ZodObject<{
                engine: z.ZodDefault<z.ZodEnum<["chromium-headless", "chromium-headful", "webgpu", "remote-render", "hypermedia-virtual"]>>;
                concurrencyClass: z.ZodDefault<z.ZodEnum<["single", "burst", "massive"]>>;
                viewport: z.ZodDefault<z.ZodObject<{
                    width: z.ZodNumber;
                    height: z.ZodNumber;
                    deviceScaleFactor: z.ZodDefault<z.ZodNumber>;
                }, "strip", z.ZodTypeAny, {
                    width: number;
                    height: number;
                    deviceScaleFactor: number;
                }, {
                    width: number;
                    height: number;
                    deviceScaleFactor?: number | undefined;
                }>>;
                navigationTimeoutMs: z.ZodDefault<z.ZodNumber>;
                scriptTimeoutMs: z.ZodDefault<z.ZodNumber>;
                sandbox: z.ZodDefault<z.ZodBoolean>;
                captureVideo: z.ZodDefault<z.ZodBoolean>;
                captureScreenshots: z.ZodDefault<z.ZodBoolean>;
                emulateMedia: z.ZodDefault<z.ZodEnum<["none", "screen", "print"]>>;
                userAgent: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                engine: "chromium-headless" | "chromium-headful" | "webgpu" | "remote-render" | "hypermedia-virtual";
                concurrencyClass: "burst" | "single" | "massive";
                viewport: {
                    width: number;
                    height: number;
                    deviceScaleFactor: number;
                };
                navigationTimeoutMs: number;
                scriptTimeoutMs: number;
                sandbox: boolean;
                captureVideo: boolean;
                captureScreenshots: boolean;
                emulateMedia: "none" | "screen" | "print";
                userAgent?: string | undefined;
            }, {
                engine?: "chromium-headless" | "chromium-headful" | "webgpu" | "remote-render" | "hypermedia-virtual" | undefined;
                concurrencyClass?: "burst" | "single" | "massive" | undefined;
                viewport?: {
                    width: number;
                    height: number;
                    deviceScaleFactor?: number | undefined;
                } | undefined;
                navigationTimeoutMs?: number | undefined;
                scriptTimeoutMs?: number | undefined;
                sandbox?: boolean | undefined;
                captureVideo?: boolean | undefined;
                captureScreenshots?: boolean | undefined;
                emulateMedia?: "none" | "screen" | "print" | undefined;
                userAgent?: string | undefined;
            }>>;
            network: z.ZodDefault<z.ZodObject<{
                bandwidthKbps: z.ZodDefault<z.ZodNumber>;
                latencyMs: z.ZodDefault<z.ZodNumber>;
                jitterMs: z.ZodDefault<z.ZodNumber>;
                packetLoss: z.ZodDefault<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                bandwidthKbps: number;
                latencyMs: number;
                jitterMs: number;
                packetLoss: number;
            }, {
                bandwidthKbps?: number | undefined;
                latencyMs?: number | undefined;
                jitterMs?: number | undefined;
                packetLoss?: number | undefined;
            }>>;
            proxy: z.ZodDefault<z.ZodObject<{
                poolId: z.ZodOptional<z.ZodString>;
                regions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                countries: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                rotationStrategy: z.ZodDefault<z.ZodEnum<["round-robin", "sticky", "burst"]>>;
                rotationSeconds: z.ZodDefault<z.ZodNumber>;
                failoverPoolIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            }, "strip", z.ZodTypeAny, {
                regions: string[];
                countries: string[];
                rotationStrategy: "round-robin" | "sticky" | "burst";
                rotationSeconds: number;
                failoverPoolIds: string[];
                poolId?: string | undefined;
            }, {
                poolId?: string | undefined;
                regions?: string[] | undefined;
                countries?: string[] | undefined;
                rotationStrategy?: "round-robin" | "sticky" | "burst" | undefined;
                rotationSeconds?: number | undefined;
                failoverPoolIds?: string[] | undefined;
            }>>;
            geoAffinity: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            label: string;
            url: string;
            headers: Record<string, string>;
            scriptInjections: string[];
            rendering: {
                engine: "chromium-headless" | "chromium-headful" | "webgpu" | "remote-render" | "hypermedia-virtual";
                concurrencyClass: "burst" | "single" | "massive";
                viewport: {
                    width: number;
                    height: number;
                    deviceScaleFactor: number;
                };
                navigationTimeoutMs: number;
                scriptTimeoutMs: number;
                sandbox: boolean;
                captureVideo: boolean;
                captureScreenshots: boolean;
                emulateMedia: "none" | "screen" | "print";
                userAgent?: string | undefined;
            };
            network: {
                bandwidthKbps: number;
                latencyMs: number;
                jitterMs: number;
                packetLoss: number;
            };
            proxy: {
                regions: string[];
                countries: string[];
                rotationStrategy: "round-robin" | "sticky" | "burst";
                rotationSeconds: number;
                failoverPoolIds: string[];
                poolId?: string | undefined;
            };
            geoAffinity: string[];
            id?: string | undefined;
            initialPath?: string | undefined;
        }, {
            label: string;
            url: string;
            id?: string | undefined;
            initialPath?: string | undefined;
            headers?: Record<string, string> | undefined;
            scriptInjections?: string[] | undefined;
            rendering?: {
                engine?: "chromium-headless" | "chromium-headful" | "webgpu" | "remote-render" | "hypermedia-virtual" | undefined;
                concurrencyClass?: "burst" | "single" | "massive" | undefined;
                viewport?: {
                    width: number;
                    height: number;
                    deviceScaleFactor?: number | undefined;
                } | undefined;
                navigationTimeoutMs?: number | undefined;
                scriptTimeoutMs?: number | undefined;
                sandbox?: boolean | undefined;
                captureVideo?: boolean | undefined;
                captureScreenshots?: boolean | undefined;
                emulateMedia?: "none" | "screen" | "print" | undefined;
                userAgent?: string | undefined;
            } | undefined;
            network?: {
                bandwidthKbps?: number | undefined;
                latencyMs?: number | undefined;
                jitterMs?: number | undefined;
                packetLoss?: number | undefined;
            } | undefined;
            proxy?: {
                poolId?: string | undefined;
                regions?: string[] | undefined;
                countries?: string[] | undefined;
                rotationStrategy?: "round-robin" | "sticky" | "burst" | undefined;
                rotationSeconds?: number | undefined;
                failoverPoolIds?: string[] | undefined;
            } | undefined;
            geoAffinity?: string[] | undefined;
        }>;
        policy: z.ZodObject<{
            targetReplicaCount: z.ZodNumber;
            maxReplicaBurst: z.ZodDefault<z.ZodNumber>;
            sampleRate: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            targetReplicaCount: number;
            maxReplicaBurst: number;
            sampleRate: number;
        }, {
            targetReplicaCount: number;
            maxReplicaBurst?: number | undefined;
            sampleRate?: number | undefined;
        }>;
        shards: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            region: z.ZodString;
            capacity: z.ZodNumber;
            warmPool: z.ZodDefault<z.ZodNumber>;
            proxyPoolId: z.ZodOptional<z.ZodString>;
            latencyBudgetMs: z.ZodDefault<z.ZodNumber>;
            autoscaleWindowSec: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            label: string;
            region: string;
            capacity: number;
            warmPool: number;
            latencyBudgetMs: number;
            autoscaleWindowSec: number;
            proxyPoolId?: string | undefined;
        }, {
            id: string;
            label: string;
            region: string;
            capacity: number;
            warmPool?: number | undefined;
            proxyPoolId?: string | undefined;
            latencyBudgetMs?: number | undefined;
            autoscaleWindowSec?: number | undefined;
        }>, "many">>;
        tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        target: {
            label: string;
            url: string;
            headers: Record<string, string>;
            scriptInjections: string[];
            rendering: {
                engine: "chromium-headless" | "chromium-headful" | "webgpu" | "remote-render" | "hypermedia-virtual";
                concurrencyClass: "burst" | "single" | "massive";
                viewport: {
                    width: number;
                    height: number;
                    deviceScaleFactor: number;
                };
                navigationTimeoutMs: number;
                scriptTimeoutMs: number;
                sandbox: boolean;
                captureVideo: boolean;
                captureScreenshots: boolean;
                emulateMedia: "none" | "screen" | "print";
                userAgent?: string | undefined;
            };
            network: {
                bandwidthKbps: number;
                latencyMs: number;
                jitterMs: number;
                packetLoss: number;
            };
            proxy: {
                regions: string[];
                countries: string[];
                rotationStrategy: "round-robin" | "sticky" | "burst";
                rotationSeconds: number;
                failoverPoolIds: string[];
                poolId?: string | undefined;
            };
            geoAffinity: string[];
            id?: string | undefined;
            initialPath?: string | undefined;
        };
        policy: {
            targetReplicaCount: number;
            maxReplicaBurst: number;
            sampleRate: number;
        };
        shards: {
            id: string;
            label: string;
            region: string;
            capacity: number;
            warmPool: number;
            latencyBudgetMs: number;
            autoscaleWindowSec: number;
            proxyPoolId?: string | undefined;
        }[];
        tags: string[];
        metadata?: Record<string, unknown> | undefined;
    }, {
        target: {
            label: string;
            url: string;
            id?: string | undefined;
            initialPath?: string | undefined;
            headers?: Record<string, string> | undefined;
            scriptInjections?: string[] | undefined;
            rendering?: {
                engine?: "chromium-headless" | "chromium-headful" | "webgpu" | "remote-render" | "hypermedia-virtual" | undefined;
                concurrencyClass?: "burst" | "single" | "massive" | undefined;
                viewport?: {
                    width: number;
                    height: number;
                    deviceScaleFactor?: number | undefined;
                } | undefined;
                navigationTimeoutMs?: number | undefined;
                scriptTimeoutMs?: number | undefined;
                sandbox?: boolean | undefined;
                captureVideo?: boolean | undefined;
                captureScreenshots?: boolean | undefined;
                emulateMedia?: "none" | "screen" | "print" | undefined;
                userAgent?: string | undefined;
            } | undefined;
            network?: {
                bandwidthKbps?: number | undefined;
                latencyMs?: number | undefined;
                jitterMs?: number | undefined;
                packetLoss?: number | undefined;
            } | undefined;
            proxy?: {
                poolId?: string | undefined;
                regions?: string[] | undefined;
                countries?: string[] | undefined;
                rotationStrategy?: "round-robin" | "sticky" | "burst" | undefined;
                rotationSeconds?: number | undefined;
                failoverPoolIds?: string[] | undefined;
            } | undefined;
            geoAffinity?: string[] | undefined;
        };
        policy: {
            targetReplicaCount: number;
            maxReplicaBurst?: number | undefined;
            sampleRate?: number | undefined;
        };
        shards?: {
            id: string;
            label: string;
            region: string;
            capacity: number;
            warmPool?: number | undefined;
            proxyPoolId?: string | undefined;
            latencyBudgetMs?: number | undefined;
            autoscaleWindowSec?: number | undefined;
        }[] | undefined;
        tags?: string[] | undefined;
        metadata?: Record<string, unknown> | undefined;
    }>;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
    version: z.ZodNumber;
    status: z.ZodDefault<z.ZodEnum<["draft", "steady", "scaling", "degraded", "terminated"]>>;
    metricsTtlMs: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    status: "draft" | "steady" | "scaling" | "degraded" | "terminated";
    id: string;
    definition: {
        target: {
            label: string;
            url: string;
            headers: Record<string, string>;
            scriptInjections: string[];
            rendering: {
                engine: "chromium-headless" | "chromium-headful" | "webgpu" | "remote-render" | "hypermedia-virtual";
                concurrencyClass: "burst" | "single" | "massive";
                viewport: {
                    width: number;
                    height: number;
                    deviceScaleFactor: number;
                };
                navigationTimeoutMs: number;
                scriptTimeoutMs: number;
                sandbox: boolean;
                captureVideo: boolean;
                captureScreenshots: boolean;
                emulateMedia: "none" | "screen" | "print";
                userAgent?: string | undefined;
            };
            network: {
                bandwidthKbps: number;
                latencyMs: number;
                jitterMs: number;
                packetLoss: number;
            };
            proxy: {
                regions: string[];
                countries: string[];
                rotationStrategy: "round-robin" | "sticky" | "burst";
                rotationSeconds: number;
                failoverPoolIds: string[];
                poolId?: string | undefined;
            };
            geoAffinity: string[];
            id?: string | undefined;
            initialPath?: string | undefined;
        };
        policy: {
            targetReplicaCount: number;
            maxReplicaBurst: number;
            sampleRate: number;
        };
        shards: {
            id: string;
            label: string;
            region: string;
            capacity: number;
            warmPool: number;
            latencyBudgetMs: number;
            autoscaleWindowSec: number;
            proxyPoolId?: string | undefined;
        }[];
        tags: string[];
        metadata?: Record<string, unknown> | undefined;
    };
    createdAt: number;
    updatedAt: number;
    version: number;
    metricsTtlMs: number;
}, {
    id: string;
    definition: {
        target: {
            label: string;
            url: string;
            id?: string | undefined;
            initialPath?: string | undefined;
            headers?: Record<string, string> | undefined;
            scriptInjections?: string[] | undefined;
            rendering?: {
                engine?: "chromium-headless" | "chromium-headful" | "webgpu" | "remote-render" | "hypermedia-virtual" | undefined;
                concurrencyClass?: "burst" | "single" | "massive" | undefined;
                viewport?: {
                    width: number;
                    height: number;
                    deviceScaleFactor?: number | undefined;
                } | undefined;
                navigationTimeoutMs?: number | undefined;
                scriptTimeoutMs?: number | undefined;
                sandbox?: boolean | undefined;
                captureVideo?: boolean | undefined;
                captureScreenshots?: boolean | undefined;
                emulateMedia?: "none" | "screen" | "print" | undefined;
                userAgent?: string | undefined;
            } | undefined;
            network?: {
                bandwidthKbps?: number | undefined;
                latencyMs?: number | undefined;
                jitterMs?: number | undefined;
                packetLoss?: number | undefined;
            } | undefined;
            proxy?: {
                poolId?: string | undefined;
                regions?: string[] | undefined;
                countries?: string[] | undefined;
                rotationStrategy?: "round-robin" | "sticky" | "burst" | undefined;
                rotationSeconds?: number | undefined;
                failoverPoolIds?: string[] | undefined;
            } | undefined;
            geoAffinity?: string[] | undefined;
        };
        policy: {
            targetReplicaCount: number;
            maxReplicaBurst?: number | undefined;
            sampleRate?: number | undefined;
        };
        shards?: {
            id: string;
            label: string;
            region: string;
            capacity: number;
            warmPool?: number | undefined;
            proxyPoolId?: string | undefined;
            latencyBudgetMs?: number | undefined;
            autoscaleWindowSec?: number | undefined;
        }[] | undefined;
        tags?: string[] | undefined;
        metadata?: Record<string, unknown> | undefined;
    };
    createdAt: number;
    updatedAt: number;
    version: number;
    status?: "draft" | "steady" | "scaling" | "degraded" | "terminated" | undefined;
    metricsTtlMs?: number | undefined;
}>;
export type SessionTarget = z.infer<typeof sessionTargetSchema>;
export type ReplicaPolicy = z.infer<typeof replicaPolicySchema>;
export type SessionDefinition = z.infer<typeof sessionDefinitionSchema>;
export type ReplicaShard = z.infer<typeof replicaShardSchema>;
export type SessionBlueprint = z.infer<typeof sessionBlueprintSchema>;
export type ProxyRequirement = z.infer<typeof proxyRequirementSchema>;
