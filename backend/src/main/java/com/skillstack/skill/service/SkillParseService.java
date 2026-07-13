package com.skillstack.skill.service;

import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.storage.StorageService;
import com.skillstack.common.storage.ZipSanitizer;
import com.skillstack.skill.dto.SkillParseResult;
import com.skillstack.skill.dto.SkillParseResult.Check;
import com.skillstack.skill.dto.SkillParseResult.ParsedMeta;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.constructor.SafeConstructor;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * 解析上传后的 SKILL.zip:
 * <ul>
 *   <li>读取文件大小 / sha256 / 条目数。</li>
 *   <li>定位 SKILL.md(根目录优先,其次任意位置)。</li>
 *   <li>解析 YAML frontmatter,抽取 name / version / description / category / tags。</li>
 *   <li>按文件扩展名推断 langs。</li>
 *   <li>组装一组前端可直接渲染的校验项。</li>
 * </ul>
 * 失败时尽量返回部分结果 + warn/fail check,而不是直接抛异常,
 * 让前端能给出更具体的提示。
 */
@Service
@RequiredArgsConstructor
public class SkillParseService {

    private static final int MAX_ENTRIES = 500;
    private static final long MAX_ZIP_BYTES = 20L * 1024 * 1024;
    private static final long MAX_SKILL_MD_BYTES = 256 * 1024;
    private static final String DEFAULT_VERSION = "0.1.0";

    private static final Pattern SLUG_RE = Pattern.compile("^[a-z0-9][a-z0-9-]{1,94}$");
    private static final Pattern SEMVER_RE = Pattern.compile("^\\d+\\.\\d+\\.\\d+(?:[-+][0-9A-Za-z.-]+)?$");

    private static final Set<String> FORBIDDEN_DIRS = Set.of("node_modules/", ".git/");

    // 扩展名 -> 标准化 lang
    private static final Map<String, String> EXT_TO_LANG = Map.ofEntries(
            Map.entry("ts", "TS"), Map.entry("tsx", "TS"),
            Map.entry("js", "JS"), Map.entry("jsx", "JS"), Map.entry("mjs", "JS"), Map.entry("cjs", "JS"),
            Map.entry("py", "Python"),
            Map.entry("java", "Java"), Map.entry("kt", "Kotlin"),
            Map.entry("go", "Go"),
            Map.entry("rs", "Rust"),
            Map.entry("rb", "Ruby"),
            Map.entry("php", "PHP"),
            Map.entry("sh", "Shell"), Map.entry("bash", "Shell"), Map.entry("zsh", "Shell"),
            Map.entry("css", "CSS"), Map.entry("scss", "CSS"), Map.entry("less", "CSS"),
            Map.entry("html", "HTML"), Map.entry("vue", "Vue"), Map.entry("svelte", "Svelte"),
            Map.entry("sql", "SQL"),
            Map.entry("yaml", "YAML"), Map.entry("yml", "YAML"),
            Map.entry("json", "JSON")
    );

    private static final Set<String> VALID_CATS = Set.of("dev", "data", "design", "doc", "devops", "ai");

    private final StorageService storage;

