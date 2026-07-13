package com.skillstack.skill.dto;

import com.skillstack.common.web.PageQuery;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 团队 Skill 库查询参数。
 * cat=all 表示不过滤分类。
 * sort: hot(installs) / recent(publishedAt) / score
 * safety: pass / warn / fail
 * visibility: PUBLIC / TEAM_PRIVATE
 */
@Data
@EqualsAndHashCode(callSuper = true)
public class PlazaQuery extends PageQuery {
    private String cat;
    private String q;
    private String sort = "hot";
    private String safety;
    private String visibility;
    private String status;
    /** 限定团队，团队 Skill 库使用 */
    private Long teamId;
    /** 仅展示该作者投递的 Skill。 */
    private Long authorId;
    /** 近 N 天有更新的 Skill；按 skills.updated_at 过滤。 */
    private Integer updatedWithin;
}
