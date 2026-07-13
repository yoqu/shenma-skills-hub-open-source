package com.skillstack.prompt.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.TeamAccessGuard;
import com.skillstack.common.storage.StorageService;
import com.skillstack.common.storage.StorageUrlResolver;
import com.skillstack.common.web.PageQuery;
import com.skillstack.common.web.PageResult;
import com.skillstack.prompt.dto.CreatePromptReq;
import com.skillstack.prompt.dto.PromptCard;
import com.skillstack.prompt.dto.PromptDetail;
import com.skillstack.prompt.dto.PromptPayload;
import com.skillstack.prompt.dto.PromptResolveResult;
import com.skillstack.prompt.dto.PromptVersionItem;
import com.skillstack.prompt.dto.SubmitPromptVersionReq;
import com.skillstack.prompt.dto.AdminPromptProfileUpdateReq;
import com.skillstack.prompt.entity.Prompt;
import com.skillstack.prompt.entity.PromptRef;
import com.skillstack.prompt.entity.PromptTag;
import com.skillstack.prompt.entity.PromptVersion;
import com.skillstack.prompt.mapper.PromptMapper;
import com.skillstack.prompt.mapper.PromptRefMapper;
import com.skillstack.prompt.mapper.PromptTagMapper;
import com.skillstack.prompt.mapper.PromptVersionMapper;
import com.skillstack.review.entity.Review;
import com.skillstack.review.mapper.ReviewMapper;
import com.skillstack.skill.entity.Tag;
import com.skillstack.skill.mapper.TagMapper;
import com.skillstack.skill.service.CategoryService;
import com.skillstack.team.entity.Team;
import com.skillstack.team.dto.TeamDetailRes;
import com.skillstack.team.service.TeamService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

@Service
@RequiredArgsConstructor
public class PromptService {

    private static final int MAX_TAGS = 8;
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final ObjectMapper OM = new ObjectMapper();
    private static final java.util.Set<String> ADMIN_STATUSES = java.util.Set.of("APPROVED", "UNLISTED");
    private static final java.util.Set<String> ADMIN_VISIBILITIES = java.util.Set.of("PUBLIC", "TEAM_PRIVATE");

    private final PromptMapper promptMapper;
    private final PromptVersionMapper versionMapper;
    private final PromptTagMapper promptTagMapper;
    private final PromptRefMapper promptRefMapper;
    private final TagMapper tagMapper;
    private final ReviewMapper reviewMapper;
    private final TeamAccessGuard guard;
    private final TeamService teamService;
    private final CategoryService categoryService;
    private final PromptMarkdownService markdownService;
    private final PromptResolveService resolveService;
    private final StorageUrlResolver storageUrlResolver;
    private final StorageService storageService;

    public PageResult<PromptCard> listPublic(PageQuery q, String keyword) {
        List<Map<String, Object>> rows = promptMapper.selectPublicPrompts(keyword, q.getOffset(), q.getSize());
        long total = promptMapper.countPublicPrompts(keyword);
        List<PromptCard> items = rows.stream().map(this::toCard).toList();
        return PageResult.of(items, total, q.getPage(), q.getSize());
    }

    public PageResult<PromptCard> listTeam(Long teamId,
                                           PageQuery q,
                                           Long userId,
                                           String status,
                                           String visibility,
                                           String cat,
                                           Long authorId,
                                           Integer updatedWithin,
                                           String keyword) {
        guard.requireMember(teamId, userId);
        var query = Wrappers.<Prompt>lambdaQuery()
                .eq(Prompt::getTeamId, teamId)
                .eq(status != null && !status.isBlank(), Prompt::getStatus, status)
                .eq(visibility != null && !visibility.isBlank(), Prompt::getVisibility, visibility)
                .eq(cat != null && !cat.isBlank() && !"all".equals(cat), Prompt::getCatCode, cat)
                .eq(authorId != null, Prompt::getAuthorId, authorId)
                .ge(updatedWithin != null && updatedWithin > 0,
                        Prompt::getUpdatedAt,
                        updatedWithin == null ? null : LocalDateTime.now().minusDays(updatedWithin))
                .and(keyword != null && !keyword.isBlank(), w -> w
                        .like(Prompt::getName, keyword)
                        .or()
                        .like(Prompt::getSlug, keyword)
                        .or()
                        .like(Prompt::getShortDesc, keyword))
                .orderByDesc(Prompt::getUpdatedAt);
        Long total = promptMapper.selectCount(query);
        List<Prompt> rows = promptMapper.selectList(query.last("LIMIT " + q.getOffset() + ", " + q.getSize()));
        List<PromptCard> items = rows.stream().map(this::toCard).toList();
        return PageResult.of(items, total == null ? 0 : total, q.getPage(), q.getSize());
    }