    public SkillParseResult parse(String zipKey) {
        if (zipKey == null || zipKey.isBlank()) {
            throw new BusinessException(40000, "zipUrl 不能为空");
        }
        if (!storage.exists(zipKey)) {
            throw new BusinessException(40400, "压缩包不存在,请重新上传");
        }
        long size = storage.size(zipKey);
        if (size <= 0) {
            throw new BusinessException(40000, "压缩包为空");
        }
        if (size > MAX_ZIP_BYTES) {
            throw new BusinessException(40000, "压缩包超过 20 MB 限制");
        }

        List<Check> checks = new ArrayList<>();
        int entryCount = 0;
        int fileCount = 0;
        String skillMdPath = null;
        byte[] skillMdBody = null;
        Set<String> hitForbidden = new TreeSet<>();
        Set<String> langs = new LinkedHashSet<>();
        boolean entriesTruncated = false;

        // pass 1: 计算 sha256(对原始字节)
        String sha256 = computeSha256(zipKey);

        // pass 2: 扫描 zip 条目
        try (InputStream raw = storage.openStream(zipKey);
             ZipInputStream zis = new ZipInputStream(raw)) {
            ZipEntry ze;
            while ((ze = zis.getNextEntry()) != null) {
                if (entryCount >= MAX_ENTRIES) {
                    entriesTruncated = true;
                    zis.closeEntry();
                    break;
                }
                String name = ze.getName();
                entryCount++;
                if (name.contains("..")) {
                    zis.closeEntry();
                    continue;
                }
                // macOS 影子条目（__MACOSX/.DS_Store/._*）：上传时已做入站清洗，
                // 这里再忽略一次以兼容历史 zip，避免污染 file/entry 计数和 SKILL.md 匹配。
                if (ZipSanitizer.isJunkEntry(name)) {
                    zis.closeEntry();
                    continue;
                }
                for (String f : FORBIDDEN_DIRS) {
                    if (name.startsWith(f) || name.contains("/" + f)) hitForbidden.add(f);
                }
                if (ze.isDirectory()) {
                    zis.closeEntry();
                    continue;
                }
                fileCount++;
                String lower = name.toLowerCase();
                if (skillMdBody == null && (lower.equals("skill.md") || lower.endsWith("/skill.md"))) {
                    long entrySize = ze.getSize();
                    if (entrySize > 0 && entrySize > MAX_SKILL_MD_BYTES) {
                        checks.add(check("warn", "SKILL.md 过大",
                                "SKILL.md 超过 " + (MAX_SKILL_MD_BYTES / 1024) + " KB,跳过解析"));
                    } else {
                        skillMdBody = readEntry(zis, MAX_SKILL_MD_BYTES);
                        skillMdPath = name;
                    }
                }
                String ext = extOf(lower);
                if (EXT_TO_LANG.containsKey(ext)) langs.add(EXT_TO_LANG.get(ext));
                zis.closeEntry();
            }
        } catch (IOException e) {
            throw new BusinessException(40000, "解析压缩包失败: " + e.getMessage());
        }

        // ---------- 文件基础校验 ----------
        checks.add(check("pass", "压缩包已上传",
                "大小 " + formatSize(size) + " · sha256 " + sha256.substring(0, 8) + "…"));
        checks.add(check(fileCount > 0 ? "pass" : "fail", "包含文件",
                fileCount + " 个文件,共 " + entryCount + " 个条目"));
        if (entriesTruncated) {
            checks.add(check("warn", "条目数超出限制",
                    "仅分析前 " + MAX_ENTRIES + " 个条目,完整 zip 仍会被上传"));
        }
        if (!hitForbidden.isEmpty()) {
            checks.add(check("warn", "包含建议剔除的目录",
                    "检测到 " + String.join(", ", hitForbidden) + ",建议提交前清理"));
        }

        // ---------- SKILL.md ----------
        ParsedMeta parsed = ParsedMeta.builder().tags(List.of()).langs(new ArrayList<>(langs)).build();
        boolean hasFrontmatter = false;

        if (skillMdBody == null) {
            checks.add(check("fail", "根目录存在 SKILL.md",
                    "未在压缩包中找到 SKILL.md,请检查文件结构"));
        } else {
            checks.add(check("pass", "根目录存在 SKILL.md", "已检测到 " + skillMdPath));
            String text = new String(skillMdBody, StandardCharsets.UTF_8);
            FrontmatterParse fm = parseFrontmatter(text);
            if (fm.error != null) {
                checks.add(check("fail", "frontmatter 解析", fm.error));
            } else if (fm.data == null) {
                checks.add(check("warn", "frontmatter 解析",
                        "未检测到 YAML frontmatter(应以 --- 开始),请在下一步手动填写"));
            } else {
                hasFrontmatter = true;
                applyFrontmatter(parsed, fm.data, langs);
                addFieldChecks(checks, parsed);
            }
        }

        boolean ok = checks.stream().noneMatch(c -> "fail".equals(c.getStatus()));
        parsed.setLangs(new ArrayList<>(langs));
        return SkillParseResult.builder()
                .zipUrl(zipKey)
                .size(size)
                .sha256(sha256)
                .entryCount(entryCount)
                .fileCount(fileCount)
                .skillMdPath(skillMdPath)
                .hasSkillMd(skillMdPath != null)
                .hasFrontmatter(hasFrontmatter)
                .parsed(parsed)
                .checks(checks)
                .ok(ok)
                .build();
    }

