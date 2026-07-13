package com.skillstack.admin.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("admin_audit_log")
public class AdminAuditLog {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long actorId;
    private String action;
    private String targetType;
    private Long targetId;
    /** JSON 字符串 */
    private String payloadJson;

    @TableField(value = "created_at", fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
