package com.skillstack.review.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.skillstack.auth.entity.User;
import com.skillstack.auth.mapper.UserMapper;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.TeamAccessGuard;
import com.skillstack.common.storage.StorageUrlResolver;
import com.skillstack.common.web.PageResult;
import com.skillstack.review.dto.ReviewDetail;
import com.skillstack.review.dto.ReviewListItem;
import com.skillstack.review.dto.ReviewPayloadReq;
import com.skillstack.review.entity.Review;
import com.skillstack.review.mapper.ReviewMapper;
import com.skillstack.prompt.service.PromptService;
import com.skillstack.skill.entity.Skill;
import com.skillstack.skill.entity.SkillTag;
import com.skillstack.skill.mapper.SkillMapper;
import com.skillstack.skill.mapper.SkillTagMapper;
import com.skillstack.notification.service.NotificationService;
import com.skillstack.notification.service.NotificationType;
import com.skillstack.skill.service.SkillService;
import com.skillstack.skill.service.SkillVersionFileService;
import com.skillstack.skill.service.SkillVersionService;
import com.skillstack.team.mapper.TeamMapper;
import com.skillstack.userskill.service.UserSkillService;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;

/**
 * 审核流程领域服务。
 *
 * <p>状态机：</p>
 * <pre>
 *   PENDING_REVIEW
 *      │  approve → APPROVED                   (Skill 联动转 APPROVED + 发布时间)
 *      │  reject  → REJECTED                   (Skill 联动转 REJECTED)
 *      │  request-changes → CHANGES_REQUESTED  (Skill 联动转 DRAFT；提交者改完再次提交)
 *      └  withdraw → WITHDRAWN                 (提交者本人主动撤回；Skill 联动转 DRAFT)
 *
 *   CHANGES_REQUESTED
 *      └  resubmit → PENDING_REVIEW            (提交者本人；Skill 联动转 PENDING_REVIEW)
 * </pre>
 *
 * <p>审核详情的文件树由 GET /api/reviews/{id}/files 单独提供；
 * safetyReport / history 字段由 service 基于现有 review 行可得的数据组装，
 * 未接入的自动化检查项不再以空集合占位。</p>
 */
@Service
public class ReviewService {

    private static final DateTimeFormatter DT_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final ReviewMapper reviewMapper;
    private final UserMapper userMapper;
    private final TeamAccessGuard guard;
    private final SkillMapper skillMapper;
    private final SkillTagMapper skillTagMapper;
    private final SkillVersionService skillVersionService;
    private final SkillVersionFileService skillVersionFileService;
    private final SkillService skillService;
    private final NotificationService notificationService;
    private final TeamMapper teamMapper;
    private final PromptService promptService;
    private final StorageUrlResolver storageUrlResolver;
    private final UserSkillService userSkillService;

    private static final Set<String> EDITABLE_STATUSES =
            Set.of("DRAFT", "REJECTED", "CHANGES_REQUESTED", "WITHDRAWN");
    private static final Set<String> DELETABLE_STATUSES =
            Set.of("DRAFT", "REJECTED", "WITHDRAWN");

    public ReviewService(ReviewMapper reviewMapper, UserMapper userMapper, TeamAccessGuard guard,
                         SkillMapper skillMapper, SkillTagMapper skillTagMapper,
                         SkillVersionService skillVersionService,
                         SkillVersionFileService skillVersionFileService,
                         @Lazy SkillService skillService,
                         NotificationService notificationService,
                         TeamMapper teamMapper,
                         @Lazy PromptService promptService,
                         StorageUrlResolver storageUrlResolver,
                         @Lazy UserSkillService userSkillService) {
        this.reviewMapper = reviewMapper;
        this.userMapper = userMapper;
        this.guard = guard;
        this.skillMapper = skillMapper;
        this.skillTagMapper = skillTagMapper;
        this.skillVersionService = skillVersionService;
        this.skillVersionFileService = skillVersionFileService;
        this.skillService = skillService;
        this.notificationService = notificationService;
        this.teamMapper = teamMapper;
        this.promptService = promptService;
        this.storageUrlResolver = storageUrlResolver;
        this.userSkillService = userSkillService;
    }

