CREATE TABLE oauth_providers (
  code           VARCHAR(32)  NOT NULL PRIMARY KEY,
  display_name   VARCHAR(64)  NOT NULL,
  enabled        TINYINT(1)   NOT NULL DEFAULT 0,
  client_id      VARCHAR(255) NULL,
  client_secret  VARCHAR(255) NULL,
  redirect_uri   VARCHAR(512) NULL,
  scope          VARCHAR(255) NULL,
  authorize_url  VARCHAR(512) NULL,
  token_url      VARCHAR(512) NULL,
  userinfo_url   VARCHAR(512) NULL,
  icon_url       VARCHAR(512) NULL,
  button_label   VARCHAR(64)  NULL,
  sort_order     INT          NOT NULL DEFAULT 0,
  extra_json     JSON         NULL,
  updated_by     BIGINT       NULL,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO oauth_providers
  (code, display_name, enabled, scope, authorize_url, token_url, userinfo_url, sort_order)
VALUES
  ('feishu', '飞书', 0, '',
   'https://open.feishu.cn/open-apis/authen/v1/authorize',
   'https://open.feishu.cn/open-apis/authen/v1/access_token',
   'https://open.feishu.cn/open-apis/authen/v1/user_info',
   10),
  ('linux_do', 'linux.do', 0, 'read',
   'https://connect.linux.do/oauth2/authorize',
   'https://connect.linux.do/oauth2/token',
   'https://connect.linux.do/api/user',
   20);

CREATE TABLE user_oauth_identities (
  id                BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id           BIGINT       NOT NULL,
  provider          VARCHAR(32)  NOT NULL,
  provider_user_id  VARCHAR(128) NOT NULL,
  union_id          VARCHAR(128) NULL,
  username          VARCHAR(128) NULL,
  email             VARCHAR(160) NULL,
  avatar_url        VARCHAR(512) NULL,
  raw_payload       JSON         NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                 ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_provider_userid (provider, provider_user_id),
  UNIQUE KEY uk_user_provider   (user_id, provider),
  KEY idx_provider_union        (provider, union_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO user_oauth_identities
  (user_id, provider, provider_user_id, union_id, avatar_url, created_at, updated_at)
SELECT id, 'feishu', feishu_open_id, feishu_union_id, feishu_avatar_url, NOW(), NOW()
FROM users
WHERE feishu_open_id IS NOT NULL
  AND feishu_open_id <> '';
