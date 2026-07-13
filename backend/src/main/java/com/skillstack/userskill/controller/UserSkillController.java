package com.skillstack.userskill.controller;

import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.CurrentUser;
import com.skillstack.common.web.ApiResponse;
import com.skillstack.userskill.dto.UserSkillImportReq;
import com.skillstack.userskill.dto.UserSkillItem;
import com.skillstack.userskill.dto.UserSkillSubscribeReq;
import com.skillstack.userskill.service.UserSkillService;
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
@RequestMapping("/api/user-skills")
@RequiredArgsConstructor
public class UserSkillController {

    private final UserSkillService userSkillService;


    @GetMapping
    public ApiResponse<List<UserSkillItem>> listMine(@AuthenticationPrincipal CurrentUser me) {
        CurrentUser currentUser = requireLogin(me);
        return ApiResponse.ok(userSkillService.listMine(currentUser.getId()));
    }

    @PostMapping("/import")
    public ApiResponse<UserSkillItem> importPersonal(@AuthenticationPrincipal CurrentUser me,
                                                     @Valid @RequestBody UserSkillImportReq req) {
        CurrentUser currentUser = requireLogin(me);
        return ApiResponse.ok(userSkillService.importPersonal(currentUser.getId(), req));
    }

    @PostMapping("/subscribe")
    public ApiResponse<UserSkillItem> subscribe(@AuthenticationPrincipal CurrentUser me,
                                                @Valid @RequestBody UserSkillSubscribeReq req) {
        CurrentUser currentUser = requireLogin(me);
        return ApiResponse.ok(userSkillService.subscribe(currentUser.getId(), req));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteMine(@AuthenticationPrincipal CurrentUser me,
                                        @PathVariable Long id) {
        CurrentUser currentUser = requireLogin(me);
        userSkillService.deleteMine(currentUser.getId(), id);
        return ApiResponse.ok();
    }

    private CurrentUser requireLogin(CurrentUser me) {
        if (me == null) {
            throw new BusinessException(40100, "未登录");
        }
        return me;
    }
}
