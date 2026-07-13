package com.skillstack.admin.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.skillstack.admin.dto.BrandingVO;
import com.skillstack.admin.dto.SiteSettingVO;
import com.skillstack.admin.entity.SiteSetting;
import com.skillstack.admin.mapper.SiteSettingMapper;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.storage.StorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.net.URL;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class SiteSettingsService {

    public static final String K_NAME     = "site.name";
    public static final String K_TAGLINE  = "site.tagline";
    public static final String K_LOGO_URL = "site.logo_url";
    public static final String K_FOOTER   = "site.footer";

    /** 第一版可写白名单。其余 key 在 PUT 时会被忽略并在响应中标记。 */
    private static final Set<String> ALLOWED_KEYS = Set.of(K_NAME, K_TAGLINE, K_LOGO_URL, K_FOOTER);

    private final SiteSettingMapper mapper;
    private final StorageService storageService;

    public BrandingVO branding() {
        Map<String, String> m = loadAllAsMap();
        return BrandingVO.builder()
                .name(m.getOrDefault(K_NAME, "SkillStack"))
                .tagline(m.getOrDefault(K_TAGLINE, ""))
                .logoUrl(resolveLogoUrl(m.get(K_LOGO_URL)))
                .footer(m.getOrDefault(K_FOOTER, ""))
                .build();
    }

    public List<SiteSettingVO> listAll() {
        List<SiteSetting> rows = mapper.selectList(null);
        List<SiteSettingVO> out = new ArrayList<>(rows.size());
        for (SiteSetting s : rows) {
            out.add(SiteSettingVO.builder()
                    .key(s.getSettingKey())
                    .value(s.getSettingValue())
                    .valueType(s.getValueType())
                    .updatedBy(s.getUpdatedBy())
                    .updatedAt(s.getUpdatedAt())
                    .build());
        }
        return out;
    }

    @Transactional
    public UpdateResult update(Map<String, String> values, Long actorId) {
        if (values == null || values.isEmpty()) {
            return new UpdateResult(List.of(), List.of());
        }
        List<String> applied = new ArrayList<>();
        List<String> unknown = new ArrayList<>();
        for (Map.Entry<String, String> e : values.entrySet()) {
            String key = e.getKey();
            if (!ALLOWED_KEYS.contains(key)) {
                unknown.add(key);
                continue;
            }
            applyOne(key, e.getValue(), actorId);
            applied.add(key);
        }
        return new UpdateResult(applied, unknown);
    }

    @Transactional
    public BrandingVO uploadLogo(MultipartFile file, Long actorId) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(40001, "未提供文件");
        }
        String contentType = file.getContentType();
        if (contentType == null || !(contentType.startsWith("image/"))) {
            throw new BusinessException(40001, "仅允许上传图片文件");
        }
        try {
            String key = storageService.store(file, "branding");
            String url = storageService.resolveUrl(key);
            applyOne(K_LOGO_URL, url, actorId);
            return branding();
        } catch (IOException e) {
            throw new BusinessException(50000, "文件保存失败：" + e.getMessage());
        }
    }

    private void applyOne(String key, String rawValue, Long actorId) {
        String value = rawValue == null ? "" : rawValue.trim();
        SiteSetting existing = mapper.selectById(key);
        String type = existing == null ? "STRING" : existing.getValueType();
        validate(key, value, type);

        if (existing == null) {
            SiteSetting row = new SiteSetting();
            row.setSettingKey(key);
            row.setSettingValue(value);
            row.setValueType(type);
            row.setUpdatedBy(actorId);
            row.setUpdatedAt(LocalDateTime.now());
            mapper.insert(row);
        } else {
            existing.setSettingValue(value);
            existing.setUpdatedBy(actorId);
            existing.setUpdatedAt(LocalDateTime.now());
            mapper.updateById(existing);
        }
    }

    private void validate(String key, String value, String type) {
        if (type == null) return;
        switch (type) {
            case "URL" -> {
                if (!value.isEmpty()) {
                    if (value.startsWith("/")) return; // 允许同源相对路径
                    try {
                        new URL(value);
                    } catch (MalformedURLException ex) {
                        throw new BusinessException(40001, key + " 不是合法的 URL");
                    }
                }
            }
            case "BOOL" -> {
                if (!value.isEmpty() && !"true".equals(value) && !"false".equals(value)) {
                    throw new BusinessException(40001, key + " 取值仅可为 true/false");
                }
            }
            default -> {
                // STRING / JSON 不强约束，前端控制长度
                if (value.length() > 1024) {
                    throw new BusinessException(40001, key + " 长度不能超过 1024");
                }
            }
        }
    }

    private Map<String, String> loadAllAsMap() {
        Map<String, String> out = new LinkedHashMap<>();
        for (SiteSetting s : mapper.selectList(new QueryWrapper<>())) {
            out.put(s.getSettingKey(), s.getSettingValue());
        }
        return out;
    }

    private String resolveLogoUrl(String stored) {
        if (stored == null || stored.isBlank()) return "";
        if (stored.startsWith("http://") || stored.startsWith("https://") || stored.startsWith("/")) {
            return stored;
        }
        return storageService.resolveUrl(stored);
    }

    public record UpdateResult(List<String> appliedKeys, List<String> unknownKeys) {}
}
