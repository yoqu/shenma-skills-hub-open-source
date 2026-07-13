package com.skillstack.auth.sms.dto;

import lombok.Data;

@Data
public class UpdateSmsProviderReq {
    private String displayName;
    private Boolean enabled;
    private String providerType;
    private String endpointUrl;
    private String method;
    private String headersJson;
    private String bodyTemplate;
    private Integer successStatus;
    private String successJsonPath;
    private String successExpectedValue;
    private String extraJson;
    private String secretJson;
}
