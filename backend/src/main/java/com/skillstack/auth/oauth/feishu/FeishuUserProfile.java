package com.skillstack.auth.oauth.feishu;

public record FeishuUserProfile(
        String openId,
        String unionId,
        String tenantKey,
        String name,
        String avatarUrl,
        String email,
        String mobile
) {
}
