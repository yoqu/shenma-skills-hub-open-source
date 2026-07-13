-- SKILL-VER-002 / REV-007：为 skill_versions 增加打包 zip 的存储 key，
-- 用于审核包文件预览与下载实链路。值是 storage 服务的 key（不是绝对 URL）。
ALTER TABLE skill_versions
    ADD COLUMN zip_url VARCHAR(512) NULL COMMENT 'storage key, 取 LocalStorageService.store 的返回'
        AFTER changelog;

-- 审核流程中提交者上传的 zip，approve 时复制到对应 skill_versions 行。
ALTER TABLE reviews
    ADD COLUMN zip_url VARCHAR(512) NULL COMMENT '审核提交时的 zip storage key'
        AFTER changelog;
