package com.skillstack.auth.oauth.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.skillstack.admin.service.AuditLogService;
import com.skillstack.auth.oauth.dto.AdminProviderVO;
import com.skillstack.auth.oauth.dto.PublicProviderVO;
import com.skillstack.auth.oauth.dto.UpdateProviderReq;
import com.skillstack.auth.oauth.entity.OAuthProvider;
import com.skillstack.auth.oauth.mapper.OAuthProviderMapper;
import com.skillstack.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class OAuthProviderService {

    private final OAuthProviderMapper providerMapper;
    private final AuditLogService auditLogService;

    private final ConcurrentHashMap<String, CachedEntry> cache = new ConcurrentHashMap<>();
    private static final long CACHE_TTL_SECONDS = 60L;

    public List<PublicProviderVO> listPublic() {
        return listAll().stream()
                .filter(p -> Boolean.TRUE.equals(p.getEnabled()))
                .map(p -> PublicProviderVO.builder()
                        .code(p.getCode())
                        .displayName(p.getDisplayName())
                        .buttonLabel(p.getButtonLabel())
                        .iconUrl(p.getIconUrl())
                        .sortOrder(p.getSortOrder())
                        .build())
                .sorted(java.util.Comparator.comparingInt(v -> v.getSortOrder() == null ? 0 : v.getSortOrder()))
                .toList();
    }

    public List<AdminProviderVO> listAdmin() {
        return listAll().stream()
                .map(this::toAdminVO)
                .toList();
    }

    public AdminProviderVO getAdmin(String code) {
        OAuthProvider p = requireExists(code);
        return toAdminVO(p);
    }

    public OAuthProvider requireConfigured(String code) {
        OAuthProvider p = getFromCache(code);
        if (p == null) {
            throw new BusinessException(40035, "未知 OAuth provider: " + code);
        }
        if (!Boolean.TRUE.equals(p.getEnabled())) {
            throw new BusinessException(40034, "OAuth provider 已被关闭: " + code);
        }
        if (isBlank(p.getClientId()) || isBlank(p.getClientSecret())
                || isBlank(p.getRedirectUri()) || isBlank(p.getAuthorizeUrl())
                || isBlank(p.getTokenUrl()) || isBlank(p.getUserinfoUrl())) {
            throw new BusinessException(40033, "OAuth provider 配置不完整: " + code);
        }
        OAuthProvider copy = new OAuthProvider();
        copy.setCode(p.getCode());
        copy.setDisplayName(p.getDisplayName());
        copy.setEnabled(p.getEnabled());
        copy.setClientId(p.getClientId());
        copy.setClientSecret(p.getClientSecret());
        copy.setRedirectUri(p.getRedirectUri());
        copy.setScope(p.getScope());
        copy.setAuthorizeUrl(p.getAuthorizeUrl());
        copy.setTokenUrl(p.getTokenUrl());
        copy.setUserinfoUrl(p.getUserinfoUrl());
        copy.setIconUrl(p.getIconUrl());
        copy.setButtonLabel(p.getButtonLabel());
        copy.setSortOrder(p.getSortOrder());
        return copy;
    }

    public AdminProviderVO update(String code, UpdateProviderReq req, Long actorId) {
        OAuthProvider existing = requireExists(code);

        Map<String, Object> before = snapshotForAudit(existing);

        if (req.getDisplayName() != null) existing.setDisplayName(req.getDisplayName());
        if (req.getEnabled() != null) existing.setEnabled(req.getEnabled());
        if (req.getClientId() != null) existing.setClientId(blankToNull(req.getClientId()));
        if (req.getRedirectUri() != null) existing.setRedirectUri(blankToNull(req.getRedirectUri()));
        if (req.getScope() != null) existing.setScope(req.getScope());
        if (req.getAuthorizeUrl() != null) existing.setAuthorizeUrl(blankToNull(req.getAuthorizeUrl()));
        if (req.getTokenUrl() != null) existing.setTokenUrl(blankToNull(req.getTokenUrl()));
        if (req.getUserinfoUrl() != null) existing.setUserinfoUrl(blankToNull(req.getUserinfoUrl()));
        if (req.getIconUrl() != null) existing.setIconUrl(blankToNull(req.getIconUrl()));
        if (req.getButtonLabel() != null) existing.setButtonLabel(blankToNull(req.getButtonLabel()));
        if (req.getSortOrder() != null) existing.setSortOrder(req.getSortOrder());
        if (req.getExtraJson() != null) existing.setExtraJson(blankToNull(req.getExtraJson()));

        boolean secretChanged = req.getClientSecret() != null;
        if (secretChanged) {
            existing.setClientSecret(req.getClientSecret().isEmpty() ? null : req.getClientSecret());
        }

        existing.setUpdatedBy(actorId);
        providerMapper.updateById(existing);
        invalidateCache(code);

        Map<String, Object> after = snapshotForAudit(existing);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("before", before);
        payload.put("after", after);
        payload.put("clientSecretChanged", secretChanged);
        auditLogService.record(actorId, "oauth.provider.update", "oauth_providers", null, payload);

        return toAdminVO(existing);
    }

    private OAuthProvider requireExists(String code) {
        OAuthProvider p = providerMapper.selectById(code);
        if (p == null) {
            throw new BusinessException(40035, "未知 OAuth provider: " + code);
        }
        return p;
    }

    private List<OAuthProvider> listAll() {
        return providerMapper.selectList(Wrappers.emptyWrapper());
    }

    private OAuthProvider getFromCache(String code) {
        CachedEntry entry = cache.get(code);
        if (entry != null && Instant.now().getEpochSecond() < entry.expiresAt()) {
            return entry.provider();
        }
        cache.remove(code);
        OAuthProvider p = providerMapper.selectById(code);
        if (p != null) {
            cache.put(code, new CachedEntry(p, Instant.now().getEpochSecond() + CACHE_TTL_SECONDS));
        }
        return p;
    }

    private void invalidateCache(String code) {
        cache.remove(code);
    }

    private AdminProviderVO toAdminVO(OAuthProvider p) {
        return AdminProviderVO.builder()
                .code(p.getCode())
                .displayName(p.getDisplayName())
                .enabled(p.getEnabled())
                .clientId(p.getClientId())
                .clientSecretSet(p.getClientSecret() != null && !p.getClientSecret().isBlank())
                .redirectUri(p.getRedirectUri())
                .scope(p.getScope())
                .authorizeUrl(p.getAuthorizeUrl())
                .tokenUrl(p.getTokenUrl())
                .userinfoUrl(p.getUserinfoUrl())
                .iconUrl(p.getIconUrl())
                .buttonLabel(p.getButtonLabel())
                .sortOrder(p.getSortOrder())
                .extraJson(p.getExtraJson())
                .updatedAt(p.getUpdatedAt())
                .build();
    }

    private Map<String, Object> snapshotForAudit(OAuthProvider p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("code", p.getCode());
        m.put("displayName", p.getDisplayName());
        m.put("enabled", p.getEnabled());
        m.put("clientId", p.getClientId());
        m.put("redirectUri", p.getRedirectUri());
        m.put("scope", p.getScope());
        m.put("authorizeUrl", p.getAuthorizeUrl());
        m.put("tokenUrl", p.getTokenUrl());
        m.put("userinfoUrl", p.getUserinfoUrl());
        m.put("iconUrl", p.getIconUrl());
        m.put("buttonLabel", p.getButtonLabel());
        m.put("sortOrder", p.getSortOrder());
        return m;
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private record CachedEntry(OAuthProvider provider, long expiresAt) {}
}
