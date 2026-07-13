package com.skillstack.prompt.dto;

import lombok.Data;

/**
 * 管理员对 Prompt 的写操作入参。
 */
@Data
public class AdminPromptUpdateReq {
    private String visibility;
    private String status;
}