    public PageResult<ReviewListItem> queue(Long teamId, String status, String targetType, long page, long size) {
        long offset = Math.max(0, (page - 1) * size);
        String normalizedStatus = normalizeStatus(status);
        String normalizedTarget = normalizeTargetType(targetType);
        List<ReviewListItem> items = reviewMapper.selectList(teamId, normalizedStatus, normalizedTarget, offset, size);
        long total = reviewMapper.countList(teamId, normalizedStatus, normalizedTarget);
        return PageResult.of(items, total, page, size);
    }

    public ReviewDetail detail(Long rowId) {
        Review r = mustLoad(rowId);
        User submitter = userMapper.selectById(r.getSubmitterId());

        ReviewDetail d = new ReviewDetail();
        d.setId(r.getCode());
        d.setRowId(r.getId());
        d.setTargetType(r.getTargetType() == null ? "SKILL" : r.getTargetType());
        d.setTargetId(r.getTargetId());
        d.setSlug(r.getDisplaySlug() == null ? r.getSkillSlug() : r.getDisplaySlug());
        d.setName(r.getDisplayName() == null ? r.getSkillName() : r.getDisplayName());
        d.setShortDesc(r.getShortDesc());
        d.setDescriptionMd(r.getDescriptionMd());
        d.setVisibility(r.getVisibility());
        d.setVersion(r.getVersion());
        d.setFiles(r.getFilesCount());
        d.setSafety(r.getSafety());
        d.setEvalScore(r.getEvalScore());
        d.setStatus(r.getStatus());
        d.setReason(r.getReason());
        d.setChangelog(r.getChangelog());
        d.setKind(r.getKind() == null ? "CREATE" : r.getKind());
        d.setCatCode(r.getCatCode());
        d.setIcon(r.getIcon());
        d.setIconUrl(storageUrlResolver.resolveSingle(r.getIconUrl()));
        d.setLangs(SkillService.parseTagsJson(r.getLangsJson()));
        d.setTags(SkillService.parseTagsJson(r.getTagsJson()));
        d.setZipUrl(r.getZipUrl());
        d.setPayloadJson(r.getPayloadJson());
        d.setSubmittedAt(r.getSubmittedAt() == null ? null : r.getSubmittedAt().format(DT_FMT));

        // SKILL-VER-001: 区分首次审核 / 发新版本，便于 UI 渲染。
        Long skillId = resolveSkillId(r);
        if (skillId != null && r.getVersion() != null) {
            String current = reviewMapper.findSkillVersion(skillId);
            d.setPreviousVersion(current);
            d.setIsVersionBump(current != null && !current.equals(r.getVersion()));
        } else {
            d.setIsVersionBump(false);
        }

        if (submitter != null) {
            ReviewListItem.Submitter s = new ReviewListItem.Submitter();
            s.setId(submitter.getId());
            s.setHandle(submitter.getHandle());
            s.setName(submitter.getName());
            s.setAvatar(submitter.getAvatar());
            s.setAvatarUrl(storageUrlResolver.resolve(submitter.getAvatarUrl(), submitter.getFeishuAvatarUrl()));
            d.setSubmittedBy(s);
        }

        d.setSafetyReport(emptySafetyReport(r.getSafety()));
        d.setHistory(buildHistory(r));
        return d;
    }

    /**
     * 审核决策权校验 — 必须是该 review 所属团队的 OWNER 或 ADMIN（REV-001）。
     */
    public void requireDecisionRight(Long rowId, Long userId) {
        Review r = mustLoad(rowId);
        guard.requireWriter(r.getTeamId(), userId);
    }

    /**
     * 撤回 / 重新提交权校验 — 必须是该 review 的提交者本人（REV-005）。
     */
    public void requireSubmitter(Long rowId, Long userId) {
        Review r = mustLoad(rowId);
        if (userId == null || !userId.equals(r.getSubmitterId())) {
            throw new BusinessException(40300, "只能操作自己提交的审核");
        }
    }

    /**
     * 读取详情权校验 — 提交者本人 或 团队 OWNER/ADMIN。
     * 用于"被驳回后作者重新编辑"的场景：作者需要拿到 payloadJson 才能还原表单。
     */
    public void requireDetailRight(Long rowId, Long userId) {
        Review r = mustLoad(rowId);
        if (userId != null && userId.equals(r.getSubmitterId())) {
            return;
        }
        guard.requireWriter(r.getTeamId(), userId);
    }

