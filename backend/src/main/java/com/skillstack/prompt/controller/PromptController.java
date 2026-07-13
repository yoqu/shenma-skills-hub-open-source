package com.skillstack.prompt.controller;

import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.CurrentUser;
import com.skillstack.common.storage.StorageService;
import com.skillstack.common.web.ApiResponse;
import com.skillstack.common.web.PageQuery;
import com.skillstack.common.web.PageResult;
import com.skillstack.prompt.dto.AdminPromptProfileUpdateReq;
import com.skillstack.prompt.dto.AdminPromptUpdateReq;
import com.skillstack.prompt.dto.CreatePromptReq;
import com.skillstack.prompt.dto.PromptCard;
import com.skillstack.prompt.dto.PromptDetail;
import com.skillstack.prompt.dto.PromptResolveResult;
import com.skillstack.prompt.dto.PromptVersionItem;
import com.skillstack.prompt.dto.ResolvePromptReq;
import com.skillstack.prompt.dto.SubmitPromptVersionReq;
import com.skillstack.prompt.service.PromptService;
import com.skillstack.asset.service.AssetReviewService;
import com.skillstack.skill.dto.SkillReviewItem;
import com.skillstack.skill.dto.SkillReviewSummary;
import com.skillstack.skill.dto.SubmitSkillReviewReplyReq;
import com.skillstack.skill.dto.SubmitSkillReviewReq;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api")
public class PromptController {

    private final PromptService promptService;
    private final AssetReviewService assetReviewService;
    private final StorageService storageService;

    @GetMapping("/prompts")
    public ApiResponse<PageResult<PromptCard>> listPublic(PageQuery q,
                                                          @RequestParam(required = false, name = "q") String keyword) {
        return ApiResponse.ok(promptService.listPublic(q, keyword));
    }

    @GetMapping("/teams/{teamId}/prompts")
    public ApiResponse<PageResult<PromptCard>> listTeam(@PathVariable Long teamId,
                                                        PageQuery q,
                                                        @RequestParam(required = false) String status,
                                                        @RequestParam(required = false) String visibility,
                                                        @RequestParam(required = false) String cat,
                                                        @RequestParam(required = false) Long authorId,
                                                        @RequestParam(required = false) Integer updatedWithin,
                                                        @RequestParam(required = false, name = "q") String keyword,
                                                        @AuthenticationPrincipal CurrentUser me) {
        return ApiResponse.ok(promptService.listTeam(teamId, q, me == null ? null : me.getId(),
                status, visibility, cat, authorId, updatedWithin, keyword));
    }

    @GetMapping("/teams/{teamSlug}/prompts/{promptSlug}")
    public ApiResponse<PromptDetail> detail(@PathVariable String teamSlug,
                                            @PathVariable String promptSlug,
                                            @AuthenticationPrincipal CurrentUser me) {
        return ApiResponse.ok(promptService.detail(teamSlug, promptSlug, me == null ? null : me.getId()));
    }

    @GetMapping("/prompts/{id}")
    public ApiResponse<PromptDetail> detailById(@PathVariable Long id,
                                                @AuthenticationPrincipal CurrentUser me) {
        return ApiResponse.ok(promptService.detailById(id, me == null ? null : me.getId()));
    }

    @GetMapping("/prompts/{id}/versions")
    public ApiResponse<List<PromptVersionItem>> versions(@PathVariable Long id,
                                                         @AuthenticationPrincipal CurrentUser me) {
        return ApiResponse.ok(promptService.versions(id, me == null ? null : me.getId()));
    }

    @GetMapping("/prompts/{id}/versions/{version}")
    public ApiResponse<PromptVersionItem> versionDetail(@PathVariable Long id,
                                                        @PathVariable String version,
                                                        @AuthenticationPrincipal CurrentUser me) {
        return ApiResponse.ok(promptService.versionDetail(id, version, me == null ? null : me.getId()));
    }

    @PostMapping("/prompts/resolve")
    public ApiResponse<PromptResolveResult> resolve(@Valid @RequestBody ResolvePromptReq req,
                                                    @AuthenticationPrincipal CurrentUser me) {
        return ApiResponse.ok(promptService.resolve(
                req.getContentMd(),
                req.getTeamSlug(),
                Boolean.TRUE.equals(req.getRaw()),
                me == null ? null : me.getId()
        ));
    }

