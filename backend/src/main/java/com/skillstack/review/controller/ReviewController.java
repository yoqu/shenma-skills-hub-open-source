package com.skillstack.review.controller;

import com.skillstack.common.security.CurrentUser;
import com.skillstack.common.security.TeamAccessGuard;
import com.skillstack.common.web.ApiResponse;
import com.skillstack.common.web.PageQuery;
import com.skillstack.common.web.PageResult;
import com.skillstack.review.dto.ReviewCommentItem;
import com.skillstack.review.dto.ReviewCommentReq;
import com.skillstack.review.dto.ReviewDecisionReq;
import com.skillstack.review.dto.ReviewDetail;
import com.skillstack.review.dto.ReviewFileTree;
import com.skillstack.review.dto.ReviewListItem;
import com.skillstack.review.dto.ReviewPayloadReq;
import com.skillstack.review.service.ReviewCommentService;
import com.skillstack.review.service.ReviewFileService;
import com.skillstack.review.service.ReviewService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 审核接口。
 *
 * <p>权限收口（REV-001）：</p>
 * <ul>
 *   <li>{@code GET /teams/{teamId}/reviews} 团队成员可读；</li>
 *   <li>{@code GET /reviews/{id}} 必须是该审核所属团队的 OWNER/ADMIN；</li>
 *   <li>approve/reject/request-changes 同上。</li>
 * </ul>
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api")
public class ReviewController {

    private final ReviewService reviewService;
    private final ReviewCommentService reviewCommentService;
    private final ReviewFileService reviewFileService;
    private final TeamAccessGuard guard;

    /** 团队审核队列。 */
    @GetMapping("/teams/{teamId}/reviews")
    public ApiResponse<PageResult<ReviewListItem>> queue(
            @PathVariable Long teamId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String targetType,
            PageQuery page,
            @AuthenticationPrincipal CurrentUser me) {
        guard.requireMember(teamId, me == null ? null : me.getId());
        return ApiResponse.ok(reviewService.queue(teamId, status, targetType, page.getPage(), page.getSize()));
    }

    /** 审核详情。提交者本人或团队 OWNER/ADMIN 都可查看（用于驳回后重新编辑）。 */
    @GetMapping("/reviews/{id}")
    public ApiResponse<ReviewDetail> detail(@PathVariable Long id,
                                            @AuthenticationPrincipal CurrentUser me) {
        Long uid = me == null ? null : me.getId();
        reviewService.requireDetailRight(id, uid);
        return ApiResponse.ok(reviewService.detail(id));
    }

    @PostMapping("/reviews/{id}/approve")
    public ApiResponse<Void> approve(@PathVariable Long id,
                                     @RequestBody(required = false) ReviewDecisionReq req,
                                     @AuthenticationPrincipal CurrentUser me) {
        Long uid = me == null ? null : me.getId();
        reviewService.requireDecisionRight(id, uid);
        String comment = req == null ? null : req.getComment();
        reviewService.approve(id, uid, comment);
        return ApiResponse.ok();
    }

    @PostMapping("/reviews/{id}/reject")
    public ApiResponse<Void> reject(@PathVariable Long id,
                                    @RequestBody ReviewDecisionReq req,
                                    @AuthenticationPrincipal CurrentUser me) {
        Long uid = me == null ? null : me.getId();
        reviewService.requireDecisionRight(id, uid);
        reviewService.reject(id, uid, req == null ? null : req.getReason());
        return ApiResponse.ok();
    }

    @PostMapping("/reviews/{id}/request-changes")
    public ApiResponse<Void> requestChanges(@PathVariable Long id,
                                            @RequestBody ReviewDecisionReq req,
                                            @AuthenticationPrincipal CurrentUser me) {
        Long uid = me == null ? null : me.getId();
        reviewService.requireDecisionRight(id, uid);
        reviewService.requestChanges(id, uid, req == null ? null : req.getReason());
        return ApiResponse.ok();
    }

