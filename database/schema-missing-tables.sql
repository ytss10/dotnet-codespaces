-- Missing tables referenced in the codebase but not in original schema
-- These tables are required for full functionality

-- Web Automation Scripts table
CREATE TABLE IF NOT EXISTS `web_automation_scripts` (
    `id` CHAR(36) PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT,
    `script_content` LONGTEXT NOT NULL,
    `script_type` ENUM('puppeteer', 'playwright', 'selenium') DEFAULT 'puppeteer',
    `status` ENUM('active', 'inactive', 'testing') DEFAULT 'active',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_status` (`status`),
    INDEX `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Browser Profiles table
CREATE TABLE IF NOT EXISTS `browser_profiles` (
    `id` CHAR(36) PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `user_agent` TEXT,
    `viewport_width` INT DEFAULT 1920,
    `viewport_height` INT DEFAULT 1080,
    `timezone` VARCHAR(50) DEFAULT 'UTC',
    `language` VARCHAR(10) DEFAULT 'en-US',
    `platform` VARCHAR(50) DEFAULT 'Win32',
    `webgl_vendor` VARCHAR(255),
    `webgl_renderer` VARCHAR(255),
    `fingerprint_data` JSON,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Proxy Performance Metrics table
CREATE TABLE IF NOT EXISTS `proxy_performance_metrics` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `proxy_id` CHAR(36) NOT NULL,
    `latency_ms` INT,
    `success_rate` DECIMAL(5,2),
    `requests_count` INT DEFAULT 0,
    `failures_count` INT DEFAULT 0,
    `bytes_transferred` BIGINT DEFAULT 0,
    `measured_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_proxy_time` (`proxy_id`, `measured_at`),
    INDEX `idx_measured` (`measured_at`),
    FOREIGN KEY (`proxy_id`) REFERENCES `proxies`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Orchestrator Health table
CREATE TABLE IF NOT EXISTS `orchestrator_health` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `node_id` VARCHAR(100) NOT NULL,
    `cpu_usage` DECIMAL(5,2),
    `memory_usage` DECIMAL(5,2),
    `disk_usage` DECIMAL(5,2),
    `active_sessions` INT DEFAULT 0,
    `active_replicas` INT DEFAULT 0,
    `status` ENUM('healthy', 'degraded', 'critical') DEFAULT 'healthy',
    `last_heartbeat` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_node_heartbeat` (`node_id`, `last_heartbeat`),
    INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- System Metrics table
CREATE TABLE IF NOT EXISTS `system_metrics` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `metric_name` VARCHAR(100) NOT NULL,
    `metric_value` DECIMAL(20,4),
    `metric_unit` VARCHAR(20),
    `tags` JSON,
    `recorded_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_name_time` (`metric_name`, `recorded_at`),
    INDEX `idx_recorded` (`recorded_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Realtime Connections table
CREATE TABLE IF NOT EXISTS `realtime_connections` (
    `id` CHAR(36) PRIMARY KEY,
    `client_id` VARCHAR(100) NOT NULL,
    `connection_type` ENUM('websocket', 'sse', 'longpoll') DEFAULT 'sse',
    `ip_address` VARCHAR(45),
    `user_agent` TEXT,
    `connected_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `last_ping` TIMESTAMP NULL,
    `status` ENUM('connected', 'disconnected', 'idle') DEFAULT 'connected',
    INDEX `idx_client` (`client_id`),
    INDEX `idx_status` (`status`),
    INDEX `idx_connected` (`connected_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Hypergrid Nodes table (for distributed processing)
CREATE TABLE IF NOT EXISTS `hypergrid_nodes` (
    `id` CHAR(36) PRIMARY KEY,
    `node_name` VARCHAR(255) NOT NULL,
    `node_type` ENUM('master', 'worker', 'edge') DEFAULT 'worker',
    `ip_address` VARCHAR(45),
    `port` INT,
    `capacity` INT DEFAULT 1000,
    `current_load` INT DEFAULT 0,
    `status` ENUM('online', 'offline', 'maintenance') DEFAULT 'online',
    `last_seen` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `metadata` JSON,
    INDEX `idx_type_status` (`node_type`, `status`),
    INDEX `idx_last_seen` (`last_seen`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Hypergrid Connections table
CREATE TABLE IF NOT EXISTS `hypergrid_connections` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `source_node_id` CHAR(36) NOT NULL,
    `target_node_id` CHAR(36) NOT NULL,
    `connection_type` ENUM('sync', 'async', 'stream') DEFAULT 'async',
    `latency_ms` INT,
    `bandwidth_mbps` DECIMAL(10,2),
    `status` ENUM('active', 'idle', 'failed') DEFAULT 'active',
    `established_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `last_activity` TIMESTAMP NULL,
    INDEX `idx_nodes` (`source_node_id`, `target_node_id`),
    INDEX `idx_status` (`status`),
    FOREIGN KEY (`source_node_id`) REFERENCES `hypergrid_nodes`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`target_node_id`) REFERENCES `hypergrid_nodes`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- API Keys table
CREATE TABLE IF NOT EXISTS `api_keys` (
    `id` CHAR(36) PRIMARY KEY,
    `key_hash` VARCHAR(255) NOT NULL UNIQUE,
    `name` VARCHAR(255),
    `permissions` JSON,
    `rate_limit` INT DEFAULT 1000,
    `requests_count` BIGINT DEFAULT 0,
    `last_used` TIMESTAMP NULL,
    `expires_at` TIMESTAMP NULL,
    `status` ENUM('active', 'suspended', 'expired') DEFAULT 'active',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_key_hash` (`key_hash`),
    INDEX `idx_status` (`status`),
    INDEX `idx_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rate Limits table
CREATE TABLE IF NOT EXISTS `rate_limits` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `identifier` VARCHAR(255) NOT NULL,
    `limit_type` ENUM('api', 'session', 'proxy', 'global') DEFAULT 'api',
    `requests_count` INT DEFAULT 0,
    `window_start` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `window_duration_seconds` INT DEFAULT 60,
    `max_requests` INT DEFAULT 100,
    UNIQUE KEY `unique_identifier_type` (`identifier`, `limit_type`),
    INDEX `idx_window` (`window_start`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Proxy Usage Stats table
CREATE TABLE IF NOT EXISTS `proxy_usage_stats` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `proxy_id` CHAR(36) NOT NULL,
    `session_id` CHAR(36),
    `bytes_sent` BIGINT DEFAULT 0,
    `bytes_received` BIGINT DEFAULT 0,
    `requests_count` INT DEFAULT 0,
    `errors_count` INT DEFAULT 0,
    `start_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `end_time` TIMESTAMP NULL,
    INDEX `idx_proxy_session` (`proxy_id`, `session_id`),
    INDEX `idx_time` (`start_time`, `end_time`),
    FOREIGN KEY (`proxy_id`) REFERENCES `proxies`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Event Snapshots table (for event sourcing checkpoints)
CREATE TABLE IF NOT EXISTS `event_snapshots` (
    `id` CHAR(36) PRIMARY KEY,
    `aggregate_id` CHAR(36) NOT NULL,
    `aggregate_type` VARCHAR(50) NOT NULL,
    `snapshot_data` JSON NOT NULL,
    `event_sequence` BIGINT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_aggregate` (`aggregate_id`, `aggregate_type`),
    INDEX `idx_sequence` (`event_sequence`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add missing columns to events table if they don't exist
ALTER TABLE `events` 
    ADD COLUMN IF NOT EXISTS `aggregate_id` CHAR(36) AFTER `entity_id`,
    ADD COLUMN IF NOT EXISTS `aggregate_type` VARCHAR(50) AFTER `entity_type`,
    ADD COLUMN IF NOT EXISTS `metadata` JSON,
    ADD COLUMN IF NOT EXISTS `vector_clock` JSON,
    ADD COLUMN IF NOT EXISTS `timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add missing columns to replicas table if they don't exist
ALTER TABLE `replicas`
    ADD COLUMN IF NOT EXISTS `region` VARCHAR(50),
    ADD COLUMN IF NOT EXISTS `proxy_id` CHAR(36),
    ADD COLUMN IF NOT EXISTS `performance_score` DECIMAL(5,2) DEFAULT 100.00,
    ADD COLUMN IF NOT EXISTS `health_check_url` VARCHAR(500),
    ADD COLUMN IF NOT EXISTS `last_health_check` TIMESTAMP NULL;

-- Add indexes for better performance
ALTER TABLE `sessions` ADD INDEX IF NOT EXISTS `idx_proxy_pool` (`proxy_pool_id`);
ALTER TABLE `proxies` ADD INDEX IF NOT EXISTS `idx_country_status` (`country`, `status`);
ALTER TABLE `metrics` ADD INDEX IF NOT EXISTS `idx_session_time` (`session_id`, `timestamp`);