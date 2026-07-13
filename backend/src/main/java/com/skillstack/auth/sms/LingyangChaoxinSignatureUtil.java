package com.skillstack.auth.sms;

import com.skillstack.common.exception.BusinessException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;
import java.util.TreeMap;

public final class LingyangChaoxinSignatureUtil {

    private LingyangChaoxinSignatureUtil() {
    }

    public static String generateSignature(String appId, String accessKey, String accessSecret, long timestamp,
                                           Map<?, ?> queryParam) {
        try {
            Map<String, String> params = new TreeMap<>();
            params.put("appId", appId);
            params.put("accessKey", accessKey);
            params.put("accessSecret", accessSecret);
            params.put("timestamp", String.valueOf(timestamp));
            if (queryParam != null) {
                for (Map.Entry<?, ?> entry : queryParam.entrySet()) {
                    params.put(String.valueOf(entry.getKey()), String.valueOf(entry.getValue()));
                }
            }

            StringBuilder content = new StringBuilder();
            boolean first = true;
            for (Map.Entry<String, String> entry : params.entrySet()) {
                if (!first) {
                    content.append("&");
                }
                first = false;
                content.append(entry.getKey()).append("=").append(entry.getValue());
            }

            MessageDigest md5 = MessageDigest.getInstance("MD5");
            byte[] digest = md5.digest(content.toString().getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : digest) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (Exception e) {
            throw new BusinessException(40041, "短信发送失败，请稍后重试");
        }
    }
}
