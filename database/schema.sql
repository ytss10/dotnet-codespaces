-- ============================================================================
-- MegaWeb Orchestrator - MySQL Database Schema
-- Advanced schema for hosting 1M concurrent website sessions with proxy support
-- Optimized for InfinityFree hosting environment
-- ============================================================================

-- Sessions table: Core session blueprint storage
CREATE TABLE IF NOT EXISTS `sessions` (
  `id` VARCHAR(36) PRIMARY KEY,
  `url` VARCHAR(2048) NOT NULL,
  `status` ENUM('draft', 'steady', 'scaling', 'degraded', 'terminated') DEFAULT 'draft',
  `region` VARCHAR(100),
  `proxy_pool_id` VARCHAR(100),
  `target_replica_count` INT DEFAULT 1,
  `current_replica_count` INT DEFAULT 0,
  `max_replica_burst` INT DEFAULT 0,
  `sample_rate` DECIMAL(5,4) DEFAULT 0.0010,
  `engine` VARCHAR(50) DEFAULT 'chromium-headless',
  `concurrency_class` ENUM('single', 'burst', 'massive') DEFAULT 'single',
  `viewport_width` INT DEFAULT 1280,
  `viewport_height` INT DEFAULT 720,
  `device_scale_factor` DECIMAL(3,2) DEFAULT 1.00,
  `navigation_timeout_ms` INT DEFAULT 45000,
  `script_timeout_ms` INT DEFAULT 10000,
  `sandbox` BOOLEAN DEFAULT TRUE,
  `capture_video` BOOLEAN DEFAULT FALSE,
  `capture_screenshots` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_status` (`status`),
  INDEX `idx_region` (`region`),
  INDEX `idx_proxy_pool` (`proxy_pool_id`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Custom proxy servers table: Internal proxy infrastructure
CREATE TABLE IF NOT EXISTS `custom_proxy_servers` (
  `id` VARCHAR(36) PRIMARY KEY,
  `server_ip` VARCHAR(45) NOT NULL,
  `port` INT NOT NULL,
  `protocol` ENUM('http', 'https', 'socks4', 'socks5') DEFAULT 'socks5',
  `region` VARCHAR(100),
  `country` VARCHAR(2),
  `current_connections` INT DEFAULT 0,
  `max_connections` INT DEFAULT 1000,
  `avg_response_time` INT DEFAULT 0,
  `uptime_percentage` DECIMAL(5,2) DEFAULT 99.00,
  `priority` INT DEFAULT 100,
  `active` BOOLEAN DEFAULT TRUE,
  `server_type` ENUM('entry', 'intermediate', 'exit', 'bridge') DEFAULT 'exit',
  `encryption_support` JSON,
  `tunnel_protocols` JSON,
  `bandwidth_capacity_mbps` INT DEFAULT 1000,
  `current_bandwidth_usage` DECIMAL(10,2) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_active` (`active`),
  INDEX `idx_region` (`region`),
  INDEX `idx_priority` (`priority`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dynamic IP pool table: Managed IP addresses for rotation
CREATE TABLE IF NOT EXISTS `dynamic_ip_pool` (
  `id` VARCHAR(36) PRIMARY KEY,
  `ip_address` VARCHAR(45) NOT NULL UNIQUE,
  `subnet` VARCHAR(45),
  `gateway` VARCHAR(45),
  `country` VARCHAR(2),
  `region` VARCHAR(100),
  `city` VARCHAR(255),
  `isp` VARCHAR(255),
  `asn` VARCHAR(20),
  `reputation_score` DECIMAL(5,2) DEFAULT 100.00,
  `available` BOOLEAN DEFAULT TRUE,
  `last_used` TIMESTAMP NULL,
  `usage_count` INT DEFAULT 0,
  `success_count` INT DEFAULT 0,
  `failure_count` INT DEFAULT 0,
  `blacklist_status` ENUM('clean', 'flagged', 'blacklisted') DEFAULT 'clean',
  `allocation_type` ENUM('static', 'dynamic', 'rotating') DEFAULT 'dynamic',
  `lease_expires_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_available` (`available`),
  INDEX `idx_country` (`country`),
  INDEX `idx_reputation` (`reputation_score`),
  INDEX `idx_last_used` (`last_used`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Proxy connections table: Active tunnel connections
CREATE TABLE IF NOT EXISTS `proxy_connections` (
  `id` VARCHAR(100) PRIMARY KEY,
  `target_url` TEXT,
  `route_id` VARCHAR(100),
  `source_ip` VARCHAR(45),
  `protocol` VARCHAR(20),
  `status` ENUM('establishing', 'active', 'idle', 'closed', 'failed') DEFAULT 'establishing',
  `established_at` TIMESTAMP NULL,
  `closed_at` TIMESTAMP NULL,
  `last_activity` TIMESTAMP NULL,
  `requests_count` INT DEFAULT 0,
  `bytes_sent` BIGINT DEFAULT 0,
  `bytes_received` BIGINT DEFAULT 0,
  `avg_latency_ms` INT DEFAULT 0,
  `config` JSON,
  `error_message` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_status` (`status`),
  INDEX `idx_source_ip` (`source_ip`),
  INDEX `idx_established_at` (`established_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Proxy hop logs table: Track multi-hop tunnel routing
CREATE TABLE IF NOT EXISTS `proxy_hop_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `connection_id` VARCHAR(100) NOT NULL,
  `hop_type` ENUM('entry', 'intermediate', 'exit') NOT NULL,
  `hop_ip` VARCHAR(45) NOT NULL,
  `hop_port` INT NOT NULL,
  `protocol` VARCHAR(20),
  `encryption` VARCHAR(50),
  `latency_ms` INT DEFAULT 0,
  `bytes_transferred` BIGINT DEFAULT 0,
  `established_at` TIMESTAMP NULL,
  `closed_at` TIMESTAMP NULL,
  INDEX `idx_connection_id` (`connection_id`),
  INDEX `idx_hop_ip` (`hop_ip`),
  INDEX `idx_established_at` (`established_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tunnel routes table: Store routing configurations
CREATE TABLE IF NOT EXISTS `tunnel_routes` (
  `id` VARCHAR(100) PRIMARY KEY,
  `source_ip` VARCHAR(45),
  `destination_url` TEXT,
  `hop_count` INT DEFAULT 3,
  `encryption_layers` INT DEFAULT 2,
  `routing_algorithm` VARCHAR(50) DEFAULT 'intelligent',
  `performance_score` DECIMAL(5,2) DEFAULT 0,
  `success_rate` DECIMAL(5,2) DEFAULT 0,
  `avg_response_time` INT DEFAULT 0,
  `usage_count` INT DEFAULT 0,
  `last_used` TIMESTAMP NULL,
  `route_config` JSON,
  `active` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_source_ip` (`source_ip`),
  INDEX `idx_active` (`active`),
  INDEX `idx_performance` (`performance_score`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- IP rotation history table: Track IP rotation events
CREATE TABLE IF NOT EXISTS `ip_rotation_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `connection_id` VARCHAR(100) NOT NULL,
  `old_ip` VARCHAR(45),
  `new_ip` VARCHAR(45),
  `rotation_reason` ENUM('scheduled', 'detection', 'failure', 'manual') DEFAULT 'scheduled',
  `rotation_strategy` VARCHAR(50),
  `success` BOOLEAN DEFAULT TRUE,
  `rotated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_connection_id` (`connection_id`),
  INDEX `idx_rotated_at` (`rotated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Proxy pools table: Multi-country proxy management with enhanced control
CREATE TABLE IF NOT EXISTS `proxy_pools` (
  `id` VARCHAR(100) PRIMARY KEY,
  `pool_name` VARCHAR(255) NOT NULL,
  `regions` JSON,
  `countries` JSON,
  `rotation_strategy` ENUM('round-robin', 'sticky', 'burst', 'intelligent', 'reputation-based') DEFAULT 'round-robin',
  `rotation_seconds` INT DEFAULT 60,
  `failover_pool_ids` JSON,
  `active` BOOLEAN DEFAULT TRUE,
  `total_proxies` INT DEFAULT 0,
  `allowed_providers` JSON,
  `blocked_providers` JSON,
  `require_verification` BOOLEAN DEFAULT TRUE,
  `min_reputation_score` DECIMAL(5,2) DEFAULT 30.00,
  `require_dedicated` BOOLEAN DEFAULT FALSE,
  `require_residential` BOOLEAN DEFAULT FALSE,
  `min_anonymity_level` ENUM('transparent', 'anonymous', 'elite') DEFAULT 'anonymous',
  `enable_connection_isolation` BOOLEAN DEFAULT FALSE,
  `max_connections_per_proxy` INT DEFAULT 10,
  `auto_verify_interval_hours` INT DEFAULT 24,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Note: External proxy providers have been completely removed
-- All proxy functionality is now self-contained using custom infrastructure
-- See custom_proxy_servers and dynamic_ip_pool tables for managed infrastructure

-- Replicas table: Individual replica instances
CREATE TABLE IF NOT EXISTS `replicas` (
  `id` VARCHAR(36) PRIMARY KEY,
  `session_id` VARCHAR(36) NOT NULL,
  `shard_id` VARCHAR(36),
  `label` VARCHAR(255),
  `region` VARCHAR(100),
  `capacity` INT DEFAULT 1,
  `warm_pool` INT DEFAULT 0,
  `proxy_id` VARCHAR(36),
  `latency_budget_ms` INT DEFAULT 500,
  `autoscale_window_sec` INT DEFAULT 30,
  `status` ENUM('initializing', 'running', 'paused', 'stopped', 'error') DEFAULT 'initializing',
  `current_url` VARCHAR(2048),
  `last_heartbeat_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`proxy_id`) REFERENCES `proxies`(`id`) ON DELETE SET NULL,
  INDEX `idx_session_id` (`session_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_region` (`region`),
  INDEX `idx_shard_id` (`shard_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Metrics table: Performance and usage metrics
CREATE TABLE IF NOT EXISTS `metrics` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `session_id` VARCHAR(36),
  `replica_id` VARCHAR(36),
  `metric_type` VARCHAR(100) NOT NULL,
  `metric_value` DECIMAL(20, 4),
  `metric_json` JSON,
  `timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`replica_id`) REFERENCES `replicas`(`id`) ON DELETE CASCADE,
  INDEX `idx_session_id` (`session_id`),
  INDEX `idx_replica_id` (`replica_id`),
  INDEX `idx_metric_type` (`metric_type`),
  INDEX `idx_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Events table: Event sourcing for audit trail
CREATE TABLE IF NOT EXISTS `events` (
  `id` VARCHAR(36) PRIMARY KEY,
  `event_type` VARCHAR(100) NOT NULL,
  `aggregate_id` VARCHAR(36),
  `aggregate_type` VARCHAR(100),
  `payload` JSON NOT NULL,
  `metadata` JSON,
  `timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `vector_clock` JSON,
  INDEX `idx_aggregate` (`aggregate_id`, `aggregate_type`),
  INDEX `idx_event_type` (`event_type`),
  INDEX `idx_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Hypergrid tiles: Spatial visualization grid
CREATE TABLE IF NOT EXISTS `hypergrid_tiles` (
  `id` VARCHAR(36) PRIMARY KEY,
  `x` INT NOT NULL,
  `y` INT NOT NULL,
  `z` INT DEFAULT 0,
  `session_ids` JSON,
  `replica_count` INT DEFAULT 0,
  `dominant_status` VARCHAR(50),
  `dominant_country` VARCHAR(2),
  `snapshot_data` JSON,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_coordinates` (`x`, `y`, `z`),
  INDEX `idx_updated_at` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Configuration table: System-wide settings
CREATE TABLE IF NOT EXISTS `configuration` (
  `config_key` VARCHAR(100) PRIMARY KEY,
  `config_value` TEXT,
  `config_type` ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
  `description` TEXT,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default configuration
INSERT INTO `configuration` (`config_key`, `config_value`, `config_type`, `description`) VALUES
('max_sessions', '1000000', 'number', 'Maximum concurrent sessions allowed'),
('max_replicas_per_session', '10000', 'number', 'Maximum replicas per session'),
('default_proxy_pool', 'global-pool', 'string', 'Default proxy pool ID'),
('enable_metrics_collection', '1', 'boolean', 'Enable metrics collection'),
('metrics_retention_days', '30', 'number', 'Metrics retention period in days'),
('enable_hypergrid', '1', 'boolean', 'Enable hypergrid visualization'),
('hypergrid_tile_size', '1000', 'number', 'Hypergrid tile size for spatial partitioning')
ON DUPLICATE KEY UPDATE `config_value` = VALUES(`config_value`);

-- ============================================================================
-- Performance optimization views
-- ============================================================================

-- Active sessions summary view
CREATE OR REPLACE VIEW `v_active_sessions` AS
SELECT 
  s.id,
  s.url,
  s.status,
  s.region,
  s.target_replica_count,
  s.current_replica_count,
  s.created_at,
  COUNT(DISTINCT r.id) as actual_replica_count,
  pp.pool_name as proxy_pool_name
FROM sessions s
LEFT JOIN replicas r ON s.id = r.session_id AND r.status IN ('running', 'initializing')
LEFT JOIN proxy_pools pp ON s.proxy_pool_id = pp.id
WHERE s.status IN ('steady', 'scaling')
GROUP BY s.id;

-- Proxy performance view
CREATE OR REPLACE VIEW `v_proxy_performance` AS
SELECT 
  p.id,
  p.host,
  p.port,
  p.country,
  p.region,
  p.active,
  p.success_count,
  p.failure_count,
  CASE 
    WHEN (p.success_count + p.failure_count) > 0 
    THEN ROUND((p.success_count / (p.success_count + p.failure_count)) * 100, 2)
    ELSE 0 
  END as success_rate,
  pp.pool_name
FROM proxies p
JOIN proxy_pools pp ON p.pool_id = pp.id;

-- Global metrics summary view
CREATE OR REPLACE VIEW `v_global_metrics` AS
SELECT 
  (SELECT COUNT(*) FROM sessions WHERE status IN ('steady', 'scaling')) as active_sessions,
  (SELECT COUNT(*) FROM replicas WHERE status IN ('running', 'initializing')) as active_replicas,
  (SELECT COUNT(*) FROM proxies WHERE active = TRUE) as active_proxies,
  (SELECT COUNT(DISTINCT country) FROM proxies WHERE active = TRUE) as countries_covered,
  (SELECT AVG(metric_value) FROM metrics WHERE metric_type = 'latency_ms' AND timestamp > DATE_SUB(NOW(), INTERVAL 1 HOUR)) as avg_latency_ms,
  (SELECT COUNT(*) FROM events WHERE timestamp > DATE_SUB(NOW(), INTERVAL 1 HOUR)) as events_last_hour;

-- ============================================================================
-- Stored procedures for advanced operations
-- ============================================================================

DELIMITER $$

-- Procedure: Create bulk sessions with auto-scaling
CREATE PROCEDURE sp_create_bulk_sessions(
  IN p_urls JSON,
  IN p_proxy_pool_id VARCHAR(100),
  IN p_target_replicas INT,
  IN p_region VARCHAR(100)
)
BEGIN
  DECLARE v_url VARCHAR(2048);
  DECLARE v_session_id VARCHAR(36);
  DECLARE v_idx INT DEFAULT 0;
  DECLARE v_count INT;
  
  SET v_count = JSON_LENGTH(p_urls);
  
  WHILE v_idx < v_count DO
    SET v_url = JSON_UNQUOTE(JSON_EXTRACT(p_urls, CONCAT('$[', v_idx, ']')));
    SET v_session_id = UUID();
    
    INSERT INTO sessions (
      id, url, status, region, proxy_pool_id, 
      target_replica_count, current_replica_count
    ) VALUES (
      v_session_id, v_url, 'steady', p_region, p_proxy_pool_id,
      p_target_replicas, 0
    );
    
    -- Create initial replicas
    CALL sp_scale_session_replicas(v_session_id, p_target_replicas);
    
    SET v_idx = v_idx + 1;
  END WHILE;
END$$

-- Procedure: Scale session replicas dynamically
CREATE PROCEDURE sp_scale_session_replicas(
  IN p_session_id VARCHAR(36),
  IN p_target_count INT
)
BEGIN
  DECLARE v_current_count INT;
  DECLARE v_diff INT;
  DECLARE v_idx INT DEFAULT 0;
  DECLARE v_replica_id VARCHAR(36);
  DECLARE v_proxy_id VARCHAR(36);
  
  SELECT current_replica_count INTO v_current_count
  FROM sessions WHERE id = p_session_id;
  
  SET v_diff = p_target_count - v_current_count;
  
  IF v_diff > 0 THEN
    -- Scale up: Add new replicas
    WHILE v_idx < v_diff DO
      SET v_replica_id = UUID();
      
      -- Get next available proxy
      SELECT id INTO v_proxy_id
      FROM proxies
      WHERE active = TRUE
      ORDER BY last_used_at ASC
      LIMIT 1;
      
      INSERT INTO replicas (
        id, session_id, status, proxy_id, label
      ) VALUES (
        v_replica_id, p_session_id, 'running', v_proxy_id,
        CONCAT('replica-', v_idx)
      );
      
      -- Update proxy last used time
      UPDATE proxies SET last_used_at = NOW() WHERE id = v_proxy_id;
      
      SET v_idx = v_idx + 1;
    END WHILE;
    
  ELSEIF v_diff < 0 THEN
    -- Scale down: Remove excess replicas
    DELETE FROM replicas 
    WHERE session_id = p_session_id 
    ORDER BY created_at DESC 
    LIMIT ABS(v_diff);
  END IF;
  
  -- Update session replica count
  UPDATE sessions 
  SET current_replica_count = p_target_count,
      status = 'steady'
  WHERE id = p_session_id;
END$$

-- Procedure: Cleanup old metrics
CREATE PROCEDURE sp_cleanup_old_metrics(IN p_retention_days INT)
BEGIN
  DELETE FROM metrics 
  WHERE timestamp < DATE_SUB(NOW(), INTERVAL p_retention_days DAY);
  
  DELETE FROM events 
  WHERE timestamp < DATE_SUB(NOW(), INTERVAL p_retention_days DAY);
END$$

-- Procedure: Get hypergrid snapshot
CREATE PROCEDURE sp_get_hypergrid_snapshot()
BEGIN
  SELECT 
    id,
    x,
    y,
    z,
    session_ids,
    replica_count,
    dominant_status,
    dominant_country,
    snapshot_data,
    updated_at
  FROM hypergrid_tiles
  WHERE updated_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
  ORDER BY x, y, z;
END$$

DELIMITER ;

-- ============================================================================
-- Triggers for automated operations
-- ============================================================================

-- Trigger: Update session replica count on replica insert
DELIMITER $$
CREATE TRIGGER tr_replica_insert_update_session
AFTER INSERT ON replicas
FOR EACH ROW
BEGIN
  UPDATE sessions 
  SET current_replica_count = current_replica_count + 1
  WHERE id = NEW.session_id;
END$$
DELIMITER ;

-- Trigger: Update session replica count on replica delete
DELIMITER $$
CREATE TRIGGER tr_replica_delete_update_session
AFTER DELETE ON replicas
FOR EACH ROW
BEGIN
  UPDATE sessions 
  SET current_replica_count = GREATEST(0, current_replica_count - 1)
  WHERE id = OLD.session_id;
END$$
DELIMITER ;

-- Trigger: Log events on session status change
DELIMITER $$
CREATE TRIGGER tr_session_status_change_event
AFTER UPDATE ON sessions
FOR EACH ROW
BEGIN
  IF OLD.status != NEW.status THEN
    INSERT INTO events (id, event_type, aggregate_id, aggregate_type, payload, timestamp)
    VALUES (
      UUID(),
      'session.status.changed',
      NEW.id,
      'session',
      JSON_OBJECT(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'replica_count', NEW.current_replica_count
      ),
      NOW()
    );
  END IF;
END$$
DELIMITER ;

-- ============================================================================
-- Indexes for optimal performance
-- ============================================================================

-- Composite indexes for common query patterns
CREATE INDEX idx_sessions_status_region ON sessions(status, region);
CREATE INDEX idx_replicas_session_status ON replicas(session_id, status);
CREATE INDEX idx_proxies_pool_country ON proxies(pool_id, country, active);
CREATE INDEX idx_metrics_session_timestamp ON metrics(session_id, timestamp);

-- ============================================================================
-- Initial sample data for testing
-- ============================================================================

-- Create default proxy pool
INSERT INTO proxy_pools (id, pool_name, regions, countries, active, total_proxies) VALUES
('global-pool', 'Global Proxy Pool', JSON_ARRAY('us-east', 'eu-west', 'asia-pacific'), JSON_ARRAY('US', 'GB', 'DE', 'JP', 'SG'), TRUE, 0)
ON DUPLICATE KEY UPDATE pool_name = VALUES(pool_name);

-- ============================================================================
-- End of schema
-- ============================================================================