    @Transactional
    public void approve(Long rowId, Long reviewerId, String comment) {
        Review r = mustLoad(rowId);
        if (!"PENDING_REVIEW".equals(r.getStatus()) && !"CHANGES_REQUESTED".equals(r.getStatus())) {
            throw new BusinessException(40900, "该审核已处理，无法再次通过");
        }
        if ("PROMPT".equals(r.getTargetType())) {
            var prompt = promptService.approveReview(r);
            r.setTargetId(prompt.getId());
            r.setStatus("APPROVED");
            r.setReviewerId(reviewerId);
            r.setDecidedAt(LocalDateTime.now());
            if (comment != null && !comment.isBlank()) {
                r.setReason(comment);
            }
            reviewMapper.updateById(r);
            notifySubmitter(NotificationType.REVIEW_APPROVED, r, reviewerId,
                    "你的 Prompt 审核已通过",
                    r.getDisplayName() + " v" + r.getVersion() + " 已发布到团队 Prompt 库",
                    "/team/prompts");
            return;
        }
        String kind = r.getKind() == null ? "CREATE" : r.getKind();

        if ("VERSION_BUMP".equals(kind)) {
            // 发新版本路径维持现有行为：更新 skill.version + 写一条历史行。
            r.setStatus("APPROVED");
            r.setReviewerId(reviewerId);
            r.setDecidedAt(LocalDateTime.now());
            if (comment != null && !comment.isBlank()) {
                r.setReason(comment);
            }
            reviewMapper.updateById(r);

            Long skillId = resolveSkillId(r);
            if (skillId != null) {
                String reviewVersion = r.getVersion();
                if (reviewVersion != null && !reviewVersion.isBlank()) {
                    String currentVersion = reviewMapper.findSkillVersion(skillId);
                    if (!reviewVersion.equals(currentVersion)) {
                        reviewMapper.updateSkillVersion(skillId, reviewVersion);
                        reviewMapper.insertSkillVersion(
                                skillId,
                                reviewVersion,
                                r.getChangelog(),
                                r.getZipUrl(),
                                r.getFilesCount() == null ? 0 : r.getFilesCount(),
                                r.getSafety() == null ? "pass" : r.getSafety(),
                                r.getEvalScore() == null ? 0 : r.getEvalScore()
                        );
                        com.skillstack.skill.entity.SkillVersion bumped =
                                skillVersionService.findBySkillAndVersion(skillId, reviewVersion);
                        if (bumped != null) {
                            skillVersionFileService.materializeQuietly(bumped.getId(), r.getZipUrl());
                        }
                    }
                }
            }
            notifySubmitter(NotificationType.REVIEW_APPROVED, r, reviewerId,
                    "你的 Skill 审核已通过",
                    r.getSkillName() + (r.getVersion() == null ? "" : " v" + r.getVersion()) + " 已发布到团队 Skill 库",
                    "/team/mine");
            return;
        }

        // kind='CREATE'：物化 skills + skill_versions + skill_tag，回填 review.skill_id
        skillService.checkSlugUniqueForReview(r.getSkillSlug(), r.getId());
        // uk_skills_slug 不含 deleted，同 slug 的 soft-deleted 旧行（典型来源：V17 把所有
        // 未发布 skill 批量 soft-delete）会阻塞 INSERT。物化前先回收掉这些占位行。
        skillService.purgeStaleSlug(r.getSkillSlug());

        Skill s = new Skill();
        s.setSlug(r.getSkillSlug());
        s.setName(stripPrefix(r.getSkillName()));
        s.setShortDesc(r.getShortDesc());
        s.setDescriptionMd(r.getDescriptionMd());
        s.setCatCode(r.getCatCode());
        s.setIcon(r.getIcon());
        s.setIconUrl(r.getIconUrl());
        s.setVersion(r.getVersion());
        s.setVisibility(r.getVisibility());
        s.setStatus("APPROVED");
        s.setAuthorId(r.getSubmitterId());
        s.setTeamId(r.getTeamId());
        s.setInstalls(0);
        s.setStars(0);
        s.setScore(BigDecimal.ZERO);
        s.setSafety(r.getSafety() == null ? "pass" : r.getSafety());
        s.setEvalScore(r.getEvalScore() == null ? 0 : r.getEvalScore());
        s.setLangs(r.getLangsJson() == null ? "[]" : r.getLangsJson());
        s.setPublishedAt(LocalDateTime.now());
        skillMapper.insert(s);

        for (String tagName : SkillService.parseTagsJson(r.getTagsJson())) {
            Long tagId = skillService.ensureTag(tagName);
            SkillTag st = new SkillTag();
            st.setSkillId(s.getId());
            st.setTagId(tagId);
            try {
                skillTagMapper.insert(st);
            } catch (Exception ignore) {
                // 唯一键冲突忽略
            }
        }

        com.skillstack.skill.entity.SkillVersion initialVersion = skillVersionService.insertInitialVersion(
                s.getId(),
                r.getVersion(),
                r.getFilesCount() == null ? 0 : r.getFilesCount(),
                s.getSafety(),
                s.getEvalScore(),
                r.getZipUrl()
        );
        if (initialVersion != null) {
            skillVersionFileService.materializeQuietly(initialVersion.getId(), r.getZipUrl());
        }

        r.setSkillId(s.getId());
        userSkillService.backfillPublishedSkill(r.getId(), s.getId());
        r.setStatus("APPROVED");
        r.setReviewerId(reviewerId);
        r.setDecidedAt(LocalDateTime.now());
        if (comment != null && !comment.isBlank()) {
            r.setReason(comment);
        }
        reviewMapper.updateById(r);
        notifySubmitter(NotificationType.REVIEW_APPROVED, r, reviewerId,
                "你的 Skill 审核已通过",
                r.getSkillName() + (r.getVersion() == null ? "" : " v" + r.getVersion()) + " 已发布到团队 Skill 库",
                "/team/mine");
    }

