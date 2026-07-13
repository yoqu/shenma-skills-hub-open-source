package com.skillstack.skill.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.skillstack.auth.entity.User;
import com.skillstack.auth.mapper.UserMapper;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.storage.StorageUrlResolver;
import com.skillstack.skill.dto.SkillReviewItem;
import com.skillstack.skill.dto.SkillReviewSummary;
import com.skillstack.skill.dto.SubmitSkillReviewReplyReq;
import com.skillstack.skill.dto.SubmitSkillReviewReq;
import com.skillstack.skill.entity.Skill;
import com.skillstack.skill.entity.SkillReview;
import com.skillstack.skill.entity.SkillReviewReply;
import com.skillstack.skill.mapper.SkillMapper;
import com.skillstack.skill.mapper.SkillReviewMapper;
import com.skillstack.skill.mapper.SkillReviewReplyMapper;
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

/**
 * Skill 公开评分 / 评论 + 作者回复。
 *
 * 规则：
 *  - 每个用户对同一 skill 至多 1 条评分；重复提交按 upsert 处理（更新 rating / body / version）。
 *  - 作者回复独立行追加，仅 skill.authorId 可写。
 *  - 任意写入后，强制重算 skills.score = AVG(skill_reviews.rating)。
 *  - 列表对所有人开放（含未登录），summary 永远基于 skill_reviews 即时聚合，避免缓存歧义。
 */
@Service
@RequiredArgsConstructor
public class SkillReviewService {

    private final SkillReviewMapper reviewMapper;
    private final SkillReviewReplyMapper replyMapper;
    private final SkillMapper skillMapper;
    private final SkillService skillService;
    private final UserMapper userMapper;
    private final StorageUrlResolver storageUrlResolver;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final String[] COLOR_POOL = {
            "#4F46E5", "#EC4899", "#14B8A6", "#F59E0B", "#0EA5E9", "#8B5CF6"
    };

    // ---------------- 写入 ----------------

    /**
     * 提交评分 + 评论。已存在则更新；保证 skills.score 与 AVG(rating) 一致。
     * @return 写入后的整体 summary，方便前端一次性刷新。
     */
    @Transactional
    public SkillReviewSummary submit(Long skillId, Long userId, SubmitSkillReviewReq req) {
        requireLogin(userId);
        Skill skill = skillService.findById(skillId);

        SkillReview existing = reviewMapper.selectOne(
                Wrappers.<SkillReview>lambdaQuery()
                        .eq(SkillReview::getSkillId, skillId)
                        .eq(SkillReview::getUserId, userId));
        if (existing == null) {
            SkillReview row = new SkillReview();
            row.setSkillId(skillId);
            row.setUserId(userId);
            row.setRating(req.getRating());
            row.setBody(req.getBody().trim());
            row.setVersion(req.getVersion());
            try {
                reviewMapper.insert(row);
            } catch (DuplicateKeyException dup) {
                // 并发场景：另一线程已写入，转 update。
                existing = reviewMapper.selectOne(
                        Wrappers.<SkillReview>lambdaQuery()
                                .eq(SkillReview::getSkillId, skillId)
                                .eq(SkillReview::getUserId, userId));
                if (existing != null) {
                    updateInPlace(existing, req);
                }
            }
        } else {
            updateInPlace(existing, req);
        }

        skillMapper.recomputeScore(skill.getId());
        return loadSummary(skillId, userId);
    }

    private void updateInPlace(SkillReview row, SubmitSkillReviewReq req) {
        row.setRating(req.getRating());
        row.setBody(req.getBody().trim());
        row.setVersion(req.getVersion());
        reviewMapper.updateById(row);
    }

