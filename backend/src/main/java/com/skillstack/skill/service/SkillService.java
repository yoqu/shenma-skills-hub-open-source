package com.skillstack.skill.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.TeamAccessGuard;
import com.skillstack.common.storage.StorageService;
import com.skillstack.common.storage.StorageUrlResolver;
import com.skillstack.common.web.PageQuery;
import com.skillstack.common.web.PageResult;
import com.skillstack.skill.dto.CreateSkillReq;
import com.skillstack.skill.dto.CreateSkillRes;
import com.skillstack.skill.dto.AdminSkillProfileUpdateReq;
import com.skillstack.skill.dto.InstallRes;
import com.skillstack.skill.dto.PlazaQuery;
import com.skillstack.skill.dto.SkillCard;
import com.skillstack.skill.dto.SkillDetail;
import com.skillstack.skill.entity.Skill;
import com.skillstack.skill.entity.SkillStar;
import com.skillstack.skill.entity.SkillTag;
import com.skillstack.skill.entity.SkillVersion;
import com.skillstack.skill.entity.Tag;
import com.skillstack.skill.mapper.SkillMapper;
import com.skillstack.skill.mapper.SkillStarMapper;
import com.skillstack.skill.mapper.SkillTagMapper;
import com.skillstack.skill.mapper.TagMapper;
import com.skillstack.review.entity.Review;
import com.skillstack.review.mapper.ReviewMapper;
import com.skillstack.review.service.ReviewService;
import com.skillstack.team.entity.Team;
import com.skillstack.team.service.TeamService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Skill 主服务：广场分页 / 详情 / 创建 / 安装 / 收藏 / 团队 Skill 库 / 我的草稿。
 */
@Service
@RequiredArgsConstructor
public class SkillService {

    private final SkillMapper skillMapper;
    private final SkillTagMapper skillTagMapper;
    private final TagMapper tagMapper;
    private final SkillStarMapper skillStarMapper;
    private final SkillVersionService skillVersionService;
    private final SkillVersionFileService skillVersionFileService;
    private final ReviewMapper reviewMapper;
    private final TeamAccessGuard teamAccessGuard;
    private final TeamService teamService;
    private final CategoryService categoryService;
    private final StorageUrlResolver storageUrlResolver;
    private final StorageService storageService;

    /** Injected lazily to avoid circular dependency (ReviewService → SkillService). */
    private ReviewService reviewService;

    @Autowired
    public void setReviewService(@Lazy ReviewService reviewService) {
        this.reviewService = reviewService;
    }

    private static final int MAX_TAGS = 8;

    /**
     * Feature flag：开启后，REVIEW 模式 / 草稿走 review-first 路径（仅落 reviews 行）。
     * 关闭时回退老路径：直接写 skills 表 + 镜像 reviews 行（用于紧急回退）。
     */
    @Value("${skillstack.review.review-first-submit:true}")
    private boolean reviewFirstSubmit;

    private static final DateTimeFormatter D = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter DT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final ObjectMapper OM = new ObjectMapper();

    private static final Set<String> VIEWABLE_PUBLIC_STATUS = Set.of("APPROVED", "UNLISTED");

    // ---------------- 广场 / 团队 Skill 库 ----------------

    public PageResult<SkillCard> listPublicSkills(PageQuery q) {
        long offset = q.getOffset();
        List<Map<String, Object>> rows = skillMapper.selectPublicSkills(offset, q.getSize());
        long total = skillMapper.countPublicSkills();
        List<SkillCard> items = new ArrayList<>(rows.size());
        for (Map<String, Object> r : rows) {
            items.add(toCard(r));
        }
        return PageResult.of(items, total, q.getPage(), q.getSize());
    }

    public PageResult<SkillCard> listPlaza(PlazaQuery q) {
        long offset = q.getOffset();
        List<Map<String, Object>> rows = skillMapper.selectPlaza(
                q.getCat(), q.getQ(), q.getSort(),
                q.getSafety(), q.getVisibility(), q.getStatus(), q.getTeamId(),
                q.getAuthorId(), q.getUpdatedWithin(),
                offset, q.getSize()
        );
        long total = skillMapper.countPlaza(
                q.getCat(), q.getQ(),
                q.getSafety(), q.getVisibility(), q.getStatus(), q.getTeamId(),
                q.getAuthorId(), q.getUpdatedWithin()
        );
        List<SkillCard> items = new ArrayList<>(rows.size());
        for (Map<String, Object> r : rows) {
            items.add(toCard(r));
        }
        return PageResult.of(items, total, q.getPage(), q.getSize());
    }

