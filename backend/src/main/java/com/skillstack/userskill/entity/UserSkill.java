package com.skillstack.userskill.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.skillstack.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("user_skills")
public class UserSkill extends BaseEntity {
    private Long userId;
    /** PERSONAL / TEAM / PUBLIC */
    private String source;
    /** 0 表示未关联公开 Skill。 */
    private Long skillId;
    /** 0 表示无审核单。 */
    private Long reviewId;
    private String slug;
    private String name;
    private String shortDesc;
    private String catCode;
    private String icon;
    private String version;
    /** storage key，沿用 reviews.zip_url / skill_versions.zip_url 口径。 */
    private String zipUrl;
    private Integer filesCount;
    /** pass / warn / fail */
    private String safety;
    private Integer evalScore;
    /** JSON 字符串 ["TS","Py"] */
    private String langs;
}
