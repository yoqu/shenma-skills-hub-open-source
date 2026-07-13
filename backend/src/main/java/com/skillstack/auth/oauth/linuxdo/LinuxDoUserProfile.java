package com.skillstack.auth.oauth.linuxdo;

public record LinuxDoUserProfile(
        String id,
        String username,
        String nickname,
        String email,
        String avatarUrl,
        boolean active,
        String rawProfileJson
) {
}