    /**
     * 团队 Skill 库（SKILL-TLIB-001）：
     *  - 成员：返回所有 status / visibility（受 PlazaQuery 过滤）；
     *  - 非成员：自动强制 visibility=PUBLIC + status=APPROVED，
     *    用于公共团队页 (/teams/:slug) 的展示。
     */
    public PageResult<SkillCard> listTeamSkills(Long teamId, PlazaQuery q, Long currentUserId) {
        boolean isMember = isMember(teamId, currentUserId);
        if (!isMember) {
            Team team = teamService.requireTeam(teamId);
            if (!Boolean.TRUE.equals(team.getPublicHome())) {
                throw new BusinessException(40400, "团队不存在");
            }
            q.setVisibility("PUBLIC");
            q.setStatus("APPROVED");
        }
        q.setTeamId(teamId);
        return listPlaza(q);
    }

    private boolean isMember(Long teamId, Long userId) {
        if (teamId == null || userId == null) return false;
        try {
            teamAccessGuard.requireMember(teamId, userId);
            return true;
        } catch (BusinessException e) {
            return false;
        }
    }

    public List<SkillCard> listDrafts(Long userId) {
        // Review-first：草稿存于 reviews 表（kind='CREATE' AND status='DRAFT'）；
        // 关闭 flag 时回退到 skills.DRAFT。
        List<Map<String, Object>> rows = reviewFirstSubmit
                ? reviewMapper.selectDraftsBySubmitter(userId)
                : skillMapper.selectDraftsByUser(userId);
        List<SkillCard> out = new ArrayList<>(rows.size());
        for (Map<String, Object> r : rows) out.add(toCard(r));
        return out;
    }

    // ---------------- 详情 ----------------

    /**
     * 公开/团队私有 Skill 详情。
     *
     * <p>SKILL-DTL-003：未审 (PENDING_REVIEW) / 已拒绝 (REJECTED) / 草稿 (DRAFT) 的 Skill
     * 不应通过 slug 暴露给团队成员以外的用户。规则：</p>
     * <ul>
     *   <li>visibility=PUBLIC + status APPROVED/UNLISTED：任何人都能看；</li>
     *   <li>visibility=TEAM_PRIVATE：仅团队成员能看，无论状态；</li>
     *   <li>其它 PUBLIC 状态（DRAFT/PENDING_REVIEW/REJECTED）：仅作者或团队成员能看。</li>
     * </ul>
     */
    public SkillDetail getDetail(String slug, Long currentUserId) {
        Map<String, Object> r = skillMapper.selectDetailBySlug(slug);
        if (r == null) {
            throw new BusinessException(40400, "Skill 不存在");
        }
        Long skillId = ((Number) r.get("id")).longValue();
        String visibility = (String) r.get("visibility");
        String status = (String) r.get("status");
        Long teamId = toLong(r.get("team_id"));
        Long authorId = toLong(r.get("author_id"));

        if ("TEAM_PRIVATE".equals(visibility)) {
            if (currentUserId == null) {
                throw new BusinessException(40300, "需要登录后访问私有 Skill");
            }
            if (!isTeamMemberOrAuthor(teamId, authorId, currentUserId)) {
                throw new BusinessException(40300, "无权访问该私有 Skill");
            }
        } else {
            // PUBLIC：默认只能看 APPROVED/UNLISTED；其它状态需作者或团队成员。
            if (!VIEWABLE_PUBLIC_STATUS.contains(status)) {
                if (currentUserId == null || !isTeamMemberOrAuthor(teamId, authorId, currentUserId)) {
                    throw new BusinessException(40400, "Skill 不存在");
                }
            }
        }

        List<String> tags = skillTagMapper.selectTagNamesBySkill(skillId);
        List<String> langs = parseLangs((String) r.get("langs"));

        LocalDateTime publishedAt = toDateTime(r.get("published_at"));
        LocalDateTime updatedAt = toDateTime(r.get("updated_at"));

        String currentVersion = (String) r.get("version");
        SkillVersion currentVersionRow = (currentVersion == null || skillVersionService == null)
                ? null
                : skillVersionService.findBySkillAndVersion(skillId, currentVersion);
        Integer filesCount = currentVersionRow == null ? null : currentVersionRow.getFilesCount();

        return SkillDetail.builder()
                .id(skillId)
                .slug((String) r.get("slug"))
                .name((String) r.get("name"))
                .shortDesc((String) r.get("short_desc"))
                .descriptionMd((String) r.get("description_md"))
                .cat((String) r.get("cat_code"))
                .catName((String) r.get("cat_name"))
                .icon((String) r.get("icon"))
                .iconUrl(storageUrlResolver.resolveSingle((String) r.get("icon_url")))
                .version((String) r.get("version"))
                .visibility(visibility)
                .status(status)
                .installs(toInt(r.get("installs")))
                .stars(toInt(r.get("stars")))
                .score(toDecimal(r.get("score")))
                .safety((String) r.get("safety"))
                .evalScore(toInt(r.get("eval_score")))
                .updated(publishedAt != null ? publishedAt.format(D)
                        : (updatedAt != null ? updatedAt.format(D) : null))
                .publishedAt(publishedAt != null ? publishedAt.format(DT) : null)
                .tags(tags)
                .langs(langs)
                .author(SkillCard.AuthorRef.builder()
                        .id(authorId)
                        .name((String) r.get("author_name"))
                        .handle((String) r.get("author_handle"))
                        .build())
                .team(SkillDetail.TeamRef.builder()
                        .id(toLong(r.get("team_id")))
                        .slug((String) r.get("team_slug"))
                        .name((String) r.get("team_name"))
                        .avatar((String) r.get("team_avatar"))
                        .color((String) r.get("team_color"))
                        .members(toInt(r.get("team_members")))
                        .publicSkills(toInt(r.get("team_public_skills")))
                        .build())
                .filesCount(filesCount)
                .license("MIT")
                .build();
    }

