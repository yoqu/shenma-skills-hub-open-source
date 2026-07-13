package com.skillstack.team.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.skillstack.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("invites_phone")
public class InvitePhone extends BaseEntity {
    private Long teamId;
    private String phoneMasked;
    private String phoneRaw;
    private Long invitedBy;
    private String note;
    /** pending / accepted / declined / expired / cancelled */
    private String status;
    private String atLabel;
    private Long acceptedByUserId;
    private LocalDateTime acceptedAt;
}
