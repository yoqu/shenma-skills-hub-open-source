package com.skillstack.common.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillstack.token.entity.PersonalAccessToken;
import com.skillstack.token.service.PersonalAccessTokenService;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.Map;

/**
 * 解析 Bearer token，把当前用户挂到 SecurityContext。
 *
 * <p>支持两种凭据：
 * <ul>
 *   <li>JWT —— 默认场景。</li>
 *   <li>Personal Access Token，明文以 {@code lst_} 开头。仅允许 skill 消费相关
 *       （{@code /api/skills/<slug>} 的 detail/versions/download/install）与 suite 消费相关
 *       （{@code /api/teams/{teamId}/suites} 列表、{@code /api/teams/{teamId}/suites/by-slug/{slug}} 详情、
 *       {@code /api/suites/{id}/install} 计数）路径；其他路径即便 token 有效也返回 403，
 *       避免被滥用为完整账号凭据。</li>
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private static final String HEADER = "Authorization";
    private static final String BEARER = "Bearer ";
    private static final String PAT_PREFIX = "lst_";
    private static final ObjectMapper JSON = new ObjectMapper();

    private final JwtUtil jwtUtil;
    private final PersonalAccessTokenService patService;

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse resp, FilterChain chain)
            throws ServletException, IOException {
        String header = req.getHeader(HEADER);
        if (StringUtils.hasText(header) && header.startsWith(BEARER)) {
            String token = header.substring(BEARER.length()).trim();
            if (!token.isEmpty()) {
                if (token.startsWith(PAT_PREFIX)) {
                    PersonalAccessToken pat = patService.resolveActive(token);
                    if (pat == null) {
                        writeAuthRejected(resp);
                        return;
                    }
                    if (!isPatAllowedPath(req.getMethod(), req.getRequestURI())) {
                        writeForbidden(resp, "PAT 仅可用于 skill、prompt 与 suite 的查询和安装");
                        return;
                    }
                    auth(new CurrentUser(pat.getUserId(), null, true), req);
                } else {
                    try {
                        Claims claims = jwtUtil.parse(token);
                        Long uid = Long.valueOf(claims.getSubject());
                        String handle = (String) claims.get("handle");
                        auth(new CurrentUser(uid, handle), req);
                    } catch (Exception e) {
                        log.debug("jwt parse failed for {} {}: {}", req.getMethod(), req.getRequestURI(), e.getMessage());
                        writeAuthRejected(resp);
                        return;
                    }
                }
            }
        }
        chain.doFilter(req, resp);
    }

    private void auth(CurrentUser cu, HttpServletRequest req) {
        UsernamePasswordAuthenticationToken authToken =
                new UsernamePasswordAuthenticationToken(cu, null, Collections.emptyList());
        authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(req));
        SecurityContextHolder.getContext().setAuthentication(authToken);
    }

    private static boolean isPatAllowedPath(String method, String uri) {
        if (uri == null) return false;
        String m = method == null ? "" : method.toUpperCase();
        // 公开广场列表，给 CLI search / config check 使用
        if ("GET".equals(m) && (uri.equals("/api/skills") || uri.equals("/api/skills/"))) return true;
        if ("GET".equals(m) && (uri.equals("/api/prompts") || uri.equals("/api/prompts/"))) return true;
        if (uri.startsWith("/api/skills/")) {
            return ("POST".equals(m) && uri.matches("/api/skills/\\d+/install/?"))
                    || ("GET".equals(m) && uri.matches("/api/skills/[^/]+/versions/?"))
                    || ("GET".equals(m) && uri.matches("/api/skills/[^/]+/versions/[^/]+/(files|skill-md)/?"))
                    || ("GET".equals(m) && uri.matches("/api/skills/[^/]+/download/?"))
                    || ("GET".equals(m) && uri.matches("/api/skills/[^/]+/?"));
        }
        if (uri.startsWith("/api/prompts/")) {
            return ("GET".equals(m) && uri.matches("/api/prompts/\\d+/?"))
                    || ("GET".equals(m) && uri.matches("/api/prompts/\\d+/download/?"))
                    || ("GET".equals(m) && uri.matches("/api/prompts/\\d+/versions/?"))
                    || ("GET".equals(m) && uri.matches("/api/prompts/\\d+/versions/[^/]+/?"));
        }
        if ("GET".equals(m) && uri.matches("/api/prompts/\\d+/versions/?")) return true;
        if (uri.matches("/api/teams/[^/]+/prompts/[^/]+/?")) {
            return "GET".equals(m);
        }
        if (uri.matches("/api/teams/[^/]+/prompts/[^/]+/download/?")) {
            return "GET".equals(m);
        }
        if ("GET".equals(m) && uri.matches("/api/teams/\\d+/suites/?")) return true;
        if ("GET".equals(m) && uri.matches("/api/teams/\\d+/suites/by-slug/[^/]+/?")) return true;
        if ("POST".equals(m) && uri.matches("/api/suites/\\d+/install/?")) return true;
        return false;
    }

    private static void writeAuthRejected(HttpServletResponse resp) throws IOException {
        if (resp.isCommitted()) return;
        resp.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        resp.setContentType("application/json;charset=UTF-8");
        resp.setHeader("X-Auth-Reset", "1");
        // Map.of() forbids null values; use a LinkedHashMap instead
        Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("code", 40110);
        body.put("message", "登录已失效，请重新登录");
        body.put("data", null);
        resp.getWriter().write(JSON.writeValueAsString(body));
        resp.getWriter().flush();
    }

    private static void writeForbidden(HttpServletResponse resp, String message) throws IOException {
        if (resp.isCommitted()) return;
        resp.setStatus(HttpServletResponse.SC_FORBIDDEN);
        resp.setContentType("application/json;charset=UTF-8");
        Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("code", 40300);
        body.put("message", message);
        body.put("data", null);
        resp.getWriter().write(JSON.writeValueAsString(body));
        resp.getWriter().flush();
    }
}
