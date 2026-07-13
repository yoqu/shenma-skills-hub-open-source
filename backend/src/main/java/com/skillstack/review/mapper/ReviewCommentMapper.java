package com.skillstack.review.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.skillstack.common.storage.StorageUrlTypeHandler;
import com.skillstack.review.dto.ReviewCommentItem;
import com.skillstack.review.entity.ReviewComment;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface ReviewCommentMapper extends BaseMapper<ReviewComment> {

    /** 按 review 拉评论时间线，附带作者信息，按时间正序。 */
    @Select({
            "SELECT c.id AS id,",
            "       c.kind AS kind,",
            "       c.body AS body,",
            "       DATE_FORMAT(c.created_at, '%Y-%m-%d %H:%i') AS ts,",
            "       u.id AS author_id,",
            "       u.handle AS author_handle,",
            "       u.name AS author_name,",
            "       u.avatar AS author_avatar,",
            "       COALESCE(u.avatar_url, u.feishu_avatar_url) AS author_avatar_url",
            "  FROM review_comments c",
            "  JOIN users u ON u.id = c.author_id AND u.deleted = 0",
            " WHERE c.review_id = #{reviewId}",
            "   AND c.deleted = 0",
            " ORDER BY c.created_at ASC, c.id ASC"
    })
    @Results({
            @Result(column = "id", property = "id"),
            @Result(column = "kind", property = "kind"),
            @Result(column = "body", property = "body"),
            @Result(column = "ts", property = "ts"),
            @Result(column = "author_id", property = "author.id"),
            @Result(column = "author_handle", property = "author.handle"),
            @Result(column = "author_name", property = "author.name"),
            @Result(column = "author_avatar", property = "author.avatar"),
            @Result(column = "author_avatar_url", property = "author.avatarUrl",
                    typeHandler = StorageUrlTypeHandler.class),
    })
    List<ReviewCommentItem> selectByReview(@Param("reviewId") Long reviewId);
}