    @Transactional
    public void reject(Long rowId, Long reviewerId, String reason) {
        if (reason == null || reason.isBlank()) {
            throw new BusinessException(40000, "拒绝原因不能为空");
        }
        Review r = mustLoad(rowId);
        if (!"PENDING_REVIEW".equals(r.getStatus()) && !"CHANGES_REQUESTED".equals(r.getStatus())) {
            throw new BusinessException(40900, "该审核已处理，无法再次拒绝");
        }
        r.setStatus("REJECTED");
        r.setReason(reason);
        r.setReviewerId(reviewerId);
        r.setDecidedAt(LocalDateTime.now());
        reviewMapper.updateById(r);
        boolean isPrompt = "PROMPT".equals(r.getTargetType());
        String title = isPrompt ? "你的 Prompt 审核未通过" : "你的 Skill 审核未通过";
        String targetUrl = isPrompt
                ? "/team/prompts/rework/" + r.getId()
                : "/team/mine";
        notifySubmitter(NotificationType.REVIEW_REJECTED, r, reviewerId,
                title,
                reason,
                targetUrl);
        // kind='CREATE'：没有对应 skills 行；kind='VERSION_BUMP'：保留 skills.APPROVED。
    }

    /**
     * 撤回（REV-005）：提交者本人在审核进入决策前主动撤销。
     * 仅 PENDING_REVIEW 可撤回。
     * kind='CREATE'：没有 skills 行；kind='VERSION_BUMP'：保留 skills.APPROVED，不回退。
     */
    @Transactional
    public void withdraw(Long rowId) {
        Review r = mustLoad(rowId);
        if (!"PENDING_REVIEW".equals(r.getStatus())) {
            throw new BusinessException(40900, "只有待审核记录可以撤回");
        }
        r.setStatus("WITHDRAWN");
        r.setDecidedAt(LocalDateTime.now());
        reviewMapper.updateById(r);
    }

    /**
     * 重新提交（REV-005）：处于 CHANGES_REQUESTED / REJECTED / WITHDRAWN 的审核，
     * 提交者修改后再次提交。状态机：→ PENDING_REVIEW。
     * 清空 reviewer 与上一次的反馈，使审核组拿到的是一条"干净的待审"。
     * 可同时携带 payload 修改（仅 kind='CREATE' 受影响）。
     */
    /** 向后兼容的无参 resubmit。 */
    @Transactional
    public void resubmit(Long rowId) {
        resubmit(rowId, null);
    }

