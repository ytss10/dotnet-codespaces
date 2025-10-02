<?php
/**
 * MegaWeb Orchestrator - Advanced Metrics Collector
 * Real-time performance monitoring and analytics
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/database.php';

class MetricsCollector {
    private $db;
    
    public function __construct() {
        $this->db = DatabaseManager::getInstance();
    }
    
    /**
     * Record metric for session
     */
    public function recordSessionMetric($sessionId, $metricType, $value, $jsonData = null) {
        if (!METRICS_ENABLED) {
            return false;
        }
        
        $this->db->insert('metrics', [
            'session_id' => $sessionId,
            'replica_id' => null,
            'metric_type' => $metricType,
            'metric_value' => $value,
            'metric_json' => $jsonData ? json_encode($jsonData, JSON_OPTIONS) : null
        ]);
        
        return true;
    }
    
    /**
     * Record metric for replica
     */
    public function recordReplicaMetric($replicaId, $metricType, $value, $jsonData = null) {
        if (!METRICS_ENABLED) {
            return false;
        }
        
        // Get session ID from replica
        $replica = $this->db->query("SELECT session_id FROM replicas WHERE id = ?", [$replicaId]);
        
        if (empty($replica)) {
            return false;
        }
        
        $this->db->insert('metrics', [
            'session_id' => $replica[0]['session_id'],
            'replica_id' => $replicaId,
            'metric_type' => $metricType,
            'metric_value' => $value,
            'metric_json' => $jsonData ? json_encode($jsonData, JSON_OPTIONS) : null
        ]);
        
        return true;
    }
    
    /**
     * Get session metrics summary
     */
    public function getSessionMetrics($sessionId, $metricType = null, $hours = 24) {
        $where = ['session_id = ?', 'timestamp > DATE_SUB(NOW(), INTERVAL ? HOUR)'];
        $params = [$sessionId, $hours];
        
        if ($metricType) {
            $where[] = 'metric_type = ?';
            $params[] = $metricType;
        }
        
        return $this->db->query(
            "SELECT * FROM metrics 
             WHERE " . implode(' AND ', $where) . "
             ORDER BY timestamp DESC
             LIMIT 1000",
            $params
        );
    }
    
    /**
     * Get aggregated metrics
     */
    public function getAggregatedMetrics($metricType, $interval = 'HOUR', $hours = 24) {
        $intervalMap = [
            'MINUTE' => '%Y-%m-%d %H:%i:00',
            'HOUR' => '%Y-%m-%d %H:00:00',
            'DAY' => '%Y-%m-%d 00:00:00'
        ];
        
        $format = $intervalMap[$interval] ?? $intervalMap['HOUR'];
        
        return $this->db->query(
            "SELECT 
                DATE_FORMAT(timestamp, ?) as time_bucket,
                COUNT(*) as count,
                AVG(metric_value) as avg_value,
                MIN(metric_value) as min_value,
                MAX(metric_value) as max_value,
                STDDEV(metric_value) as stddev_value
             FROM metrics
             WHERE metric_type = ? 
               AND timestamp > DATE_SUB(NOW(), INTERVAL ? HOUR)
             GROUP BY time_bucket
             ORDER BY time_bucket DESC",
            [$format, $metricType, $hours]
        );
    }
    
    /**
     * Get metric percentiles
     */
    public function getMetricPercentiles($metricType, $hours = 24) {
        $metrics = $this->db->query(
            "SELECT metric_value
             FROM metrics
             WHERE metric_type = ?
               AND timestamp > DATE_SUB(NOW(), INTERVAL ? HOUR)
             ORDER BY metric_value",
            [$metricType, $hours]
        );
        
        if (empty($metrics)) {
            return null;
        }
        
        $values = array_column($metrics, 'metric_value');
        $count = count($values);
        
        return [
            'p50' => $this->getPercentile($values, 50),
            'p75' => $this->getPercentile($values, 75),
            'p90' => $this->getPercentile($values, 90),
            'p95' => $this->getPercentile($values, 95),
            'p99' => $this->getPercentile($values, 99),
            'count' => $count
        ];
    }
    
    /**
     * Calculate percentile
     */
    private function getPercentile($values, $percentile) {
        $count = count($values);
        $index = ($percentile / 100) * ($count - 1);
        $lower = floor($index);
        $upper = ceil($index);
        
        if ($lower === $upper) {
            return $values[$lower];
        }
        
        $weight = $index - $lower;
        return $values[$lower] * (1 - $weight) + $values[$upper] * $weight;
    }
    
    /**
     * Get top sessions by metric
     */
    public function getTopSessions($metricType, $limit = 10, $hours = 24) {
        return $this->db->query(
            "SELECT 
                m.session_id,
                s.url,
                AVG(m.metric_value) as avg_value,
                COUNT(*) as data_points
             FROM metrics m
             JOIN sessions s ON m.session_id = s.id
             WHERE m.metric_type = ?
               AND m.timestamp > DATE_SUB(NOW(), INTERVAL ? HOUR)
             GROUP BY m.session_id
             ORDER BY avg_value DESC
             LIMIT ?",
            [$metricType, $hours, $limit]
        );
    }
    
    /**
     * Get real-time metrics (last 5 minutes)
     */
    public function getRealTimeMetrics() {
        $queries = [
            'sessions_per_minute' => "
                SELECT COUNT(DISTINCT session_id) as value
                FROM metrics
                WHERE timestamp > DATE_SUB(NOW(), INTERVAL 1 MINUTE)
            ",
            'metrics_per_second' => "
                SELECT COUNT(*) / 60 as value
                FROM metrics
                WHERE timestamp > DATE_SUB(NOW(), INTERVAL 1 MINUTE)
            ",
            'avg_latency' => "
                SELECT AVG(metric_value) as value
                FROM metrics
                WHERE metric_type = 'latency_ms'
                  AND timestamp > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
            ",
            'error_rate' => "
                SELECT 
                    (SUM(CASE WHEN metric_type = 'error' THEN 1 ELSE 0 END) / COUNT(*)) * 100 as value
                FROM metrics
                WHERE timestamp > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
            "
        ];
        
        $results = [];
        foreach ($queries as $key => $query) {
            $result = $this->db->query($query);
            $results[$key] = round($result[0]['value'] ?? 0, 2);
        }
        
        return $results;
    }
    
    /**
     * Record system resource metrics
     */
    public function recordSystemMetrics() {
        $metrics = [
            'cpu_load_1min' => sys_getloadavg()[0] ?? 0,
            'memory_usage' => memory_get_usage(true),
            'memory_peak' => memory_get_peak_usage(true),
            'disk_free' => disk_free_space('.'),
        ];
        
        foreach ($metrics as $type => $value) {
            $this->db->insert('metrics', [
                'session_id' => null,
                'replica_id' => null,
                'metric_type' => "system.$type",
                'metric_value' => $value,
                'metric_json' => null
            ]);
        }
        
        return $metrics;
    }
    
    /**
     * Get system health score (0-100)
     */
    public function getSystemHealthScore() {
        $weights = [
            'cpu' => 0.3,
            'memory' => 0.3,
            'disk' => 0.2,
            'errors' => 0.2
        ];
        
        // CPU score (based on load average)
        $load = sys_getloadavg()[0] ?? 0;
        $cpuScore = max(0, 100 - ($load * 20)); // Penalty for high load
        
        // Memory score
        $memUsed = memory_get_usage(true);
        $memLimit = $this->parseMemoryLimit(ini_get('memory_limit'));
        $memUsage = $memLimit > 0 ? ($memUsed / $memLimit) * 100 : 0;
        $memScore = max(0, 100 - $memUsage);
        
        // Disk score
        $diskFree = disk_free_space('.');
        $diskTotal = disk_total_space('.');
        $diskUsage = $diskTotal > 0 ? (($diskTotal - $diskFree) / $diskTotal) * 100 : 0;
        $diskScore = max(0, 100 - $diskUsage);
        
        // Error rate score
        $errorRate = $this->db->query(
            "SELECT 
                (SUM(CASE WHEN metric_type LIKE 'error%' THEN 1 ELSE 0 END) / GREATEST(COUNT(*), 1)) * 100 as error_rate
             FROM metrics
             WHERE timestamp > DATE_SUB(NOW(), INTERVAL 1 HOUR)"
        )[0]['error_rate'] ?? 0;
        $errorScore = max(0, 100 - ($errorRate * 10));
        
        // Calculate weighted score
        $totalScore = (
            $cpuScore * $weights['cpu'] +
            $memScore * $weights['memory'] +
            $diskScore * $weights['disk'] +
            $errorScore * $weights['errors']
        );
        
        return [
            'overall_score' => round($totalScore, 2),
            'components' => [
                'cpu' => round($cpuScore, 2),
                'memory' => round($memScore, 2),
                'disk' => round($diskScore, 2),
                'errors' => round($errorScore, 2)
            ],
            'details' => [
                'cpu_load' => $load,
                'memory_usage_mb' => round($memUsed / 1024 / 1024, 2),
                'memory_limit_mb' => round($memLimit / 1024 / 1024, 2),
                'disk_free_gb' => round($diskFree / 1024 / 1024 / 1024, 2),
                'error_rate_percent' => round($errorRate, 2)
            ]
        ];
    }
    
    /**
     * Parse memory limit string to bytes
     */
    private function parseMemoryLimit($limit) {
        $limit = trim($limit);
        $last = strtolower($limit[strlen($limit)-1]);
        $limit = (int)$limit;
        
        switch($last) {
            case 'g': $limit *= 1024;
            case 'm': $limit *= 1024;
            case 'k': $limit *= 1024;
        }
        
        return $limit;
    }
    
    /**
     * Export metrics to CSV
     */
    public function exportMetrics($metricType = null, $hours = 24) {
        $where = ['timestamp > DATE_SUB(NOW(), INTERVAL ? HOUR)'];
        $params = [$hours];
        
        if ($metricType) {
            $where[] = 'metric_type = ?';
            $params[] = $metricType;
        }
        
        $metrics = $this->db->query(
            "SELECT * FROM metrics 
             WHERE " . implode(' AND ', $where) . "
             ORDER BY timestamp DESC",
            $params
        );
        
        // Generate CSV
        $csv = "ID,Session ID,Replica ID,Metric Type,Value,Timestamp\n";
        
        foreach ($metrics as $metric) {
            $csv .= sprintf(
                "%s,%s,%s,%s,%s,%s\n",
                $metric['id'],
                $metric['session_id'] ?? '',
                $metric['replica_id'] ?? '',
                $metric['metric_type'],
                $metric['metric_value'],
                $metric['timestamp']
            );
        }
        
        return $csv;
    }
    
    /**
     * Cleanup old metrics
     */
    public function cleanup($retentionDays = null) {
        $days = $retentionDays ?? METRICS_RETENTION_DAYS;
        
        $deleted = $this->db->query(
            "DELETE FROM metrics WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? DAY)",
            [$days]
        );
        
        return $deleted;
    }
    
    /**
     * Get metric types summary
     */
    public function getMetricTypes() {
        return $this->db->query(
            "SELECT 
                metric_type,
                COUNT(*) as count,
                MIN(timestamp) as first_recorded,
                MAX(timestamp) as last_recorded
             FROM metrics
             GROUP BY metric_type
             ORDER BY count DESC"
        );
    }
}