    public PromptDetail detail(String teamSlug, String promptSlug, Long userId) {
        Map<String, Object> row = promptMapper.selectDetailByTeamAndSlug(teamSlug, promptSlug);
        if (row == null) throw new BusinessException(40400, "Prompt 不存在");
        Long teamId = toLong(row.get("team_id"));
        String visibility = str(row.get("visibility"));
        String status = str(row.get("status"));
        if ("TEAM_PRIVATE".equals(visibility)) {
            guard.requireMember(teamId, userId);
        } else if (!"APPROVED".equals(status) && !"UNLISTED".equals(status)) {
            throw new BusinessException(40400, "Prompt 不存在");
        }
        PromptDetail detail = toDetail(row);
        PromptVersion version = versionMapper.selectById(toLong(row.get("current_version_id")));
        String content = version == null ? "" : version.getContentMd();
        detail.setContentMd(content);
        detail.setResolved(resolveContentForUser(content, teamSlug, false, userId, teamId));
        return detail;
    }

    public PromptDetail detailById(Long promptId, Long userId) {
        Prompt p = requireReadableById(promptId, userId);
        Team team = teamService.requireTeam(p.getTeamId());
        return detail(team.getSlug(), p.getSlug(), userId);
    }

    public List<PromptVersionItem> versions(Long promptId, Long userId) {
        Prompt p = requireReadableById(promptId, userId);
        return versionMapper.listByPrompt(p.getId()).stream()
                .map(v -> PromptVersionItem.builder()
                        .id(v.getId())
                        .version(v.getVersion())
                        .changelog(v.getChangelog())
                        .refsCount(v.getRefsCount())
                        .publishedAt(v.getPublishedAt() == null ? null : v.getPublishedAt().format(DATE))
                        .build())
                .toList();
    }

    public PromptVersionItem versionDetail(Long promptId, String version, Long userId) {
        Prompt p = requireReadableById(promptId, userId);
        PromptVersion row = findVersion(p.getId(), version);
        if (row == null) throw new BusinessException(40400, "Prompt 版本不存在");
        return PromptVersionItem.builder()
                .id(row.getId())
                .version(row.getVersion())
                .changelog(row.getChangelog())
                .contentMd(row.getContentMd())
                .refsCount(row.getRefsCount())
                .publishedAt(row.getPublishedAt() == null ? null : row.getPublishedAt().format(DATE))
                .build();
    }

    public String download(String teamSlug, String promptSlug, Long userId, boolean raw) {
        PromptDetail detail = detail(teamSlug, promptSlug, userId);
        promptMapper.incrExports(detail.getId());
        if (raw) {
            return withFrontmatter(detail, List.of(), detail.getContentMd());
        }
        PromptResolveResult resolved = detail.getResolved();
        return withFrontmatter(detail, resolved.getResolvedRefs(), resolved.getMarkdown());
    }

    public String downloadById(Long promptId, Long userId, boolean raw) {
        Prompt p = requireReadableById(promptId, userId);
        Team team = teamService.requireTeam(p.getTeamId());
        return download(team.getSlug(), p.getSlug(), userId, raw);
    }

    public PromptResolveResult resolve(String contentMd, String teamSlug, boolean raw, Long userId) {
        TeamDetailRes team = teamService.getBySlug(teamSlug);
        if (team == null || team.getId() == null) {
            throw new BusinessException(40400, "团队不存在");
        }
        Long sourceTeamId = team.getId();
        return resolveContentForUser(contentMd, teamSlug, raw, userId, sourceTeamId);
    }

    @Transactional
    public Map<String, Object> create(CreatePromptReq req, Long userId) {
        guard.requireMember(req.getTeamId(), userId);
        validatePayload(req.getCat(), req.getTags(), req.getContentMd(), req.getVisibility());
        Team team = teamService.requireTeam(req.getTeamId());
        boolean draft = Boolean.TRUE.equals(req.getDraft());
        boolean direct = !draft && "DIRECT_PUBLISH".equals(team.getReviewMode());
        if (direct) {
            Prompt p = publishNew(req, userId);
            return Map.of("id", p.getId(), "slug", p.getSlug(), "status", p.getStatus(), "pendingReview", false);
        }
        Review r = createReview(req, userId, draft);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", null);
        result.put("slug", req.getSlug());
        result.put("status", r.getStatus());
        result.put("pendingReview", "PENDING_REVIEW".equals(r.getStatus()));
        result.put("reviewId", r.getId());
        return result;
    }

