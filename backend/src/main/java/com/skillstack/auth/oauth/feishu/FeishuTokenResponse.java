package com.skillstack.auth.oauth.feishu;

public record FeishuTokenResponse(
        String appAccessToken,
        String userAccessToken
) {
}
