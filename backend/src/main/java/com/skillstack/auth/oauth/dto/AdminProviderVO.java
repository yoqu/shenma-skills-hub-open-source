package com.skillstack.auth.oauth.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class AdminProviderVO {
    private String code;
    private String displayName;
    private Boolean enabled;
    private String clientId;
    private Boolean clientSecretSet;
    private String redirectUri;
    private String scope;
    private String authorizeUrl;
    private String tokenUrl;
    private String userinfoUrl;
    private String iconUrl;
    private String buttonLabel;
    private Integer sortOrder;
    private String extraJson;
    private LocalDateTime updatedAt;
}
