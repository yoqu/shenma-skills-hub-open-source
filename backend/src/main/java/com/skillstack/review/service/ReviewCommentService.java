package com.skillstack.review.service;

import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.TeamAccessGuard;
import com.skillstack.notification.service.NotificationService;
import com.skillstack.notification.service.NotificationType;
import com.skillstack.review.dto.ReviewCommentItem;
import com.skillstack.review.entity.Review;
import com.skillstack.review.entity.ReviewComment;
import com.skillstack.review.mapper.ReviewCommentMapper;
import com.skillstack.review.mapper.ReviewMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 审核评论服务（REV-006）。
 *
 * <p>权限：</p>
 * <ul>
 *   <li>读取：必须是该 review 的提交者本人 <b>或</b> 所在团队的 OWNER/ADMIN（写权限）；
 *       不允许其他团队成员窥视审核对话。</li>
 *   <li>写入：同上。kind 由 service 根据是否团队 writer 判定 — writer 写入算 'review'，
 *       提交者本人写入算 'mine'。</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class ReviewCommentService {

    private final ReviewMapper reviewMapper;
    private final ReviewCommentMapper commentMapper;
    private final TeamAccessGuard guard;
    private final NotificationService notificationService;
    private final ReviewService reviewService;

    public List<ReviewCommentItem> list(Long reviewId, Long currentUserId) {
        Review r = mustLoad(reviewId);
        requireAccess(r, currentUserId);
        List<ReviewCommentItem> items = commentMapper.selectByReview(reviewId);
        for (ReviewCommentItem c : items) {
            decorateRole(c, r);
        }
        return items;
    }

    @Transactional
    public ReviewCommentItem create(Long reviewId, Long currentUserId, String body) {
        if (currentUserId == null) {
            throw new BusinessException(40100, "请先登录");
        }
        if (body == null || body.trim().isEmpty()) {
            throw new BusinessException(40000, "回复内容不能为空");
        }
        Review r = mustLoad(reviewId);
        boolean isSubmitter = currentUserId.equals(r.getSubmitterId());
        boolean isWriter = guard.isWriter(r.getTeamId(), currentUserId);
        if (!isSubmitter && !isWriter) {
            throw new BusinessException(40300, "无权评论该审核");
        }
        if ("APPROVED".equals(r.getStatus())) {
            throw new BusinessException(40900, "已通过的审核不再接受评论");
        }

        ReviewComment c = new ReviewComment();
        c.setReviewId(reviewId);
        c.setAuthorId(currentUserId);
        c.setKind(isWriter ? "review" : "mine");
        c.setBody(body.trim());
        commentMapper.insert(c);

        String preview = body.trim().length() > 120
                ? body.trim().substring(0, 117) + "…"
                : body.trim();
        if (isWriter) {
            notificationService.notify(NotificationType.REVIEW_COMMENT,
                    r.getSubmitterId(), r.getTeamId(), currentUserId,
                    "审核人评论了你的 Skill", preview, "/team/mine",
                    "review_comment", c.getId());
        } else {
            reviewService.notifyReviewCommentToWriters(r, currentUserId, preview);
        }

        // 取插入后的列表项以保持字段一致（含时间格式 + 作者信息）。
        return commentMapper.selectByReview(reviewId).stream()
                .filter(it -> it.getId() != null && it.getId().equals(c.getId()))
                .findFirst()
                .map(it -> {
                    decorateRole(it, r);
                    return it;
                })
                .orElseThrow(() -> new BusinessException(50000, "评论创建后查询失败"));
    }

    private Review mustLoad(Long reviewId) {
        Review r = reviewMapper.selectById(reviewId);
        if (r == null) {
            throw new BusinessException(40400, "审核记录不存在");
        }
        return r;
    }

    private void requireAccess(Review r, Long userId) {
        if (userId == null) {
            throw new BusinessException(40100, "请先登录");
        }
        if (userId.equals(r.getSubmitterId())) {
            return;
        }
        if (guard.isWriter(r.getTeamId(), userId)) {
            return;
        }
        throw new BusinessException(40300, "无权查看该审核评论");
    }

    private void decorateRole(ReviewCommentItem c, Review r) {
        if (c.getAuthor() == null || c.getAuthor().getId() == null) {
            return;
        }
        if (c.getAuthor().getId().equals(r.getSubmitterId())) {
            c.getAuthor().setRole("提交者");
        } else {
            c.getAuthor().setRole("审核人");
        }
    }
}
