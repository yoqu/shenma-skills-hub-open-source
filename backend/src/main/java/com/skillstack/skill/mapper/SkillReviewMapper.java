package com.skillstack.skill.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.skillstack.skill.entity.SkillReview;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.math.BigDecimal;

@Mapper
public interface SkillReviewMapper extends BaseMapper<SkillReview> {

    /** AVG(rating) over non-deleted reviews; null if no rows. */
    @Select("SELECT AVG(rating) FROM skill_reviews WHERE skill_id = #{skillId} AND deleted = 0")
    BigDecimal avgRating(@Param("skillId") Long skillId);

    @Select("SELECT COUNT(*) FROM skill_reviews WHERE skill_id = #{skillId} AND deleted = 0")
    long countReviews(@Param("skillId") Long skillId);
}
