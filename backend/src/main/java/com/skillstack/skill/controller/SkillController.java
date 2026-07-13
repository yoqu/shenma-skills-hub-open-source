package com.skillstack.skill.controller;

import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.CurrentUser;
import com.skillstack.common.storage.StorageService;
import com.skillstack.common.storage.ZipSanitizer;
import com.skillstack.common.web.ApiResponse;
import com.skillstack.common.web.PageQuery;
import com.skillstack.common.web.PageResult;
import com.skillstack.skill.dto.AdminSkillProfileUpdateReq;
import com.skillstack.skill.dto.AdminSkillUpdateReq;
import com.skillstack.skill.dto.CreateSkillReq;
import com.skillstack.skill.dto.CreateSkillRes;
import com.skillstack.skill.dto.InstallRes;
import com.skillstack.skill.dto.ParseVersionReq;
import com.skillstack.skill.dto.PlazaQuery;
import com.skillstack.skill.dto.SkillCard;
import com.skillstack.skill.dto.SkillDetail;
import com.skillstack.skill.dto.SkillMdContent;
import com.skillstack.skill.dto.SkillParseResult;
import com.skillstack.skill.dto.SkillReviewItem;
import com.skillstack.skill.dto.SkillReviewSummary;
import com.skillstack.skill.dto.SkillVersionFileItem;
import com.skillstack.skill.dto.SkillVersionItem;
import com.skillstack.skill.dto.SubmitSkillReviewReplyReq;
import com.skillstack.skill.dto.SubmitSkillReviewReq;
import com.skillstack.skill.dto.SubmitVersionReq;
import com.skillstack.skill.dto.UploadTextReq;
import com.skillstack.skill.entity.Skill;
import com.skillstack.skill.entity.SkillVersion;
import com.skillstack.skill.entity.SkillVersionFile;
import com.skillstack.skill.service.SkillDownloadService;
import com.skillstack.skill.service.SkillParseService;
import com.skillstack.skill.service.SkillReviewService;
import com.skillstack.skill.service.SkillService;
import com.skillstack.skill.service.SkillVersionFileService;
import com.skillstack.skill.service.SkillVersionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Skill 相关接口。详细可见性/状态规则见 SkillService 注释。
 */
@RestController
@RequestMapping
@RequiredArgsConstructor
public class SkillController {

    private final SkillService skillService;
    private final SkillVersionService skillVersionService;
    private final SkillVersionFileService skillVersionFileService;
    private final SkillDownloadService skillDownloadService;
    private final SkillParseService skillParseService;
    private final SkillReviewService skillReviewService;
    private final StorageService storageService;

    // ===================== 广场 =====================

    @GetMapping("/api/skills")
    public ApiResponse<PageResult<SkillCard>> listPlaza(@ModelAttribute PageQuery q) {
        return ApiResponse.ok(skillService.listPublicSkills(q));
    }

    @GetMapping("/api/skills/{slug}")
    public ApiResponse<SkillDetail> detail(@PathVariable String slug,
                                           @AuthenticationPrincipal CurrentUser me) {
        Long uid = me == null ? null : me.getId();
        return ApiResponse.ok(skillService.getDetail(slug, uid));
    }

    @GetMapping("/api/skills/{slug}/versions")
    public ApiResponse<List<SkillVersionItem>> versions(@PathVariable String slug,
                                                        @AuthenticationPrincipal CurrentUser me) {
        Long uid = me == null ? null : me.getId();
        // 与详情一致的可见性检查
        skillService.requireReadable(slug, uid);
        return ApiResponse.ok(skillVersionService.listBySlug(slug));
    }

