UPDATE oauth_providers
SET icon_url = '/auth/oauth/feishu.svg'
WHERE code = 'feishu'
  AND (icon_url IS NULL OR icon_url = '' OR icon_url = '/auth/oauth/feishu.png');

UPDATE oauth_providers
SET icon_url = '/auth/oauth/linuxdo.svg'
WHERE code = 'linux_do'
  AND (icon_url IS NULL OR icon_url = '' OR icon_url = '/auth/oauth/linuxdo.png');
