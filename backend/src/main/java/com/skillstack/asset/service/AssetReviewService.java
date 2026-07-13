package com.skillstack.asset.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.skillstack.asset.entity.AssetReview;
import com.skillstack.asset.entity.AssetReviewReply;
import com.skillstack.asset.mapper.AssetReviewMapper;
import com.skillstack.asset.mapper.AssetReviewReplyMapper;
import com.skillstack.auth.entity.User;
import com.skillstack.auth.mapper.UserMapper;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.prompt.entity.Prompt;
import com.skillstack.prompt.mapper.PromptMapper;
import com.skillstack.skill.dto.SkillReviewItem;
import com.skillstack.skill.dto.SkillReviewSummary;
import com.skillstack.skill.dto.SubmitSkillReviewReplyReq;
import com.skillstack.skill.dto.SubmitSkillReviewReq;
import com.skillstack.skill.entity.Skill;
import com.skillstack.skill.mapper.SkillMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AssetReviewService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final String[] COLOR_POOL = {
            "#4F46E5", "#EC4899", "#14B8A6", "#F59E0B", "#0EA5E9", "#8B5CF6"
    };

    private final AssetReviewMapper reviewMapper;
    private final AssetReviewReplyMapper replyMapper;
    private final SkillMapper skillMapper;
    private final PromptMapper promptMapper;
    private final UserMapper userMapper;

    @Transactional
    public SkillReviewSummary submit(String targetType, Long targetId, Long userId, SubmitSkillReviewReq req) {
        requireLogin(userId);
        AssetMeta meta = requireTarget(targetType, targetId);
        AssetReview existing = reviewMapper.selectOne(Wrappers.<AssetReview>lambdaQuery()
                .eq(AssetReview::getTargetType, meta.type())
                .eq(AssetReview::getTargetId, targetId)
                .eq(AssetReview::getUserId, userId));
        if (existing == null) {
            AssetReview row = new AssetReview();
            row.setTargetType(meta.type());
            row.setTargetId(targetId);
            row.setUserId(userId);
            row.setRating(req.getRating());
            row.setBody(req.getBody().trim());
            row.setVersion(req.getVersion());
            try {
                reviewMapper.insert(row);
            } catch (DuplicateKeyException dup) {
                existing = reviewMapper.selectOne(Wrappers.<AssetReview>lambdaQuery()
                        .eq(AssetReview::getTargetType, meta.type())
                        .eq(AssetReview::getTargetId, targetId)
                        .eq(AssetReview::getUserId, userId));
                if (existing != null) updateInPlace(existing, req);
            }
        } else {
            updateInPlace(existing, req);
        }
        recomputeScore(meta.type(), targetId);
        return loadSummary(meta.type(), targetId, userId);
    }

    @Transactional
    public SkillReviewItem.ReplyItem reply(String targetType,
                                           Long targetId,
                                           Long reviewId,
                                           Long viewerId,
                                           SubmitSkillReviewReplyReq req) {
        requireLogin(viewerId);
        AssetMeta meta = requireTarget(targetType, targetId);
        if (!viewerId.equals(meta.authorId())) {
            throw new BusinessException(40300, "仅资产作者可回复评论");
        }
        AssetReview review = reviewMapper.selectById(reviewId);
        if (review == null || !targetId.equals(review.getTargetId()) || !meta.type().equals(review.getTargetType())) {
            throw new BusinessException(40400, "评论不存在");
        }
        AssetReviewReply row = new AssetReviewReply();
        row.setReviewId(reviewId);
        row.setAuthorId(viewerId);
        row.setBody(req.getBody().trim());
        replyMapper.insert(row);
        User author = userMapper.selectById(viewerId);
        return SkillReviewItem.ReplyItem.builder()
                .id(row.getId())
                .user(toUserRef(author, true))
                .date(formatDate(row.getCreatedAt()))
                .body(row.getBody())
                .build();
    }

    public SkillReviewSummary loadSummary(String targetType, Long targetId, Long viewerId) {
        AssetMeta meta = requireTarget(targetType, targetId);
        List<AssetReview> reviews = reviewMapper.selectList(Wrappers.<AssetReview>lambdaQuery()
                .eq(AssetReview::getTargetType, meta.type())
                .eq(AssetReview::getTargetId, targetId)
                .orderByDesc(AssetReview::getCreatedAt));
        if (reviews.isEmpty()) {
            return SkillReviewSummary.builder()
                    .avg(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP))
                    .total(0L)
                    .distribution(emptyDistribution())
                    .items(Collections.emptyList())
                    .myReviewId(null)
                    .build();
        }

        List<Long> reviewIds = reviews.stream().map(AssetReview::getId).collect(Collectors.toList());
        List<AssetReviewReply> replies = replyMapper.selectList(Wrappers.<AssetReviewReply>lambdaQuery()
                .in(AssetReviewReply::getReviewId, reviewIds)
                .orderByAsc(AssetReviewReply::getCreatedAt));

        Set<Long> userIds = reviews.stream()
                .map(AssetReview::getUserId)
                .collect(Collectors.toCollection(java.util.LinkedHashSet::new));
        replies.stream().map(AssetReviewReply::getAuthorId).forEach(userIds::add);
        Map<Long, User> userMap = loadUsers(userIds);

        Map<Long, List<AssetReviewReply>> repliesByReview = new HashMap<>();
        for (AssetReviewReply r : replies) {
            repliesByReview.computeIfAbsent(r.getReviewId(), k -> new ArrayList<>()).add(r);
        }

        long sum = 0L;
        Map<Integer, Long> dist = new HashMap<>();
        Long myReviewId = null;
        List<SkillReviewItem> items = new ArrayList<>(reviews.size());
        for (AssetReview rev : reviews) {
            sum += rev.getRating();
            dist.merge(rev.getRating(), 1L, Long::sum);
            boolean mine = viewerId != null && viewerId.equals(rev.getUserId());
            if (mine) myReviewId = rev.getId();
            List<SkillReviewItem.ReplyItem> mappedReplies = repliesByReview
                    .getOrDefault(rev.getId(), Collections.emptyList())
                    .stream()
                    .map(rep -> SkillReviewItem.ReplyItem.builder()
                            .id(rep.getId())
                            .user(toUserRef(userMap.get(rep.getAuthorId()), rep.getAuthorId().equals(meta.authorId())))
                            .date(formatDate(rep.getCreatedAt()))
                            .body(rep.getBody())
                            .build())
                    .toList();
            items.add(SkillReviewItem.builder()
                    .id(rev.getId())
                    .user(toUserRef(userMap.get(rev.getUserId()), rev.getUserId().equals(meta.authorId())))
                    .rating(rev.getRating())
                    .version(rev.getVersion())
                    .date(formatDate(rev.getCreatedAt()))
                    .body(rev.getBody())
                    .mine(mine)
                    .replies(mappedReplies)
                    .build());
        }

        BigDecimal avg = BigDecimal.valueOf(sum)
                .divide(BigDecimal.valueOf(reviews.size()), 2, RoundingMode.HALF_UP);
        List<SkillReviewSummary.RatingBucket> distribution = new ArrayList<>(5);
        for (int star = 5; star >= 1; star--) {
            distribution.add(SkillReviewSummary.RatingBucket.builder()
                    .star(star)
                    .count(dist.getOrDefault(star, 0L))
                    .build());
        }
        return SkillReviewSummary.builder()
                .avg(avg)
                .total((long) reviews.size())
                .distribution(distribution)
                .items(items)
                .myReviewId(myReviewId)
                .build();
    }

    private void updateInPlace(AssetReview row, SubmitSkillReviewReq req) {
        row.setRating(req.getRating());
        row.setBody(req.getBody().trim());
        row.setVersion(req.getVersion());
        reviewMapper.updateById(row);
    }

    private void recomputeScore(String type, Long id) {
        if ("PROMPT".equals(type)) {
            promptMapper.recomputeScore(id);
        } else {
            // Skill keeps its existing score path until all legacy reads move to asset_reviews.
            skillMapper.recomputeScore(id);
        }
    }

    private AssetMeta requireTarget(String targetType, Long targetId) {
        String type = normalizeType(targetType);
        if ("PROMPT".equals(type)) {
            Prompt prompt = promptMapper.selectById(targetId);
            if (prompt == null) throw new BusinessException(40400, "Prompt 不存在");
            return new AssetMeta(type, prompt.getAuthorId());
        }
        Skill skill = skillMapper.selectById(targetId);
        if (skill == null) throw new BusinessException(40400, "Skill 不存在");
        return new AssetMeta(type, skill.getAuthorId());
    }

    private static String normalizeType(String targetType) {
        String type = targetType == null ? "SKILL" : targetType.trim().toUpperCase();
        if (!"SKILL".equals(type) && !"PROMPT".equals(type)) {
            throw new BusinessException(40000, "资产类型必须是 SKILL 或 PROMPT");
        }
        return type;
    }

    private List<SkillReviewSummary.RatingBucket> emptyDistribution() {
        List<SkillReviewSummary.RatingBucket> out = new ArrayList<>(5);
        for (int star = 5; star >= 1; star--) {
            out.add(SkillReviewSummary.RatingBucket.builder().star(star).count(0L).build());
        }
        return out;
    }

    private Map<Long, User> loadUsers(Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) return Collections.emptyMap();
        List<User> users = userMapper.selectBatchIds(ids);
        Map<Long, User> map = new LinkedHashMap<>(users.size());
        for (User u : users) map.put(u.getId(), u);
        return map;
    }

    private SkillReviewItem.UserRef toUserRef(User u, boolean isAuthor) {
        if (u == null) {
            return SkillReviewItem.UserRef.builder()
                    .id(null)
                    .name("匿名用户")
                    .handle(null)
                    .avatar("?")
                    .color(COLOR_POOL[0])
                    .isAuthor(isAuthor)
                    .build();
        }
        String name = u.getName() != null ? u.getName() : (u.getHandle() != null ? u.getHandle() : "匿名");
        String avatar = u.getAvatar();
        if (avatar == null || avatar.isBlank()) {
            avatar = name.substring(0, Math.min(1, name.length()));
        }
        String color = u.getAvatarColor();
        if (color == null || color.isBlank()) {
            color = pickColor(u.getHandle() != null ? u.getHandle() : name);
        }
        return SkillReviewItem.UserRef.builder()
                .id(u.getId())
                .name(name)
                .handle(u.getHandle())
                .avatar(avatar)
                .color(color)
                .isAuthor(isAuthor)
                .build();
    }

    private static String pickColor(String seed) {
        int h = 0;
        for (int i = 0; i < seed.length(); i++) {
            h = (h * 31 + seed.charAt(i)) & 0x7fffffff;
        }
        return COLOR_POOL[h % COLOR_POOL.length];
    }

    private static String formatDate(LocalDateTime t) {
        return t == null ? "" : t.format(DATE_FMT);
    }

    private static void requireLogin(Long uid) {
        if (uid == null) {
            throw new BusinessException(40100, "请先登录");
        }
    }

    private record AssetMeta(String type, Long authorId) {
    }
}
