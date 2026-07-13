package com.skillstack.common.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

/**
 * CORS 配置。
 * 通过 {@link CorsConfigurationSource} Bean 暴露给 Spring Security 的 {@code http.cors()} 自动接管，
 * 避免再额外注册一个游离的 CorsFilter（顺序无法保证、容易在受保护接口上漏头）。
 *
 * <p>开发期允许任意 localhost / 127.0.0.1 端口（dev 服务器、preview、不同前端壳）。</p>
 * <p>生产通过 {@code SKILLSTACK_CORS_ALLOWED_ORIGINS} 注入精确白名单（逗号分隔）。</p>
 */
@Configuration
public class CorsConfig {

    private static final List<String> DEV_ORIGIN_PATTERNS = List.of(
            "http://localhost:[*]",
            "http://127.0.0.1:[*]"
    );

    @Value("${skillstack.cors.allowed-origins:}")
    private String allowedOrigins;

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cfg = new CorsConfiguration();

        List<String> patterns = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
        if (patterns.isEmpty()) {
            patterns = DEV_ORIGIN_PATTERNS;
        }
        cfg.setAllowedOriginPatterns(patterns);

        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Requested-With", "Accept"));
        cfg.setExposedHeaders(List.of("Authorization", "Content-Disposition"));
        cfg.setAllowCredentials(true);
        cfg.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource src = new UrlBasedCorsConfigurationSource();
        src.registerCorsConfiguration("/**", cfg);
        return src;
    }
}