    /**
     * 作者对评论追加回复。仅 skill.authorId 可写。
     */
    @Transactional
    public SkillReviewItem.ReplyItem reply(Long skillId, Long reviewId, Long viewerId,
                                           SubmitSkillReviewReplyReq req) {
        requireLogin(viewerId);
        Skill skill = skillService.findById(skillId);
        if (!viewerId.equals(skill.getAuthorId())) {
            throw new BusinessException(40300, "仅 skill 作者可回复评论");
        }
        SkillReview review = reviewMapper.selectById(reviewId);
        if (review == null || !review.getSkillId().equals(skillId)) {
            throw new BusinessException(40400, "评论不存在");
        }
        SkillReviewReply row = new SkillReviewReply();
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

    // ---------------- 读取 ----------------

    public SkillReviewSummary loadSummary(Long skillId, Long viewerId) {
        Skill skill = skillService.findById(skillId);

        List<SkillReview> reviews = reviewMapper.selectList(
                Wrappers.<SkillReview>lambdaQuery()
                        .eq(SkillReview::getSkillId, skillId)
                        .orderByDesc(SkillReview::getCreatedAt));

        if (reviews.isEmpty()) {
            return SkillReviewSummary.builder()
                    .avg(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP))
                    .total(0L)
                    .distribution(emptyDistribution())
                    .items(Collections.emptyList())
                    .myReviewId(null)
                    .build();
        }

        Set<Long> userIds = reviews.stream()
                .map(SkillReview::getUserId)
                .collect(Collectors.toCollection(java.util.LinkedHashSet::new));

        List<Long> reviewIds = reviews.stream().map(SkillReview::getId).collect(Collectors.toList());
        List<SkillReviewReply> replies = replyMapper.selectList(
                Wrappers.<SkillReviewReply>lambdaQuery()
                        .in(SkillReviewReply::getReviewId, reviewIds)
                        .orderByAsc(SkillReviewReply::getCreatedAt));

        Set<Long> replyAuthorIds = replies.stream()
                .map(SkillReviewReply::getAuthorId)
                .collect(Collectors.toCollection(java.util.LinkedHashSet::new));

        Set<Long> allUserIds = new java.util.LinkedHashSet<>();
        allUserIds.addAll(userIds);
        allUserIds.addAll(replyAuthorIds);
        Map<Long, User> userMap = loadUsers(allUserIds);

        Map<Long, List<SkillReviewReply>> repliesByReview = new HashMap<>();
        for (SkillReviewReply r : replies) {
            repliesByReview.computeIfAbsent(r.getReviewId(), k -> new ArrayList<>()).add(r);
        }

        Long authorId = skill.getAuthorId();
        List<SkillReviewItem> items = new ArrayList<>(reviews.size());
        long sum = 0L;
        Map<Integer, Long> dist = new HashMap<>();
        Long myReviewId = null;
        for (SkillReview rev : reviews) {
            sum += rev.getRating();
            dist.merge(rev.getRating(), 1L, Long::sum);
            User u = userMap.get(rev.getUserId());

            List<SkillReviewItem.ReplyItem> mapped = repliesByReview
                    .getOrDefault(rev.getId(), Collections.emptyList())
                    .stream()
                    .map(rep -> SkillReviewItem.ReplyItem.builder()
                            .id(rep.getId())
                            .user(toUserRef(userMap.get(rep.getAuthorId()),
                                    rep.getAuthorId().equals(authorId)))
                            .date(formatDate(rep.getCreatedAt()))
                            .body(rep.getBody())
                            .build())
                    .collect(Collectors.toList());

            boolean mine = viewerId != null && viewerId.equals(rev.getUserId());
            if (mine) myReviewId = rev.getId();
            items.add(SkillReviewItem.builder()
                    .id(rev.getId())
                    .user(toUserRef(u, rev.getUserId().equals(authorId)))
                    .rating(rev.getRating())
                    .version(rev.getVersion())
                    .date(formatDate(rev.getCreatedAt()))
                    .body(rev.getBody())
                    .mine(mine)
                    .replies(mapped)
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

    // ---------------- helpers ----------------

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
                .avatarUrl(storageUrlResolver.resolve(u.getAvatarUrl(), u.getFeishuAvatarUrl()))
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
}
