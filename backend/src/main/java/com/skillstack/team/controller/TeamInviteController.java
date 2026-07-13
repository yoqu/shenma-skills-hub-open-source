package com.skillstack.team.controller;

import com.skillstack.common.security.CurrentUser;
import com.skillstack.common.web.ApiResponse;
import com.skillstack.team.dto.CreateCodeReq;
import com.skillstack.team.dto.CreatePhoneInviteReq;
import com.skillstack.team.dto.InviteCodeRes;
import com.skillstack.team.dto.PhoneInviteRes;
import com.skillstack.team.entity.InviteCode;
import com.skillstack.team.entity.InvitePhone;
import com.skillstack.team.service.InviteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/teams/{teamId}/invites")
@RequiredArgsConstructor
public class TeamInviteController {

    private final InviteService inviteService;

    // ---------------- 邀请码 ----------------

    @GetMapping("/codes")
    public ApiResponse<List<InviteCodeRes>> listCodes(@PathVariable Long teamId,
                                                      @AuthenticationPrincipal CurrentUser me) {
        return ApiResponse.ok(inviteService.listCodes(teamId, me.getId()));
    }

    @PostMapping("/codes")
    public ApiResponse<InviteCode> createCode(@PathVariable Long teamId,
                                              @AuthenticationPrincipal CurrentUser me,
                                              @Valid @RequestBody CreateCodeReq req) {
        return ApiResponse.ok(inviteService.createCode(teamId, me.getId(), req));
    }

    @DeleteMapping("/codes/{id}")
    public ApiResponse<Void> revokeCode(@PathVariable Long teamId,
                                        @PathVariable("id") Long codeId,
                                        @AuthenticationPrincipal CurrentUser me) {
        inviteService.revokeCode(teamId, codeId, me.getId());
        return ApiResponse.ok();
    }

    // ---------------- 手机邀请 ----------------

    @GetMapping("/phones")
    public ApiResponse<List<PhoneInviteRes>> listPhones(@PathVariable Long teamId,
                                                        @AuthenticationPrincipal CurrentUser me) {
        return ApiResponse.ok(inviteService.listPhones(teamId, me.getId()));
    }

    @PostMapping("/phones")
    public ApiResponse<InvitePhone> createPhoneInvite(@PathVariable Long teamId,
                                                      @AuthenticationPrincipal CurrentUser me,
                                                      @Valid @RequestBody CreatePhoneInviteReq req) {
        return ApiResponse.ok(inviteService.createPhoneInvite(teamId, me.getId(), req));
    }

    @PostMapping("/phones/{id}/cancel")
    public ApiResponse<Void> cancelPhoneInvite(@PathVariable Long teamId,
                                               @PathVariable("id") Long inviteId,
                                               @AuthenticationPrincipal CurrentUser me) {
        inviteService.cancelPhoneInvite(teamId, inviteId, me.getId());
        return ApiResponse.ok();
    }

    /** 被邀请人接受定向邀请，加入团队。 */
    @PostMapping("/phones/{id}/accept")
    public ApiResponse<Void> acceptPhoneInvite(@PathVariable Long teamId,
                                               @PathVariable("id") Long inviteId,
                                               @AuthenticationPrincipal CurrentUser me) {
        inviteService.acceptPhoneInvite(teamId, inviteId, me.getId());
        return ApiResponse.ok();
    }
}
