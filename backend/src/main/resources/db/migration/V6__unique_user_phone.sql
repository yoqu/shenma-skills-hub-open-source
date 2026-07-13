-- users.phone is a login and account recovery identifier, so it must be unique.
DROP INDEX idx_users_phone ON users;
CREATE UNIQUE INDEX uk_users_phone ON users (phone);