    @Transactional
    public Prompt publishNew(CreatePromptReq req, Long userId) {
        return publishNew(req, userId, null);
    }

    private Prompt publishNew(CreatePromptReq req, Long userId, Long excludeReviewId) {
        checkSlugUnique(req.getTeamId(), req.getSlug(), null, excludeReviewId);
        Team team = teamService.requireTeam(req.getTeamId());
        resolveContentForUser(req.getContentMd(), team.getSlug(), false, userId, req.getTeamId());
        validateReferencePolicy(req.getContentMd(), req.getVisibility(), userId, req.getTeamId());
        Prompt p = new Prompt();
        p.setTeamId(req.getTeamId());
        p.setSlug(req.getSlug());
        p.setName(req.getName().trim());
        p.setShortDesc(req.getShortDesc().trim());
        p.setCatCode(req.getCat().trim());
        p.setIconUrl(blankToNull(req.getIconKey()));
        p.setVisibility(req.getVisibility());
        p.setStatus("APPROVED");
        p.setVersion(req.getVersion().trim());
        p.setAuthorId(userId);
        p.setScore(BigDecimal.ZERO);
        p.setStars(0);
        p.setExports(0);
        p.setPublishedAt(LocalDateTime.now());
        promptMapper.insert(p);

        PromptVersion version = insertVersion(p, req.getVersion(), req.getContentMd(), req.getChangelog());
        p.setCurrentVersionId(version.getId());
        promptMapper.updateById(p);
        rebuildTags(p.getId(), req.getTags());
        rebuildRefs(p, version, req.getContentMd());
        return p;
    }

    public PromptVersion insertVersion(Prompt prompt, String version, String content, String changelog) {
        PromptVersion row = new PromptVersion();
        row.setPromptId(prompt.getId());
        row.setVersion(version);
        row.setContentMd(content);
        row.setChangelog(changelog);
        row.setContentSha256(sha256(content));
        row.setRefsCount(markdownService.extractMentions(content).size());
        row.setPublishedAt(LocalDateTime.now());
        versionMapper.insert(row);
        return row;
    }

    @Transactional
    public Prompt approveReview(Review review) {
        PromptPayload payload = parsePayload(review.getPayloadJson());
        CreatePromptReq req = new CreatePromptReq();
        req.setTeamId(review.getTeamId());
        req.setSlug(payload.getSlug());
        req.setName(payload.getName());
        req.setShortDesc(payload.getShortDesc());
        req.setCat(payload.getCat());
        req.setVisibility(payload.getVisibility());
        req.setVersion(payload.getVersion());
        req.setContentMd(payload.getContentMd());
        req.setChangelog(payload.getChangelog());
        req.setTags(payload.getTags());
        // 图标 key 存在 review.icon_url（不进 payloadJson），CREATE 物化时透传给 publishNew。
        req.setIconKey(review.getIconUrl());

        if ("VERSION_BUMP".equals(payload.getKind())) {
            Prompt prompt = promptMapper.selectById(review.getTargetId());
            if (prompt == null) throw new BusinessException(40400, "Prompt 不存在");
            Team team = teamService.requireTeam(prompt.getTeamId());
            resolveContentForUser(req.getContentMd(), team.getSlug(), false, review.getSubmitterId(), prompt.getTeamId());
            validateReferencePolicy(req.getContentMd(), prompt.getVisibility(), review.getSubmitterId(), prompt.getTeamId());
            PromptVersion version = insertVersion(prompt, req.getVersion(), req.getContentMd(), req.getChangelog());
            prompt.setVersion(req.getVersion());
            prompt.setCurrentVersionId(version.getId());
            promptMapper.updateById(prompt);
            rebuildTags(prompt.getId(), req.getTags());
            rebuildRefs(prompt, version, req.getContentMd());
            return prompt;
        }

        Prompt prompt = publishNew(req, review.getSubmitterId(), review.getId());
        review.setTargetId(prompt.getId());
        return prompt;
    }

