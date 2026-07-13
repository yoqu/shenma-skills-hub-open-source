package com.skillstack.auth.oauth.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AuthUrlVO {
    private String authUrl;
    private String state;
}
