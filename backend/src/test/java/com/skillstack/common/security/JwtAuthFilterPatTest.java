package com.skillstack.common.security;

import com.skillstack.auth.entity.User;
import com.skillstack.auth.mapper.UserMapper;
import com.skillstack.team.entity.Team;
import com.skillstack.team.entity.TeamMember;
import com.skillstack.team.mapper.TeamMapper;
import com.skillstack.team.mapper.TeamMemberMapper;
import com.skillstack.token.dto.CreateTokenReq;
import com.skillstack.token.dto.CreateTokenRes;
import com.skillstack.token.service.PersonalAccessTokenService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class JwtAuthFilterPatTest {

    @Autowired MockMvc mvc;
    @Autowired PersonalAccessTokenService svc;
    @Autowired UserMapper userMapper;
    @Autowired TeamMapper teamMapper;
    @Autowired TeamMemberMapper teamMemberMapper;

    Long userId; Long teamId; String secret;

    @BeforeEach
    void setup() {
        User u = new User();
        u.setHandle("filt_" + System.nanoTime());
        u.setName("X"); u.setEmail(u.getHandle()+"@t.local"); u.setPasswordHash("x");
        userMapper.insert(u); userId = u.getId();
        Team t = new Team(); t.setSlug("filt_"+System.nanoTime()); t.setName("T"); t.setOwnerId(userId); t.setMembersCount(1);
        teamMapper.insert(t); teamId = t.getId();
        TeamMember m = new TeamMember(); m.setTeamId(teamId); m.setUserId(userId); m.setRole("OWNER");
        teamMemberMapper.insert(m);
        CreateTokenReq req = new CreateTokenReq();
        req.setName("ci"); req.setKind("ci");
        CreateTokenRes r = svc.create(teamId, userId, req);
        secret = r.getSecret();
    }

    @Test
    void pat_allowed_on_skills_download_path() throws Exception {
        // PAT must not be rejected by the filter on /api/skills/<slug>/download even if the skill doesn't exist.
        // The controller will return 404 (or another 4xx), but NOT 401.
        mvc.perform(get("/api/skills/nonexistent/download").header("Authorization", "Bearer " + secret))
           .andExpect(status().is4xxClientError());
    }

    @Test
    void pat_rejected_on_unrelated_path() throws Exception {
        mvc.perform(get("/api/teams/mine").header("Authorization", "Bearer " + secret))
           .andExpect(status().isForbidden());
    }

    @Test
    void invalid_pat_returns_401() throws Exception {
        mvc.perform(get("/api/skills/x/download").header("Authorization", "Bearer lst_invalid_secret"))
           .andExpect(status().isUnauthorized());
    }

    @Test
    void anonymous_can_list_public_prompts() throws Exception {
        mvc.perform(get("/api/prompts"))
           .andExpect(status().isOk());
    }

    @Test
    void anonymous_prompt_detail_path_reaches_controller() throws Exception {
        mvc.perform(get("/api/teams/no-such-team/prompts/no-such-prompt"))
           .andDo(res -> {
               int status = res.getResponse().getStatus();
               org.junit.jupiter.api.Assertions.assertNotEquals(401, status);
               org.junit.jupiter.api.Assertions.assertNotEquals(403, status);
           });
    }

    @Test
    void anonymous_prompt_download_path_reaches_controller() throws Exception {
        mvc.perform(get("/api/teams/no-such-team/prompts/no-such-prompt/download"))
           .andDo(res -> {
               int status = res.getResponse().getStatus();
               org.junit.jupiter.api.Assertions.assertNotEquals(401, status);
               org.junit.jupiter.api.Assertions.assertNotEquals(403, status);
           });
    }

    @Test
    void pat_allowed_on_skill_versions_list() throws Exception {
        // /api/skills/<slug>/versions (no trailing segment) must pass through the filter.
        // Skill doesn't exist; controller will return 4xx, but the filter must not 403.
        mvc.perform(get("/api/skills/nonexistent/versions").header("Authorization", "Bearer " + secret))
           .andDo(res -> {
               int status = res.getResponse().getStatus();
               org.junit.jupiter.api.Assertions.assertNotEquals(401, status, "filter must not 401");
               org.junit.jupiter.api.Assertions.assertNotEquals(403, status, "filter must not 403");
           });
    }

    @Test
    void pat_allowed_on_prompt_download_path() throws Exception {
        mvc.perform(get("/api/teams/no-such-team/prompts/no-such-prompt/download")
                        .header("Authorization", "Bearer " + secret))
           .andDo(res -> {
               int status = res.getResponse().getStatus();
               org.junit.jupiter.api.Assertions.assertNotEquals(401, status);
               org.junit.jupiter.api.Assertions.assertNotEquals(403, status);
           });
    }

    @Test
    void pat_allowed_on_prompt_id_consumption_paths() throws Exception {
        for (String path : new String[] {
                "/api/prompts/999999",
                "/api/prompts/999999/download",
                "/api/prompts/999999/versions",
                "/api/prompts/999999/versions/0.1.0"
        }) {
            mvc.perform(get(path).header("Authorization", "Bearer " + secret))
               .andDo(res -> {
                   int status = res.getResponse().getStatus();
                   org.junit.jupiter.api.Assertions.assertNotEquals(401, status, path);
                   org.junit.jupiter.api.Assertions.assertNotEquals(403, status, path);
               });
        }
    }

    @Test
    void pat_rejected_on_prompt_create() throws Exception {
        mvc.perform(post("/api/prompts")
                        .header("Authorization", "Bearer " + secret)
                        .contentType("application/json")
                        .content("{}"))
           .andExpect(status().isForbidden());
    }

    @Test
    void pat_allowed_on_team_suite_list() throws Exception {
        mvc.perform(get("/api/teams/" + teamId + "/suites").header("Authorization", "Bearer " + secret))
           .andExpect(status().isOk());
    }

    @Test
    void pat_allowed_on_suite_by_slug() throws Exception {
        mvc.perform(get("/api/teams/" + teamId + "/suites/by-slug/no-such-suite").header("Authorization", "Bearer " + secret))
           .andDo(res -> {
               int status = res.getResponse().getStatus();
               org.junit.jupiter.api.Assertions.assertNotEquals(401, status);
               org.junit.jupiter.api.Assertions.assertNotEquals(403, status);
           });
    }

    @Test
    void pat_allowed_on_suite_install_counter() throws Exception {
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                    .post("/api/suites/999999/install")
                    .header("Authorization", "Bearer " + secret))
           .andDo(res -> {
               int status = res.getResponse().getStatus();
               org.junit.jupiter.api.Assertions.assertNotEquals(401, status);
               org.junit.jupiter.api.Assertions.assertNotEquals(403, status);
           });
    }

    @Test
    void pat_rejected_on_auth_me() throws Exception {
        // Regression: PAT must not gain access to /api/auth/me even though it's an authenticated endpoint.
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + secret))
           .andExpect(status().isForbidden());
    }

    @Test
    void pat_rejected_on_skill_create() throws Exception {
        mvc.perform(post("/api/skills")
                        .header("Authorization", "Bearer " + secret)
                        .contentType("application/json")
                        .content("{}"))
           .andExpect(status().isForbidden());
    }

    @Test
    void pat_rejected_on_skill_upload_text() throws Exception {
        mvc.perform(post("/api/skills/versions/upload-text")
                        .header("Authorization", "Bearer " + secret)
                        .contentType("application/json")
                        .content("{\"content\":\"---\\nname: x\\nversion: 0.1.0\\ndescription: x\\n---\\n# x\"}"))
           .andExpect(status().isForbidden());
    }

    @Test
    void pat_rejected_on_skill_parse() throws Exception {
        mvc.perform(post("/api/skills/versions/parse")
                        .header("Authorization", "Bearer " + secret)
                        .contentType("application/json")
                        .content("{\"zipUrl\":\"skill-versions/1/x.zip\"}"))
           .andExpect(status().isForbidden());
    }
}
