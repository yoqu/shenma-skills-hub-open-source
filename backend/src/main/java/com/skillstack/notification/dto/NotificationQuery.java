package com.skillstack.notification.dto;

import com.skillstack.common.web.PageQuery;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class NotificationQuery extends PageQuery {
    private Long teamId;
    /** "unread" or "all"; null treated as "all". */
    private String status;
}