    @Transactional
    public Map<String, Object> submitVersion(Long promptId, SubmitPromptVersionReq req, Long userId) {
        Prompt prompt = promptMapper.selectById(promptId);
        if (prompt == null) throw new BusinessException(40400, "Prompt 不存在");
        guard.requireMember(prompt.getTeamId(), userId);
        validatePayload(prompt.getCatCode(), req.getTags(), req.getContentMd(), prompt.getVisibility());
        Team team = teamService.requireTeam(prompt.getTeamId());
        resolveContentForUser(req.getContentMd(), team.getSlug(), false, userId, prompt.getTeamId());
        validateReferencePolicy(req.getContentMd(), prompt.getVisibility(), userId, prompt.getTeamId());

        boolean direct = guard.isWriter(prompt.getTeamId(), userId)
                || "DIRECT_PUBLISH".equals(team.getReviewMode());
        if (direct) {
            PromptVersion version = insertVersion(prompt, req.getVersion(), req.getContentMd(), req.getChangelog());
            prompt.setVersion(req.getVersion());
            prompt.setCurrentVersionId(version.getId());
            promptMapper.updateById(prompt);
            rebuildTags(prompt.getId(), req.getTags());
            rebuildRefs(prompt, version, req.getContentMd());
            return Map.of("id", prompt.getId(), "slug", prompt.getSlug(), "status", prompt.getStatus(), "pendingReview", false);
        }

        CreatePromptReq payloadReq = new CreatePromptReq();
        payloadReq.setTeamId(prompt.getTeamId());
        payloadReq.setSlug(prompt.getSlug());
        payloadReq.setName(prompt.getName());
        payloadReq.setShortDesc(prompt.getShortDesc());
        payloadReq.setCat(prompt.getCatCode());
        payloadReq.setVisibility(prompt.getVisibility());
        payloadReq.setVersion(req.getVersion());
        payloadReq.setContentMd(req.getContentMd());
        payloadReq.setChangelog(req.getChangelog());
        payloadReq.setTags(req.getTags());

        Review r = new Review();
        r.setCode(nextReviewCode());
        r.setTargetType("PROMPT");
        r.setTargetId(prompt.getId());
        r.setDisplaySlug(prompt.getSlug());
        r.setDisplayName(prompt.getName());
        r.setSkillSlug(prompt.getSlug());
        r.setSkillName("Prompt · " + prompt.getName());
        r.setShortDesc(prompt.getShortDesc());
        r.setCatCode(prompt.getCatCode());
        r.setKind("VERSION_BUMP");
        r.setTeamId(prompt.getTeamId());
        r.setSubmitterId(userId);
        r.setVisibility(prompt.getVisibility());
        r.setVersion(req.getVersion());
        r.setStatus("PENDING_REVIEW");
        r.setSubmittedAt(LocalDateTime.now());
        r.setPayloadJson(writePayload(payloadReq, "VERSION_BUMP"));
        reviewMapper.insert(r);
        return Map.of("id", prompt.getId(), "slug", prompt.getSlug(), "status", r.getStatus(),
                "pendingReview", true, "reviewId", r.getId());
    }

    public void rebuildRefs(Prompt prompt, PromptVersion version, String content) {
        promptRefMapper.delete(Wrappers.<PromptRef>lambdaQuery().eq(PromptRef::getSourceVersionId, version.getId()));
        for (PromptMarkdownService.PromptMention mention : markdownService.extractMentions(content)) {
            Prompt target = promptMapper.selectByTeamSlugAndSlug(mention.teamSlug(), mention.promptSlug());
            if (target == null) throw new BusinessException(40400, "引用 Prompt 不存在");
            PromptRef ref = new PromptRef();
            ref.setSourcePromptId(prompt.getId());
            ref.setSourceVersionId(version.getId());
            ref.setReferencedPromptId(target.getId());
            ref.setDisplayLabel(mention.label());
            ref.setPosition(mention.position());
            promptRefMapper.insert(ref);
        }
    }

    public Prompt requireReadableById(Long promptId, Long userId) {
        Prompt p = promptMapper.selectById(promptId);
        if (p == null) throw new BusinessException(40400, "Prompt 不存在");
        if ("TEAM_PRIVATE".equals(p.getVisibility())) {
            guard.requireMember(p.getTeamId(), userId);
        }
        return p;
    }