    @Transactional
    public void resubmit(Long rowId, ReviewPayloadReq payload) {
        Review r = mustLoad(rowId);
        if (!"CHANGES_REQUESTED".equals(r.getStatus())
                && !"REJECTED".equals(r.getStatus())
                && !"WITHDRAWN".equals(r.getStatus())) {
            throw new BusinessException(40900, "当前状态不可重新提交");
        }
        if (payload != null) {
            applyPayload(r, payload);
        }
        boolean isPrompt = "PROMPT".equals(r.getTargetType());
        if ("CREATE".equals(r.getKind() == null ? "CREATE" : r.getKind())) {
            if (isPrompt) {
                promptService.checkSlugUniqueForReview(r.getTeamId(), r.getSkillSlug(), r.getId());
            } else {
                skillService.checkSlugUniqueForReview(r.getSkillSlug(), r.getId());
            }
        }
        r.setStatus("PENDING_REVIEW");
        r.setSubmittedAt(LocalDateTime.now());
        reviewMapper.updateById(r);
        reviewMapper.clearDecision(r.getId());
        String displayName = isPrompt
                ? (r.getDisplayName() == null ? r.getSkillName() : r.getDisplayName())
                : r.getSkillName();
        notifyTeamWriters(NotificationType.REVIEW_RESUBMITTED, r, r.getSubmitterId(),
                "审核已重新提交：" + displayName, null, "/team/reviews");
    }

    /**
     * "请修改"：把 review 推回提交者，状态独立于 REJECTED（REV-004 / SUB-002）。
     * kind='CREATE'：没有 skills 行；kind='VERSION_BUMP'：保留 skills.APPROVED 不回退。
     */
    @Transactional
    public void requestChanges(Long rowId, Long reviewerId, String reason) {
        if (reason == null || reason.isBlank()) {
            throw new BusinessException(40000, "修改说明不能为空");
        }
        Review r = mustLoad(rowId);
        if (!"PENDING_REVIEW".equals(r.getStatus())) {
            throw new BusinessException(40900, "该审核已处理，无法发起修改请求");
        }
        r.setStatus("CHANGES_REQUESTED");
        r.setReason(reason);
        r.setReviewerId(reviewerId);
        reviewMapper.updateById(r);
        boolean isPrompt = "PROMPT".equals(r.getTargetType());
        String targetUrl = isPrompt
                ? "/team/prompts/rework/" + r.getId()
                : "/team/mine";
        notifySubmitter(NotificationType.REVIEW_CHANGES_REQUESTED, r, reviewerId,
                "审核人请求修改",
                reason,
                targetUrl);
    }

    /**
     * 作者编辑 review payload（PATCH）。
     * 只在 status ∈ {DRAFT, REJECTED, CHANGES_REQUESTED, WITHDRAWN} 时允许。
     */
    @Transactional
    public void editPayload(Long rowId, ReviewPayloadReq req) {
        Review r = mustLoad(rowId);
        if (!EDITABLE_STATUSES.contains(r.getStatus())) {
            throw new BusinessException(40900, "当前状态不允许编辑");
        }
        if (!"CREATE".equals(r.getKind() == null ? "CREATE" : r.getKind())) {
            throw new BusinessException(40900, "仅首次提交可编辑 payload");
        }
        applyPayload(r, req);
        reviewMapper.updateById(r);
    }

    /**
     * 草稿提交：DRAFT → PENDING_REVIEW，再次跑 slug 唯一性校验。
     */
    @Transactional
    public void submitDraft(Long rowId) {
        Review r = mustLoad(rowId);
        if (!"DRAFT".equals(r.getStatus())) {
            throw new BusinessException(40900, "只有草稿可以提交");
        }
        if ("CREATE".equals(r.getKind() == null ? "CREATE" : r.getKind())) {
            if ("PROMPT".equals(r.getTargetType())) {
                promptService.checkSlugUniqueForReview(r.getTeamId(), r.getSkillSlug(), r.getId());
            } else {
                skillService.checkSlugUniqueForReview(r.getSkillSlug(), r.getId());
            }
        }
        r.setStatus("PENDING_REVIEW");
        r.setSubmittedAt(LocalDateTime.now());
        reviewMapper.updateById(r);
        reviewMapper.clearDecision(r.getId());
        notifyTeamWriters(NotificationType.REVIEW_SUBMITTED, r, r.getSubmitterId(),
                "有新审核请求：" + r.getSkillName(), null, "/team/reviews");
    }