    /**
     * 详情页「文件」tab：列出指定版本 zip 内的文件清单（不返回内容）。
     * 权限与 download 一致：requireReadable（公开 + 已审核 / 团队成员）。
     * 未指定版本或指定版本不存在时回退到 skill 当前版本。
     */
    @GetMapping("/api/skills/{slug}/versions/{version}/files")
    public ApiResponse<List<SkillVersionFileItem>> versionFiles(
            @PathVariable String slug,
            @PathVariable String version,
            @AuthenticationPrincipal CurrentUser me) {
        Long uid = me == null ? null : me.getId();
        Skill skill = skillService.requireReadable(slug, uid);
        String effective = (version == null || version.isBlank()) ? skill.getVersion() : version.trim();
        SkillVersion v = skillVersionService.findBySkillAndVersion(skill.getId(), effective);
        if (v == null) {
            v = skillVersionService.findBySkillAndVersion(skill.getId(), skill.getVersion());
        }
        if (v == null) {
            return ApiResponse.ok(List.of());
        }
        List<SkillVersionFile> rows = skillVersionFileService.listWithLazyBackfill(v);
        List<SkillVersionFileItem> items = rows.stream()
                .map(r -> SkillVersionFileItem.builder().path(r.getPath()).size(r.getSize()).build())
                .toList();
        return ApiResponse.ok(items);
    }

    /**
     * 详情页「概述」：读取指定版本 zip 内的 SKILL.md 文本内容。
     * 权限与文件清单 / 下载一致。
     */
    @GetMapping("/api/skills/{slug}/versions/{version}/skill-md")
    public ApiResponse<SkillMdContent> versionSkillMd(
            @PathVariable String slug,
            @PathVariable String version,
            @AuthenticationPrincipal CurrentUser me) {
        Long uid = me == null ? null : me.getId();
        Skill skill = skillService.requireReadable(slug, uid);
        String effective = (version == null || version.isBlank()) ? skill.getVersion() : version.trim();
        SkillVersion v = skillVersionService.findBySkillAndVersion(skill.getId(), effective);
        if (v == null) {
            v = skillVersionService.findBySkillAndVersion(skill.getId(), skill.getVersion());
        }
        return ApiResponse.ok(skillVersionFileService.readSkillMd(v));
    }

