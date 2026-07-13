ALTER TABLE sms_provider_config
  ADD COLUMN extra_json JSON NULL AFTER success_expected_value,
  ADD COLUMN secret_json JSON NULL AFTER extra_json,
  DROP COLUMN secret_headers_json;

UPDATE sms_provider_config
SET code = 'sms_login'
WHERE code = 'sms_http';
