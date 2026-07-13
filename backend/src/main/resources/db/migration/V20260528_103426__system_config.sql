CREATE TABLE system_config (
  config_key    VARCHAR(128) NOT NULL PRIMARY KEY,
  config_value  TEXT         NOT NULL,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
