-- Target database must already have been created by the guarded local migration tool.
-- MySQL 5.7 compatible. The original strategy_code remains the API identity.
CREATE TABLE sr_strategy (
    id BIGINT NOT NULL AUTO_INCREMENT,
    strategy_code VARCHAR(64) NOT NULL,
    strategy_name VARCHAR(255) DEFAULT NULL,
    strategy_class VARCHAR(16) NOT NULL,
    customer_group VARCHAR(64) DEFAULT NULL,
    channel VARCHAR(64) DEFAULT NULL,
    strategy_level VARCHAR(32) DEFAULT NULL,
    caliber VARCHAR(512) DEFAULT NULL,
    iteration INT DEFAULT NULL,
    owner VARCHAR(64) DEFAULT NULL,
    status VARCHAR(32) DEFAULT NULL,
    city_id VARCHAR(64) DEFAULT NULL,
    county_id VARCHAR(64) DEFAULT NULL,
    start_date DATE DEFAULT NULL,
    end_date DATE DEFAULT NULL,
    create_time DATETIME DEFAULT NULL,
    update_time DATETIME DEFAULT NULL,
    create_by VARCHAR(64) DEFAULT NULL,
    update_by VARCHAR(64) DEFAULT NULL,
    is_deleted TINYINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_strategy_code (strategy_code),
    KEY idx_strategy_class (strategy_class, is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE sr_legacy_strategy_map (
    legacy_table VARCHAR(64) NOT NULL,
    legacy_id BIGINT NOT NULL,
    strategy_id BIGINT DEFAULT NULL,
    strategy_code VARCHAR(64) DEFAULT NULL,
    status VARCHAR(32) NOT NULL,
    reason VARCHAR(512) DEFAULT NULL,
    original_data JSON NOT NULL,
    PRIMARY KEY (legacy_table, legacy_id),
    KEY idx_legacy_strategy (strategy_id),
    KEY idx_legacy_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