    public Skill findById(Long id) {
        Skill s = skillMapper.selectById(id);
        if (s == null) throw new BusinessException(40400, "Skill 不存在");
        return s;
    }

    public Skill findBySlug(String slug) {
        Skill s = skillMapper.selectOne(Wrappers.<Skill>lambdaQuery().eq(Skill::getSlug, slug));
        if (s == null) throw new BusinessException(40400, "Skill 不存在");
        return s;
    }

    /** 用于下载/版本接口的可见性校验。 */
    public Skill requireReadable(String slug, Long currentUserId) {
        Skill s = findBySlug(slug);
        if ("TEAM_PRIVATE".equals(s.getVisibility())) {
            if (currentUserId == null) {
                throw new BusinessException(40300, "需要登录后访问私有 Skill");
            }
            if (!isTeamMemberOrAuthor(s.getTeamId(), s.getAuthorId(), currentUserId)) {
                throw new BusinessException(40300, "无权访问该私有 Skill");
            }
        } else if (!VIEWABLE_PUBLIC_STATUS.contains(s.getStatus())) {
            if (currentUserId == null || !isTeamMemberOrAuthor(s.getTeamId(), s.getAuthorId(), currentUserId)) {
                throw new BusinessException(40400, "Skill 不存在");
            }
        }
        return s;
    }

    private boolean isTeamMemberOrAuthor(Long teamId, Long authorId, Long userId) {
        if (userId == null) return false;
        if (authorId != null && authorId.equals(userId)) return true;
        try {
            teamAccessGuard.requireMember(teamId, userId);
            return true;
        } catch (BusinessException e) {
            return false;
        }
    }

    // ---------------- 创建 ----------------

    @Transactional
    public CreateSkillRes create(CreateSkillReq req, Long currentUserId) {
        // 必须是目标团队的成员才能向团队投递 Skill（SKILL-CRT-002）
        teamAccessGuard.requireMember(req.getTeamId(), currentUserId);

        // 分类必须真实存在,且不能是 "all" 这种聚合占位
        String cat = req.getCat() == null ? "" : req.getCat().trim();
        if (cat.isEmpty() || "all".equalsIgnoreCase(cat)) {
            throw new BusinessException(40000, "请选择有效分类");
        }
        if (categoryService.findByCode(cat) == null) {
            throw new BusinessException(40000, "分类不存在: " + cat);
        }

        // 标签数量上限
        if (req.getTags() != null && req.getTags().size() > MAX_TAGS) {
            throw new BusinessException(40000, "标签最多 " + MAX_TAGS + " 个");
        }

        // 团队若设置为 DIRECT_PUBLISH，非草稿提交直接发布，跳过审核流程。
        Team team = teamService.requireTeam(req.getTeamId());
        boolean draft = isDraft(req);
        boolean directPublish = !draft && "DIRECT_PUBLISH".equals(team.getReviewMode());

        // 新流程：DIRECT_PUBLISH 走老路径；其余（REVIEW 模式 / 草稿）只写 reviews 行。
        if (reviewFirstSubmit && !directPublish) {
            return createReviewFirst(req, currentUserId, draft);
        }
        return createDirect(req, currentUserId, draft, directPublish);
    }

