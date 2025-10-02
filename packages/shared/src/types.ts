export enum SessionStatus {
  INITIALIZING = 'initializing',
  RUNNING = 'running',
  PAUSED = 'paused',
  FAILED = 'failed',
  COMPLETED = 'completed'
}

export interface ProxyConfig {
  host: string;
  port: number;
  protocol: 'http' | 'https' | 'socks5';
  auth?: {
    username: string;
    password: string;
  };
  country?: string;
}

export interface SessionBlueprint {
  id: string;
  targetUrl: string;
  proxyConfig?: ProxyConfig;
  headers?: Record<string, string>;
  cookies?: Array<{
    name: string;
    value: string;
    domain?: string;
    path?: string;
  }>;
  createdAt: Date;
}

export interface WebSession {
  id: string;
  blueprintId: string;
  status: SessionStatus;
  startTime: Date;
  endTime?: Date;
  country?: string;
  metrics: SessionMetrics;
  health: SessionHealth;
}

export interface SessionMetrics {
  responseTime: number;
  throughput: number;
  errorRate: number;
  activeConnections: number;
  cpuUsage: number;
  memoryUsage: number;
  bandwidth: number;
  requestsPerSecond: number;
}

export interface SessionHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  uptime: number;
  errors: Array<{
    timestamp: Date;
    message: string;
    code?: string;
  }>;
}

export interface MetricsSnapshot {
  timestamp: Date;
  totalSessions: number;
  activeSessions: number;
  failedSessions: number;
  averageResponseTime: number;
  totalThroughput: number;
  systemLoad: {
    cpu: number;
    memory: number;
    activeConnections: number;
  };
}

export interface LoadDistribution {
  byStatus: Record<string, number>;
  byCountry: Record<string, number>;
  byProxy: Record<string, number>;
  timestamp: Date;
}