    /**
     * 作者删除处于 DRAFT / REJECTED / WITHDRAWN 的 review 行（软删）。
     * PENDING_REVIEW / CHANGES_REQUESTED 不允许删；APPROVED 已经物化为 skills，删除无意义。
     */
    @Transactional
    public void deleteByAuthor(Long rowId) {
        Review r = mustLoad(rowId);
        if (!DELETABLE_STATUSES.contains(r.getStatus())) {
            throw new BusinessException(40900, "当前状态不允许删除");
        }
        reviewMapper.deleteById(rowId);
    }

    private void applyPayload(Review r, ReviewPayloadReq req) {
        if (req == null) return;
        boolean isPrompt = "PROMPT".equals(r.getTargetType());
        if (req.getName() != null && !req.getName().isBlank()) {
            String n = req.getName().trim();
            if (isPrompt) {
                r.setDisplayName(n);
                r.setSkillName(n);
            } else {
                r.setSkillName(n.startsWith("Skill") ? n : "Skill · " + n);
            }
        }
        if (req.getSlug() != null && !req.getSlug().isBlank()) {
            String s = req.getSlug().trim();
            r.setSkillSlug(s);
            if (isPrompt) r.setDisplaySlug(s);
        }
        if (req.getShortDesc() != null) {
            r.setShortDesc(req.getShortDesc());
        }
        if (req.getDescriptionMd() != null) {
            r.setDescriptionMd(req.getDescriptionMd());
        }
        if (req.getCat() != null && !req.getCat().isBlank()) {
            r.setCatCode(req.getCat().trim());
        }
        if (req.getVisibility() != null && !req.getVisibility().isBlank()) {
            r.setVisibility(req.getVisibility());
        }
        if (req.getVersion() != null && !req.getVersion().isBlank()) {
            r.setVersion(req.getVersion().trim());
        }
        if (req.getIcon() != null) {
            r.setIcon(req.getIcon());
        }
        // 自定义上传图标 key：null=不变；""=清除；非空=替换。对 SKILL / PROMPT 都存到 review.icon_url。
        if (req.getIconKey() != null) {
            String next = req.getIconKey().isBlank() ? null : req.getIconKey().trim();
            r.setIconUrl(next);
        }
        if (req.getLangs() != null) {
            r.setLangsJson(SkillService.tagsToJson(req.getLangs())); // 复用 list→json
        }
        if (req.getTags() != null) {
            r.setTagsJson(SkillService.tagsToJson(req.getTags()));
        }
        if (req.getFilesCount() != null) {
            r.setFilesCount(Math.max(0, req.getFilesCount()));
        }
        if (req.getZipUrl() != null) {
            r.setZipUrl(req.getZipUrl().isBlank() ? null : req.getZipUrl().trim());
        }
        if (req.getChangelog() != null) {
            r.setChangelog(req.getChangelog());
        }
        // Prompt review: contentMd / changelog 等字段存在 payloadJson 里，需要同步重写
        if (isPrompt) {
            r.setPayloadJson(promptService.mergeReviewPayload(r.getPayloadJson(), req));
        }
    }

    private String stripPrefix(String name) {
        if (name == null) return null;
        String n = name.trim();
        if (n.startsWith("Skill · ")) return n.substring("Skill · ".length());
        if (n.startsWith("Skill·")) return n.substring("Skill·".length());
        if (n.startsWith("Skill ")) return n.substring("Skill ".length());
        return n;
    }

    // ---------------- notification helpers ----------------

    private void notifySubmitter(NotificationType type, Review r, Long actorId,
                                 String title, String body, String targetUrl) {
        notificationService.notify(type, r.getSubmitterId(), r.getTeamId(), actorId,
                title, body, targetUrl, "review", r.getId());
    }

    /** Fan out a review event to team OWNER/ADMIN, excluding the actor. */
    private void notifyTeamWriters(NotificationType type, Review r, Long actorId,
                                   String title, String body, String targetUrl) {
        java.util.List<com.skillstack.team.dto.TeamMemberRes> owners =
                teamMapper.selectMembers(r.getTeamId(), "OWNER", null, 0, 1000);
        java.util.List<com.skillstack.team.dto.TeamMemberRes> admins =
                teamMapper.selectMembers(r.getTeamId(), "ADMIN", null, 0, 1000);
        java.util.LinkedHashSet<Long> ids = new java.util.LinkedHashSet<>();
        for (var m : owners) ids.add(m.getUserId());
        for (var m : admins) ids.add(m.getUserId());
        for (Long uid : ids) {
            if (actorId != null && actorId.equals(uid)) continue;
            notificationService.notify(type, uid, r.getTeamId(), actorId,
                    title, body, targetUrl, "review", r.getId());
        }
    }

