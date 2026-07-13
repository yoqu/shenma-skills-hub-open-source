CREATE TABLE sms_provider_config (
  code                  VARCHAR(32)  NOT NULL PRIMARY KEY,
  display_name          VARCHAR(64)  NOT NULL,
  enabled               TINYINT(1)   NOT NULL DEFAULT 0,
  provider_type         VARCHAR(32)  NOT NULL DEFAULT 'HTTP',
  endpoint_url          VARCHAR(512) NULL,
  method                VARCHAR(16)  NOT NULL DEFAULT 'POST',
  headers_json          JSON         NULL,
  secret_headers_json   JSON         NULL,
  body_template         TEXT         NULL,
  success_status        INT          NOT NULL DEFAULT 200,
  success_json_path     VARCHAR(128) NULL,
  success_expected_value VARCHAR(128) NULL,
  updated_by            BIGINT       NULL,
  updated_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                       ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO sms_provider_config
  (code, display_name, enabled, provider_type, method, success_status)
VALUES
  ('sms_http', '短信验证码', 0, 'HTTP', 'POST', 200);