    /**
     * 老路径 / DIRECT_PUBLISH 路径：直接写 skills 表 + 初始 skill_versions + skill_tag，
     * 并在 REVIEW 模式下补一条镜像 reviews 行（仅当 reviewFirstSubmit=false 时才会用于审核模式）。
     */
    private CreateSkillRes createDirect(CreateSkillReq req, Long currentUserId, boolean draft, boolean directPublish) {
        checkSkillSlugUnique(req.getSlug(), null);
        // 同 slug 的 soft-deleted 旧行也会撞 uk_skills_slug，物化前先回收。
        purgeStaleSlug(req.getSlug());

        Skill s = new Skill();
        s.setSlug(req.getSlug());
        s.setName(req.getName());
        s.setShortDesc(req.getShortDesc());
        s.setDescriptionMd(req.getDescriptionMd());
        s.setCatCode(req.getCat());
        s.setIcon(req.getIcon() != null ? req.getIcon() : pickIcon(req.getName()));
        s.setIconUrl(blankToNull(req.getIconKey()));
        s.setVersion(req.getVersion());
        s.setVisibility(req.getVisibility());
        s.setStatus(draft ? "DRAFT" : (directPublish ? "APPROVED" : "PENDING_REVIEW"));
        s.setAuthorId(currentUserId);
        s.setTeamId(req.getTeamId());
        s.setInstalls(0);
        s.setStars(0);
        s.setScore(BigDecimal.ZERO);
        s.setSafety("pass");
        s.setEvalScore(0);
        s.setLangs(langsToJson(req.getLangs()));
        s.setPublishedAt(directPublish ? LocalDateTime.now() : null);
        skillMapper.insert(s);

        if (req.getTags() != null) {
            for (String name : req.getTags()) {
                if (name == null || name.isBlank()) continue;
                Long tagId = ensureTag(name.trim());
                SkillTag st = new SkillTag();
                st.setSkillId(s.getId());
                st.setTagId(tagId);
                try {
                    skillTagMapper.insert(st);
                } catch (Exception ignore) {
                    // 唯一键冲突忽略
                }
            }
        }

        int filesCount = req.getFileCount() != null
                ? Math.max(0, req.getFileCount())
                : (req.getFiles() == null ? 0 : req.getFiles().size());
        SkillVersion initialVersion = skillVersionService.insertInitialVersion(
                s.getId(), req.getVersion(), filesCount, "pass", 0, req.getZipUrl());
        if (initialVersion != null && skillVersionFileService != null) {
            skillVersionFileService.materializeQuietly(initialVersion.getId(), req.getZipUrl());
        }
        Long reviewId = null;
        if ("PENDING_REVIEW".equals(s.getStatus())) {
            reviewId = createReview(s, currentUserId, filesCount, req.getZipUrl());
        }

        return CreateSkillRes.builder()
                .id(s.getId())
                .slug(s.getSlug())
                .status(s.getStatus())
                .pendingReview("PENDING_REVIEW".equals(s.getStatus()))
                .reviewId(reviewId)
                .build();
    }

    /**
     * Review-first 路径：仅插入 reviews 行（kind='CREATE'），不写 skills；approve 时再物化。
     * draft=true → DRAFT；draft=false → PENDING_REVIEW（submitted_at=now）。
     */
    private CreateSkillRes createReviewFirst(CreateSkillReq req, Long currentUserId, boolean draft) {
        // 同步校验 skills 表和 reviews 开放期，避免决策期间发现冲突
        checkSlugUniqueForReview(req.getSlug(), null);

        Review r = new Review();
        r.setCode(nextReviewCode());
        r.setSkillId(null);
        r.setSkillSlug(req.getSlug());
        r.setSkillName(req.getName().startsWith("Skill") ? req.getName() : "Skill · " + req.getName());
        r.setShortDesc(req.getShortDesc());
        r.setDescriptionMd(req.getDescriptionMd());
        r.setCatCode(req.getCat());
        r.setIcon(req.getIcon() != null ? req.getIcon() : pickIcon(req.getName()));
        r.setIconUrl(blankToNull(req.getIconKey()));
        r.setLangsJson(langsToJson(req.getLangs()));
        r.setTagsJson(tagsToJson(req.getTags()));
        r.setKind("CREATE");
        r.setTeamId(req.getTeamId());
        r.setSubmitterId(currentUserId);
        r.setVisibility(req.getVisibility());
        int filesCount = req.getFileCount() != null
                ? Math.max(0, req.getFileCount())
                : (req.getFiles() == null ? 0 : req.getFiles().size());
        r.setFilesCount(filesCount);
        r.setVersion(req.getVersion());
        r.setSafety("pass");
        r.setEvalScore(0);
        r.setStatus(draft ? "DRAFT" : "PENDING_REVIEW");
        r.setZipUrl(req.getZipUrl() == null || req.getZipUrl().isBlank() ? null : req.getZipUrl().trim());
        r.setSubmittedAt(draft ? null : LocalDateTime.now());
        reviewMapper.insert(r);

        if (!draft) {
            reviewService.notifyReviewSubmitted(r, currentUserId);
        }

        return CreateSkillRes.builder()
                .id(null)
                .slug(req.getSlug())
                .status(r.getStatus())
                .pendingReview("PENDING_REVIEW".equals(r.getStatus()))
                .reviewId(r.getId())
                .build();
    }

    /**
     * 校验 slug 是否被 skills 表（任何活跃行）占用。
     */
    void checkSkillSlugUnique(String slug, Long excludeSkillId) {
        if (slug == null || slug.isBlank()) {
            throw new BusinessException(40000, "slug 不能为空");
        }
        Long exists = skillMapper.selectCount(
                Wrappers.<Skill>lambdaQuery()
                        .eq(Skill::getSlug, slug)
                        .ne(excludeSkillId != null, Skill::getId, excludeSkillId)
        );
        if (exists != null && exists > 0) {
            throw new BusinessException(40900, "slug 已被占用");
        }
    }

    /**
     * Submit / resubmit / approve 时使用：校验 slug 不被 skills 占用，
     * 也不被其他 kind='CREATE' 且处于开放期的 review 占用。
     */
    public void checkSlugUniqueForReview(String slug, Long excludeReviewId) {
        checkSkillSlugUnique(slug, null);
        long open = reviewMapper.countOpenReviewBySlug(slug, excludeReviewId);
        if (open > 0) {
            throw new BusinessException(40900, "slug 已被占用");
        }
    }

