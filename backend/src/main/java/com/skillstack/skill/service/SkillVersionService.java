package com.skillstack.skill.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.skillstack.skill.dto.SkillVersionItem;
import com.skillstack.skill.entity.Skill;
import com.skillstack.skill.entity.SkillVersion;
import com.skillstack.skill.mapper.SkillMapper;
import com.skillstack.skill.mapper.SkillVersionMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class SkillVersionService {

    private final SkillVersionMapper skillVersionMapper;
    private final SkillMapper skillMapper;
    private final JdbcTemplate jdbc;

    private static final DateTimeFormatter D = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    /** 按 slug 查版本列表（标记 latest） */
    public List<SkillVersionItem> listBySlug(String slug) {
        Skill skill = skillMapper.selectOne(
                Wrappers.<Skill>lambdaQuery().eq(Skill::getSlug, slug)
        );
        if (skill == null) return List.of();
        String latest = skill.getVersion();
        // 顺带把 author 名字带出来（统一 skill 作者，简化处理）
        String authorName = jdbc.queryForObject(
                "SELECT name FROM users WHERE id = ? AND deleted = 0",
                String.class, skill.getAuthorId()
        );
        List<SkillVersion> rows = skillVersionMapper.selectList(
                Wrappers.<SkillVersion>lambdaQuery()
                        .eq(SkillVersion::getSkillId, skill.getId())
                        .orderByDesc(SkillVersion::getPublishedAt)
        );
        return rows.stream().map(v -> SkillVersionItem.builder()
                .id(v.getId())
                .version(v.getVersion())
                .note(firstLine(v.getChangelog()))
                .changelog(v.getChangelog())
                .date(v.getPublishedAt() != null ? v.getPublishedAt().format(D) : null)
                .author(authorName)
                .installs(skill.getInstalls())
                .safety(v.getSafety())
                .evalScore(v.getEvalScore())
                .filesCount(v.getFilesCount())
                .latest(latest != null && latest.equals(v.getVersion()))
                .build()).toList();
    }

    /** 新建 skill 时同步建一条 version 行；返回插入后的 entity（含自增 id），供调用方触发后续物化（如文件清单）。 */
    public SkillVersion insertInitialVersion(Long skillId, String version, int filesCount,
                                             String safety, Integer evalScore, String zipUrl) {
        return insertVersion(skillId, version, "初始版本", filesCount, safety, evalScore, zipUrl);
    }

    public SkillVersion insertVersion(Long skillId, String version, String changelog, int filesCount,
                                      String safety, Integer evalScore, String zipUrl) {
        SkillVersion v = new SkillVersion();
        v.setSkillId(skillId);
        v.setVersion(version);
        v.setChangelog(changelog);
        v.setZipUrl(zipUrl);
        v.setFilesCount(filesCount);
        v.setSafety(safety == null ? "pass" : safety);
        v.setEvalScore(evalScore == null ? 0 : evalScore);
        v.setPublishedAt(java.time.LocalDateTime.now());
        skillVersionMapper.insert(v);
        return v;
    }

    /** 按 skillId + version 找到一条 version 行（用于审核包文件预览）。 */
    public SkillVersion findBySkillAndVersion(Long skillId, String version) {
        return skillVersionMapper.selectOne(
                Wrappers.<SkillVersion>lambdaQuery()
                        .eq(SkillVersion::getSkillId, skillId)
                        .eq(SkillVersion::getVersion, version)
                        .last("LIMIT 1")
        );
    }

    /** 取该 skill 的最新版本行。 */
    public SkillVersion findLatest(Long skillId) {
        return skillVersionMapper.selectOne(
                Wrappers.<SkillVersion>lambdaQuery()
                        .eq(SkillVersion::getSkillId, skillId)
                        .orderByDesc(SkillVersion::getPublishedAt)
                        .last("LIMIT 1")
        );
    }

    @SuppressWarnings("unused")
    private Map<String, Object> empty() {
        return new HashMap<>();
    }

    private static String firstLine(String s) {
        if (s == null) return null;
        int idx = s.indexOf('\n');
        return idx < 0 ? s : s.substring(0, idx);
    }
}
