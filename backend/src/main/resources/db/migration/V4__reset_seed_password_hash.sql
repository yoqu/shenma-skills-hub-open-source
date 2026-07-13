-- Keep seed credentials aligned with docs/UI: every seeded user logs in with password.
UPDATE users
SET password_hash = '$2a$10$TG1GJWiTlILpMtJgdbE6tO63aceOO1lGJxSFlkf77DI84XiHbZPge'
WHERE id BETWEEN 1 AND 8;
