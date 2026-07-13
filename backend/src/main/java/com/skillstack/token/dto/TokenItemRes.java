package com.skillstack.token.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Builder
public class TokenItemRes {
    private Long id;
    private String name;
    private String kind;
    private String masked;
    private LocalDateTime lastUsedAt;
    private String lastUsedIp;
    private LocalDateTime createdAt;
    private LocalDateTime revokedAt;
}
