package com.skillstack.auth.service;

import com.skillstack.auth.dto.ChangePasswordReq;
import com.skillstack.auth.dto.ChangePhoneReq;
import com.skillstack.auth.dto.MeRes;
import com.skillstack.auth.dto.UpdateMeProfileReq;
import com.skillstack.auth.entity.User;
import com.skillstack.auth.mapper.UserMapper;
import com.skillstack.common.exception.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserServiceAccountTest {

    private UserMapper userMapper;
    private TestableUserService userService;
    private PasswordEncoder passwordEncoder;

    @BeforeEach
    void setUp() {
        userMapper = mock(UserMapper.class);
        passwordEncoder = new BCryptPasswordEncoder();
        userService = new TestableUserService(userMapper, passwordEncoder);
    }

    @Test
    void updateProfileUpdatesCurrentUserFields() {
        User current = user(1L, "zhao_yc", "赵一辰", "old@example.test", "13900001111", "旧", "password");
        when(userMapper.selectById(1L)).thenReturn(current);
        when(userMapper.selectOne(any())).thenReturn(null);
        when(userMapper.updateById(any(User.class))).thenReturn(1);

        UpdateMeProfileReq req = new UpdateMeProfileReq();
        req.setName("赵一辰 New");
        req.setEmail(" New@Example.Test ");
        req.setAvatar("赵");

        MeRes res = userService.updateProfile(1L, req);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userMapper).updateById(captor.capture());
        User updated = captor.getValue();
        assertThat(updated.getId()).isEqualTo(1L);
        assertThat(updated.getName()).isEqualTo("赵一辰 New");
        assertThat(updated.getEmail()).isEqualTo("new@example.test");
        assertThat(updated.getAvatar()).isEqualTo("赵");
        assertThat(res.getId()).isEqualTo(1L);
    }

    @Test
    void updateProfileRejectsEmailUsedByAnotherUser() {
        User current = user(1L, "zhao_yc", "赵一辰", "old@example.test", "13900001111", "赵", "password");
        User other = user(2L, "lin_zr", "林子睿", "taken@example.test", "13900002222", "林", "password");
        when(userMapper.selectById(1L)).thenReturn(current);
        when(userMapper.selectOne(any())).thenReturn(other);

        UpdateMeProfileReq req = new UpdateMeProfileReq();
        req.setName("赵一辰");
        req.setEmail("taken@example.test");

        assertThatThrownBy(() -> userService.updateProfile(1L, req))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("邮箱");
        verify(userMapper, never()).updateById(any(User.class));
    }

    @Test
    void changePasswordRequiresCurrentPasswordAndStoresNewHash() {
        User current = user(1L, "zhao_yc", "赵一辰", "old@example.test", "13900001111", "赵", "old-password");
        when(userMapper.selectById(1L)).thenReturn(current);
        when(userMapper.updateById(any(User.class))).thenReturn(1);

        ChangePasswordReq req = new ChangePasswordReq();
        req.setCurrentPassword("old-password");
        req.setNewPassword("new-password");

        userService.changePassword(1L, req);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userMapper).updateById(captor.capture());
        String hash = captor.getValue().getPasswordHash();
        assertThat(passwordEncoder.matches("new-password", hash)).isTrue();
        assertThat(passwordEncoder.matches("old-password", hash)).isFalse();
    }

    @Test
    void changePasswordRejectsWrongCurrentPassword() {
        User current = user(1L, "zhao_yc", "赵一辰", "old@example.test", "13900001111", "赵", "old-password");
        when(userMapper.selectById(1L)).thenReturn(current);

        ChangePasswordReq req = new ChangePasswordReq();
        req.setCurrentPassword("wrong-password");
        req.setNewPassword("new-password");

        assertThatThrownBy(() -> userService.changePassword(1L, req))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("当前密码");
        verify(userMapper, never()).updateById(any(User.class));
    }

    @Test
    void changePhoneVerifiesSmsPasswordAndDuplicateBeforeUpdating() {
        User current = user(1L, "zhao_yc", "赵一辰", "old@example.test", "13900001111", "赵", "password");
        when(userMapper.selectById(1L)).thenReturn(current);
        when(userMapper.selectOne(any())).thenReturn(null);
        when(userMapper.updateById(any(User.class))).thenReturn(1);

        ChangePhoneReq req = new ChangePhoneReq();
        req.setCurrentPassword("password");
        req.setPhone("139-0000-2222");
        req.setSmsCode("123456");

        MeRes res = userService.changePhone(1L, req, (phone, code) -> {
            assertThat(phone).isEqualTo("13900002222");
            assertThat(code).isEqualTo("123456");
        });

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userMapper).updateById(captor.capture());
        assertThat(captor.getValue().getPhone()).isEqualTo("13900002222");
        assertThat(res.getPhone()).isEqualTo("13900002222");
    }

    @Test
    void changePhoneRejectsSmsVerifierFailure() {
        User current = user(1L, "zhao_yc", "赵一辰", "old@example.test", "13900001111", "赵", "password");
        when(userMapper.selectById(1L)).thenReturn(current);

        ChangePhoneReq req = new ChangePhoneReq();
        req.setCurrentPassword("password");
        req.setPhone("13900002222");
        req.setSmsCode("000000");

        assertThatThrownBy(() -> userService.changePhone(1L, req, (phone, code) -> {
            throw new BusinessException(40010, "验证码错误或已过期");
        }))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("验证码");
        verify(userMapper, never()).updateById(any(User.class));
    }

    @Test
    void changePhoneRejectsPhoneUsedByAnotherUser() {
        User current = user(1L, "zhao_yc", "赵一辰", "old@example.test", "13900001111", "赵", "password");
        User other = user(2L, "lin_zr", "林子睿", "taken@example.test", "13900002222", "林", "password");
        when(userMapper.selectById(1L)).thenReturn(current);
        when(userMapper.selectOne(any())).thenReturn(other);

        ChangePhoneReq req = new ChangePhoneReq();
        req.setCurrentPassword("password");
        req.setPhone("13900002222");
        req.setSmsCode("123456");

        assertThatThrownBy(() -> userService.changePhone(1L, req, (phone, code) -> {}))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("手机号");
        verify(userMapper, never()).updateById(any(User.class));
    }

    @Test
    void upsertByFeishuUserCreatesUserWithoutRequiredPhone() {
        when(userMapper.selectOne(any())).thenReturn(null);
        when(userMapper.selectCount(any())).thenReturn(0L);
        when(userMapper.insert(any(User.class))).thenReturn(1);

        FeishuAuthService.FeishuUserInfo info = FeishuAuthService.FeishuUserInfo.builder()
                .openId("ou_test")
                .unionId("on_test")
                .tenantKey("tenant_test")
                .name("飞书用户")
                .email("feishu@example.test")
                .mobile(null)
                .avatarUrl("https://example.test/avatar.png")
                .build();

        User created = userService.upsertByFeishuUser(info);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userMapper).insert(captor.capture());
        User saved = captor.getValue();
        assertThat(created).isSameAs(saved);
        assertThat(saved.getHandle()).startsWith("fs_ou_test");
        assertThat(saved.getName()).isEqualTo("飞书用户");
        assertThat(saved.getPhone()).isNull();
        assertThat(saved.getFeishuOpenId()).isEqualTo("ou_test");
        assertThat(saved.getFeishuTenantKey()).isEqualTo("tenant_test");
        assertThat(saved.getFeishuAvatarUrl()).isEqualTo("https://example.test/avatar.png");
        assertThat(passwordEncoder.matches("ou_test", saved.getPasswordHash())).isFalse();
    }

    private User user(Long id, String handle, String name, String email, String phone, String avatar, String password) {
        User u = new User();
        u.setId(id);
        u.setHandle(handle);
        u.setName(name);
        u.setEmail(email);
        u.setPhone(phone);
        u.setAvatar(avatar);
        u.setPasswordHash(passwordEncoder.encode(password));
        return u;
    }

    private static class TestableUserService extends UserService {
        TestableUserService(UserMapper userMapper, PasswordEncoder passwordEncoder) {
            super(userMapper, null, passwordEncoder, null, null);
        }

        @Override
        public MeRes buildMe(Long userId) {
            User u = getById(userId);
            return MeRes.builder()
                    .id(u.getId())
                    .handle(u.getHandle())
                    .name(u.getName())
                    .email(u.getEmail())
                    .phone(u.getPhone())
                    .avatar(u.getAvatar())
                    .build();
        }
    }
}