    /**
     * 物化 / 直发新 skill 行之前，清理同 slug 且从未发布过的 soft-deleted 旧行。
     *
     * <p>{@code uk_skills_slug} 只索引 slug 列，soft-delete 不释放该索引。MP 的 @TableLogic
     * 让业务层的存在性校验看不到这些行，但 INSERT 仍会撞唯一键（典型场景：V17 把所有
     * 未发布 skill 批量 soft-delete，遗留的 slug 占位会阻塞同 slug 的 review 物化）。</p>
     *
     * <p>只回收 status NOT IN ('APPROVED','UNLISTED') 的行——已发布资产即便被 soft-delete
     * 也保留下游历史，让冲突显式暴露。</p>
     */
    public void purgeStaleSlug(String slug) {
        if (slug == null || slug.isBlank()) return;
        List<Long> ids = skillMapper.findPurgeableSoftDeletedIdsBySlug(slug);
        if (ids.isEmpty()) return;
        skillMapper.hardDeleteVersionsBySkillIds(ids);
        skillMapper.hardDeleteTagsBySkillIds(ids);
        skillMapper.hardDeleteSkillsByIds(ids);
    }

    public Long ensureTag(String name) {
        Tag exist = tagMapper.selectOne(Wrappers.<Tag>lambdaQuery().eq(Tag::getName, name));
        if (exist != null) return exist.getId();
        Tag t = new Tag();
        t.setName(name);
        tagMapper.insert(t);
        return t.getId();
    }

    private boolean isDraft(CreateSkillReq req) {
        return Boolean.TRUE.equals(req.getDraft());
    }

    private Long createReview(Skill s, Long submitterId, int filesCount, String zipUrl) {
        Review r = new Review();
        r.setCode(nextReviewCode());
        r.setSkillId(s.getId());
        r.setSkillSlug(s.getSlug());
        r.setSkillName(s.getName().startsWith("Skill") ? s.getName() : "Skill · " + s.getName());
        r.setShortDesc(s.getShortDesc());
        r.setDescriptionMd(s.getDescriptionMd());
        r.setKind("CREATE");
        r.setTeamId(s.getTeamId());
        r.setSubmitterId(submitterId);
        r.setVisibility(s.getVisibility());
        r.setFilesCount(filesCount);
        r.setVersion(s.getVersion());
        r.setSafety(s.getSafety());
        r.setEvalScore(s.getEvalScore());
        r.setStatus("PENDING_REVIEW");
        r.setZipUrl(zipUrl == null || zipUrl.isBlank() ? null : zipUrl.trim());
        r.setSubmittedAt(LocalDateTime.now());
        reviewMapper.insert(r);
        return r.getId();
    }

    /**
     * 发新版本（SKILL-VER-001）：作者本人对一个已通过的 skill 提交新版本审核。
     *
     * <p>约束：</p>
     * <ul>
     *   <li>必须是 skill 作者本人；</li>
     *   <li>skill 当前状态必须是 APPROVED（已通过的才能升版本）；</li>
     *   <li>新版本号不能与当前相同；</li>
     *   <li>该 skill 不能存在未决的审核（PENDING_REVIEW / CHANGES_REQUESTED）。</li>
     * </ul>
     *
     * <p>审核通过后，{@link com.skillstack.review.service.ReviewService#approve}
     * 会同步把 skill.version 更新到新版本并写一条 skill_versions 历史行。</p>
     */
    @Transactional
    public CreateSkillRes submitVersion(Long skillId, Long userId, String newVersion, String changelog, String zipUrl) {
        if (newVersion == null || newVersion.isBlank()) {
            throw new BusinessException(40000, "新版本号不能为空");
        }
        if (zipUrl == null || zipUrl.isBlank()) {
            throw new BusinessException(40000, "请先上传新版本源文件");
        }
        Skill s = skillMapper.selectById(skillId);
        if (s == null) {
            throw new BusinessException(40400, "Skill 不存在");
        }
        boolean isWriter = isWriter(s.getTeamId(), userId);
        if (!isWriter) {
            if (userId == null || !userId.equals(s.getAuthorId())) {
                throw new BusinessException(40300, "只有作者或团队管理员可以为该 Skill 发新版本");
            }
            try {
                teamAccessGuard.requireMember(s.getTeamId(), userId);
            } catch (BusinessException e) {
                throw new BusinessException(40300, "无权为该 Skill 发新版本");
            }
        }
        if (!ADMIN_STATUSES.contains(s.getStatus())) {
            throw new BusinessException(40900, "只有已上线的 Skill 可以发新版本");
        }
        String version = newVersion.trim();
        if (version.equals(s.getVersion())) {
            throw new BusinessException(40900, "新版本号与当前版本相同");
        }
        long open = reviewMapper.countOpenBySkill(skillId);
        if (open > 0) {
            throw new BusinessException(40900, "该 Skill 当前有未决审核，请先处理后再发新版本");
        }

        String storageKey = zipUrl.trim();
        Team team = teamService.requireTeam(s.getTeamId());
        boolean directPublish = isWriter || "DIRECT_PUBLISH".equals(team.getReviewMode());
        if (directPublish) {
            return publishVersionDirectly(s, version, changelog, storageKey);
        }

        Review r = new Review();
        r.setCode(nextReviewCode());
        r.setSkillId(s.getId());
        r.setSkillSlug(s.getSlug());
        r.setSkillName(s.getName().startsWith("Skill") ? s.getName() : "Skill · " + s.getName());
        r.setShortDesc(s.getShortDesc());
        r.setKind("VERSION_BUMP");
        r.setTeamId(s.getTeamId());
        r.setSubmitterId(userId);
        r.setVisibility(s.getVisibility());
        r.setFilesCount(0);
        r.setVersion(version);
        r.setSafety(s.getSafety() == null ? "pass" : s.getSafety());
        r.setEvalScore(s.getEvalScore() == null ? 0 : s.getEvalScore());
        r.setStatus("PENDING_REVIEW");
        r.setChangelog(changelog == null ? null : changelog.trim());
        r.setZipUrl(storageKey);
        r.setSubmittedAt(LocalDateTime.now());
        reviewMapper.insert(r);

        return CreateSkillRes.builder()
                .id(s.getId())
                .slug(s.getSlug())
                .status("PENDING_REVIEW")
                .pendingReview(true)
                .build();
    }