    /** 撤回（提交者本人）：PENDING_REVIEW → WITHDRAWN（REV-005）。 */
    @PostMapping("/reviews/{id}/withdraw")
    public ApiResponse<Void> withdraw(@PathVariable Long id,
                                      @AuthenticationPrincipal CurrentUser me) {
        Long uid = me == null ? null : me.getId();
        reviewService.requireSubmitter(id, uid);
        reviewService.withdraw(id);
        return ApiResponse.ok();
    }

    /** 重新提交（提交者本人）：CHANGES_REQUESTED / REJECTED / WITHDRAWN → PENDING_REVIEW（REV-005）。 */
    @PostMapping("/reviews/{id}/resubmit")
    public ApiResponse<Void> resubmit(@PathVariable Long id,
                                      @RequestBody(required = false) @Valid ReviewPayloadReq payload,
                                      @AuthenticationPrincipal CurrentUser me) {
        Long uid = me == null ? null : me.getId();
        reviewService.requireSubmitter(id, uid);
        reviewService.resubmit(id, payload);
        return ApiResponse.ok();
    }

    /** 作者编辑 review payload。允许在 DRAFT / REJECTED / CHANGES_REQUESTED / WITHDRAWN 时调用。 */
    @PatchMapping("/reviews/{id}")
    public ApiResponse<Void> editPayload(@PathVariable Long id,
                                         @Valid @RequestBody ReviewPayloadReq req,
                                         @AuthenticationPrincipal CurrentUser me) {
        Long uid = me == null ? null : me.getId();
        reviewService.requireSubmitter(id, uid);
        reviewService.editPayload(id, req);
        return ApiResponse.ok();
    }

    /** 草稿提交：DRAFT → PENDING_REVIEW。 */
    @PostMapping("/reviews/{id}/submit")
    public ApiResponse<Void> submitDraft(@PathVariable Long id,
                                         @AuthenticationPrincipal CurrentUser me) {
        Long uid = me == null ? null : me.getId();
        reviewService.requireSubmitter(id, uid);
        reviewService.submitDraft(id);
        return ApiResponse.ok();
    }

    /** 作者删除自己处于 DRAFT / REJECTED / WITHDRAWN 的 review 行。 */
    @DeleteMapping("/reviews/{id}")
    public ApiResponse<Void> deleteByAuthor(@PathVariable Long id,
                                            @AuthenticationPrincipal CurrentUser me) {
        Long uid = me == null ? null : me.getId();
        reviewService.requireSubmitter(id, uid);
        reviewService.deleteByAuthor(id);
        return ApiResponse.ok();
    }

    /** 审核包文件树（REV-007）：解析对应 zip 返回文件列表与文本预览。 */
    @GetMapping("/reviews/{id}/files")
    public ApiResponse<ReviewFileTree> files(@PathVariable Long id,
                                             @AuthenticationPrincipal CurrentUser me) {
        Long uid = me == null ? null : me.getId();
        return ApiResponse.ok(reviewFileService.load(id, uid));
    }

    // ===================== 评论（REV-006） =====================

    /** 审核对话评论列表（提交者本人 + 团队 writer 可读）。 */
    @GetMapping("/reviews/{id}/comments")
    public ApiResponse<java.util.List<ReviewCommentItem>> listComments(@PathVariable Long id,
                                                                       @AuthenticationPrincipal CurrentUser me) {
        Long uid = me == null ? null : me.getId();
        return ApiResponse.ok(reviewCommentService.list(id, uid));
    }

    /** 在审核记录上回复。kind 由 service 根据角色判定。 */
    @PostMapping("/reviews/{id}/comments")
    public ApiResponse<ReviewCommentItem> postComment(@PathVariable Long id,
                                                      @Valid @RequestBody ReviewCommentReq req,
                                                      @AuthenticationPrincipal CurrentUser me) {
        Long uid = me == null ? null : me.getId();
        return ApiResponse.ok(reviewCommentService.create(id, uid, req.getBody()));
    }
}
