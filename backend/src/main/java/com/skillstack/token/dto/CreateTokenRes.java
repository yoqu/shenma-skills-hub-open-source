package com.skillstack.token.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class CreateTokenRes {
    private Long id;
    private String name;
    private String kind;
    /** 明文 token，仅创建时一次返回 */
    private String secret;
    private String masked;
}