    // ---------- frontmatter ----------

    private static final class FrontmatterParse {
        Map<String, Object> data;
        String error;
    }

    @SuppressWarnings("unchecked")
    private FrontmatterParse parseFrontmatter(String text) {
        FrontmatterParse out = new FrontmatterParse();
        if (text == null) return out;
        String body = stripBom(text).replace("\r\n", "\n");
        if (!body.startsWith("---\n") && !body.startsWith("---")) return out;
        // 找第一个起始 --- 后的内容
        int start = body.indexOf("---");
        int end = body.indexOf("\n---", start + 3);
        if (end < 0) {
            out.error = "frontmatter 未正确结束(缺少闭合 --- 行)";
            return out;
        }
        String yamlText = body.substring(start + 3, end).trim();
        if (yamlText.isEmpty()) return out;
        try {
            LoaderOptions opts = new LoaderOptions();
            opts.setMaxAliasesForCollections(50);
            opts.setAllowDuplicateKeys(false);
            Yaml yaml = new Yaml(new SafeConstructor(opts));
            Object loaded = yaml.load(yamlText);
            if (loaded instanceof Map<?, ?> m) {
                Map<String, Object> norm = new HashMap<>();
                for (Map.Entry<?, ?> e : m.entrySet()) {
                    if (e.getKey() != null) norm.put(e.getKey().toString().toLowerCase(), e.getValue());
                }
                out.data = norm;
            } else {
                out.error = "frontmatter 顶层必须是 key: value 映射";
            }
        } catch (Exception e) {
            out.error = "YAML 解析失败: " + e.getMessage();
        }
        return out;
    }

    private void applyFrontmatter(ParsedMeta meta, Map<String, Object> fm, Set<String> langsAcc) {
        meta.setName(asString(fm.get("name")));
        meta.setVersion(asString(fm.get("version")));
        Object descObj = fm.get("description");
        if (descObj == null) descObj = fm.get("short_desc");
        if (descObj == null) descObj = fm.get("shortdesc");
        meta.setDescription(asString(descObj));

        Object catObj = fm.get("category");
        if (catObj == null) catObj = fm.get("cat");
        String cat = asString(catObj);
        if (cat != null) cat = cat.toLowerCase().trim();
        meta.setCategory(cat);

        List<String> tags = asStringList(fm.get("tags"));
        if (tags == null || tags.isEmpty()) tags = asStringList(fm.get("keywords"));
        if (tags != null) {
            // 规范化:小写 / 去重 / 截断 24
            LinkedHashSet<String> norm = new LinkedHashSet<>();
            for (String t : tags) {
                if (t == null) continue;
                String x = t.trim().toLowerCase();
                if (x.isEmpty()) continue;
                if (x.length() > 24) x = x.substring(0, 24);
                norm.add(x);
                if (norm.size() >= 8) break;
            }
            meta.setTags(new ArrayList<>(norm));
        } else {
            meta.setTags(List.of());
        }

        List<String> declaredLangs = asStringList(fm.get("langs"));
        if (declaredLangs == null) declaredLangs = asStringList(fm.get("languages"));
        if (declaredLangs != null) {
            for (String l : declaredLangs) {
                if (l != null && !l.isBlank()) langsAcc.add(l.trim());
            }
        }
    }