    @Transactional
    public void updateVisibility(Long promptId, String visibility, Long operatorId) {
        if (visibility == null || !ADMIN_VISIBILITIES.contains(visibility)) {
            throw new BusinessException(40000, "可见性取值非法");
        }
        Prompt p = findById(promptId);
        guard.requireWriter(p.getTeamId(), operatorId);
        p.setVisibility(visibility);
        promptMapper.updateById(p);
    }

    @Transactional
    public void updateStatus(Long promptId, String status, Long operatorId) {
        if (status == null || !ADMIN_STATUSES.contains(status)) {
            throw new BusinessException(40000, "状态只允许 APPROVED 或 UNLISTED");
        }
        Prompt p = findById(promptId);
        guard.requireWriter(p.getTeamId(), operatorId);
        if (!ADMIN_STATUSES.contains(p.getStatus())) {
            throw new BusinessException(40900, "当前状态不支持上下架，请先完成审核");
        }
        p.setStatus(status);
        promptMapper.updateById(p);
    }

    @Transactional
    public void updateAdminProfile(Long promptId, AdminPromptProfileUpdateReq req, Long operatorId) {
        if (req == null) throw new BusinessException(40000, "请求不能为空");
        Prompt p = findById(promptId);
        guard.requireWriter(p.getTeamId(), operatorId);
        if (!ADMIN_STATUSES.contains(p.getStatus())) {
            throw new BusinessException(40900, "只能编辑已上线 Prompt");
        }
        String name = cleanRequired(req.getName(), "名称", 128);
        String shortDesc = cleanRequired(req.getShortDesc(), "描述", 512);
        String cat = cleanRequired(req.getCat(), "分类", 64);
        if (categoryService.findByCode(cat) == null) {
            throw new BusinessException(40000, "分类不存在: " + cat);
        }
        String visibility = req.getVisibility() == null ? p.getVisibility() : req.getVisibility().trim();
        if (!ADMIN_VISIBILITIES.contains(visibility)) {
            throw new BusinessException(40000, "可见性取值非法");
        }

        p.setName(name);
        p.setShortDesc(shortDesc);
        p.setCatCode(cat);
        applyIconKey(p, req.getIconKey());
        p.setVisibility(visibility);
        promptMapper.updateById(p);
        rebuildTags(promptId, req.getTags());
    }

    @Transactional
    public void softDelete(Long promptId, Long operatorId) {
        Prompt p = findById(promptId);
        guard.requireWriter(p.getTeamId(), operatorId);
        promptMapper.deleteById(promptId);
    }

    private Prompt findById(Long promptId) {
        Prompt p = promptMapper.selectById(promptId);
        if (p == null) throw new BusinessException(40400, "Prompt 不存在");
        return p;
    }

    private Review createReview(CreatePromptReq req, Long userId, boolean draft) {
        checkSlugUnique(req.getTeamId(), req.getSlug(), null, null);
        Review r = new Review();
        r.setCode(nextReviewCode());
        r.setTargetType("PROMPT");
        r.setDisplaySlug(req.getSlug());
        r.setDisplayName(req.getName());
        r.setSkillSlug(req.getSlug());
        r.setSkillName("Prompt · " + req.getName());
        r.setShortDesc(req.getShortDesc());
        r.setCatCode(req.getCat());
        r.setIconUrl(blankToNull(req.getIconKey()));
        r.setKind("CREATE");
        r.setTeamId(req.getTeamId());
        r.setSubmitterId(userId);
        r.setVisibility(req.getVisibility());
        r.setVersion(req.getVersion());
        r.setStatus(draft ? "DRAFT" : "PENDING_REVIEW");
        r.setSubmittedAt(draft ? null : LocalDateTime.now());
        r.setPayloadJson(writePayload(req, "CREATE"));
        reviewMapper.insert(r);
        return r;
    }

    void validateReferencePolicy(String content, String sourceVisibility) {
        validateReferencePolicy(content, sourceVisibility, null);
    }

    void validateReferencePolicy(String content, String sourceVisibility, Long userId) {
        validateReferencePolicy(content, sourceVisibility, userId, null);
    }

