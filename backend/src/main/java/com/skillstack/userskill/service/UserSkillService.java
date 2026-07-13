package com.skillstack.userskill.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.skill.dto.SkillCard;
import com.skillstack.skill.entity.Skill;
import com.skillstack.skill.entity.SkillVersion;
import com.skillstack.skill.service.SkillService;
import com.skillstack.skill.service.SkillVersionService;
import com.skillstack.team.service.TeamService;
import com.skillstack.userskill.dto.UserSkillImportReq;
import com.skillstack.userskill.dto.UserSkillItem;
import com.skillstack.userskill.dto.UserSkillSubscribeReq;
import com.skillstack.userskill.entity.UserSkill;
import com.skillstack.userskill.mapper.UserSkillMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class UserSkillService {

    private static final ObjectMapper OM = new ObjectMapper();

    private final UserSkillMapper userSkillMapper;
    private final SkillService skillService;
    private final SkillVersionService skillVersionService;
    private final TeamService teamService;


    public List<UserSkillItem> listMine(Long userId) {
        List<Map<String, Object>> rows = userSkillMapper.selectMineWithSkill(userId);
        List<UserSkillItem> items = new ArrayList<>(rows.size());
        for (Map<String, Object> row : rows) {
            items.add(toItem(row));
        }
        return items;
    }

    @Transactional
    public UserSkillItem importPersonal(Long userId, UserSkillImportReq req) {
        UserSkill existing = userSkillMapper.selectOneIncludeDeletedBySlug(userId, "PERSONAL", req.getSlug());
        UserSkill row = existing == null ? new UserSkill() : existing;
        boolean rebuildDeleted = isDeleted(existing);
        if (rebuildDeleted) {
            userSkillMapper.hardDeleteById(existing.getId());
            row = new UserSkill();
        }

        row.setUserId(userId);
        row.setSource("PERSONAL");
        if (row.getSkillId() == null) {
            row.setSkillId(0L);
        }
        if (row.getReviewId() == null) {
            row.setReviewId(0L);
        }
        row.setSlug(req.getSlug());
        row.setName(req.getName());
        row.setShortDesc(blankToEmpty(req.getShortDesc()));
        row.setCatCode(blankToEmpty(req.getCatCode()));
        row.setIcon(blankToEmpty(req.getIcon()));
        row.setVersion(req.getVersion());
        row.setZipUrl(req.getZipUrl());
        row.setFilesCount(req.getFilesCount() == null ? 0 : Math.max(0, req.getFilesCount()));
        row.setSafety("pass");
        row.setEvalScore(0);
        row.setLangs(toJsonArray(req.getLangs()));

        if (existing == null || rebuildDeleted) {
            userSkillMapper.insert(row);
        } else {
            userSkillMapper.updateById(row);
        }
        return findMineItem(userId, row.getId());
    }

    @Transactional
    public UserSkillItem subscribe(Long userId, UserSkillSubscribeReq req) {
        Skill skill = skillService.findById(req.getSkillId());
        String source = resolveSubscribeSource(userId, skill);
        if (!"APPROVED".equals(skill.getStatus())) {
            throw new BusinessException(40900, "只有已发布 Skill 可以添加");
        }
        if (!"PUBLIC".equals(skill.getVisibility()) && !"TEAM".equals(source)) {
            throw new BusinessException(40900, "只有公开上架 Skill 可以添加");
        }
        SkillVersion currentVersion = skillVersionService.findBySkillAndVersion(skill.getId(), skill.getVersion());
        if (currentVersion == null || currentVersion.getZipUrl() == null || currentVersion.getZipUrl().isBlank()) {
            throw new BusinessException(40900, "当前 Skill 版本缺少 zip 包");
        }

        UserSkill existing = userSkillMapper.selectOneIncludeDeletedBySkillId(userId, skill.getId());
        if (existing != null && !isDeleted(existing)) {
            return findMineItem(userId, existing.getId());
        }
        if (isDeleted(existing)) {
            userSkillMapper.hardDeleteById(existing.getId());
        }

        UserSkill row = new UserSkill();
        row.setUserId(userId);
        row.setSource(source);
        row.setSkillId(skill.getId());
        row.setReviewId(0L);
        row.setSlug(skill.getSlug());
        row.setName(skill.getName());
        row.setShortDesc(blankToEmpty(skill.getShortDesc()));
        row.setCatCode(blankToEmpty(skill.getCatCode()));
        row.setIcon(blankToEmpty(skill.getIcon()));
        row.setVersion(skill.getVersion());
        row.setZipUrl(currentVersion.getZipUrl().trim());
        row.setFilesCount(currentVersion.getFilesCount() == null ? 0 : Math.max(0, currentVersion.getFilesCount()));
        row.setSafety(skill.getSafety() == null ? "pass" : skill.getSafety());
        row.setEvalScore(skill.getEvalScore() == null ? 0 : skill.getEvalScore());
        row.setLangs(skill.getLangs() == null || skill.getLangs().isBlank() ? "[]" : skill.getLangs());
        userSkillMapper.insert(row);
        return findMineItem(userId, row.getId());
    }

    @Transactional
    public void deleteMine(Long userId, Long id) {
        UserSkill row = userSkillMapper.selectById(id);
        if (row == null || row.getDeleted() != null && row.getDeleted() == 1 || !userId.equals(row.getUserId())) {
            throw new BusinessException(40400, "用户 Skill 不存在");
        }
        userSkillMapper.deleteById(id);
    }

    public UserSkillItem findMineItem(Long userId, Long id) {
        List<UserSkillItem> items = listMine(userId);
        for (UserSkillItem item : items) {
            if (id.equals(item.getId())) {
                return item;
            }
        }
        throw new BusinessException(40400, "用户 Skill 不存在");
    }

    public int backfillPublishedSkill(Long reviewId, Long skillId) {
        if (reviewId == null || reviewId <= 0 || skillId == null || skillId <= 0) {
            return 0;
        }
        return userSkillMapper.backfillSkillIdByReviewId(reviewId, skillId);
    }

    private UserSkillItem toItem(Map<String, Object> row) {
        Integer publicDeleted = toInt(row.get("public_deleted"));
        return UserSkillItem.builder()
                .id(toLong(row.get("id")))
                .source((String) row.get("source"))
                .skillId(toLong(row.get("skill_id")))
                .reviewId(toLong(row.get("review_id")))
                .slug((String) row.get("slug"))
                .name((String) row.get("name"))
                .shortDesc((String) row.get("short_desc"))
                .catCode((String) row.get("cat_code"))
                .icon((String) row.get("icon"))
                .version((String) row.get("version"))
                .zipUrl((String) row.get("zip_url"))
                .filesCount(toInt(row.get("files_count")))
                .safety((String) row.get("safety"))
                .evalScore(toInt(row.get("eval_score")))
                .langs(row.get("langs") == null ? "[]" : String.valueOf(row.get("langs")))
                .publicVersion((String) row.get("public_version"))
                .publicStatus((String) row.get("public_status"))
                .publicVisibility((String) row.get("public_visibility"))
                .publicDeleted(publicDeleted != null && publicDeleted == 1)
                .publicInstalls(toInt(row.get("public_installs")))
                .publicStars(toInt(row.get("public_stars")))
                .author(toAuthor(row))
                .createdAt(toText(row.get("created_at")))
                .updatedAt(toText(row.get("updated_at")))
                .build();
    }

    private boolean isDeleted(UserSkill row) {
        return row != null && row.getDeleted() != null && row.getDeleted() == 1;
    }

    private String resolveSubscribeSource(Long userId, Skill skill) {
        Long teamId = skill.getTeamId();
        if (teamId == null || teamId <= 0) {
            return "PUBLIC";
        }
        try {
            teamService.requireMembership(teamId, userId);
            return "TEAM";
        } catch (BusinessException e) {
            return "PUBLIC";
        }
    }

    private SkillCard.AuthorRef toAuthor(Map<String, Object> row) {
        Long authorId = toLong(row.get("author_id"));
        if (authorId == null) {
            return null;
        }
        return SkillCard.AuthorRef.builder()
                .id(authorId)
                .name((String) row.get("author_name"))
                .handle((String) row.get("author_handle"))
                .build();
    }

    private static String blankToEmpty(String value) {
        return value == null || value.isBlank() ? "" : value.trim();
    }

    private static String toJsonArray(List<String> values) {
        if (values == null || values.isEmpty()) {
            return "[]";
        }
        try {
            return OM.writeValueAsString(values);
        } catch (JsonProcessingException e) {
            return "[]";
        }
    }

    private static Long toLong(Object value) {
        return value instanceof Number number ? number.longValue() : null;
    }

    private static Integer toInt(Object value) {
        return value instanceof Number number ? number.intValue() : null;
    }

    private static String toText(Object value) {
        return value == null ? null : String.valueOf(value);
    }
}
