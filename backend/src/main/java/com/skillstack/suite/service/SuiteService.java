package com.skillstack.suite.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.TeamAccessGuard;
import com.skillstack.common.storage.StorageUrlResolver;
import com.skillstack.common.web.PageQuery;
import com.skillstack.common.web.PageResult;
import com.skillstack.notification.service.NotificationService;
import com.skillstack.notification.service.NotificationType;
import com.skillstack.suite.dto.CreateSuiteReq;
import com.skillstack.suite.dto.SkillInSuite;
import com.skillstack.suite.dto.SuiteAssetItem;
import com.skillstack.suite.dto.SuiteDetail;
import com.skillstack.suite.dto.SuiteListItem;
import com.skillstack.suite.dto.UpdateSuiteItemsReq;
import com.skillstack.suite.entity.Suite;
import com.skillstack.suite.entity.SuiteItem;
import com.skillstack.suite.mapper.SuiteItemMapper;
import com.skillstack.suite.mapper.SuiteMapper;
import com.skillstack.team.mapper.TeamMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Suite (skill collection) 领域服务。
 *
 * <p>权限边界（SUITE-020/021/022/023）：</p>
 * <ul>
 *   <li>读：成员可读全量；非成员仅 PUBLIC suite；</li>
 *   <li>写：OWNER/ADMIN；</li>
 *   <li>定位：detail 始终按 (team_id, slug)。</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class SuiteService {

    private final SuiteMapper suiteMapper;
    private final SuiteItemMapper suiteItemMapper;
    private final JdbcTemplate jdbc;
    private final TeamAccessGuard guard;
    private final NotificationService notificationService;
    private final TeamMapper teamMapper;
    private final StorageUrlResolver storageUrlResolver;

    // ------------------------------------------------------------
    // 列表
    // ------------------------------------------------------------
    public PageResult<SuiteListItem> listByTeam(Long teamId, String visibility, PageQuery pq, Long currentUserId) {
        boolean isMember = isMemberSafe(teamId, currentUserId);
        if (!isMember) {
            ensurePublicHomeOpen(teamId);
        }
        Page<Suite> page = Page.of(pq.getPage(), pq.getSize());
        QueryWrapper<Suite> qw = new QueryWrapper<>();
        qw.eq("team_id", teamId);
        if (!isMember) {
            // 非成员仅能看 PUBLIC（SUITE-020）
            qw.eq("visibility", "PUBLIC");
        } else if (visibility != null && !visibility.isBlank()) {
            qw.eq("visibility", visibility);
        }
        qw.orderByDesc("updated_at");
        IPage<Suite> p = suiteMapper.selectPage(page, qw);
        List<SuiteListItem> items = new ArrayList<>();
        for (Suite s : p.getRecords()) {
            items.add(toListItem(s));
        }
        return PageResult.of(items, p.getTotal(), p.getCurrent(), p.getSize());
    }

    // ------------------------------------------------------------
    // 详情 — 必须按 (team, slug) 双键
    // ------------------------------------------------------------
    public SuiteDetail getByTeamAndSlug(Long teamId, String slug, Long currentUserId) {
        if (teamId == null) {
            throw new BusinessException(40000, "缺少 teamId 参数（套件需要团队上下文）");
        }
        boolean isMember = isMemberSafe(teamId, currentUserId);
        if (!isMember) {
            ensurePublicHomeOpen(teamId);
        }
        QueryWrapper<Suite> qw = new QueryWrapper<>();
        qw.eq("team_id", teamId).eq("slug", slug).last("LIMIT 1");
        Suite s = suiteMapper.selectOne(qw);
        if (s == null) {
            throw new BusinessException(40400, "套件不存在");
        }
        if ("TEAM_PRIVATE".equals(s.getVisibility()) && !isMember) {
            throw new BusinessException(40300, "无权访问该私有套件");
        }
        return loadDetail(s, currentUserId);
    }

    private SuiteDetail loadDetail(Suite s, Long currentUserId) {
        SuiteDetail d = new SuiteDetail();
        d.setId(s.getId());
        d.setSlug(s.getSlug());
        d.setName(s.getName());
        d.setDesc(s.getDescription());
        d.setTeamId(s.getTeamId());
        d.setVisibility(s.getVisibility());
        d.setInstalls(s.getInstalls());
        d.setSkillsCount(s.getSkillsCount());
        d.setUpdatedAt(s.getUpdatedAt());

        Map<String, Object> team = jdbc.queryForMap(
                "SELECT slug, name FROM teams WHERE id = ? AND deleted = 0", s.getTeamId());
        d.setTeamSlug((String) team.get("slug"));
        d.setTeamName((String) team.get("name"));

        boolean isMember = isMemberSafe(s.getTeamId(), currentUserId);
        d.setItems(loadItemsInSuite(s.getId(), isMember));
        d.setSkills(loadSkillsInSuite(s.getId(), isMember));
        if (!isMember) {
            // 非成员只能感知公开 skill 数量
            d.setSkillsCount(d.getSkills().size());
        }
        return d;
    }

    private List<SuiteAssetItem> loadItemsInSuite(Long suiteId, boolean includePrivate) {
        List<SuiteAssetItem> out = new ArrayList<>();
        StringBuilder skillSql = new StringBuilder()
                .append("SELECT 'SKILL' AS type, COALESCE(si.item_id, si.skill_id) AS id, si.position, ")
                .append("       sk.slug, sk.name, sk.short_desc, sk.cat_code, sk.icon, sk.icon_url, sk.version, ")
                .append("       sk.visibility, sk.installs, sk.stars, NULL AS exports ")
                .append("FROM suite_items si ")
                .append("JOIN skills sk ON sk.id = COALESCE(si.item_id, si.skill_id) AND sk.deleted = 0 ")
                .append("WHERE si.suite_id = ? AND si.deleted = 0 AND COALESCE(si.item_type, 'SKILL') = 'SKILL' ");
        if (!includePrivate) {
            skillSql.append(" AND sk.visibility = 'PUBLIC' AND sk.status = 'APPROVED' ");
        }
        out.addAll(jdbc.query(skillSql.toString(), (rs, i) -> {
            SuiteAssetItem item = new SuiteAssetItem();
            item.setType(rs.getString("type"));
            item.setId(rs.getLong("id"));
            item.setSlug(rs.getString("slug"));
            item.setName(rs.getString("name"));
            item.setShortDesc(rs.getString("short_desc"));
            item.setCatCode(rs.getString("cat_code"));
            item.setIcon(rs.getString("icon"));
            item.setIconUrl(storageUrlResolver.resolveSingle(rs.getString("icon_url")));
            item.setVersion(rs.getString("version"));
            item.setVisibility(rs.getString("visibility"));
            item.setInstalls(rs.getInt("installs"));
            item.setStars(rs.getInt("stars"));
            item.setExports(null);
            item.setPosition(rs.getInt("position"));
            return item;
        }, suiteId));

        StringBuilder promptSql = new StringBuilder()
                .append("SELECT 'PROMPT' AS type, si.item_id AS id, si.position, ")
                .append("       p.slug, p.name, p.short_desc, p.cat_code, p.version, ")
                .append("       p.visibility, NULL AS installs, p.stars, p.exports ")
                .append("FROM suite_items si ")
                .append("JOIN prompts p ON p.id = si.item_id AND p.deleted = 0 ")
                .append("WHERE si.suite_id = ? AND si.deleted = 0 AND si.item_type = 'PROMPT' ");
        if (!includePrivate) {
            promptSql.append(" AND p.visibility = 'PUBLIC' AND p.status = 'APPROVED' ");
        }
        out.addAll(jdbc.query(promptSql.toString(), (rs, i) -> {
            SuiteAssetItem item = new SuiteAssetItem();
            item.setType(rs.getString("type"));
            item.setId(rs.getLong("id"));
            item.setSlug(rs.getString("slug"));
            item.setName(rs.getString("name"));
            item.setShortDesc(rs.getString("short_desc"));
            item.setCatCode(rs.getString("cat_code"));
            item.setVersion(rs.getString("version"));
            item.setVisibility(rs.getString("visibility"));
            item.setInstalls(null);
            item.setStars(rs.getInt("stars"));
            item.setExports(rs.getInt("exports"));
            item.setPosition(rs.getInt("position"));
            return item;
        }, suiteId));
        out.sort(java.util.Comparator.comparing(SuiteAssetItem::getPosition).thenComparing(SuiteAssetItem::getId));
        return out;
    }

    private List<SkillInSuite> loadSkillsInSuite(Long suiteId, boolean includePrivate) {
        StringBuilder sql = new StringBuilder()
                .append("SELECT si.skill_id, si.position, ")
                .append("       sk.slug, sk.name, sk.short_desc, sk.cat_code, sk.icon, sk.icon_url, sk.version, ")
                .append("       sk.visibility, sk.status, sk.installs, sk.stars ")
                .append("FROM suite_items si ")
                .append("JOIN skills sk ON sk.id = si.skill_id AND sk.deleted = 0 ")
                .append("WHERE si.suite_id = ? AND si.deleted = 0 ");
        if (!includePrivate) {
            sql.append("  AND sk.visibility = 'PUBLIC' AND sk.status = 'APPROVED' ");
        }
        sql.append("ORDER BY si.position ASC, si.id ASC");
        return jdbc.query(sql.toString(), (rs, i) -> {
            SkillInSuite x = new SkillInSuite();
            x.setId(rs.getLong("skill_id"));
            x.setSlug(rs.getString("slug"));
            x.setName(rs.getString("name"));
            x.setShortDesc(rs.getString("short_desc"));
            x.setCatCode(rs.getString("cat_code"));
            x.setIcon(rs.getString("icon"));
            x.setIconUrl(storageUrlResolver.resolveSingle(rs.getString("icon_url")));
            x.setVersion(rs.getString("version"));
            x.setVisibility(rs.getString("visibility"));
            x.setInstalls(rs.getInt("installs"));
            x.setStars(rs.getInt("stars"));
            x.setPosition(rs.getInt("position"));
            return x;
        }, suiteId);
    }

    // ------------------------------------------------------------
    // 创建
    // ------------------------------------------------------------
    @Transactional
    public SuiteDetail create(Long teamId, CreateSuiteReq req, Long currentUserId) {
        guard.requireWriter(teamId, currentUserId);
        QueryWrapper<Suite> exist = new QueryWrapper<>();
        exist.eq("team_id", teamId).eq("slug", req.getSlug());
        if (suiteMapper.exists(exist)) {
            throw new BusinessException(40900, "套件 slug 已存在");
        }

        List<UpdateSuiteItemsReq.Item> requestedItems = req.getItems() == null
                ? skillIdsToItems(req.getSkillIds())
                : req.getItems();
        List<UpdateSuiteItemsReq.Item> validatedItems = dedupeAndValidateItems(requestedItems, teamId);

        Suite s = new Suite();
        s.setSlug(req.getSlug());
        s.setName(req.getName());
        s.setDescription(req.getDescription());
        s.setTeamId(teamId);
        s.setVisibility(req.getVisibility() == null ? "TEAM_PRIVATE" : req.getVisibility());
        s.setInstalls(0);
        s.setSkillsCount((int) validatedItems.stream().filter(it -> "SKILL".equals(normalizeType(it.getType()))).count());
        suiteMapper.insert(s);

        int pos = 1;
        for (UpdateSuiteItemsReq.Item item : validatedItems) {
            SuiteItem it = new SuiteItem();
            it.setSuiteId(s.getId());
            it.setItemType(normalizeType(item.getType()));
            it.setItemId(effectiveItemId(item));
            if ("SKILL".equals(it.getItemType())) {
                it.setSkillId(it.getItemId());
            }
            it.setPosition(pos++);
            suiteItemMapper.insert(it);
        }
        bumpTeamSuitesCount(teamId, 1);
        notificationService.notifyTeamMembers(NotificationType.SUITE_PUBLISHED, teamId, currentUserId,
                "新的团队套件已发布：" + s.getName(),
                s.getDescription(),
                "/team/suites",
                "suite", s.getId(),
                teamMemberIds(teamId));
        return loadDetail(s, currentUserId);
    }

    // ------------------------------------------------------------
    // 更新 items
    // ------------------------------------------------------------
    @Transactional
    public SuiteDetail updateItems(Long suiteId, UpdateSuiteItemsReq req, Long currentUserId) {
        Suite s = requireSuite(suiteId);
        guard.requireWriter(s.getTeamId(), currentUserId);

        List<UpdateSuiteItemsReq.Item> rawItems = req.getItems() == null
                ? Collections.emptyList() : req.getItems();
        List<UpdateSuiteItemsReq.Item> items = dedupeAndValidateItems(rawItems, s.getTeamId());

        QueryWrapper<SuiteItem> del = new QueryWrapper<>();
        del.eq("suite_id", suiteId);
        suiteItemMapper.delete(del);

        int pos = 0;
        for (UpdateSuiteItemsReq.Item it : items) {
            SuiteItem row = new SuiteItem();
            row.setSuiteId(suiteId);
            row.setItemType(normalizeType(it.getType()));
            row.setItemId(effectiveItemId(it));
            if ("SKILL".equals(row.getItemType())) {
                row.setSkillId(row.getItemId());
            }
            // 拒绝非法 position（必须 >0）
            int position = it.getPosition() == null || it.getPosition() < 1 ? ++pos : it.getPosition();
            row.setPosition(position);
            suiteItemMapper.insert(row);
        }

        s.setSkillsCount((int) items.stream().filter(it -> "SKILL".equals(normalizeType(it.getType()))).count());
        s.setUpdatedAt(LocalDateTime.now());
        suiteMapper.updateById(s);
        notificationService.notifyTeamMembers(NotificationType.SUITE_UPDATED, s.getTeamId(), currentUserId,
                "团队套件已更新：" + s.getName(),
                null,
                "/team/suites",
                "suite", s.getId(),
                teamMemberIds(s.getTeamId()));
        return loadDetail(s, currentUserId);
    }

    // ------------------------------------------------------------
    // 删除
    // ------------------------------------------------------------
    @Transactional
    public void delete(Long suiteId, Long currentUserId) {
        Suite s = requireSuite(suiteId);
        guard.requireWriter(s.getTeamId(), currentUserId);
        QueryWrapper<SuiteItem> del = new QueryWrapper<>();
        del.eq("suite_id", suiteId);
        suiteItemMapper.delete(del);
        suiteMapper.deleteById(suiteId);
        bumpTeamSuitesCount(s.getTeamId(), -1);
    }

    // ------------------------------------------------------------
    // 安装计数（按 visibility / membership 校验）
    // ------------------------------------------------------------
    @Transactional
    public int install(Long suiteId, Long currentUserId) {
        Suite s = requireSuite(suiteId);
        if ("TEAM_PRIVATE".equals(s.getVisibility())) {
            guard.requireMember(s.getTeamId(), currentUserId);
        } else if (currentUserId == null) {
            throw new BusinessException(40100, "请先登录后再安装");
        }
        int next = (s.getInstalls() == null ? 0 : s.getInstalls()) + 1;
        s.setInstalls(next);
        suiteMapper.updateById(s);
        return next;
    }

    // ------------------------------------------------------------
    // helpers
    // ------------------------------------------------------------
    private java.util.List<Long> teamMemberIds(Long teamId) {
        java.util.List<com.skillstack.team.dto.TeamMemberRes> members =
                teamMapper.selectMembers(teamId, null, null, 0, 10000);
        java.util.List<Long> ids = new java.util.ArrayList<>(members.size());
        for (com.skillstack.team.dto.TeamMemberRes m : members) ids.add(m.getUserId());
        return ids;
    }

    private Suite requireSuite(Long suiteId) {
        Suite s = suiteMapper.selectById(suiteId);
        if (s == null) {
            throw new BusinessException(40400, "套件不存在");
        }
        return s;
    }

    private boolean isMemberSafe(Long teamId, Long userId) {
        if (userId == null || teamId == null) return false;
        try {
            guard.requireMember(teamId, userId);
            return true;
        } catch (BusinessException e) {
            return false;
        }
    }

    private void ensurePublicHomeOpen(Long teamId) {
        Map<String, Object> row;
        try {
            row = jdbc.queryForMap("SELECT public_home FROM teams WHERE id = ? AND deleted = 0", teamId);
        } catch (org.springframework.dao.EmptyResultDataAccessException e) {
            throw new BusinessException(40400, "团队不存在");
        }
        Object value = row.get("public_home");
        boolean open = value instanceof Boolean b ? b
                : value instanceof Number n ? n.intValue() != 0
                : Boolean.parseBoolean(String.valueOf(value));
        if (!open) {
            throw new BusinessException(40400, "团队不存在");
        }
    }

    /**
     * 去重 + 校验 skillId 必须属于当前 team（SUITE-007）。
     */
    private List<Long> dedupeAndValidate(List<Long> ids, Long teamId) {
        if (ids == null || ids.isEmpty()) return List.of();
        Set<Long> deduped = new LinkedHashSet<>(ids);
        deduped.removeIf(java.util.Objects::isNull);
        if (deduped.isEmpty()) return List.of();
        List<Long> idList = new ArrayList<>(deduped);
        // 查 skill team_id
        String placeholders = String.join(",", Collections.nCopies(idList.size(), "?"));
        Object[] args = idList.toArray();
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, team_id, visibility, status FROM skills WHERE deleted = 0 AND id IN (" + placeholders + ")",
                args);
        Set<Long> foundIds = new HashSet<>();
        for (Map<String, Object> row : rows) {
            Long id = ((Number) row.get("id")).longValue();
            Long skillTeam = row.get("team_id") == null ? null : ((Number) row.get("team_id")).longValue();
            if (skillTeam == null || !skillTeam.equals(teamId)) {
                throw new BusinessException(40000, "Skill #" + id + " 不属于当前团队，无法加入套件");
            }
            foundIds.add(id);
        }
        // 缺失项
        for (Long id : idList) {
            if (!foundIds.contains(id)) {
                throw new BusinessException(40400, "Skill #" + id + " 不存在或已删除");
            }
        }
        return idList;
    }

    private List<UpdateSuiteItemsReq.Item> skillIdsToItems(List<Long> skillIds) {
        if (skillIds == null || skillIds.isEmpty()) return List.of();
        List<UpdateSuiteItemsReq.Item> out = new ArrayList<>(skillIds.size());
        int pos = 1;
        for (Long skillId : skillIds) {
            UpdateSuiteItemsReq.Item item = new UpdateSuiteItemsReq.Item();
            item.setType("SKILL");
            item.setSkillId(skillId);
            item.setItemId(skillId);
            item.setPosition(pos++);
            out.add(item);
        }
        return out;
    }

    private List<UpdateSuiteItemsReq.Item> dedupeAndValidateItems(List<UpdateSuiteItemsReq.Item> rawItems,
                                                                  Long teamId) {
        if (rawItems == null || rawItems.isEmpty()) return List.of();
        List<UpdateSuiteItemsReq.Item> out = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (UpdateSuiteItemsReq.Item item : rawItems) {
            if (item == null) continue;
            String type = normalizeType(item.getType());
            Long id = effectiveItemId(item);
            if (id == null) continue;
            String key = type + ":" + id;
            if (!seen.add(key)) continue;
            validateItem(type, id, teamId);
            item.setType(type);
            item.setItemId(id);
            if ("SKILL".equals(type)) {
                item.setSkillId(id);
            }
            out.add(item);
        }
        return out;
    }

    private void validateItem(String type, Long id, Long teamId) {
        String table = "SKILL".equals(type) ? "skills" : "prompts";
        Map<String, Object> row;
        try {
            row = jdbc.queryForMap("SELECT id, team_id FROM " + table + " WHERE id = ? AND deleted = 0", id);
        } catch (org.springframework.dao.EmptyResultDataAccessException e) {
            throw new BusinessException(40400, type + " #" + id + " 不存在或已删除");
        }
        Long itemTeam = row.get("team_id") == null ? null : ((Number) row.get("team_id")).longValue();
        if (!teamId.equals(itemTeam)) {
            throw new BusinessException(40000, type + " #" + id + " 不属于当前团队，无法加入套件");
        }
    }

    private static String normalizeType(String type) {
        if (type == null || type.isBlank()) return "SKILL";
        String v = type.trim().toUpperCase();
        if (!"SKILL".equals(v) && !"PROMPT".equals(v)) {
            throw new BusinessException(40000, "套件资产类型必须是 SKILL 或 PROMPT");
        }
        return v;
    }

    private static Long effectiveItemId(UpdateSuiteItemsReq.Item item) {
        if (item == null) return null;
        String type = normalizeType(item.getType());
        if ("SKILL".equals(type) && item.getSkillId() != null) return item.getSkillId();
        return item.getItemId();
    }

    private SuiteListItem toListItem(Suite s) {
        SuiteListItem it = new SuiteListItem();
        it.setId(s.getId());
        it.setSlug(s.getSlug());
        it.setName(s.getName());
        it.setDesc(s.getDescription());
        it.setVisibility(s.getVisibility());
        it.setSkills(s.getSkillsCount() == null ? 0 : s.getSkillsCount());
        it.setInstalls(s.getInstalls() == null ? 0 : s.getInstalls());
        it.setUpdatedAt(s.getUpdatedAt());
        return it;
    }

    private void bumpTeamSuitesCount(Long teamId, int delta) {
        try {
            jdbc.update("UPDATE teams SET suites_count = GREATEST(0, suites_count + ?) WHERE id = ?",
                    delta, teamId);
        } catch (Exception ignore) {
            // 冗余字段,忽略
        }
    }
}