    void validateReferencePolicy(String content, String sourceVisibility, Long userId, Long sourceTeamId) {
        for (PromptMarkdownService.PromptMention mention : markdownService.extractMentions(content)) {
            Prompt target = promptMapper.selectByTeamSlugAndSlug(mention.teamSlug(), mention.promptSlug());
            if (target == null || !"APPROVED".equals(target.getStatus()) || target.getCurrentVersionId() == null) {
                throw new BusinessException(40400, "引用 Prompt 不存在或尚无审核版本: "
                        + mention.teamSlug() + "/" + mention.promptSlug());
            }
            requirePromptReadable(target, userId);
            if (sourceTeamId != null && !sourceTeamId.equals(target.getTeamId())) {
                throw new BusinessException(40900, "暂不支持跨团队引用 Prompt: "
                        + mention.teamSlug() + "/" + mention.promptSlug());
            }
            if ("PUBLIC".equals(sourceVisibility) && "TEAM_PRIVATE".equals(target.getVisibility())) {
                throw new BusinessException(40900, "公开 Prompt 不能引用团队私有 Prompt: "
                        + mention.teamSlug() + "/" + mention.promptSlug());
            }
        }
    }

    private PromptResolveResult resolveContentForUser(String contentMd,
                                                      String teamSlug,
                                                      boolean raw,
                                                      Long userId,
                                                      Long sourceTeamId) {
        if (!raw) {
            validateReferencePolicy(contentMd, null, userId, sourceTeamId);
        }
        return resolveService.resolve(contentMd, teamSlug, raw, prompt -> requirePromptReadable(prompt, userId));
    }

    private void requirePromptReadable(Prompt prompt, Long userId) {
        if (prompt == null) throw new BusinessException(40400, "Prompt 不存在");
        if ("TEAM_PRIVATE".equals(prompt.getVisibility())) {
            guard.requireMember(prompt.getTeamId(), userId);
        }
    }

    private void checkSlugUnique(Long teamId, String slug, Long excludeId, Long excludeReviewId) {
        Long count = promptMapper.selectCount(Wrappers.<Prompt>lambdaQuery()
                .eq(Prompt::getTeamId, teamId)
                .eq(Prompt::getSlug, slug)
                .ne(excludeId != null, Prompt::getId, excludeId));
        if (count != null && count > 0) throw new BusinessException(40900, "Prompt slug 已被占用");
        long open = reviewMapper.countOpenPromptReviewByTeamAndSlug(teamId, slug, excludeReviewId);
        if (open > 0) throw new BusinessException(40900, "Prompt slug 已被占用");
    }

    public void checkSlugUniqueForReview(Long teamId, String slug, Long excludeReviewId) {
        checkSlugUnique(teamId, slug, null, excludeReviewId);
    }

    private void validatePayload(String cat, List<String> tags, String content, String visibility) {
        if (categoryService.findByCode(cat) == null) throw new BusinessException(40000, "分类不存在: " + cat);
        if (!"PUBLIC".equals(visibility) && !"TEAM_PRIVATE".equals(visibility)) {
            throw new BusinessException(40000, "可见性取值非法");
        }
        if (content == null || content.isBlank()) throw new BusinessException(40000, "Prompt 内容不能为空");
        normalizeTags(tags);
    }

    private void rebuildTags(Long promptId, List<String> raw) {
        promptTagMapper.delete(Wrappers.<PromptTag>lambdaQuery().eq(PromptTag::getPromptId, promptId));
        for (String tag : normalizeTags(raw)) {
            Long tagId = ensureTag(tag);
            PromptTag pt = new PromptTag();
            pt.setPromptId(promptId);
            pt.setTagId(tagId);
            promptTagMapper.insert(pt);
        }
    }

    private Long ensureTag(String name) {
        Tag existing = tagMapper.selectOne(Wrappers.<Tag>lambdaQuery().eq(Tag::getName, name));
        if (existing != null) return existing.getId();
        Tag tag = new Tag();
        tag.setName(name);
        tagMapper.insert(tag);
        return tag.getId();
    }

    private static List<String> normalizeTags(List<String> raw) {
        if (raw == null) return List.of();
        LinkedHashSet<String> out = new LinkedHashSet<>();
        for (String item : raw) {
            if (item == null) continue;
            String tag = item.trim();
            if (tag.isEmpty()) continue;
            if (tag.length() > 32) throw new BusinessException(40000, "标签最多 32 个字符");
            out.add(tag);
            if (out.size() > MAX_TAGS) throw new BusinessException(40000, "标签最多 " + MAX_TAGS + " 个");
        }
        return new ArrayList<>(out);
    }

    private static String cleanRequired(String value, String label, int max) {
        String v = value == null ? "" : value.trim();
        if (v.isEmpty()) throw new BusinessException(40000, label + "不能为空");
        if (v.length() > max) throw new BusinessException(40000, label + "最多 " + max + " 个字符");
        return v;
    }

