package com.skillstack.skill.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.storage.StorageService;
import com.skillstack.common.storage.ZipSanitizer;
import com.skillstack.skill.dto.SkillMdContent;
import com.skillstack.skill.entity.SkillVersion;
import com.skillstack.skill.entity.SkillVersionFile;
import com.skillstack.skill.mapper.SkillVersionFileMapper;
import com.skillstack.skill.mapper.SkillVersionMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * 维护 skill_version_files：从 zip 抽取条目清单并落库，供详情页「文件」tab 展示。
 *
 * 写时机：
 *   - SkillService.createSkill 初始版本插入后
 *   - SkillService.submitVersion 新版本插入后
 *   - listWithLazyBackfill 在历史版本首次访问时回填
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SkillVersionFileService {

    private static final int MAX_ENTRIES = 500;
    private static final int MAX_SKILL_MD_BYTES = 262_144;

    private final SkillVersionFileMapper fileMapper;
    private final SkillVersionMapper versionMapper;
    private final StorageService storage;

    /**
     * 幂等地写入指定版本的文件清单。先按 version_id 删旧行再批量插入。
     * 用 REQUIRES_NEW 隔离事务，失败不会回滚调用方的主事务（创建 skill / 审批通过等）。
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void materialize(Long versionId, String zipKey) {
        if (versionId == null || zipKey == null || zipKey.isBlank()) return;
        if (!storage.exists(zipKey)) {
            log.warn("materialize skipped: zipKey missing in storage, versionId={}, zipKey={}", versionId, zipKey);
            return;
        }

        List<SkillVersionFile> rows = scanZip(versionId, zipKey);

        fileMapper.delete(Wrappers.<SkillVersionFile>lambdaQuery()
                .eq(SkillVersionFile::getVersionId, versionId));
        for (SkillVersionFile row : rows) {
            fileMapper.insert(row);
        }

        // 把真实条目数回写到 skill_versions.files_count，保证侧边栏 / 版本行 / 文件 tab
        // 三处计数始终与实际文件清单一致（覆盖前端提交时漏传 fileCount 的场景）。
        SkillVersion ver = versionMapper.selectById(versionId);
        if (ver != null && (ver.getFilesCount() == null || ver.getFilesCount() != rows.size())) {
            ver.setFilesCount(rows.size());
            versionMapper.updateById(ver);
        }
    }

    /**
     * 对主流程无副作用的 materialize：捕获所有异常仅记录 warn 日志。
     * 用于 createSkill / approve 等主路径中的旁路调用。
     */
    public void materializeQuietly(Long versionId, String zipKey) {
        try {
            materialize(versionId, zipKey);
        } catch (RuntimeException e) {
            log.warn("materializeQuietly failed for versionId={}: {}", versionId, e.getMessage());
        }
    }

    /**
     * 返回某 version 的文件清单（按 sort 升序）。
     * 当前版本暂无清单且 zip 存在时，先 materialize 再返回，作为历史数据的懒回填。
     */
    public List<SkillVersionFile> listWithLazyBackfill(SkillVersion version) {
        if (version == null || version.getId() == null) return Collections.emptyList();

        List<SkillVersionFile> rows = listByVersionId(version.getId());
        if (!rows.isEmpty()) return rows;

        String zipKey = version.getZipUrl();
        if (zipKey != null && !zipKey.isBlank() && storage.exists(zipKey)) {
            try {
                materialize(version.getId(), zipKey);
                rows = listByVersionId(version.getId());
            } catch (RuntimeException e) {
                log.warn("lazy materialize failed for versionId={}: {}", version.getId(), e.getMessage());
            }
        }
        return rows;
    }

    /**
     * 从版本 zip 中读取 SKILL.md 文本，供详情页概述区直接预览。
     * 仅读取第一个根目录或子目录下的 SKILL.md，最多返回 256 KB。
     */
    public SkillMdContent readSkillMd(SkillVersion version) {
        if (version == null || version.getZipUrl() == null || version.getZipUrl().isBlank()) {
            throw new BusinessException(40400, "SKILL.md 不存在");
        }
        if (!storage.exists(version.getZipUrl())) {
            throw new BusinessException(40400, "SKILL.md 不存在");
        }

        try (InputStream raw = storage.openStream(version.getZipUrl());
             ZipInputStream zis = new ZipInputStream(raw)) {
            ZipEntry ze;
            while ((ze = zis.getNextEntry()) != null) {
                String name = ze.getName();
                if (shouldSkip(ze, name)) {
                    zis.closeEntry();
                    continue;
                }
                String lower = name.toLowerCase();
                if (lower.equals("skill.md") || lower.endsWith("/skill.md")) {
                    ReadTextResult text = readText(zis, MAX_SKILL_MD_BYTES);
                    long size = ze.getSize() >= 0 ? ze.getSize() : text.bytesRead;
                    zis.closeEntry();
                    return SkillMdContent.builder()
                            .path(name)
                            .content(text.content)
                            .size(size)
                            .truncated(text.truncated)
                            .build();
                }
                zis.closeEntry();
            }
        } catch (IOException e) {
            log.warn("readSkillMd failed for versionId={} zipKey={}: {}",
                    version.getId(), version.getZipUrl(), e.getMessage());
            throw new BusinessException(50000, "读取 SKILL.md 失败");
        }
        throw new BusinessException(40400, "SKILL.md 不存在");
    }

    private List<SkillVersionFile> listByVersionId(Long versionId) {
        return fileMapper.selectList(Wrappers.<SkillVersionFile>lambdaQuery()
                .eq(SkillVersionFile::getVersionId, versionId)
                .orderByAsc(SkillVersionFile::getSort));
    }

    private List<SkillVersionFile> scanZip(Long versionId, String zipKey) {
        List<SkillVersionFile> rows = new ArrayList<>();
        int sort = 0;
        try (InputStream raw = storage.openStream(zipKey);
             ZipInputStream zis = new ZipInputStream(raw)) {
            ZipEntry ze;
            while ((ze = zis.getNextEntry()) != null) {
                if (rows.size() >= MAX_ENTRIES) {
                    log.warn("zip entries truncated at {} for versionId={}", MAX_ENTRIES, versionId);
                    zis.closeEntry();
                    break;
                }
                String name = ze.getName();
                if (shouldSkip(ze, name)) {
                    zis.closeEntry();
                    continue;
                }

                long size = ze.getSize();
                if (size < 0) {
                    size = drainAndCount(zis);
                }

                SkillVersionFile row = new SkillVersionFile();
                row.setVersionId(versionId);
                row.setPath(truncatePath(name));
                row.setSize(size);
                row.setSort(sort++);
                rows.add(row);

                zis.closeEntry();
            }
        } catch (IOException e) {
            log.warn("scanZip failed for versionId={} zipKey={}: {}", versionId, zipKey, e.getMessage());
        }
        return rows;
    }

    private static boolean shouldSkip(ZipEntry ze, String name) {
        if (ze.isDirectory()) return true;
        if (name == null || name.isBlank()) return true;
        if (name.contains("..")) return true;
        return ZipSanitizer.isJunkEntry(name);
    }

    private static String truncatePath(String name) {
        // DB 列宽 512，留一格余量
        if (name.length() <= 500) return name;
        return name.substring(0, 500);
    }

    private static long drainAndCount(ZipInputStream zis) throws IOException {
        byte[] buf = new byte[8192];
        long total = 0;
        int n;
        while ((n = zis.read(buf)) > 0) total += n;
        return total;
    }

    private static ReadTextResult readText(ZipInputStream zis, int maxBytes) throws IOException {
        byte[] buf = new byte[8192];
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        long total = 0;
        boolean truncated = false;
        int n;
        while ((n = zis.read(buf)) > 0) {
            total += n;
            int remaining = maxBytes - out.size();
            if (remaining > 0) {
                out.write(buf, 0, Math.min(n, remaining));
            }
            if (total > maxBytes) truncated = true;
        }
        return new ReadTextResult(out.toString(StandardCharsets.UTF_8), total, truncated);
    }

    private record ReadTextResult(String content, long bytesRead, boolean truncated) {}
}