    private void addFieldChecks(List<Check> checks, ParsedMeta p) {
        if (isBlank(p.getName())) {
            checks.add(check("fail", "frontmatter.name", "缺少 name 字段"));
        } else if (!SLUG_RE.matcher(p.getName().toLowerCase()).matches()) {
            checks.add(check("warn", "frontmatter.name",
                    p.getName() + " 建议使用 kebab-case (a-z 0-9 -)"));
        } else {
            checks.add(check("pass", "frontmatter.name", p.getName()));
        }

        if (isBlank(p.getVersion())) {
            p.setVersion(DEFAULT_VERSION);
            checks.add(check("warn", "frontmatter.version",
                    "缺少 version 字段,已按 " + DEFAULT_VERSION + " 导入"));
        } else if (!SEMVER_RE.matcher(p.getVersion()).matches()) {
            checks.add(check("fail", "frontmatter.version", p.getVersion() + " 不符合 SemVer"));
        } else {
            checks.add(check("pass", "frontmatter.version", p.getVersion()));
        }

        if (isBlank(p.getDescription())) {
            checks.add(check("fail", "frontmatter.description", "缺少 description 字段"));
        } else if (p.getDescription().length() > 80) {
            checks.add(check("warn", "frontmatter.description",
                    "description 超过 80 字符,提交前会截断"));
        } else {
            checks.add(check("pass", "frontmatter.description",
                    p.getDescription().length() + " 字符"));
        }

        if (p.getCategory() != null && !p.getCategory().isBlank()
                && !VALID_CATS.contains(p.getCategory())) {
            checks.add(check("warn", "frontmatter.category",
                    "未识别的分类: " + p.getCategory() + " · 下一步请手动选择"));
        }
    }

    // ---------- helpers ----------

    private String computeSha256(String key) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            try (InputStream in = storage.openStream(key);
                 DigestInputStream dIn = new DigestInputStream(in, md)) {
                byte[] buf = new byte[8192];
                while (dIn.read(buf) != -1) {
                    // drain
                }
            }
            return toHex(md.digest());
        } catch (NoSuchAlgorithmException e) {
            throw new BusinessException(50000, "服务端缺少 SHA-256 实现");
        } catch (IOException e) {
            throw new BusinessException(40000, "读取压缩包失败: " + e.getMessage());
        }
    }

    private static byte[] readEntry(InputStream in, long max) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[4096];
        long total = 0;
        int n;
        while ((n = in.read(buf)) > 0) {
            total += n;
            if (total > max) {
                // 截断,但仍然消费完
                continue;
            }
            out.write(buf, 0, n);
        }
        return out.toByteArray();
    }

    private static Check check(String status, String name, String detail) {
        return Check.builder().status(status).name(name).detail(detail).build();
    }

    private static String stripBom(String s) {
        if (s != null && !s.isEmpty() && s.charAt(0) == '﻿') return s.substring(1);
        return s;
    }

    private static String asString(Object v) {
        if (v == null) return null;
        String s = String.valueOf(v).trim();
        return s.isEmpty() ? null : s;
    }

    @SuppressWarnings("unchecked")
    private static List<String> asStringList(Object v) {
        if (v == null) return null;
        if (v instanceof Collection<?> c) {
            List<String> out = new ArrayList<>(c.size());
            for (Object o : c) {
                if (o != null) out.add(String.valueOf(o));
            }
            return out;
        }
        if (v instanceof String s) {
            return Arrays.stream(s.split("[,\\s]+"))
                    .filter(x -> !x.isBlank())
                    .toList();
        }
        return null;
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String extOf(String name) {
        int dot = name.lastIndexOf('.');
        if (dot < 0 || dot == name.length() - 1) return "";
        return name.substring(dot + 1);
    }

    private static String formatSize(long bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return String.format("%.1f KB", bytes / 1024.0);
        return String.format("%.1f MB", bytes / (1024.0 * 1024.0));
    }

    private static String toHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) sb.append(String.format("%02x", b));
        return sb.toString();
    }
}
