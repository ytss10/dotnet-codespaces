import React, { useState, useEffect } from "react";

interface SystemMetrics {
  totalSessions: number;
  activeSessions: number;
  totalProxyPools: number;
  activeProxyNodes: number;
  systemPerformance: {
    memoryUsageMB: number;
    cpuUsage: number;
    requestsPerSecond: number;
    averageLatency: number;
    errorRate: number;
  };
  topRegions: Array<{
    region: string;
    sessions: number;
    performance: number;
  }>;
  alertsAndWarnings: string[];
}

interface SystemMetricsDashboardProps {
  orchestratorUrl: string;
  refreshInterval?: number;
}

export function SystemMetricsDashboard({ 
  orchestratorUrl, 
  refreshInterval = 5000 
}: SystemMetricsDashboardProps) {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch(`${orchestratorUrl}/embed/metrics/global`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        setMetrics(data);
        setError(null);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, refreshInterval);

    return () => clearInterval(interval);
  }, [orchestratorUrl, refreshInterval]);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes.toFixed(0)} B`;
  };

  const formatPercentage = (value: number): string => {
    return `${(value * 100).toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="system-metrics-dashboard system-metrics-dashboard--loading">
        <div className="system-metrics-dashboard__spinner">Loading system metrics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="system-metrics-dashboard system-metrics-dashboard--error">
        <div className="system-metrics-dashboard__error">
          <h3>❌ Metrics Unavailable</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="system-metrics-dashboard system-metrics-dashboard--empty">
        <div className="system-metrics-dashboard__empty">No metrics data available</div>
      </div>
    );
  }

  return (
    <div className="system-metrics-dashboard">
      <div className="system-metrics-dashboard__header">
        <h2>🎯 System Performance Dashboard</h2>
        <div className="system-metrics-dashboard__status">
          <span className="system-metrics-dashboard__indicator system-metrics-dashboard__indicator--active">
            ● LIVE
          </span>
          <span className="system-metrics-dashboard__timestamp">
            Updated: {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>

      {metrics.alertsAndWarnings.length > 0 && (
        <div className="system-metrics-dashboard__alerts">
          <h3>⚠️ Alerts & Warnings</h3>
          <ul className="system-metrics-dashboard__alert-list">
            {metrics.alertsAndWarnings.map((alert, index) => (
              <li key={index} className="system-metrics-dashboard__alert">
                {alert}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="system-metrics-dashboard__overview">
        <div className="system-metrics-dashboard__metric-card">
          <div className="system-metrics-dashboard__metric-value">
            {formatNumber(metrics.totalSessions)}
          </div>
          <div className="system-metrics-dashboard__metric-label">Total Sessions</div>
          <div className="system-metrics-dashboard__metric-detail">
            {formatNumber(metrics.activeSessions)} active
          </div>
        </div>

        <div className="system-metrics-dashboard__metric-card">
          <div className="system-metrics-dashboard__metric-value">
            {formatNumber(metrics.systemPerformance.requestsPerSecond)}
          </div>
          <div className="system-metrics-dashboard__metric-label">Requests/Second</div>
          <div className="system-metrics-dashboard__metric-detail">
            {metrics.systemPerformance.averageLatency.toFixed(0)}ms avg latency
          </div>
        </div>

        <div className="system-metrics-dashboard__metric-card">
          <div className="system-metrics-dashboard__metric-value">
            {formatBytes(metrics.systemPerformance.memoryUsageMB * 1024 * 1024)}
          </div>
          <div className="system-metrics-dashboard__metric-label">Memory Usage</div>
          <div className="system-metrics-dashboard__metric-detail">
            {metrics.systemPerformance.cpuUsage.toFixed(1)}% CPU
          </div>
        </div>

        <div className="system-metrics-dashboard__metric-card">
          <div className="system-metrics-dashboard__metric-value">
            {formatNumber(metrics.activeProxyNodes)}
          </div>
          <div className="system-metrics-dashboard__metric-label">Active Proxies</div>
          <div className="system-metrics-dashboard__metric-detail">
            {metrics.totalProxyPools} pools
          </div>
        </div>
      </div>

      <div className="system-metrics-dashboard__performance">
        <h3>📊 Performance Indicators</h3>
        <div className="system-metrics-dashboard__performance-grid">
          
          <div className="system-metrics-dashboard__performance-item">
            <div className="system-metrics-dashboard__performance-label">Error Rate</div>
            <div className={`system-metrics-dashboard__performance-bar ${
              metrics.systemPerformance.errorRate > 0.05 ? 
              "system-metrics-dashboard__performance-bar--danger" : 
              metrics.systemPerformance.errorRate > 0.02 ? 
              "system-metrics-dashboard__performance-bar--warning" :
              "system-metrics-dashboard__performance-bar--success"
            }`}>
              <div 
                className="system-metrics-dashboard__performance-fill" 
                style={{ width: `${Math.min(100, metrics.systemPerformance.errorRate * 2000)}%` }}
              />
              <span className="system-metrics-dashboard__performance-value">
                {formatPercentage(metrics.systemPerformance.errorRate)}
              </span>
            </div>
          </div>

          <div className="system-metrics-dashboard__performance-item">
            <div className="system-metrics-dashboard__performance-label">CPU Utilization</div>
            <div className={`system-metrics-dashboard__performance-bar ${
              metrics.systemPerformance.cpuUsage > 80 ? 
              "system-metrics-dashboard__performance-bar--danger" : 
              metrics.systemPerformance.cpuUsage > 60 ? 
              "system-metrics-dashboard__performance-bar--warning" :
              "system-metrics-dashboard__performance-bar--success"
            }`}>
              <div 
                className="system-metrics-dashboard__performance-fill" 
                style={{ width: `${Math.min(100, metrics.systemPerformance.cpuUsage)}%` }}
              />
              <span className="system-metrics-dashboard__performance-value">
                {metrics.systemPerformance.cpuUsage.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="system-metrics-dashboard__performance-item">
            <div className="system-metrics-dashboard__performance-label">Response Time</div>
            <div className={`system-metrics-dashboard__performance-bar ${
              metrics.systemPerformance.averageLatency > 1000 ? 
              "system-metrics-dashboard__performance-bar--danger" : 
              metrics.systemPerformance.averageLatency > 500 ? 
              "system-metrics-dashboard__performance-bar--warning" :
              "system-metrics-dashboard__performance-bar--success"
            }`}>
              <div 
                className="system-metrics-dashboard__performance-fill" 
                style={{ width: `${Math.min(100, metrics.systemPerformance.averageLatency / 10)}%` }}
              />
              <span className="system-metrics-dashboard__performance-value">
                {metrics.systemPerformance.averageLatency.toFixed(0)}ms
              </span>
            </div>
          </div>

        </div>
      </div>

      <div className="system-metrics-dashboard__regions">
        <h3>🌍 Top Performing Regions</h3>
        <div className="system-metrics-dashboard__regions-list">
          {metrics.topRegions.slice(0, 5).map((region, index) => (
            <div key={region.region} className="system-metrics-dashboard__region-item">
              <div className="system-metrics-dashboard__region-rank">#{index + 1}</div>
              <div className="system-metrics-dashboard__region-name">{region.region}</div>
              <div className="system-metrics-dashboard__region-sessions">
                {formatNumber(region.sessions)} sessions
              </div>
              <div className="system-metrics-dashboard__region-performance">
                {region.performance.toFixed(0)}ms
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="system-metrics-dashboard__capacity">
        <h3>⚡ Million-Scale Capacity</h3>
        <div className="system-metrics-dashboard__capacity-indicators">
          
          <div className="system-metrics-dashboard__capacity-item">
            <div className="system-metrics-dashboard__capacity-label">Session Capacity</div>
            <div className="system-metrics-dashboard__capacity-progress">
              <div 
                className="system-metrics-dashboard__capacity-bar"
                style={{ width: `${Math.min(100, (metrics.totalSessions / 1000000) * 100)}%` }}
              />
              <span className="system-metrics-dashboard__capacity-text">
                {formatNumber(metrics.totalSessions)} / 1M
              </span>
            </div>
          </div>

          <div className="system-metrics-dashboard__capacity-item">
            <div className="system-metrics-dashboard__capacity-label">Throughput Capacity</div>
            <div className="system-metrics-dashboard__capacity-progress">
              <div 
                className="system-metrics-dashboard__capacity-bar"
                style={{ width: `${Math.min(100, (metrics.systemPerformance.requestsPerSecond / 1000000) * 100)}%` }}
              />
              <span className="system-metrics-dashboard__capacity-text">
                {formatNumber(metrics.systemPerformance.requestsPerSecond)} / 1M RPS
              </span>
            </div>
          </div>

          <div className="system-metrics-dashboard__capacity-item">
            <div className="system-metrics-dashboard__capacity-label">Proxy Network</div>
            <div className="system-metrics-dashboard__capacity-progress">
              <div 
                className="system-metrics-dashboard__capacity-bar"
                style={{ width: `${Math.min(100, (metrics.activeProxyNodes / 10000) * 100)}%` }}
              />
              <span className="system-metrics-dashboard__capacity-text">
                {formatNumber(metrics.activeProxyNodes)} / 10K nodes
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}