    @GetMapping("/api/skills/{slug}/download")
    public ResponseEntity<ByteArrayResource> download(@PathVariable String slug,
                                                      @RequestParam(value = "version", required = false) String version,
                                                      @AuthenticationPrincipal CurrentUser me) {
        Long uid = me == null ? null : me.getId();
        SkillDownloadService.ZipPayload payload = skillDownloadService.build(slug, version, uid);
        String encoded = URLEncoder.encode(payload.fileName, StandardCharsets.UTF_8).replace("+", "%20");
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/zip"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + payload.fileName + "\"; filename*=UTF-8''" + encoded)
                .contentLength(payload.data.length)
                .body(new ByteArrayResource(payload.data));
    }

    // ===================== 创建 / 草稿 =====================

    @PostMapping("/api/skills")
    public ApiResponse<CreateSkillRes> create(@Valid @RequestBody CreateSkillReq req,
                                              @AuthenticationPrincipal CurrentUser me) {
        return ApiResponse.ok(skillService.create(req, me.getId()));
    }

    /** 显式存草稿入口（SKILL-CRT-004）。 */
    @PostMapping("/api/skills/drafts")
    public ApiResponse<CreateSkillRes> createDraft(@Valid @RequestBody CreateSkillReq req,
                                                   @AuthenticationPrincipal CurrentUser me) {
        req.setDraft(true);
        return ApiResponse.ok(skillService.create(req, me.getId()));
    }

    @GetMapping("/api/skills/me/drafts")
    public ApiResponse<List<SkillCard>> myDrafts(@AuthenticationPrincipal CurrentUser me) {
        return ApiResponse.ok(skillService.listDrafts(me.getId()));
    }

    /**
     * 发新版本（SKILL-VER-001）：作者本人对已通过的 Skill 提交新版本审核。
     * 审核通过后 skill.version 同步更新并写 skill_versions 历史。
     */
    @PostMapping("/api/skills/{id}/versions")
    public ApiResponse<CreateSkillRes> submitVersion(@PathVariable Long id,
                                                     @Valid @RequestBody SubmitVersionReq req,
                                                     @AuthenticationPrincipal CurrentUser me) {
        Long uid = me == null ? null : me.getId();
        return ApiResponse.ok(skillService.submitVersion(id, uid, req.getVersion(), req.getChangelog(), req.getZipUrl()));
    }

    /**
     * 提交 Skill 版本前上传 zip 文件，返回 storage key（赋给 CreateSkillReq.zipUrl
     * 或 SubmitVersionReq.zipUrl）。仅允许 .zip。
     */
    @PostMapping("/api/skills/versions/upload")
    public ApiResponse<Map<String, String>> uploadVersionZip(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal CurrentUser me) {
        if (me == null) throw new BusinessException(40100, "请先登录");
        String name = file.getOriginalFilename();
        if (name == null || !name.toLowerCase().endsWith(".zip")) {
            throw new BusinessException(40000, "只支持 .zip 文件");
        }
        try {
            // 入站清洗：剔除 macOS Finder 压缩遗留的 __MACOSX/.DS_Store/._* 影子条目，
            // 让线上存储与下游解析/打包链路始终拿到干净 zip。
            byte[] cleaned = ZipSanitizer.sanitize(file.getBytes());
            String key = storageService.store(cleaned, name, "skill-versions/" + me.getId());
            return ApiResponse.ok(Map.of("zipUrl", key, "url", storageService.resolveUrl(key)));
        } catch (java.io.IOException e) {
            throw new BusinessException(50000, "上传失败：" + e.getMessage());
        }
    }

    /**
     * Skill 介绍 Markdown 内嵌图片上传：返回可直接嵌入 ![](url) 的完整 URL。
     * 仅图片，单文件 ≤ 5MB；需登录。
     */
    @PostMapping("/api/skills/description-images")
    public ApiResponse<Map<String, String>> uploadDescriptionImage(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal CurrentUser me) {
        if (me == null) throw new BusinessException(40100, "请先登录");
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new BusinessException(40000, "只支持图片文件");
        }
        if (file.getSize() <= 0) {
            throw new BusinessException(40000, "文件为空");
        }
        if (file.getSize() > 5 * 1024 * 1024) {
            throw new BusinessException(40000, "图片不能超过 5 MB");
        }
        try {
            String key = storageService.store(file, "skill-desc/" + me.getId());
            return ApiResponse.ok(Map.of("url", storageService.resolveUrl(key)));
        } catch (java.io.IOException e) {
            throw new BusinessException(50000, "上传失败：" + e.getMessage());
        }
    }

    /**
     * Skill 自定义图标上传：返回 storage key + 可访问 URL。
     * 创建/编辑表单拿 key 提交（落库为 raw key），用 url 做预览。仅图片，≤ 2MB，需登录。
     */
    @PostMapping("/api/skills/icon-images")
    public ApiResponse<Map<String, String>> uploadIconImage(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal CurrentUser me) {
        if (me == null) throw new BusinessException(40100, "请先登录");
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new BusinessException(40000, "只支持图片文件");
        }
        if (file.getSize() <= 0) {
            throw new BusinessException(40000, "文件为空");
        }
        if (file.getSize() > 2 * 1024 * 1024) {
            throw new BusinessException(40000, "图标不能超过 2 MB");
        }
        try {
            String key = storageService.store(file, "skill-icons/" + me.getId());
            return ApiResponse.ok(Map.of("key", key, "url", storageService.resolveUrl(key)));
        } catch (java.io.IOException e) {
            throw new BusinessException(50000, "上传失败：" + e.getMessage());
        }
    }

    /**
     * 上传单文件 SKILL.md：服务端把它合成为含一个 SKILL.md 的 zip,
     * 让下游解析 / 审核 / 下载链路保持单一形态。
     */
    @PostMapping("/api/skills/versions/upload-md")
    public ApiResponse<Map<String, String>> uploadVersionMd(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal CurrentUser me) {
        if (me == null) throw new BusinessException(40100, "请先登录");
        String name = file.getOriginalFilename();
        if (name == null || !name.toLowerCase().endsWith(".md")) {
            throw new BusinessException(40000, "只支持 .md 文件");
        }
        if (file.getSize() <= 0) {
            throw new BusinessException(40000, "文件为空");
        }
        if (file.getSize() > 256 * 1024) {
            throw new BusinessException(40000, "SKILL.md 不能超过 256 KB");
        }
        try {
            byte[] zip = wrapSkillMdToZip(file.getBytes());
            String key = storageService.store(zip, "skill.zip", "skill-versions/" + me.getId());
            return ApiResponse.ok(Map.of("zipUrl", key, "url", storageService.resolveUrl(key)));
        } catch (java.io.IOException e) {
            throw new BusinessException(50000, "上传失败：" + e.getMessage());
        }
    }

    /**
     * 粘贴 SKILL.md 文本：服务端按 UTF-8 编码并合成为只含 SKILL.md 的 zip。
     */
    @PostMapping("/api/skills/versions/upload-text")
    public ApiResponse<Map<String, String>> uploadVersionText(
            @Valid @RequestBody UploadTextReq req,
            @AuthenticationPrincipal CurrentUser me) {
        if (me == null) throw new BusinessException(40100, "请先登录");
        byte[] body = req.getContent().getBytes(StandardCharsets.UTF_8);
        try {
            byte[] zip = wrapSkillMdToZip(body);
            String key = storageService.store(zip, "skill.zip", "skill-versions/" + me.getId());
            return ApiResponse.ok(Map.of("zipUrl", key, "url", storageService.resolveUrl(key)));
        } catch (java.io.IOException e) {
            throw new BusinessException(50000, "保存失败：" + e.getMessage());
        }
    }

    private static byte[] wrapSkillMdToZip(byte[] skillMdBody) throws java.io.IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(out)) {
            ZipEntry e = new ZipEntry("SKILL.md");
            zos.putNextEntry(e);
            zos.write(skillMdBody);
            zos.closeEntry();
        }
        return out.toByteArray();
    }

    /**
     * 解析上传的 zip：抽取 SKILL.md / frontmatter / 推断 langs / 生成校验项。
     * 仅允许解析由自己上传的包(通过 storage key 前缀做最低限度校验)。
     */
    @PostMapping("/api/skills/versions/parse")
    public ApiResponse<SkillParseResult> parseVersionZip(@Valid @RequestBody ParseVersionReq req,
                                                          @AuthenticationPrincipal CurrentUser me) {
        if (me == null) throw new BusinessException(40100, "请先登录");
        String key = req.getZipUrl();
        String expectedPrefix = "skill-versions/" + me.getId() + "/";
        if (key == null || !key.startsWith(expectedPrefix)) {
            throw new BusinessException(40300, "无权解析该文件");
        }
        return ApiResponse.ok(skillParseService.parse(key));
    }

    // ===================== 安装 / 收藏 =====================

    @PostMapping("/api/skills/{id}/install")
    public ApiResponse<InstallRes> install(@PathVariable Long id,
                                           @AuthenticationPrincipal CurrentUser me) {
        return ApiResponse.ok(skillService.install(id));
    }

    @PostMapping("/api/skills/{id}/star")
    public ApiResponse<Map<String, Object>> star(@PathVariable Long id,
                                                 @AuthenticationPrincipal CurrentUser me) {
        Long uid = me == null ? null : me.getId();
        int stars = skillService.star(id, uid, true);
        return ApiResponse.ok(Map.of("stars", stars, "starred", true));
    }

    @DeleteMapping("/api/skills/{id}/star")
    public ApiResponse<Map<String, Object>> unstar(@PathVariable Long id,
                                                   @AuthenticationPrincipal CurrentUser me) {
        Long uid = me == null ? null : me.getId();
        int stars = skillService.star(id, uid, false);
        return ApiResponse.ok(Map.of("stars", stars, "starred", false));
    }

    // ===================== 评分 / 评论 =====================

    /** 公共：评分聚合 + 评论列表 + 作者回复。viewer 已登录时附带 myReviewId。 */
    @GetMapping("/api/skills/{id}/reviews")
    public ApiResponse<SkillReviewSummary> listReviews(@PathVariable Long id,
                                                       @AuthenticationPrincipal CurrentUser me) {
        Long uid = me == null ? null : me.getId();
        return ApiResponse.ok(skillReviewService.loadSummary(id, uid));
    }

    /** 登录后提交评分 + 评论；同一用户重复提交按 upsert 处理。返回最新 summary。 */
    @PostMapping("/api/skills/{id}/reviews")
    public ApiResponse<SkillReviewSummary> submitReview(@PathVariable Long id,
                                                        @Valid @RequestBody SubmitSkillReviewReq req,
                                                        @AuthenticationPrincipal CurrentUser me) {
        Long uid = me == null ? null : me.getId();
        return ApiResponse.ok(skillReviewService.submit(id, uid, req));
    }

    /** 仅 skill 作者可对评论追加回复。 */
    @PostMapping("/api/skills/{id}/reviews/{reviewId}/replies")
    public ApiResponse<SkillReviewItem.ReplyItem> replyReview(@PathVariable Long id,
                                                              @PathVariable Long reviewId,
                                                              @Valid @RequestBody SubmitSkillReviewReplyReq req,
                                                              @AuthenticationPrincipal CurrentUser me) {
        Long uid = me == null ? null : me.getId();
        return ApiResponse.ok(skillReviewService.reply(id, reviewId, uid, req));
    }

    // ===================== 管理员写操作 =====================

    /** 修改可见性 PUBLIC ↔ TEAM_PRIVATE，需团队 OWNER/ADMIN。 */
    @PatchMapping("/api/skills/{id}/visibility")
    public ApiResponse<Void> updateVisibility(@PathVariable Long id,
                                              @RequestBody AdminSkillUpdateReq req,
                                              @AuthenticationPrincipal CurrentUser me) {
        Long uid = me == null ? null : me.getId();
        skillService.updateVisibility(id, req.getVisibility(), uid);
        return ApiResponse.ok();
    }

    /** 上下架 APPROVED ↔ UNLISTED，需团队 OWNER/ADMIN。 */
    @PatchMapping("/api/skills/{id}/status")
    public ApiResponse<Void> updateStatus(@PathVariable Long id,
                                          @RequestBody AdminSkillUpdateReq req,
                                          @AuthenticationPrincipal CurrentUser me) {
        Long uid = me == null ? null : me.getId();
        skillService.updateStatus(id, req.getStatus(), uid);
        return ApiResponse.ok();
    }

    /** 转移作者，需团队 OWNER/ADMIN；新作者必须是同团队成员。 */
    @PatchMapping("/api/skills/{id}/owner")
    public ApiResponse<Void> transferOwner(@PathVariable Long id,
                                           @RequestBody AdminSkillUpdateReq req,
                                           @AuthenticationPrincipal CurrentUser me) {
        Long uid = me == null ? null : me.getId();
        skillService.transferOwner(id, req.getOwnerId(), uid);
        return ApiResponse.ok();
    }

    /** 编辑已上线 Skill 展示信息，需团队 OWNER/ADMIN。 */
    @PatchMapping("/api/skills/{id}/admin-profile")
    public ApiResponse<Void> updateAdminProfile(@PathVariable Long id,
                                                @RequestBody AdminSkillProfileUpdateReq req,
                                                @AuthenticationPrincipal CurrentUser me) {
        Long uid = me == null ? null : me.getId();
        skillService.updateAdminProfile(id, req, uid);
        return ApiResponse.ok();
    }

    /** 软删除，需团队 OWNER/ADMIN。 */
    @DeleteMapping("/api/skills/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id,
                                    @AuthenticationPrincipal CurrentUser me) {
        Long uid = me == null ? null : me.getId();
        skillService.softDelete(id, uid);
        return ApiResponse.ok();
    }

    // ===================== 团队 Skill 库 =====================

    @GetMapping("/api/teams/{teamId}/skills")
    public ApiResponse<PageResult<SkillCard>> listTeamSkills(@PathVariable Long teamId,
                                                             @ModelAttribute PlazaQuery q,
                                                             @AuthenticationPrincipal CurrentUser me) {
        Long uid = me == null ? null : me.getId();
        return ApiResponse.ok(skillService.listTeamSkills(teamId, q, uid));
    }
}
