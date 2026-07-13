package com.skillstack.auth.oauth.feishu;

public interface FeishuAuthClient {

    String getAppAccessToken(String appId, String appSecret);

    String getUserAccessToken(String code, String appAccessToken, String tokenEndpoint);

    FeishuUserProfile getUserProfile(String userAccessToken, String userinfoEndpoint);
}
