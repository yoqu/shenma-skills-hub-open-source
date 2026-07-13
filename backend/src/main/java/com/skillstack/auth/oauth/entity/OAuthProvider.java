package com.skillstack.auth.oauth.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("oauth_providers")
public class OAuthProvider {

    @TableId
    private String code;
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
    private Long updatedBy;
    private LocalDateTime updatedAt;
}