    private boolean isWriter(Long teamId, Long userId) {
        if (teamId == null || userId == null) return false;
        try {
            teamAccessGuard.requireWriter(teamId, userId);
            return true;
        } catch (BusinessException e) {
            return false;
        }
    }

    private CreateSkillRes publishVersionDirectly(Skill s, String version, String changelog, String zipUrl) {
        String storageKey = zipUrl == null || zipUrl.isBlank() ? null : zipUrl.trim();
        SkillVersion v = skillVersionService.insertVersion(
                s.getId(),
                version,
                changelog == null ? null : changelog.trim(),
                0,
                s.getSafety() == null ? "pass" : s.getSafety(),
                s.getEvalScore() == null ? 0 : s.getEvalScore(),
                storageKey
        );
        if (v != null && skillVersionFileService != null) {
            skillVersionFileService.materializeQuietly(v.getId(), storageKey);
        }
        s.setVersion(version);
        skillMapper.updateById(s);
        return CreateSkillRes.builder()
                .id(s.getId())
                .slug(s.getSlug())
                .status(s.getStatus())
                .pendingReview(false)
                .build();
    }

    private String nextReviewCode() {
        return "r-" + (System.currentTimeMillis() % 100000) + "-" + ThreadLocalRandom.current().nextInt(100, 999);
    }

    // ---------------- 安装 / 收藏 ----------------

    public InstallRes install(Long id) {
        Skill s = findById(id);
        skillMapper.incrInstalls(id);
        return InstallRes.builder().id(id).installs(s.getInstalls() + 1).build();
    }

    /**
     * 幂等收藏（SKILL-ACT-001/002）：
     *  - add=true 但当前用户已 star → no-op；
     *  - add=false 但当前用户从未 star → no-op；
     *  - 总数变化与 skill_stars 真实 insert/delete 行数挂钩，避免负数和重复计数。
     */
    @Transactional
    public int star(Long skillId, Long userId, boolean add) {
        if (userId == null) {
            throw new BusinessException(40100, "请先登录");
        }
        Skill s = findById(skillId);
        boolean already = skillStarMapper.exists(
                Wrappers.<SkillStar>lambdaQuery()
                        .eq(SkillStar::getUserId, userId)
                        .eq(SkillStar::getSkillId, skillId));
        int delta = 0;
        if (add && !already) {
            SkillStar row = new SkillStar();
            row.setUserId(userId);
            row.setSkillId(skillId);
            try {
                skillStarMapper.insert(row);
                delta = 1;
            } catch (DuplicateKeyException ignore) {
                // 并发情况下唯一键冲突，忽略
            }
        } else if (!add && already) {
            int affected = skillStarMapper.delete(
                    Wrappers.<SkillStar>lambdaQuery()
                            .eq(SkillStar::getUserId, userId)
                            .eq(SkillStar::getSkillId, skillId));
            delta = affected > 0 ? -1 : 0;
        }
        if (delta != 0) {
            skillMapper.incrStars(skillId, delta);
        }
        int current = (s.getStars() == null ? 0 : s.getStars()) + delta;
        return Math.max(0, current);
    }

    public boolean isStarredByUser(Long skillId, Long userId) {
        if (userId == null) return false;
        return skillStarMapper.exists(Wrappers.<SkillStar>lambdaQuery()
                .eq(SkillStar::getUserId, userId)
                .eq(SkillStar::getSkillId, skillId));
    }