    /** 空白字符串归一成 null，避免往 icon_url 落入空串。 */
    static String blankToNull(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }

    /**
     * 编辑场景应用图标 key：iconKey==null 表示不变；""（空白）表示清除；非空表示替换。
     * 替换/清除时删除旧的上传文件（仅当旧值是我们自己的 storage key），避免存储泄漏。
     */
    private void applyIconKey(Prompt p, String iconKey) {
        if (iconKey == null) return;
        String next = blankToNull(iconKey);
        String old = p.getIconUrl();
        if (java.util.Objects.equals(old, next)) return;
        p.setIconUrl(next);
        if (old != null && !old.isBlank()
                && !old.startsWith("http://") && !old.startsWith("https://") && !old.startsWith("/")) {
            storageService.delete(old.trim());
        }
    }

    private PromptVersion findVersion(Long promptId, String version) {
        if (version == null || version.isBlank()) return null;
        return versionMapper.selectOne(Wrappers.<PromptVersion>lambdaQuery()
                .eq(PromptVersion::getPromptId, promptId)
                .eq(PromptVersion::getVersion, version.trim()));
    }

    private String writePayload(CreatePromptReq req, String kind) {
        try {
            PromptPayload p = new PromptPayload();
            p.setKind(kind);
            p.setSlug(req.getSlug());
            p.setName(req.getName());
            p.setShortDesc(req.getShortDesc());
            p.setCat(req.getCat());
            p.setVisibility(req.getVisibility());
            p.setVersion(req.getVersion());
            p.setContentMd(req.getContentMd());
            p.setChangelog(req.getChangelog());
            p.setTags(req.getTags());
            return OM.writeValueAsString(p);
        } catch (Exception e) {
            throw new BusinessException(50000, "Prompt payload 序列化失败");
        }
    }

    private PromptPayload parsePayload(String json) {
        if (json == null || json.isBlank()) {
            throw new BusinessException(40000, "Prompt 审核 payload 为空");
        }
        try {
            return OM.readValue(json, PromptPayload.class);
        } catch (Exception e) {
            throw new BusinessException(40000, "Prompt 审核 payload 格式错误");
        }
    }

    /**
     * 合并 ReviewPayloadReq 到现有 payloadJson；仅非空字段覆盖。
     * 用于作者重新编辑被驳回的 Prompt review。
     */
    public String mergeReviewPayload(String existingJson,
                                     com.skillstack.review.dto.ReviewPayloadReq req) {
        PromptPayload p;
        if (existingJson == null || existingJson.isBlank()) {
            p = new PromptPayload();
            p.setKind("CREATE");
        } else {
            try {
                p = OM.readValue(existingJson, PromptPayload.class);
            } catch (Exception e) {
                throw new BusinessException(40000, "Prompt 审核 payload 格式错误");
            }
        }
        if (req != null) {
            if (req.getName() != null && !req.getName().isBlank()) p.setName(req.getName().trim());
            if (req.getSlug() != null && !req.getSlug().isBlank()) p.setSlug(req.getSlug().trim());
            if (req.getShortDesc() != null) p.setShortDesc(req.getShortDesc());
            if (req.getCat() != null && !req.getCat().isBlank()) p.setCat(req.getCat().trim());
            if (req.getVisibility() != null && !req.getVisibility().isBlank()) p.setVisibility(req.getVisibility());
            if (req.getVersion() != null && !req.getVersion().isBlank()) p.setVersion(req.getVersion().trim());
            if (req.getContentMd() != null) p.setContentMd(req.getContentMd());
            if (req.getChangelog() != null) p.setChangelog(req.getChangelog());
            if (req.getTags() != null) p.setTags(req.getTags());
        }
        try {
            return OM.writeValueAsString(p);
        } catch (Exception e) {
            throw new BusinessException(50000, "Prompt payload 序列化失败");
        }
    }

    private String withFrontmatter(PromptDetail detail,
                                   List<PromptResolveResult.ResolvedRef> refs,
                                   String body) {
        StringBuilder out = new StringBuilder();
        out.append("---\n");
        out.append("type: prompt\n");
        out.append("team: ").append(detail.getTeamSlug()).append("\n");
        out.append("slug: ").append(detail.getSlug()).append("\n");
        out.append("version: ").append(detail.getVersion()).append("\n");
        out.append("resolvedRefs:\n");
        for (PromptResolveResult.ResolvedRef ref : refs) {
            out.append("  - ").append(ref.getTeamSlug()).append("/")
                    .append(ref.getSlug()).append("@").append(ref.getVersion()).append("\n");
        }
        out.append("---\n\n").append(body == null ? "" : body);
        return out.toString();
    }

