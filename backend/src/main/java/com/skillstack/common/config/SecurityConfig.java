package com.skillstack.common.config;

import com.skillstack.common.security.JwtAuthFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> {})
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(reg -> reg
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/auth/providers").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/auth/oauth/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/skills", "/api/skills/*", "/api/skills/*/versions", "/api/skills/*/versions/*/files", "/api/skills/*/versions/*/skill-md", "/api/skills/*/download", "/api/skills/*/reviews").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/prompts", "/api/prompts/*", "/api/prompts/*/versions", "/api/prompts/*/versions/*", "/api/prompts/*/download", "/api/prompts/*/reviews").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/teams", "/api/teams/*").permitAll()
                        // 公共团队页：只允许 GET，service 层会按 membership 做差异化过滤
                        .requestMatchers(HttpMethod.GET,
                                "/api/teams/*/skills",
                                "/api/teams/*/prompts",
                                "/api/teams/*/prompts/*",
                                "/api/teams/*/prompts/*/download",
                                "/api/teams/*/suites",
                                "/api/teams/*/suites/**",
                                "/api/teams/*/members"
                        ).permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/suites/*").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/users/*").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/categories").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/site/branding").permitAll()
                        .requestMatchers(HttpMethod.GET, "/uploads/**").permitAll()
                        .requestMatchers(
                                "/actuator/**",
                                "/swagger-ui.html",
                                "/swagger-ui/**",
                                "/v3/api-docs",
                                "/v3/api-docs/**",
                                "/error"
                        ).permitAll()
                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .formLogin(f -> f.disable())
                .httpBasic(b -> b.disable());

        return http.build();
    }
}
