package com.skillstack.skill.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.storage.StorageService;
import com.skillstack.common.storage.ZipSanitizer;
import com.skillstack.skill.entity.Skill;
import com.skillstack.skill.entity.SkillVersion;
import com.skillstack.skill.mapper.SkillMapper;
import com.skillstack.skill.mapper.SkillTagMapper;
import com.skillstack.skill.mapper.SkillVersionMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * 生成 Skill 下载产物。
 *
 * 优先级：当版本存在已上传的源码包（{@link SkillVersion#getZipUrl()} 指向存储中的 zip）时，
 * 直接回流该真实源码包；仅当没有源码包（老数据 / 仅元数据创建）时，才回退到根据 skill
 * 元数据 + 当前版本号动态合成一个占位 Zip（SKILL.md / skill.toml / LICENSE）。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SkillDownloadService {

    private final SkillMapper skillMapper;
    private final SkillVersionMapper skillVersionMapper;
    private final SkillTagMapper skillTagMapper;
    private final SkillService skillService;
    private final StorageService storage;

    private static final DateTimeFormatter D = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    public static class ZipPayload {
        public final String fileName;
        public final byte[] data;

        public ZipPayload(String fileName, byte[] data) {
            this.fileName = fileName;
            this.data = data;
        }
    }

    public ZipPayload build(String slug, String version, Long currentUserId) {
        // 同时承担可见性 + 状态 + membership 校验（SKILL-DL-001/002 / SKILL-DTL-003）
        Skill skill = skillService.requireReadable(slug, currentUserId);

        String effectiveVersion = (version == null || version.isBlank()) ? skill.getVersion() : version.trim();
        SkillVersion ver = skillVersionMapper.selectOne(
                Wrappers.<SkillVersion>lambdaQuery()
                        .eq(SkillVersion::getSkillId, skill.getId())
                        .eq(SkillVersion::getVersion, effectiveVersion)
        );
        // 找不到指定版本时回退到当前版本，避免直链 404 干扰前端
        if (ver == null) {
            ver = skillVersionMapper.selectOne(
                    Wrappers.<SkillVersion>lambdaQuery()
                            .eq(SkillVersion::getSkillId, skill.getId())
                            .eq(SkillVersion::getVersion, skill.getVersion())
            );
            if (ver != null) effectiveVersion = ver.getVersion();
        }

        // 优先回流作者上传的真实源码包；读取失败时降级到占位合成，保证下载不中断。
        byte[] uploaded = readUploadedZip(ver);
        if (uploaded != null) {
            return new ZipPayload(skill.getSlug() + "-" + effectiveVersion + ".zip", uploaded);
        }

        List<String> tags = skillTagMapper.selectTagNamesBySkill(skill.getId());

        try (ByteArrayOutputStream buffer = new ByteArrayOutputStream();
             ZipOutputStream zip = new ZipOutputStream(buffer)) {
            zip.setLevel(6);

            String dir = skill.getSlug() + "-" + effectiveVersion + "/";

            writeEntry(zip, dir + "SKILL.md", renderSkillMd(skill, effectiveVersion, ver, tags));
            writeEntry(zip, dir + "skill.toml", renderSkillToml(skill, effectiveVersion, tags));
            writeEntry(zip, dir + "LICENSE", renderLicense(skill));

            zip.finish();
            return new ZipPayload(skill.getSlug() + "-" + effectiveVersion + ".zip", buffer.toByteArray());
        } catch (IOException e) {
            throw new BusinessException(50000, "打包失败:" + e.getMessage());
        }
    }

    /**
     * 读取版本对应的真实上传源码包。无 zipUrl、文件缺失或读取异常时返回 null，由调用方降级到占位合成。
     */
    private byte[] readUploadedZip(SkillVersion ver) {
        if (ver == null) return null;
        String key = ver.getZipUrl();
        if (key == null || key.isBlank() || !storage.exists(key)) return null;
        try (InputStream in = storage.openStream(key)) {
            // 兜底：upload 入站已用 ZipSanitizer 清洗，这里仅为历史数据补一层防护。
            return ZipSanitizer.sanitize(in.readAllBytes());
        } catch (IOException e) {
            log.warn("readUploadedZip failed for versionId={} zipKey={}: {}", ver.getId(), key, e.getMessage());
            return null;
        }
    }

    private static void writeEntry(ZipOutputStream zip, String name, String content) throws IOException {
        ZipEntry entry = new ZipEntry(name);
        zip.putNextEntry(entry);
        zip.write(content.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }

    private static String renderSkillMd(Skill skill, String version, SkillVersion ver, List<String> tags) {
        StringBuilder sb = new StringBuilder();
        sb.append("# ").append(safe(skill.getName())).append('\n');
        sb.append('\n');
        if (skill.getShortDesc() != null && !skill.getShortDesc().isBlank()) {
            sb.append("> ").append(skill.getShortDesc()).append('\n');
            sb.append('\n');
        }
        sb.append("## 基本信息\n\n");
        sb.append("- slug: `").append(skill.getSlug()).append("`\n");
        sb.append("- 当前版本: `").append(version).append("`\n");
        if (skill.getVisibility() != null) sb.append("- 可见性: ").append(skill.getVisibility()).append('\n');
        if (skill.getSafety() != null) sb.append("- 安全等级: ").append(skill.getSafety()).append('\n');
        if (skill.getEvalScore() != null) sb.append("- 评测分数: ").append(skill.getEvalScore()).append("/100\n");
        if (tags != null && !tags.isEmpty()) sb.append("- 标签: ").append(String.join(" / ", tags)).append('\n');
        sb.append('\n');
        sb.append("## 快速安装\n\n");
        sb.append("```bash\n");
        sb.append("skill install ").append(skill.getSlug()).append('@').append(version).append('\n');
        sb.append("```\n\n");
        sb.append("## 版本说明\n\n");
        if (ver != null && ver.getChangelog() != null && !ver.getChangelog().isBlank()) {
            sb.append(ver.getChangelog()).append('\n');
        } else {
            sb.append("当前版本暂无 changelog。\n");
        }
        sb.append('\n');
        sb.append("---\n");
        sb.append("打包时间: ").append(LocalDateTime.now().format(D)).append('\n');
        sb.append("由 SkillStack 自动生成,作者可在后续版本上传完整源码包覆盖。\n");
        return sb.toString();
    }

    private static String renderSkillToml(Skill skill, String version, List<String> tags) {
        StringBuilder sb = new StringBuilder();
        sb.append("# 由 SkillStack 自动生成的元数据\n");
        sb.append("[skill]\n");
        sb.append("slug = \"").append(skill.getSlug()).append("\"\n");
        sb.append("name = \"").append(safe(skill.getName())).append("\"\n");
        sb.append("version = \"").append(version).append("\"\n");
        if (skill.getShortDesc() != null) {
            sb.append("description = \"").append(escapeToml(skill.getShortDesc())).append("\"\n");
        }
        if (skill.getCatCode() != null) sb.append("category = \"").append(skill.getCatCode()).append("\"\n");
        if (skill.getVisibility() != null) sb.append("visibility = \"").append(skill.getVisibility()).append("\"\n");
        if (tags != null && !tags.isEmpty()) {
            sb.append("tags = [");
            for (int i = 0; i < tags.size(); i++) {
                if (i > 0) sb.append(", ");
                sb.append('\"').append(escapeToml(tags.get(i))).append('\"');
            }
            sb.append("]\n");
        }
        sb.append("license = \"MIT\"\n");
        return sb.toString();
    }

    private static String renderLicense(Skill skill) {
        int year = java.time.Year.now().getValue();
        return "MIT License\n\n" +
                "Copyright (c) " + year + " " + safe(skill.getName()) + " contributors\n\n" +
                "Permission is hereby granted, free of charge, to any person obtaining a copy " +
                "of this software and associated documentation files (the \"Software\"), to deal " +
                "in the Software without restriction, including without limitation the rights " +
                "to use, copy, modify, merge, publish, distribute, sublicense, and/or sell " +
                "copies of the Software, and to permit persons to whom the Software is furnished " +
                "to do so, subject to the following conditions:\n\n" +
                "The above copyright notice and this permission notice shall be included in all " +
                "copies or substantial portions of the Software.\n\n" +
                "THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND.\n";
    }

    private static String safe(String s) {
        return s == null ? "" : s;
    }

    private static String escapeToml(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
