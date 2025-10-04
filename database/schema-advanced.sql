-- Additional tables for advanced features

-- Proxy pools table
CREATE TABLE IF NOT EXISTS `proxy_pools` (
  `id` VARCHAR(36) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `region` VARCHAR(100),
  `country_code` VARCHAR(2),
  `rotation_strategy` ENUM('round-robin', 'sticky', 'burst', 'weighted', 'adaptive') DEFAULT 'adaptive',
  `rotation_interval_ms` INT DEFAULT 60000,
  `health_check_interval_ms` INT DEFAULT 30000,
  `max_failures` INT DEFAULT 5,
  `enable_geo_affinity` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_country` (`country_code`),
  INDEX `idx_region` (`region`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Proxy nodes table
CREATE TABLE IF NOT EXISTS `proxy_nodes` (
  `id` VARCHAR(36) PRIMARY KEY,
  `pool_id` VARCHAR(36),
  `endpoint` VARCHAR(255) NOT NULL,
  `region` VARCHAR(100),
  `country_code` VARCHAR(2),
  `protocol` ENUM('http', 'https', 'socks4', 'socks5') DEFAULT 'https',
  `port` INT NOT NULL,
  `username` VARCHAR(255),
  `password` VARCHAR(255),
  `latency_ms` INT DEFAULT 0,
  `reliability` DECIMAL(5,4) DEFAULT 0.9900,
  `concurrent` INT DEFAULT 0,
  `max_concurrent` INT DEFAULT 200,
  `status` ENUM('active', 'throttled', 'error', 'maintenance') DEFAULT 'active',
  `last_health_check` INT,
  `error_count` INT DEFAULT 0,
  `success_rate` DECIMAL(5,4) DEFAULT 0.9900,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`pool_id`) REFERENCES `proxy_pools`(`id`) ON DELETE CASCADE,
  INDEX `idx_pool` (`pool_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_country` (`country_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Session replicas table (for tracking individual replica instances)
CREATE TABLE IF NOT EXISTS `session_replicas` (
  `id` VARCHAR(36) PRIMARY KEY,
  `session_id` VARCHAR(36) NOT NULL,
  `proxy_node_id` VARCHAR(36),
  `status` ENUM('initializing', 'running', 'paused', 'failed', 'stopped') DEFAULT 'initializing',
  `started_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `last_activity` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `response_time_ms` INT DEFAULT 0,
  `error_count` INT DEFAULT 0,
  `request_count` INT DEFAULT 0,
  FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`proxy_node_id`) REFERENCES `proxy_nodes`(`id`) ON DELETE SET NULL,
  INDEX `idx_session` (`session_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_proxy` (`proxy_node_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Session metrics aggregation table
CREATE TABLE IF NOT EXISTS `session_metrics` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `session_id` VARCHAR(36) NOT NULL,
  `timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `active_replicas` INT DEFAULT 0,
  `failed_replicas` INT DEFAULT 0,
  `avg_response_time` INT DEFAULT 0,
  `total_requests` BIGINT DEFAULT 0,
  `total_errors` INT DEFAULT 0,
  `throughput` DECIMAL(10,2) DEFAULT 0,
  `cpu_usage` DECIMAL(5,2) DEFAULT 0,
  `memory_usage` BIGINT DEFAULT 0,
  FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE CASCADE,
  INDEX `idx_session_timestamp` (`session_id`, `timestamp`),
  INDEX `idx_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Hypergrid cache table (for spatial visualization)
CREATE TABLE IF NOT EXISTS `hypergrid_cache` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `dimensions_rows` INT DEFAULT 0,
  `dimensions_cols` INT DEFAULT 0,
  `total_cells` INT DEFAULT 0,
  `total_sessions` INT DEFAULT 0,
  `total_replicas` BIGINT DEFAULT 0,
  `tiles_data` LONGTEXT,
  `aggregates_data` TEXT,
  `generated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `version` INT DEFAULT 1,
  INDEX `idx_generated` (`generated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
