package com.skillstack.auth.oauth.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillstack.auth.entity.User;
import com.skillstack.auth.mapper.UserMapper;
import com.skillstack.auth.oauth.entity.UserOAuthIdentity;
import com.skillstack.auth.oauth.mapper.UserOAuthIdentityMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class OAuthIdentityServiceTest {

    private UserOAuthIdentityMapper identityMapper;
    private UserMapper userMapper;
    private OAuthIdentityService service;

    @BeforeEach
    void setUp() {
        identityMapper = mock(UserOAuthIdentityMapper.class);
        userMapper = mock(UserMapper.class);
        service = new OAuthIdentityService(
                identityMapper,
                userMapper,
                new BCryptPasswordEncoder(),
                new ObjectMapper()
        );
    }

    @Test
    void firstLoginCreatesUserAndIdentity() {
        when(identityMapper.selectOne(any())).thenReturn(null);
        when(userMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(0L);
        doAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(42L);
            return 1;
        }).when(userMapper).insert(any(User.class));
        when(identityMapper.insert(any(UserOAuthIdentity.class))).thenReturn(1);
        when(userMapper.selectById(42L)).thenReturn(buildUser(42L, "cooluser"));

        OAuthIdentityService.OAuthProfile profile = new OAuthIdentityService.OAuthProfile(
                "uid_123", null, "cooluser", "Cool User", "cool@example.com", null, null);

        User user = service.loginOrCreate("linux_do", profile);
        assertThat(user.getId()).isEqualTo(42L);
    }

    @Test
    void existingIdentityReturnsExistingUser() {
        UserOAuthIdentity identity = new UserOAuthIdentity();
        identity.setUserId(7L);
        identity.setProvider("feishu");
        identity.setProviderUserId("ou_abc");
        when(identityMapper.selectOne(any())).thenReturn(identity);
        when(identityMapper.updateById(any())).thenReturn(1);
        User existing = buildUser(7L, "feishu_user");
        when(userMapper.selectById(7L)).thenReturn(existing);
        when(userMapper.updateById(any())).thenReturn(1);

        OAuthIdentityService.OAuthProfile profile = new OAuthIdentityService.OAuthProfile(
                "ou_abc", "union_abc", null, "飞书用户", null, null, null);

        User user = service.loginOrCreate("feishu", profile);
        assertThat(user.getId()).isEqualTo(7L);
    }

    @Test
    void handleConflictAppendsSuffix() {
        when(identityMapper.selectOne(any())).thenReturn(null);
        when(userMapper.selectCount(any(LambdaQueryWrapper.class)))
                .thenReturn(1L, 1L, 0L);
        doAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(99L);
            return 1;
        }).when(userMapper).insert(any(User.class));
        when(identityMapper.insert(any())).thenReturn(1);
        when(userMapper.selectById(99L)).thenReturn(buildUser(99L, "alice_3"));

        OAuthIdentityService.OAuthProfile profile = new OAuthIdentityService.OAuthProfile(
                "uid_alice", null, "alice", "Alice", null, null, null);

        User user = service.loginOrCreate("linux_do", profile);
        assertThat(user.getHandle()).isEqualTo("alice_3");
    }

    @Test
    void emailFallbackWhenEmailTaken() {
        when(identityMapper.selectOne(any())).thenReturn(null);
        when(userMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(0L, 1L, 0L);
        doAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(55L);
            assertThat(u.getEmail()).endsWith("@oauth.local");
            return 1;
        }).when(userMapper).insert(any(User.class));
        when(identityMapper.insert(any())).thenReturn(1);
        when(userMapper.selectById(55L)).thenReturn(buildUser(55L, "taken_user"));

        OAuthIdentityService.OAuthProfile profile = new OAuthIdentityService.OAuthProfile(
                "uid_taken", null, "taken_user", "Taken", "taken@example.com", null, null);

        service.loginOrCreate("linux_do", profile);
    }

    private User buildUser(Long id, String handle) {
        User u = new User();
        u.setId(id);
        u.setHandle(handle);
        return u;
    }
}
