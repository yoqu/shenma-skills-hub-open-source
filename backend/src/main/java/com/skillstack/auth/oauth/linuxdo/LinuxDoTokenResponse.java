package com.skillstack.auth.oauth.linuxdo;

public record LinuxDoTokenResponse(
        String accessToken,
        String tokenType
) {
}
