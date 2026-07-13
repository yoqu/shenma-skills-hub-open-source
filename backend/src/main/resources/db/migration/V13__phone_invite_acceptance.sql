-- V13 — phone invite acceptance support
-- 1. Add 'cancelled' to invites_phone.status (admin revoke, distinct from 'declined' = user rejected)
-- 2. Track who accepted and when
-- 3. Index for fast lookup of pending invites by phone number

ALTER TABLE invites_phone
    MODIFY status ENUM('pending','accepted','declined','expired','cancelled')
        NOT NULL DEFAULT 'pending';

ALTER TABLE invites_phone
    ADD COLUMN accepted_by_user_id BIGINT  DEFAULT NULL COMMENT '接受邀请的用户 ID' AFTER status,
    ADD COLUMN accepted_at         DATETIME DEFAULT NULL COMMENT '接受时间'          AFTER accepted_by_user_id;

ALTER TABLE invites_phone
    ADD KEY idx_invites_phone_phone_status (phone_raw, status);