    private PromptCard toCard(Prompt p) {
        return PromptCard.builder()
                .id(p.getId())
                .slug(p.getSlug())
                .name(p.getName())
                .shortDesc(p.getShortDesc())
                .cat(p.getCatCode())
                .iconUrl(storageUrlResolver.resolveSingle(p.getIconUrl()))
                .visibility(p.getVisibility())
                .status(p.getStatus())
                .version(p.getVersion())
                .score(p.getScore())
                .stars(p.getStars())
                .exports(p.getExports())
                .updated(p.getPublishedAt() == null ? null : p.getPublishedAt().format(DATE))
                .tags(promptTagMapper.selectTagNamesByPrompt(p.getId()))
                .build();
    }

    private PromptCard toCard(Map<String, Object> r) {
        Long id = toLong(r.get("id"));
        return PromptCard.builder()
                .id(id)
                .slug(str(r.get("slug")))
                .teamSlug(str(r.get("team_slug")))
                .name(str(r.get("name")))
                .shortDesc(str(r.get("short_desc")))
                .cat(str(r.get("cat_code")))
                .iconUrl(storageUrlResolver.resolveSingle(str(r.get("icon_url"))))
                .visibility(str(r.get("visibility")))
                .status(str(r.get("status")))
                .version(str(r.get("version")))
                .score(toDecimal(r.get("score")))
                .stars(toInt(r.get("stars")))
                .exports(toInt(r.get("exports")))
                .updated(toDate(r.get("published_at")))
                .tags(promptTagMapper.selectTagNamesByPrompt(id))
                .author(PromptCard.AuthorRef.builder()
                        .id(toLong(r.get("author_id")))
                        .name(str(r.get("author_name")))
                        .handle(str(r.get("author_handle")))
                        .build())
                .build();
    }

    private PromptDetail toDetail(Map<String, Object> r) {
        PromptDetail d = new PromptDetail();
        d.setId(toLong(r.get("id")));
        d.setSlug(str(r.get("slug")));
        d.setTeamSlug(str(r.get("team_slug")));
        d.setTeamName(str(r.get("team_name")));
        d.setName(str(r.get("name")));
        d.setShortDesc(str(r.get("short_desc")));
        d.setCat(str(r.get("cat_code")));
        d.setCatName(str(r.get("cat_name")));
        d.setIconUrl(storageUrlResolver.resolveSingle(str(r.get("icon_url"))));
        d.setVisibility(str(r.get("visibility")));
        d.setStatus(str(r.get("status")));
        d.setVersion(str(r.get("version")));
        d.setScore(toDecimal(r.get("score")));
        d.setStars(toInt(r.get("stars")));
        d.setExports(toInt(r.get("exports")));
        d.setTags(promptTagMapper.selectTagNamesByPrompt(d.getId()));
        d.setAuthor(PromptCard.AuthorRef.builder()
                .id(toLong(r.get("author_id")))
                .name(str(r.get("author_name")))
                .handle(str(r.get("author_handle")))
                .build());
        return d;
    }

    private static String nextReviewCode() {
        return "p-" + (System.currentTimeMillis() % 100000) + "-" + ThreadLocalRandom.current().nextInt(100, 999);
    }

    private static String sha256(String content) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest((content == null ? "" : content).getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : digest) hex.append(String.format("%02x", b));
            return hex.toString();
        } catch (Exception e) {
            return null;
        }
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    private static Long toLong(Object o) {
        if (o == null) return null;
        if (o instanceof Number n) return n.longValue();
        return Long.parseLong(o.toString());
    }

    private static Integer toInt(Object o) {
        if (o == null) return null;
        if (o instanceof Number n) return n.intValue();
        return Integer.parseInt(o.toString());
    }

    private static BigDecimal toDecimal(Object o) {
        if (o == null) return BigDecimal.ZERO;
        if (o instanceof BigDecimal bd) return bd;
        if (o instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        return new BigDecimal(o.toString());
    }

    private static String toDate(Object o) {
        if (o instanceof LocalDateTime dt) return dt.format(DATE);
        if (o instanceof java.sql.Timestamp ts) return ts.toLocalDateTime().format(DATE);
        return null;
    }
}
