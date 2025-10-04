-- ============================================================================
-- MegaWeb Orchestrator - Unified & Optimized MySQL Schema
-- Production-grade schema for 1M+ concurrent sessions with proxy support
-- Version: 2.0 | Optimized for performance, scalability & maintainability
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';
SET time_zone = '+00:00';

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Sessions: Primary orchestration entities
CREATE TABLE IF NOT EXISTS `sessions` (
  `id` CHAR(36) PRIMARY KEY COMMENT 'UUID v4',
  `url` VARCHAR(2048) NOT NULL,
  `status` ENUM('draft', 'steady', 'scaling', 'degraded', 'terminated') DEFAULT 'draft',
  `region` VARCHAR(100) DEFAULT NULL,
  `proxy_pool_id` CHAR(36) DEFAULT NULL,
  `target_replica_count` INT UNSIGNED DEFAULT 1,
  `current_replica_count` INT UNSIGNED DEFAULT 0,
  `max_replica_burst` INT UNSIGNED DEFAULT 0,
  `sample_rate` DECIMAL(5,4) DEFAULT 0.0010,
  `engine` VARCHAR(50) DEFAULT 'chromium-headless',
  `concurrency_class` ENUM('single', 'burst', 'massive') DEFAULT 'single',
  `viewport_width` SMALLINT UNSIGNED DEFAULT 1280,
  `viewport_height` SMALLINT UNSIGNED DEFAULT 720,
  `device_scale_factor` DECIMAL(3,2) DEFAULT 1.00,
  `navigation_timeout_ms` INT UNSIGNED DEFAULT 45000,
  `script_timeout_ms` INT UNSIGNED DEFAULT 10000,
  `sandbox` BOOLEAN DEFAULT TRUE,
  `capture_video` BOOLEAN DEFAULT FALSE,
  `capture_screenshots` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_status_created` (`status`, `created_at`),
  INDEX `idx_region_status` (`region`, `status`),
  INDEX `idx_proxy_pool` (`proxy_pool_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- Replicas: Individual session instances
CREATE TABLE IF NOT EXISTS `replicas` (
  `id` CHAR(36) PRIMARY KEY,
  `session_id` CHAR(36) NOT NULL,
  `shard_id` CHAR(36) DEFAULT NULL,
  `proxy_node_id` CHAR(36) DEFAULT NULL,
  `worker_id` SMALLINT UNSIGNED DEFAULT NULL,
  `status` ENUM('spawning', 'active', 'idle', 'error', 'terminated') DEFAULT 'spawning',
  `viewport_x` SMALLINT DEFAULT 0,
  `viewport_y` SMALLINT DEFAULT 0,
  `viewport_width` SMALLINT UNSIGNED DEFAULT 1280,
  `viewport_height` SMALLINT UNSIGNED DEFAULT 720,
  `fps` TINYINT UNSIGNED DEFAULT 0,
  `latency_ms` SMALLINT UNSIGNED DEFAULT 0,
  `bandwidth_kbps` INT UNSIGNED DEFAULT 0,
  `cpu_usage` TINYINT UNSIGNED DEFAULT 0,
  `memory_mb` SMALLINT UNSIGNED DEFAULT 0,
  `error_count` SMALLINT UNSIGNED DEFAULT 0,
  `last_heartbeat` INT UNSIGNED DEFAULT 0 COMMENT 'Unix timestamp',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE CASCADE,
  INDEX `idx_session_status` (`session_id`, `status`),
  INDEX `idx_status_updated` (`status`, `updated_at`),
  INDEX `idx_worker` (`worker_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;

-- ============================================================================
-- PROXY INFRASTRUCTURE
-- ============================================================================

-- Proxy pools: Logical grouping of proxy nodes
CREATE TABLE IF NOT EXISTS `proxy_pools` (
  `id` CHAR(36) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `region` VARCHAR(100) DEFAULT NULL,
  `country_code` CHAR(2) DEFAULT NULL,
  `rotation_strategy` ENUM('round-robin', 'sticky', 'burst', 'weighted', 'adaptive') DEFAULT 'adaptive',
  `rotation_interval_ms` INT UNSIGNED DEFAULT 60000,
  `health_check_interval_ms` INT UNSIGNED DEFAULT 30000,
  `max_failures` TINYINT UNSIGNED DEFAULT 5,
  `enable_geo_affinity` BOOLEAN DEFAULT TRUE,
  `active` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_name` (`name`),
  INDEX `idx_country_active` (`country_code`, `active`),
  INDEX `idx_region` (`region`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Proxy nodes: Individual proxy endpoints
CREATE TABLE IF NOT EXISTS `proxy_nodes` (
  `id` CHAR(36) PRIMARY KEY,
  `pool_id` CHAR(36) NOT NULL,
  `endpoint` VARCHAR(255) NOT NULL,
  `region` VARCHAR(100) DEFAULT NULL,
  `country_code` CHAR(2) DEFAULT NULL,
  `protocol` ENUM('http', 'https', 'socks4', 'socks5') DEFAULT 'https',
  `port` SMALLINT UNSIGNED NOT NULL,
  `username` VARCHAR(255) DEFAULT NULL,
  `password` VARCHAR(255) DEFAULT NULL,
  `latency_ms` SMALLINT UNSIGNED DEFAULT 0,
  `reliability` DECIMAL(5,4) DEFAULT 0.9900,
  `concurrent` SMALLINT UNSIGNED DEFAULT 0,
  `max_concurrent` SMALLINT UNSIGNED DEFAULT 200,
  `status` ENUM('active', 'throttled', 'error', 'maintenance') DEFAULT 'active',
  `last_health_check` INT UNSIGNED DEFAULT 0,
  `error_count` SMALLINT UNSIGNED DEFAULT 0,
  `success_rate` DECIMAL(5,4) DEFAULT 0.9900,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`pool_id`) REFERENCES `proxy_pools`(`id`) ON DELETE CASCADE,
  INDEX `idx_pool_status` (`pool_id`, `status`),
  INDEX `idx_country_status` (`country_code`, `status`),
  INDEX `idx_health` (`last_health_check`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- OBSERVABILITY & AUDIT
-- ============================================================================

-- Metrics: Time-series performance data
CREATE TABLE IF NOT EXISTS `metrics` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `session_id` CHAR(36) DEFAULT NULL,
  `replica_id` CHAR(36) DEFAULT NULL,
  `metric_type` VARCHAR(50) NOT NULL,
  `metric_value` DECIMAL(12,4) NOT NULL,
  `tags` JSON DEFAULT NULL,
  `timestamp` TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `idx_session_type_time` (`session_id`, `metric_type`, `timestamp`),
  INDEX `idx_type_time` (`metric_type`, `timestamp`),
  INDEX `idx_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=COMPRESSED;

-- Events: Event sourcing audit log
CREATE TABLE IF NOT EXISTS `events` (
  `id` CHAR(36) PRIMARY KEY,
  `event_type` VARCHAR(100) NOT NULL,
  `entity_id` CHAR(36) NOT NULL,
  `entity_type` VARCHAR(50) NOT NULL,
  `payload` JSON DEFAULT NULL,
  `user_id` VARCHAR(100) DEFAULT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_entity` (`entity_id`, `entity_type`),
  INDEX `idx_event_type_time` (`event_type`, `created_at`),
  INDEX `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=COMPRESSED;

-- ============================================================================
-- AUTOMATION & TASKS
-- ============================================================================

-- Automation tasks: Web scraping and automation jobs
CREATE TABLE IF NOT EXISTS `automation_tasks` (
  `id` CHAR(36) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `task_type` VARCHAR(50) NOT NULL,
  `session_id` CHAR(36) DEFAULT NULL,
  `config` JSON NOT NULL,
  `status` ENUM('pending', 'running', 'paused', 'completed', 'failed') DEFAULT 'pending',
  `priority` TINYINT UNSIGNED DEFAULT 100,
  `progress` TINYINT UNSIGNED DEFAULT 0,
  `result` JSON DEFAULT NULL,
  `error_message` TEXT DEFAULT NULL,
  `started_at` TIMESTAMP NULL DEFAULT NULL,
  `completed_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_status_priority` (`status`, `priority`),
  INDEX `idx_session` (`session_id`),
  INDEX `idx_type_status` (`task_type`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- STORED PROCEDURES
-- ============================================================================

DELIMITER $$

-- Create session with replicas in single transaction
CREATE PROCEDURE IF NOT EXISTS `sp_create_session_bulk`(
  IN p_url VARCHAR(2048),
  IN p_replica_count INT,
  IN p_region VARCHAR(100),
  IN p_proxy_pool_id CHAR(36),
  OUT p_session_id CHAR(36)
)
BEGIN
  DECLARE v_replica_id CHAR(36);
  DECLARE v_counter INT DEFAULT 0;
  
  START TRANSACTION;
  
  SET p_session_id = UUID();
  
  INSERT INTO `sessions` (
    `id`, `url`, `status`, `region`, `proxy_pool_id`,
    `target_replica_count`, `current_replica_count`
  ) VALUES (
    p_session_id, p_url, 'steady', p_region, p_proxy_pool_id,
    p_replica_count, p_replica_count
  );
  
  WHILE v_counter < p_replica_count DO
    SET v_replica_id = UUID();
    INSERT INTO `replicas` (`id`, `session_id`, `status`)
    VALUES (v_replica_id, p_session_id, 'spawning');
    SET v_counter = v_counter + 1;
  END WHILE;
  
  COMMIT;
END$$

-- Cleanup old metrics data
CREATE PROCEDURE IF NOT EXISTS `sp_cleanup_old_data`(
  IN p_days_to_keep INT
)
BEGIN
  DECLARE v_cutoff_date TIMESTAMP;
  SET v_cutoff_date = DATE_SUB(NOW(), INTERVAL p_days_to_keep DAY);
  
  DELETE FROM `metrics` WHERE `timestamp` < v_cutoff_date;
  DELETE FROM `events` WHERE `created_at` < v_cutoff_date;
  
  OPTIMIZE TABLE `metrics`, `events`;
END$$

-- Get session health status
CREATE FUNCTION IF NOT EXISTS `fn_get_session_health`(
  p_session_id CHAR(36)
) RETURNS VARCHAR(20)
DETERMINISTIC
READS SQL DATA
BEGIN
  DECLARE v_total_replicas INT;
  DECLARE v_error_replicas INT;
  DECLARE v_error_rate DECIMAL(5,4);
  
  SELECT COUNT(*) INTO v_total_replicas
  FROM `replicas`
  WHERE `session_id` = p_session_id;
  
  SELECT COUNT(*) INTO v_error_replicas
  FROM `replicas`
  WHERE `session_id` = p_session_id AND `status` = 'error';
  
  IF v_total_replicas = 0 THEN
    RETURN 'unknown';
  END IF;
  
  SET v_error_rate = v_error_replicas / v_total_replicas;
  
  IF v_error_rate < 0.1 THEN
    RETURN 'healthy';
  ELSEIF v_error_rate < 0.3 THEN
    RETURN 'degraded';
  ELSE
    RETURN 'critical';
  END IF;
END$$

DELIMITER ;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

DELIMITER $$

-- Auto-update replica count on insert
CREATE TRIGGER IF NOT EXISTS `trg_replica_insert_update_count`
AFTER INSERT ON `replicas`
FOR EACH ROW
BEGIN
  UPDATE `sessions`
  SET `current_replica_count` = (
    SELECT COUNT(*) FROM `replicas` WHERE `session_id` = NEW.session_id
  )
  WHERE `id` = NEW.session_id;
END$$

-- Auto-update replica count on delete
CREATE TRIGGER IF NOT EXISTS `trg_replica_delete_update_count`
AFTER DELETE ON `replicas`
FOR EACH ROW
BEGIN
  UPDATE `sessions`
  SET `current_replica_count` = (
    SELECT COUNT(*) FROM `replicas` WHERE `session_id` = OLD.session_id
  )
  WHERE `id` = OLD.session_id;
END$$

DELIMITER ;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Session overview with aggregated metrics
CREATE OR REPLACE VIEW `v_session_overview` AS
SELECT
  s.id,
  s.url,
  s.status,
  s.region,
  s.current_replica_count,
  s.target_replica_count,
  COUNT(DISTINCT r.id) as active_replicas,
  AVG(r.latency_ms) as avg_latency_ms,
  AVG(r.fps) as avg_fps,
  SUM(r.bandwidth_kbps) as total_bandwidth_kbps,
  MAX(r.updated_at) as last_activity,
  s.created_at
FROM `sessions` s
LEFT JOIN `replicas` r ON s.id = r.session_id AND r.status IN ('active', 'idle')
GROUP BY s.id;

-- Proxy pool health
CREATE OR REPLACE VIEW `v_proxy_pool_health` AS
SELECT
  p.id,
  p.name,
  p.country_code,
  COUNT(n.id) as total_nodes,
  SUM(CASE WHEN n.status = 'active' THEN 1 ELSE 0 END) as active_nodes,
  AVG(n.latency_ms) as avg_latency_ms,
  AVG(n.reliability) as avg_reliability,
  SUM(n.concurrent) as total_concurrent,
  p.updated_at
FROM `proxy_pools` p
LEFT JOIN `proxy_nodes` n ON p.id = n.pool_id
GROUP BY p.id;

-- ============================================================================
-- INDEXES OPTIMIZATION
-- ============================================================================

-- Additional composite indexes for common query patterns
ALTER TABLE `replicas` ADD INDEX IF NOT EXISTS `idx_heartbeat_status` (`last_heartbeat`, `status`);
ALTER TABLE `automation_tasks` ADD INDEX IF NOT EXISTS `idx_created_status` (`created_at`, `status`);

-- ============================================================================
-- CONFIGURATION
-- ============================================================================

-- Set optimal MySQL configuration for this schema
SET GLOBAL max_connections = 500;
SET GLOBAL innodb_buffer_pool_size = 134217728; -- 128MB for shared hosting
SET GLOBAL query_cache_size = 33554432; -- 32MB
SET GLOBAL query_cache_type = 1;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
