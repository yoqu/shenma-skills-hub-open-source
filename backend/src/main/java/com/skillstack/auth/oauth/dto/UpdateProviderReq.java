package com.skillstack.auth.oauth.dto;

import lombok.Data;

@Data
public class UpdateProviderReq {
    private String displayName;
    private Boolean enabled;
    private String clientId;
    private String clientSecret;
    private String redirectUri;
    private String scope;
    private String authorizeUrl;
    private String tokenUrl;
    private String userinfoUrl;
    private String iconUrl;
    private String buttonLabel;
    private Integer sortOrder;
    private String extraJson;
}
