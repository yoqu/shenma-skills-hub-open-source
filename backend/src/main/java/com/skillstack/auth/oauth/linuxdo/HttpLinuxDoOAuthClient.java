package com.skillstack.auth.oauth.linuxdo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

@Component
public class HttpLinuxDoOAuthClient implements LinuxDoOAuthClient {

    private static final String LINUX_DO_ORIGIN = "https://linux.do";

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public HttpLinuxDoOAuthClient() {
        this.objectMapper = new ObjectMapper();
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(8))
                .build();
    }

    @Override
    public LinuxDoTokenResponse exchangeCode(
            String code,
            String clientId,
            String clientSecret,
            String redirectUri,
            String tokenEndpoint
    ) {
        Map<String, String> form = new LinkedHashMap<>();
        form.put("grant_type", "authorization_code");
        form.put("code", code);
        form.put("redirect_uri", redirectUri);
        form.put("client_id", clientId);
        form.put("client_secret", clientSecret);

        HttpRequest request = HttpRequest.newBuilder(URI.create(tokenEndpoint))
                .timeout(Duration.ofSeconds(12))
                .header("Accept", "application/json")
                .header("Content-Type", "application/x-www-form-urlencoded;charset=UTF-8")
                .POST(HttpRequest.BodyPublishers.ofString(formEncode(form)))
                .build();

        String body = send(request, "linux.do token endpoint");
        try {
            JsonNode root = objectMapper.readTree(body);
            String accessToken = text(root, "access_token").orElse(null);
            if (accessToken == null) {
                throw new IllegalStateException("linux.do token response missing access_token");
            }
            return new LinuxDoTokenResponse(accessToken, text(root, "token_type").orElse("Bearer"));
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to parse linux.do token response", exception);
        }
    }

    @Override
    public LinuxDoUserProfile fetchUser(String accessToken, String userEndpoint) {
        HttpRequest request = HttpRequest.newBuilder(URI.create(userEndpoint))
                .timeout(Duration.ofSeconds(12))
                .header("Accept", "application/json")
                .header("Authorization", "Bearer " + accessToken)
                .GET()
                .build();

        String body = send(request, "linux.do user endpoint");
        try {
            JsonNode root = objectMapper.readTree(body);
            String id = text(root, "id").orElse(null);
            if (id == null) {
                throw new IllegalStateException("linux.do user response missing id");
            }

            String username = text(root, "username").orElse("linuxdo_" + id);
            String nickname = text(root, "name").orElse(username);
            String avatarUrl = text(root, "avatar_url")
                    .or(() -> text(root, "avatar_template").map(this::normalizeAvatarUrl))
                    .orElse(null);
            boolean active = !root.has("active") || root.path("active").asBoolean(true);

            return new LinuxDoUserProfile(
                    id,
                    username,
                    nickname,
                    text(root, "email").orElse(null),
                    avatarUrl,
                    active,
                    body
            );
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to parse linux.do user response", exception);
        }
    }

    private String send(HttpRequest request, String label) {
        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException(label + " returned HTTP " + response.statusCode());
            }
            return response.body();
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while calling " + label, exception);
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to call " + label, exception);
        }
    }

    private String formEncode(Map<String, String> values) {
        StringBuilder builder = new StringBuilder();
        for (Map.Entry<String, String> entry : values.entrySet()) {
            if (!builder.isEmpty()) {
                builder.append('&');
            }
            builder.append(URLEncoder.encode(entry.getKey(), StandardCharsets.UTF_8));
            builder.append('=');
            builder.append(URLEncoder.encode(entry.getValue(), StandardCharsets.UTF_8));
        }
        return builder.toString();
    }

    private Optional<String> text(JsonNode root, String fieldName) {
        JsonNode node = root.path(fieldName);
        if (node.isMissingNode() || node.isNull()) {
            return Optional.empty();
        }
        String value = node.isTextual() ? node.asText() : node.toString();
        String trimmed = value.trim();
        return trimmed.isEmpty() ? Optional.empty() : Optional.of(trimmed);
    }

    private String normalizeAvatarUrl(String avatarTemplate) {
        String value = avatarTemplate.replace("{size}", "96");
        if (value.startsWith("//")) {
            return "https:" + value;
        }
        if (value.startsWith("/")) {
            return LINUX_DO_ORIGIN + value;
        }
        return value;
    }
}
