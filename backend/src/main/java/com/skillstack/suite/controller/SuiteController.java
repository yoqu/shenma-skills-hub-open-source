package com.skillstack.suite.controller;

import com.skillstack.common.security.CurrentUser;
import com.skillstack.common.web.ApiResponse;
import com.skillstack.common.web.PageQuery;
import com.skillstack.common.web.PageResult;
import com.skillstack.suite.dto.CreateSuiteReq;
import com.skillstack.suite.dto.SuiteDetail;
import com.skillstack.suite.dto.SuiteListItem;
import com.skillstack.suite.dto.UpdateSuiteItemsReq;
import com.skillstack.suite.service.SuiteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Suite (collection) 接口。所有越权治理见 SuiteService。
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class SuiteController {

    private final SuiteService suiteService;

    /** 团队套件列表（分页）。仅团队成员可见全量；外部仅 PUBLIC。 */
    @GetMapping("/teams/{teamId}/suites")
    public ApiResponse<PageResult<SuiteListItem>> listByTeam(
            @PathVariable Long teamId,
            @RequestParam(required = false) String visibility,
            PageQuery pq,
            @AuthenticationPrincipal CurrentUser me) {
        Long uid = me == null ? null : me.getId();
        return ApiResponse.ok(suiteService.listByTeam(teamId, visibility, pq, uid));
    }

    /**
     * 套件详情：必须按 (team, slug) 双键定位（SUITE-022）。
     * 公开 suite 任何登录用户可见；私有 suite 仅团队成员。
     */
    @GetMapping("/teams/{teamId}/suites/by-slug/{slug}")
    public ApiResponse<SuiteDetail> getByTeamSlug(@PathVariable Long teamId,
                                                  @PathVariable String slug,
                                                  @AuthenticationPrincipal CurrentUser me) {
        Long uid = me == null ? null : me.getId();
        return ApiResponse.ok(suiteService.getByTeamAndSlug(teamId, slug, uid));
    }

    /**
     * 同时兼容旧路径 GET /api/suites/{slug}：必须搭配 teamId query 参数定位团队。
     * 之前仅按 slug 全局查会跨团队串数据 — 现在缺 teamId 直接 400。
     */
    @GetMapping("/suites/{slug}")
    public ApiResponse<SuiteDetail> getBySlug(@PathVariable String slug,
                                              @RequestParam(value = "teamId", required = false) Long teamId,
                                              @AuthenticationPrincipal CurrentUser me) {
        Long uid = me == null ? null : me.getId();
        return ApiResponse.ok(suiteService.getByTeamAndSlug(teamId, slug, uid));
    }

    /** 创建套件 — Writer 写权限。 */
    @PostMapping("/teams/{teamId}/suites")
    public ApiResponse<SuiteDetail> create(
            @PathVariable Long teamId,
            @Valid @RequestBody CreateSuiteReq req,
            @AuthenticationPrincipal CurrentUser me) {
        Long uid = me == null ? null : me.getId();
        return ApiResponse.ok(suiteService.create(teamId, req, uid));
    }

    /** 更新套件内部 skill 列表（整体替换 + 排序）— Writer 写权限。 */
    @PutMapping("/suites/{id}/items")
    public ApiResponse<SuiteDetail> updateItems(
            @PathVariable Long id,
            @Valid @RequestBody UpdateSuiteItemsReq req,
            @AuthenticationPrincipal CurrentUser me) {
        Long uid = me == null ? null : me.getId();
        return ApiResponse.ok(suiteService.updateItems(id, req, uid));
    }

    /** 删除套件 — Writer 写权限。 */
    @DeleteMapping("/suites/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id,
                                    @AuthenticationPrincipal CurrentUser me) {
        Long uid = me == null ? null : me.getId();
        suiteService.delete(id, uid);
        return ApiResponse.ok();
    }

    /** 安装计数 +1（登录即可，并按可见性/membership 校验）。 */
    @PostMapping("/suites/{id}/install")
    public ApiResponse<Map<String, Object>> install(@PathVariable Long id,
                                                    @AuthenticationPrincipal CurrentUser me) {
        Long uid = me == null ? null : me.getId();
        int installs = suiteService.install(id, uid);
        return ApiResponse.ok(Map.of("installs", installs));
    }
}
