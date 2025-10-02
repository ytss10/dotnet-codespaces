export type ReplicaStatus = "initializing" | "active" | "throttled" | "error" | "terminated";
export interface ReplicaSummary {
    id: string;
    sessionId: string;
    status: ReplicaStatus;
    region: string;
    proxyId?: string;
    lastSeenAt: number;
    latencyMs?: number;
    errorCode?: string;
}
export interface MetricsSnapshot {
    sessionId: string;
    timestamp: number;
    activeReplicas: number;
    errorsPerMinute: number;
    medianLatencyMs: number;
    bandwidthKbps: number;
}
