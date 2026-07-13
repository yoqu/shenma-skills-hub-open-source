package com.skillstack.auth.oauth.linuxdo;

public interface LinuxDoOAuthClient {

    LinuxDoTokenResponse exchangeCode(
            String code,
            String clientId,
            String clientSecret,
            String redirectUri,
            String tokenEndpoint
    );

    LinuxDoUserProfile fetchUser(String accessToken, String userEndpoint);
}
