package com.skillstack.token.controller;

import com.skillstack.common.security.CurrentUser;
import com.skillstack.common.security.TeamAccessGuard;
import com.skillstack.common.web.ApiResponse;
import com.skillstack.token.dto.CreateTokenReq;
import com.skillstack.token.dto.CreateTokenRes;
import com.skillstack.token.dto.TokenItemRes;
import com.skillstack.token.service.PersonalAccessTokenService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/teams/{teamId}/me/tokens")
public class PersonalAccessTokenController {

    private final PersonalAccessTokenService svc;
    private final TeamAccessGuard guard;

    @GetMapping
    public ApiResponse<List<TokenItemRes>> list(@PathVariable Long teamId,
                                                @AuthenticationPrincipal CurrentUser me) {
        Long uid = guard.requireLogin(me == null ? null : me.getId());
        return ApiResponse.ok(svc.list(teamId, uid));
    }

    @PostMapping
    public ApiResponse<CreateTokenRes> create(@PathVariable Long teamId,
                                              @AuthenticationPrincipal CurrentUser me,
                                              @Valid @RequestBody CreateTokenReq req) {
        Long uid = guard.requireLogin(me == null ? null : me.getId());
        return ApiResponse.ok(svc.create(teamId, uid, req));
    }

    @DeleteMapping("/{tokenId}")
    public ApiResponse<Void> revoke(@PathVariable Long teamId,
                                    @PathVariable Long tokenId,
                                    @AuthenticationPrincipal CurrentUser me) {
        Long uid = guard.requireLogin(me == null ? null : me.getId());
        svc.revoke(teamId, uid, tokenId);
        return ApiResponse.ok(null);
    }
}