    // ---------------- 管理员写操作（SKILL-ADM-001 ~ 004） ----------------

    private static final Set<String> ADMIN_STATUSES = Set.of("APPROVED", "UNLISTED");
    private static final Set<String> ADMIN_VISIBILITIES = Set.of("PUBLIC", "TEAM_PRIVATE");

    @Transactional
    public void updateVisibility(Long skillId, String visibility, Long operatorId) {
        if (visibility == null || !ADMIN_VISIBILITIES.contains(visibility)) {
            throw new BusinessException(40000, "可见性取值非法");
        }
        Skill s = findById(skillId);
        teamAccessGuard.requireWriter(s.getTeamId(), operatorId);
        s.setVisibility(visibility);
        skillMapper.updateById(s);
    }

    /**
     * 上下架：只允许 APPROVED ↔ UNLISTED；DRAFT / PENDING_REVIEW / REJECTED 走审核流程。
     */
    @Transactional
    public void updateStatus(Long skillId, String status, Long operatorId) {
        if (status == null || !ADMIN_STATUSES.contains(status)) {
            throw new BusinessException(40000, "状态只允许 APPROVED 或 UNLISTED");
        }
        Skill s = findById(skillId);
        teamAccessGuard.requireWriter(s.getTeamId(), operatorId);
        if (!ADMIN_STATUSES.contains(s.getStatus())) {
            throw new BusinessException(40900, "当前状态不支持上下架，请先完成审核");
        }
        s.setStatus(status);
        skillMapper.updateById(s);
    }

    /**
     * 转移作者：新作者必须是同团队成员；操作者必须是团队 OWNER/ADMIN。
     */
    @Transactional
    public void transferOwner(Long skillId, Long newOwnerId, Long operatorId) {
        if (newOwnerId == null) {
            throw new BusinessException(40000, "新作者 ID 不能为空");
        }
        Skill s = findById(skillId);
        teamAccessGuard.requireWriter(s.getTeamId(), operatorId);
        // 新作者必须是该团队成员（不强制要求 writer 角色）
        try {
            teamAccessGuard.requireMember(s.getTeamId(), newOwnerId);
        } catch (BusinessException e) {
            throw new BusinessException(40900, "新作者必须是该团队成员");
        }
        s.setAuthorId(newOwnerId);
        skillMapper.updateById(s);
    }

    /** 软删除：MyBatis Plus 通过 deleted 字段。 */
    @Transactional
    public void softDelete(Long skillId, Long operatorId) {
        Skill s = findById(skillId);
        teamAccessGuard.requireWriter(s.getTeamId(), operatorId);
        skillMapper.deleteById(skillId);
    }

    @Transactional
    public void updateAdminProfile(Long skillId, AdminSkillProfileUpdateReq req, Long operatorId) {
        if (req == null) {
            throw new BusinessException(40000, "请求不能为空");
        }
        Skill s = findById(skillId);
        teamAccessGuard.requireWriter(s.getTeamId(), operatorId);
        if (!ADMIN_STATUSES.contains(s.getStatus())) {
            throw new BusinessException(40900, "只能编辑已上线 Skill");
        }
        String name = cleanRequired(req.getName(), "名称", 80);
        String shortDesc = cleanRequired(req.getShortDesc(), "描述", 200);
        String cat = cleanRequired(req.getCat(), "分类", 64);
        if (categoryService.findByCode(cat) == null) {
            throw new BusinessException(40000, "分类不存在: " + cat);
        }
        String visibility = req.getVisibility() == null ? s.getVisibility() : req.getVisibility().trim();
        if (!ADMIN_VISIBILITIES.contains(visibility)) {
            throw new BusinessException(40000, "可见性取值非法");
        }
        String icon = req.getIcon() == null ? null : req.getIcon().trim();
        if (icon != null && icon.length() > 8) {
            throw new BusinessException(40000, "图标最多 8 个字符");
        }
        List<String> tags = normalizeTags(req.getTags());

        s.setName(name);
        s.setShortDesc(shortDesc);
        s.setCatCode(cat);
        s.setIcon(icon == null || icon.isBlank() ? pickIcon(name) : icon);
        applyIconKey(s, req.getIconKey());
        s.setVisibility(visibility);
        skillMapper.updateById(s);

        skillTagMapper.delete(Wrappers.<SkillTag>lambdaQuery().eq(SkillTag::getSkillId, skillId));
        for (String tag : tags) {
            Long tagId = ensureTag(tag);
            SkillTag st = new SkillTag();
            st.setSkillId(skillId);
            st.setTagId(tagId);
            try {
                skillTagMapper.insert(st);
            } catch (Exception ignore) {
                // 唯一键冲突忽略
            }
        }
    }

    private static String cleanRequired(String value, String label, int max) {
        String v = value == null ? "" : value.trim();
        if (v.isEmpty()) {
            throw new BusinessException(40000, label + "不能为空");
        }
        if (v.length() > max) {
            throw new BusinessException(40000, label + "最多 " + max + " 个字符");
        }
        return v;
    }