    /**
     * Public entry for SkillService.createReviewFirst — emit REVIEW_SUBMITTED to team writers.
     * Body argument is optional; pass null when no preview is available.
     */
    public void notifyReviewSubmitted(Review r, Long actorId) {
        notifyTeamWriters(NotificationType.REVIEW_SUBMITTED, r, actorId,
                "有新审核请求：" + r.getSkillName(), null, "/team/reviews");
    }

    /**
     * Public entry for ReviewCommentService — emit REVIEW_COMMENT to writers (used in Task 9).
     */
    public void notifyReviewCommentToWriters(Review r, Long actorId, String preview) {
        notifyTeamWriters(NotificationType.REVIEW_COMMENT, r, actorId,
                "提交者评论了审核：" + r.getSkillName(), preview, "/team/reviews");
    }

    // ---------------- private helpers ----------------

    private Review mustLoad(Long rowId) {
        Review r = reviewMapper.selectById(rowId);
        if (r == null) {
            throw new BusinessException(40400, "审核记录不存在");
        }
        return r;
    }

    private Long resolveSkillId(Review r) {
        if (r.getSkillId() != null) {
            return r.getSkillId();
        }
        if (r.getSkillSlug() != null) {
            return reviewMapper.findSkillIdBySlug(r.getSkillSlug());
        }
        return null;
    }

    private String normalizeStatus(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String s = raw.trim().toUpperCase();
        if ("PENDING".equals(s)) return "PENDING_REVIEW";
        if (Arrays.asList("DRAFT", "PENDING_REVIEW", "APPROVED", "REJECTED", "CHANGES_REQUESTED", "WITHDRAWN").contains(s)) {
            return s;
        }
        return null;
    }

    private String normalizeTargetType(String raw) {
        if (raw == null || raw.isBlank() || "ALL".equalsIgnoreCase(raw)) {
            return null;
        }
        String s = raw.trim().toUpperCase();
        if ("SKILL".equals(s) || "PROMPT".equals(s)) {
            return s;
        }
        throw new BusinessException(40000, "审核目标类型必须是 SKILL 或 PROMPT");
    }

    private ReviewDetail.SafetyReport emptySafetyReport(String safety) {
        ReviewDetail.SafetyReport rep = new ReviewDetail.SafetyReport();
        rep.setOverall(safety == null ? "pass" : safety);
        rep.setIssues(new ArrayList<>());
        return rep;
    }

    private List<ReviewDetail.HistoryEntry> buildHistory(Review r) {
        List<ReviewDetail.HistoryEntry> list = new ArrayList<>();
        if (r.getSubmittedAt() != null) {
            ReviewDetail.HistoryEntry submit = new ReviewDetail.HistoryEntry();
            submit.setAt(r.getSubmittedAt().format(DT_FMT));
            submit.setActor(r.getSubmitterId() == null ? "提交者" : "submitter#" + r.getSubmitterId());
            submit.setAction("submit");
            submit.setComment("提交审核：v" + (r.getVersion() == null ? "?" : r.getVersion()));
            list.add(submit);
        }
        if (r.getDecidedAt() != null) {
            ReviewDetail.HistoryEntry done = new ReviewDetail.HistoryEntry();
            done.setAt(r.getDecidedAt().format(DT_FMT));
            done.setActor(r.getReviewerId() == null ? "reviewer" : "reviewer#" + r.getReviewerId());
            String action = switch (r.getStatus() == null ? "" : r.getStatus()) {
                case "APPROVED" -> "approve";
                case "REJECTED" -> "reject";
                case "CHANGES_REQUESTED" -> "request-changes";
                default -> "comment";
            };
            done.setAction(action);
            done.setComment(r.getReason());
            list.add(done);
        }
        return list;
    }

    @SuppressWarnings("unused")
    private long countByStatus(Long teamId, String status) {
        return reviewMapper.selectCount(Wrappers.<Review>lambdaQuery()
                .eq(Review::getTeamId, teamId)
                .eq(Review::getStatus, status));
    }
}