    @GetMapping("/prompts/{id}/download")
    public ResponseEntity<ByteArrayResource> downloadById(@PathVariable Long id,
                                                          @RequestParam(defaultValue = "false") boolean raw,
                                                          @AuthenticationPrincipal CurrentUser me) {
        String md = promptService.downloadById(id, me == null ? null : me.getId(), raw);
        String filename = "prompt-" + id + ".md";
        String encoded = URLEncoder.encode(filename, StandardCharsets.UTF_8).replace("+", "%20");
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/markdown; charset=UTF-8"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + filename + "\"; filename*=UTF-8''" + encoded)
                .contentLength(md.getBytes(StandardCharsets.UTF_8).length)
                .body(new ByteArrayResource(md.getBytes(StandardCharsets.UTF_8)));
    }

    @GetMapping("/teams/{teamSlug}/prompts/{promptSlug}/download")
    public ResponseEntity<ByteArrayResource> download(@PathVariable String teamSlug,
                                                      @PathVariable String promptSlug,
                                                      @RequestParam(defaultValue = "false") boolean raw,
                                                      @AuthenticationPrincipal CurrentUser me) {
        String md = promptService.download(teamSlug, promptSlug, me == null ? null : me.getId(), raw);
        byte[] body = md.getBytes(StandardCharsets.UTF_8);
        String filename = promptSlug + ".md";
        String encoded = URLEncoder.encode(filename, StandardCharsets.UTF_8).replace("+", "%20");
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/markdown; charset=UTF-8"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + filename + "\"; filename*=UTF-8''" + encoded)
                .contentLength(body.length)
                .body(new ByteArrayResource(body));
    }

    @PostMapping("/prompts")
    public ApiResponse<Map<String, Object>> create(@Valid @RequestBody CreatePromptReq req,
                                                   @AuthenticationPrincipal CurrentUser me) {
        return ApiResponse.ok(promptService.create(req, me == null ? null : me.getId()));
    }

    @PostMapping("/prompts/drafts")
    public ApiResponse<Map<String, Object>> draft(@Valid @RequestBody CreatePromptReq req,
                                                  @AuthenticationPrincipal CurrentUser me) {
        req.setDraft(true);
        return ApiResponse.ok(promptService.create(req, me == null ? null : me.getId()));
    }

    /**
     * Prompt 自定义图标上传：返回 storage key + 可访问 URL。
     * 创建/编辑表单拿 key 提交（落库为 raw key），用 url 做预览。仅图片，≤ 2MB，需登录。
     */
    @PostMapping("/prompts/icon-images")
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
            String key = storageService.store(file, "prompt-icons/" + me.getId());
            return ApiResponse.ok(Map.of("key", key, "url", storageService.resolveUrl(key)));
        } catch (java.io.IOException e) {
            throw new BusinessException(50000, "上传失败：" + e.getMessage());
        }
    }

    @PostMapping("/prompts/{id}/versions")
    public ApiResponse<Map<String, Object>> submitVersion(@PathVariable Long id,
                                                          @Valid @RequestBody SubmitPromptVersionReq req,
                                                          @AuthenticationPrincipal CurrentUser me) {
        return ApiResponse.ok(promptService.submitVersion(id, req, me == null ? null : me.getId()));
    }

    @PatchMapping("/prompts/{id}/visibility")
    public ApiResponse<Void> updateVisibility(@PathVariable Long id,
                                              @RequestBody AdminPromptUpdateReq req,
                                              @AuthenticationPrincipal CurrentUser me) {
        promptService.updateVisibility(id, req.getVisibility(), me == null ? null : me.getId());
        return ApiResponse.ok();
    }

    @PatchMapping("/prompts/{id}/status")
    public ApiResponse<Void> updateStatus(@PathVariable Long id,
                                          @RequestBody AdminPromptUpdateReq req,
                                          @AuthenticationPrincipal CurrentUser me) {
        promptService.updateStatus(id, req.getStatus(), me == null ? null : me.getId());
        return ApiResponse.ok();
    }

    @PatchMapping("/prompts/{id}/admin-profile")
    public ApiResponse<Void> updateAdminProfile(@PathVariable Long id,
                                                @RequestBody AdminPromptProfileUpdateReq req,
                                                @AuthenticationPrincipal CurrentUser me) {
        promptService.updateAdminProfile(id, req, me == null ? null : me.getId());
        return ApiResponse.ok();
    }

    @DeleteMapping("/prompts/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id,
                                    @AuthenticationPrincipal CurrentUser me) {
        promptService.softDelete(id, me == null ? null : me.getId());
        return ApiResponse.ok();
    }

    @GetMapping("/prompts/{id}/reviews")
    public ApiResponse<SkillReviewSummary> reviews(@PathVariable Long id,
                                                   @AuthenticationPrincipal CurrentUser me) {
        return ApiResponse.ok(assetReviewService.loadSummary("PROMPT", id, me == null ? null : me.getId()));
    }

    @PostMapping("/prompts/{id}/reviews")
    public ApiResponse<SkillReviewSummary> submitReview(@PathVariable Long id,
                                                        @Valid @RequestBody SubmitSkillReviewReq req,
                                                        @AuthenticationPrincipal CurrentUser me) {
        return ApiResponse.ok(assetReviewService.submit("PROMPT", id, me == null ? null : me.getId(), req));
    }

    @PostMapping("/prompts/{id}/reviews/{reviewId}/replies")
    public ApiResponse<SkillReviewItem.ReplyItem> replyReview(@PathVariable Long id,
                                                              @PathVariable Long reviewId,
                                                              @Valid @RequestBody SubmitSkillReviewReplyReq req,
                                                              @AuthenticationPrincipal CurrentUser me) {
        return ApiResponse.ok(assetReviewService.reply("PROMPT", id, reviewId, me == null ? null : me.getId(), req));
    }
}
