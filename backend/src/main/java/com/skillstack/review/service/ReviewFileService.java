package com.skillstack.review.service;

import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.TeamAccessGuard;
import com.skillstack.common.storage.StorageProperties;
import com.skillstack.review.dto.ReviewFileTree;
import com.skillstack.review.entity.Review;
import com.skillstack.review.mapper.ReviewMapper;
import com.skillstack.skill.entity.SkillVersion;
import com.skillstack.skill.service.SkillVersionService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * 审核包文件预览服务（REV-007）。
 *
 * <p>解析 reviews.zip_url（或 fallback 到对应 skill_versions.zip_url）指向的本地
 * zip 包，返回文件树 + 文本文件内容字典。</p>
 *
 * <p>限制：</p>
 * <ul>
 *   <li>单包条目数 ≤ 200，超出截断；</li>
 *   <li>单个文本文件读取 ≤ 64KB；</li>
 *   <li>二进制扩展名（zip/png/jpg/exe/...) 不读取内容，仅返回 metadata；</li>
 *   <li>禁止 zip slip：拒绝包含 .. 的相对路径。</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class ReviewFileService {

    private static final int MAX_ENTRIES = 200;
    private static final int MAX_TEXT_BYTES = 64 * 1024;
    private static final java.util.Set<String> TEXT_EXT = java.util.Set.of(
            "md", "txt", "json", "ts", "tsx", "js", "jsx", "yml", "yaml",
            "html", "css", "sh", "py", "java", "kt", "go", "rs", "graphql",
            "ejs", "xml", "toml", "ini", "env"
    );

    private final ReviewMapper reviewMapper;
    private final SkillVersionService skillVersionService;
    private final TeamAccessGuard guard;
    private final StorageProperties storageProperties;

    public ReviewFileTree load(Long reviewId, Long userId) {
        Review r = reviewMapper.selectById(reviewId);
        if (r == null) {
            throw new BusinessException(40400, "审核记录不存在");
        }
        // 审核包内容仅团队 OWNER/ADMIN 与提交者本人可读。
        boolean isSubmitter = userId != null && userId.equals(r.getSubmitterId());
        if (!isSubmitter) {
            guard.requireWriter(r.getTeamId(), userId);
        }

        String key = r.getZipUrl();
        if ((key == null || key.isBlank()) && r.getSkillId() != null && r.getVersion() != null) {
            SkillVersion v = skillVersionService.findBySkillAndVersion(r.getSkillId(), r.getVersion());
            if (v != null) key = v.getZipUrl();
        }

        ReviewFileTree tree = new ReviewFileTree();
        if (key == null || key.isBlank()) {
            tree.setAvailable(false);
            tree.setMessage("当前版本未上传文件包");
            tree.setEntries(List.of());
            tree.setContents(Map.of());
            return tree;
        }

        Path zip = Paths.get(storageProperties.getLocal().getBaseDir()).resolve(key);
        if (!Files.isRegularFile(zip)) {
            tree.setAvailable(false);
            tree.setMessage("文件包已丢失或不可访问");
            tree.setEntries(List.of());
            tree.setContents(Map.of());
            return tree;
        }

        try (InputStream raw = Files.newInputStream(zip);
             ZipInputStream zis = new ZipInputStream(raw)) {
            List<ReviewFileTree.Entry> entries = new ArrayList<>();
            Map<String, String> contents = new HashMap<>();
            ZipEntry ze;
            int count = 0;
            while ((ze = zis.getNextEntry()) != null && count < MAX_ENTRIES) {
                String name = ze.getName();
                if (name.contains("..")) {
                    zis.closeEntry();
                    continue;
                }
                ReviewFileTree.Entry e = new ReviewFileTree.Entry();
                e.setPath(name);
                e.setSize(ze.getSize());
                if (ze.isDirectory()) {
                    e.setType("dir");
                } else {
                    String ext = extOf(name);
                    e.setType(ext);
                    boolean text = TEXT_EXT.contains(ext);
                    e.setBinary(!text);
                    if (text && ze.getSize() <= MAX_TEXT_BYTES) {
                        contents.put(name, readText(zis));
                    }
                }
                entries.add(e);
                count++;
                zis.closeEntry();
            }
            entries.sort((a, b) -> a.getPath().compareTo(b.getPath()));
            tree.setAvailable(true);
            tree.setEntries(entries);
            tree.setContents(contents);
            return tree;
        } catch (IOException e) {
            tree.setAvailable(false);
            tree.setMessage("解析 zip 失败：" + e.getMessage());
            tree.setEntries(List.of());
            tree.setContents(Map.of());
            return tree;
        }
    }

    private static String extOf(String name) {
        int dot = name.lastIndexOf('.');
        if (dot < 0 || dot == name.length() - 1) return "";
        return name.substring(dot + 1).toLowerCase();
    }

    private static String readText(ZipInputStream zis) throws IOException {
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        byte[] tmp = new byte[4096];
        int total = 0;
        int n;
        while ((n = zis.read(tmp)) > 0) {
            total += n;
            if (total > MAX_TEXT_BYTES) {
                buf.write(tmp, 0, n - (total - MAX_TEXT_BYTES));
                break;
            }
            buf.write(tmp, 0, n);
        }
        return buf.toString(StandardCharsets.UTF_8);
    }
}