    private static List<String> normalizeTags(List<String> raw) {
        if (raw == null) return List.of();
        LinkedHashSet<String> out = new LinkedHashSet<>();
        for (String item : raw) {
            if (item == null) continue;
            String tag = item.trim();
            if (tag.isEmpty()) continue;
            if (tag.length() > 32) {
                throw new BusinessException(40000, "标签最多 32 个字符");
            }
            out.add(tag);
            if (out.size() > MAX_TAGS) {
                throw new BusinessException(40000, "标签最多 " + MAX_TAGS + " 个");
            }
        }
        return new ArrayList<>(out);
    }

    // ---------------- 内部转换 ----------------

    private SkillCard toCard(Map<String, Object> r) {
        Long id = toLong(r.get("id"));
        List<String> tags = skillTagMapper.selectTagNamesBySkill(id);
        List<String> langs = parseLangs((String) r.get("langs"));
        LocalDateTime publishedAt = toDateTime(r.get("published_at"));
        return SkillCard.builder()
                .id(id)
                .slug((String) r.get("slug"))
                .name((String) r.get("name"))
                .shortDesc((String) r.get("short_desc"))
                .cat((String) r.get("cat_code"))
                .icon((String) r.get("icon"))
                .iconUrl(storageUrlResolver.resolveSingle((String) r.get("icon_url")))
                .installs(toInt(r.get("installs")))
                .stars(toInt(r.get("stars")))
                .score(toDecimal(r.get("score")))
                .version((String) r.get("version"))
                .updated(publishedAt != null ? publishedAt.format(D) : null)
                .visibility((String) r.get("visibility"))
                .status((String) r.get("status"))
                .team((String) r.get("team_slug"))
                .safety((String) r.get("safety"))
                .evalScore(toInt(r.get("eval_score")))
                .langs(langs)
                .tags(tags)
                .author(SkillCard.AuthorRef.builder()
                        .id(toLong(r.get("author_id")))
                        .name((String) r.get("author_name"))
                        .handle((String) r.get("author_handle"))
                        .build())
                .build();
    }

    private static List<String> parseLangs(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return OM.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    private static String langsToJson(List<String> langs) {
        if (langs == null || langs.isEmpty()) return "[]";
        try {
            return OM.writeValueAsString(new HashSet<>(langs));
        } catch (Exception e) {
            return "[]";
        }
    }

    public static String tagsToJson(List<String> tags) {
        if (tags == null || tags.isEmpty()) return "[]";
        List<String> clean = new ArrayList<>();
        for (String t : tags) {
            if (t == null) continue;
            String v = t.trim();
            if (v.isEmpty()) continue;
            if (!clean.contains(v)) clean.add(v);
        }
        try {
            return OM.writeValueAsString(clean);
        } catch (Exception e) {
            return "[]";
        }
    }

    public static List<String> parseTagsJson(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return OM.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    private static Integer toInt(Object o) {
        if (o == null) return null;
        if (o instanceof Number n) return n.intValue();
        return Integer.parseInt(o.toString());
    }

    private static Long toLong(Object o) {
        if (o == null) return null;
        if (o instanceof Number n) return n.longValue();
        return Long.parseLong(o.toString());
    }

    private static BigDecimal toDecimal(Object o) {
        if (o == null) return null;
        if (o instanceof BigDecimal bd) return bd;
        if (o instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        return new BigDecimal(o.toString());
    }

    private static LocalDateTime toDateTime(Object o) {
        if (o == null) return null;
        if (o instanceof LocalDateTime dt) return dt;
        if (o instanceof java.sql.Timestamp ts) return ts.toLocalDateTime();
        if (o instanceof java.util.Date d) {
            return LocalDateTime.ofInstant(d.toInstant(), java.time.ZoneId.systemDefault());
        }
        return null;
    }

    private static String pickIcon(String name) {
        if (name == null || name.isBlank()) return "S";
        return name.substring(0, 1).toUpperCase();
    }

    /** 空白字符串归一成 null，避免往 icon_url 落入空串。 */
    static String blankToNull(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }

    /**
     * 编辑场景应用图标 key：iconKey==null 表示不变；""（空白）表示清除；非空表示替换。
     * 替换/清除时删除旧的上传文件，避免存储泄漏（仅当旧值是我们自己的 storage key）。
     */
    private void applyIconKey(Skill s, String iconKey) {
        if (iconKey == null) return;
        String next = blankToNull(iconKey);
        String old = s.getIconUrl();
        if (java.util.Objects.equals(old, next)) return;
        s.setIconUrl(next);
        deleteIfStorageKey(old);
    }

    /** 仅当值看起来是 storage key（非完整 URL / 非 / 开头）时才删除。 */
    private void deleteIfStorageKey(String value) {
        if (value == null || value.isBlank()) return;
        String v = value.trim();
        if (v.startsWith("http://") || v.startsWith("https://") || v.startsWith("/")) return;
        storageService.delete(v);
    }
}
