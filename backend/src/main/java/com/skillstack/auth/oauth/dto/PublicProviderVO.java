package com.skillstack.auth.oauth.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class PublicProviderVO {
    private String code;
    private String displayName;
    private String buttonLabel;
    private String iconUrl;
    private Integer sortOrder;
}
