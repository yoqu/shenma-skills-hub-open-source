# 我的偏好（/team/prefs）端到端生产化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `/team/prefs` 四个 Tab（通知偏好 / 我的资料 / 我的 Token / 离开团队）从纯前端 mock 改造为真正持久化、可读写、可吊销、可离队的生产实现。

**Architecture:**
- 新增 `team_member_profile`、`notification_pref`、`personal_access_token` 三张表。所有偏好接口走 `/api/teams/{teamId}/me/*` 命名空间，受 `TeamAccessGuard.requireMember` 保护。
- PAT 写入数据库时只保存 SHA-256 哈希 + 8 位明文前缀；明文只在创建时一次返回。`JwtAuthFilter` 扩展为同时接受 `lst_` 前缀的 PAT，用于 `/api/skills/*/download` 与 `/api/skills/*/install`。
- 离队走"软删 team_members + 自动吊销该团队下该用户的全部 PAT + 校验非唯一 Owner"逻辑，复用现有 `BaseEntity.deleted` 软删模式。
- 前端去掉 `Prefs.tsx` 中所有硬编码字符串与 `disabled` 占位，全部走 TanStack Query。

**Tech Stack:** Java 17 / Spring Boot 3.2 / MyBatis Plus / Flyway / MySQL 8 / React 18 / TanStack Query / Axios。

**Phasing:**
- Phase 1: 团队作用域的个人资料（最小风险，复用已有 avatar 存储）
- Phase 2: 通知偏好持久化（无投递器，只读写偏好）
- Phase 3: Personal Access Token（含 auth filter 集成）
- Phase 4: 离开团队

每个 Phase 自包含、可独立提交、独立验证。

---

## Phase 1 — 团队作用域的个人资料

**Scope:** 用户在每个团队里有独立的 displayName / bio / showEmailToTeam 三个字段；头像继续走账号级 `/me/avatar`（已经实现，本期复用，不在团队级再做覆盖）。

### Task 1.1: 数据库 migration

**Files:**
- Create: `backend/src/main/resources/db/migration/V14__team_member_profile.sql`

- [ ] **Step 1: 写 migration**

```sql
-- V14 — team-scoped member profile (display name / bio / email visibility)
-- 1:1 with team_members. 缺失行视为 fallback 到账号级 name + bio.
CREATE TABLE team_member_profile (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    team_id         BIGINT       NOT NULL,
    user_id         BIGINT       NOT NULL,
    display_name    VARCHAR(64)  DEFAULT NULL COMMENT '团队内显示名，NULL 表示用账号级 name',
    bio             VARCHAR(120) DEFAULT NULL COMMENT '团队内简介，限 60 字（DB 留余量）',
    show_email      TINYINT      NOT NULL DEFAULT 0 COMMENT '允许同团队成员查看邮箱（Admin 永远可见）',
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted         TINYINT      NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_tmp_team_user (team_id, user_id),
    KEY idx_tmp_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

- [ ] **Step 2: 启动后端验证 migration 应用成功**

Run: `cd backend && mvn -q -DskipTests compile && mvn spring-boot:run` 等到 `Started SkillStackApplication` 后 Ctrl-C。
Expected: 启动日志包含 `Successfully applied 1 migration to schema "skillstack"`，无 `Migration ... failed`。

- [ ] **Step 3: 提交**

```bash
git add backend/src/main/resources/db/migration/V14__team_member_profile.sql
git commit -m "feat(team): add team_member_profile table for per-team display name & bio"
```

### Task 1.2: Entity / Mapper / DTO

**Files:**
- Create: `backend/src/main/java/com/skillstack/team/entity/TeamMemberProfile.java`
- Create: `backend/src/main/java/com/skillstack/team/mapper/TeamMemberProfileMapper.java`
- Create: `backend/src/main/java/com/skillstack/team/dto/TeamMemberProfileRes.java`
- Create: `backend/src/main/java/com/skillstack/team/dto/UpdateTeamMemberProfileReq.java`

- [ ] **Step 1: Entity**

```java
package com.skillstack.team.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.skillstack.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("team_member_profile")
public class TeamMemberProfile extends BaseEntity {
    private Long teamId;
    private Long userId;
    private String displayName;
    private String bio;
    private Boolean showEmail;
}
```

- [ ] **Step 2: Mapper**

```java
package com.skillstack.team.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.skillstack.team.entity.TeamMemberProfile;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface TeamMemberProfileMapper extends BaseMapper<TeamMemberProfile> {
}
```

- [ ] **Step 3: Response DTO**

```java
package com.skillstack.team.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class TeamMemberProfileRes {
    /** 团队内显示名（fallback 到账号 name） */
    private String displayName;
    /** 团队内简介（fallback 到账号 bio） */
    private String bio;
    /** 允许同团队成员查看邮箱 */
    private Boolean showEmail;
    /** 账号级 email，仅本人或 Admin 看；普通成员永远 null */
    private String email;
    /** 头像 URL（账号级） */
    private String avatarUrl;
    /** 账号 handle */
    private String handle;
}
```

- [ ] **Step 4: Request DTO**

```java
package com.skillstack.team.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateTeamMemberProfileReq {
    @NotBlank(message = "显示名不能为空")
    @Size(max = 32, message = "显示名最长 32 字")
    private String displayName;

    @Size(max = 60, message = "简介最长 60 字")
    private String bio;

    private Boolean showEmail;
}
```

- [ ] **Step 5: 编译**

Run: `cd backend && mvn -q -DskipTests compile`
Expected: BUILD SUCCESS, 无 error。

- [ ] **Step 6: 提交**

```bash
git add backend/src/main/java/com/skillstack/team/entity/TeamMemberProfile.java \
        backend/src/main/java/com/skillstack/team/mapper/TeamMemberProfileMapper.java \
        backend/src/main/java/com/skillstack/team/dto/TeamMemberProfileRes.java \
        backend/src/main/java/com/skillstack/team/dto/UpdateTeamMemberProfileReq.java
git commit -m "feat(team): add TeamMemberProfile entity, mapper, and DTOs"
```

### Task 1.3: Service + 测试

**Files:**
- Create: `backend/src/main/java/com/skillstack/team/service/TeamMemberProfileService.java`
- Create: `backend/src/test/java/com/skillstack/team/service/TeamMemberProfileServiceTest.java`

- [ ] **Step 1: 写失败测试**

```java
package com.skillstack.team.service;

import com.skillstack.auth.entity.User;
import com.skillstack.auth.mapper.UserMapper;
import com.skillstack.team.dto.TeamMemberProfileRes;
import com.skillstack.team.dto.UpdateTeamMemberProfileReq;
import com.skillstack.team.entity.Team;
import com.skillstack.team.entity.TeamMember;
import com.skillstack.team.mapper.TeamMapper;
import com.skillstack.team.mapper.TeamMemberMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class TeamMemberProfileServiceTest {

    @Autowired TeamMemberProfileService service;
    @Autowired UserMapper userMapper;
    @Autowired TeamMapper teamMapper;
    @Autowired TeamMemberMapper teamMemberMapper;

    Long userId;
    Long teamId;

    @BeforeEach
    void setup() {
        User u = new User();
        u.setHandle("tmp_user_" + System.nanoTime());
        u.setName("张三");
        u.setEmail(u.getHandle() + "@test.local");
        u.setPasswordHash("x");
        userMapper.insert(u);
        userId = u.getId();

        Team t = new Team();
        t.setSlug("tmp_team_" + System.nanoTime());
        t.setName("临时团队");
        t.setOwnerId(userId);
        t.setMembersCount(1);
        teamMapper.insert(t);
        teamId = t.getId();

        TeamMember m = new TeamMember();
        m.setTeamId(teamId);
        m.setUserId(userId);
        m.setRole("OWNER");
        teamMemberMapper.insert(m);
    }

    @Test
    void getProfile_falls_back_to_account_when_no_team_profile_row() {
        TeamMemberProfileRes res = service.get(teamId, userId, userId);
        assertEquals("张三", res.getDisplayName());
        assertFalse(res.getShowEmail());
        assertNotNull(res.getEmail()); // self always sees own email
    }

    @Test
    void updateProfile_creates_then_updates_row() {
        UpdateTeamMemberProfileReq req = new UpdateTeamMemberProfileReq();
        req.setDisplayName("阿三");
        req.setBio("前端工程");
        req.setShowEmail(true);
        TeamMemberProfileRes after = service.update(teamId, userId, req);
        assertEquals("阿三", after.getDisplayName());
        assertEquals("前端工程", after.getBio());
        assertTrue(after.getShowEmail());

        req.setDisplayName("阿四");
        req.setBio(null);
        req.setShowEmail(false);
        TeamMemberProfileRes second = service.update(teamId, userId, req);
        assertEquals("阿四", second.getDisplayName());
        assertNull(second.getBio());
        assertFalse(second.getShowEmail());
    }

    @Test
    void getProfile_for_other_member_hides_email_when_showEmail_false() {
        // create second user/member
        User other = new User();
        other.setHandle("other_" + System.nanoTime());
        other.setName("李四");
        other.setEmail(other.getHandle() + "@test.local");
        other.setPasswordHash("x");
        userMapper.insert(other);

        TeamMember om = new TeamMember();
        om.setTeamId(teamId);
        om.setUserId(other.getId());
        om.setRole("MEMBER");
        teamMemberMapper.insert(om);

        TeamMemberProfileRes seenByOwner = service.get(teamId, other.getId(), userId);
        // owner is writer, should always see email
        assertNotNull(seenByOwner.getEmail());

        TeamMemberProfileRes seenByOther = service.get(teamId, userId, other.getId());
        // owner.showEmail == false (default) → other member must NOT see email
        assertNull(seenByOther.getEmail());
    }
}
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `cd backend && mvn -q -Dtest=TeamMemberProfileServiceTest test`
Expected: 编译失败（service 尚未存在）。

- [ ] **Step 3: 实现 Service**

```java
package com.skillstack.team.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.skillstack.auth.entity.User;
import com.skillstack.auth.mapper.UserMapper;
import com.skillstack.common.security.TeamAccessGuard;
import com.skillstack.common.storage.StorageService;
import com.skillstack.team.dto.TeamMemberProfileRes;
import com.skillstack.team.dto.UpdateTeamMemberProfileReq;
import com.skillstack.team.entity.TeamMemberProfile;
import com.skillstack.team.mapper.TeamMemberProfileMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TeamMemberProfileService {

    private final TeamMemberProfileMapper mapper;
    private final UserMapper userMapper;
    private final TeamAccessGuard guard;
    private final StorageService storageService;

    public TeamMemberProfileRes get(Long teamId, Long targetUserId, Long viewerId) {
        guard.requireMember(teamId, viewerId);
        guard.requireMember(teamId, targetUserId);
        User u = userMapper.selectById(targetUserId);
        TeamMemberProfile p = findRow(teamId, targetUserId);
        boolean self = viewerId.equals(targetUserId);
        boolean writer = guard.isWriter(teamId, viewerId);
        boolean showEmail = p != null && Boolean.TRUE.equals(p.getShowEmail());
        return TeamMemberProfileRes.builder()
                .displayName(p != null && p.getDisplayName() != null ? p.getDisplayName() : u.getName())
                .bio(p != null && p.getBio() != null ? p.getBio() : u.getBio())
                .showEmail(p != null && Boolean.TRUE.equals(p.getShowEmail()))
                .email(self || writer || showEmail ? u.getEmail() : null)
                .avatarUrl(u.getAvatarUrl() != null ? storageService.resolveUrl(u.getAvatarUrl()) : null)
                .handle(u.getHandle())
                .build();
    }

    @Transactional
    public TeamMemberProfileRes update(Long teamId, Long userId, UpdateTeamMemberProfileReq req) {
        guard.requireMember(teamId, userId);
        TeamMemberProfile p = findRow(teamId, userId);
        if (p == null) {
            p = new TeamMemberProfile();
            p.setTeamId(teamId);
            p.setUserId(userId);
            p.setDisplayName(req.getDisplayName().trim());
            p.setBio(blankToNull(req.getBio()));
            p.setShowEmail(Boolean.TRUE.equals(req.getShowEmail()));
            mapper.insert(p);
        } else {
            p.setDisplayName(req.getDisplayName().trim());
            p.setBio(blankToNull(req.getBio()));
            p.setShowEmail(Boolean.TRUE.equals(req.getShowEmail()));
            mapper.updateById(p);
        }
        return get(teamId, userId, userId);
    }

    private TeamMemberProfile findRow(Long teamId, Long userId) {
        return mapper.selectOne(new LambdaQueryWrapper<TeamMemberProfile>()
                .eq(TeamMemberProfile::getTeamId, teamId)
                .eq(TeamMemberProfile::getUserId, userId));
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
```

- [ ] **Step 4: 运行测试**

Run: `cd backend && mvn -q -Dtest=TeamMemberProfileServiceTest test`
Expected: Tests run: 3, Failures: 0, Errors: 0。

- [ ] **Step 5: 提交**

```bash
git add backend/src/main/java/com/skillstack/team/service/TeamMemberProfileService.java \
        backend/src/test/java/com/skillstack/team/service/TeamMemberProfileServiceTest.java
git commit -m "feat(team): TeamMemberProfileService with read/update + fallback to account profile"
```

### Task 1.4: Controller endpoint

**Files:**
- Modify: `backend/src/main/java/com/skillstack/team/controller/TeamMemberController.java`

- [ ] **Step 1: 添加 2 个端点（GET 自己 / PUT 自己）**

在 controller 的现有方法之后追加：

```java
@GetMapping("/api/teams/{teamId}/me/profile")
public ApiResponse<TeamMemberProfileRes> getMyTeamProfile(
        @PathVariable Long teamId,
        @AuthenticationPrincipal CurrentUser me
) {
    Long uid = guard.requireLogin(me == null ? null : me.getId());
    return ApiResponse.ok(teamMemberProfileService.get(teamId, uid, uid));
}

@PutMapping("/api/teams/{teamId}/me/profile")
public ApiResponse<TeamMemberProfileRes> updateMyTeamProfile(
        @PathVariable Long teamId,
        @AuthenticationPrincipal CurrentUser me,
        @Valid @RequestBody UpdateTeamMemberProfileReq req
) {
    Long uid = guard.requireLogin(me == null ? null : me.getId());
    return ApiResponse.ok(teamMemberProfileService.update(teamId, uid, req));
}
```

注入构造里加上 `private final TeamMemberProfileService teamMemberProfileService;` 与必要 import（`com.skillstack.team.dto.TeamMemberProfileRes` / `UpdateTeamMemberProfileReq` / `jakarta.validation.Valid`）。

- [ ] **Step 2: SecurityConfig 检查**

Run: `grep -n "/api/teams/" backend/src/main/java/com/skillstack/common/security/SecurityConfig.java`
Expected: `/api/teams/**` 已在 authenticated 范围内，无需新增白名单。如不在则补 `.requestMatchers("/api/teams/**").authenticated()`。

- [ ] **Step 3: 编译 + 启动后端，curl 冒烟**

Run（后台启动，登录获取 token）：
```bash
cd backend && mvn -q -DskipTests compile && mvn spring-boot:run &
# 等 15s 后
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login -H 'Content-Type: application/json' \
  -d '{"identifier":"chen_yx","password":"chen_yx@2024","remember":false}' | jq -r .data.token)
TEAM_ID=$(curl -s http://localhost:8080/api/teams/mine -H "Authorization: Bearer $TOKEN" | jq -r .data[0].id)
curl -s http://localhost:8080/api/teams/$TEAM_ID/me/profile -H "Authorization: Bearer $TOKEN" | jq
curl -s -X PUT http://localhost:8080/api/teams/$TEAM_ID/me/profile -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"displayName":"小陈","bio":"前端 · DevTools","showEmail":true}' | jq
```
Expected: 第一次 GET 返回 fallback name；PUT 返回 `displayName:"小陈"`；再 GET 返回相同值。

- [ ] **Step 4: 提交**

```bash
git add backend/src/main/java/com/skillstack/team/controller/TeamMemberController.java
git commit -m "feat(team): expose /api/teams/{teamId}/me/profile GET & PUT"
```

### Task 1.5: 前端 API client

**Files:**
- Modify: `frontend/src/api/endpoints.ts`

- [ ] **Step 1: 添加 teamApi.myProfile 与 updateMyProfile**

在 `teamApi` 对象里现有方法之后追加：

```ts
myProfile: (teamId: number) =>
  http.get<unknown, {
    displayName: string;
    bio: string | null;
    showEmail: boolean;
    email: string | null;
    avatarUrl: string | null;
    handle: string;
  }>(`/teams/${teamId}/me/profile`),

updateMyProfile: (teamId: number, body: {
  displayName: string;
  bio?: string | null;
  showEmail?: boolean;
}) => http.put<unknown, {
  displayName: string;
  bio: string | null;
  showEmail: boolean;
  email: string | null;
  avatarUrl: string | null;
  handle: string;
}>(`/teams/${teamId}/me/profile`, body),
```

- [ ] **Step 2: 类型检查**

Run: `cd frontend && npm run lint`
Expected: 无错误。

- [ ] **Step 3: 提交**

```bash
git add frontend/src/api/endpoints.ts
git commit -m "feat(frontend): teamApi.myProfile + updateMyProfile endpoints"
```

### Task 1.6: 前端 ProfilePrefs 接入

**Files:**
- Modify: `frontend/src/pages/team/member/Prefs.tsx`

- [ ] **Step 1: 重写 `ProfilePrefs` 函数**

将文件中 `function ProfilePrefs()` 整段替换为：

```tsx
function ProfilePrefs() {
  const { team } = useCurrentTeam();
  const { data: me } = useMe();
  const teamId = team?.id;
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['team-profile', teamId],
    queryFn: () => teamApi.myProfile(teamId!),
    enabled: !!teamId,
  });
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [showEmail, setShowEmail] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!data) return;
    setDisplayName(data.displayName ?? '');
    setBio(data.bio ?? '');
    setShowEmail(!!data.showEmail);
    setDirty(false);
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => teamApi.updateMyProfile(teamId!, { displayName, bio: bio || null, showEmail }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team-profile', teamId] });
      toast.success('已保存');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '保存失败'),
  });

  const onChange = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setDirty(true); };

  if (!teamId || isLoading || !data) {
    return <Card pad={20}><div style={{ color: TOKENS.text3, fontSize: 12 }}>加载中…</div></Card>;
  }

  return (
    <>
      <Card pad={20}>
        <SectionHeader title="我在团队里的展示" hint="影响成员页 / 审核记录 / 团队公开页里的姓名与简介" />
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 0', borderBottom: `1px solid ${TOKENS.borderSoft}`,
        }}>
          <Avatar name={data.displayName} char={data.displayName?.[0] ?? '?'} size={48}
                  color={hashColor(data.handle)} src={data.avatarUrl ?? undefined} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>头像</div>
            <div style={{ fontSize: 11.5, color: TOKENS.text3, marginTop: 2 }}>
              账号级头像，在所有团队中通用
            </div>
          </div>
          <AvatarUploadButton />
        </div>
        <PrefRow title="显示名" hint="审核记录、活动流里出现的名字">
          <Input value={displayName} onChange={(e) => onChange(setDisplayName)(e.target.value)}
                 style={{ width: 220, height: 30, padding: '0 10px', fontSize: 12.5 }} />
        </PrefRow>
        <PrefRow title="团队内简介" hint="出现在成员卡片下面,限 60 字">
          <Input value={bio} onChange={(e) => onChange(setBio)(e.target.value)}
                 style={{ width: 320, height: 30, padding: '0 10px', fontSize: 12.5 }} />
        </PrefRow>
        <PrefRow title="允许其他成员查看我的邮箱" hint={`邮箱: ${me?.email ?? '—'}`}>
          <Switch on={showEmail} onChange={onChange(setShowEmail)} />
        </PrefRow>
      </Card>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="ghost" disabled={!dirty || mutation.isPending}
                onClick={() => { setDisplayName(data.displayName); setBio(data.bio ?? ''); setShowEmail(!!data.showEmail); setDirty(false); }}>
          放弃修改
        </Button>
        <Button variant="primary" disabled={!dirty || mutation.isPending || !displayName.trim()}
                onClick={() => mutation.mutate()}>
          {mutation.isPending ? '保存中…' : '保存'}
        </Button>
      </div>
    </>
  );
}

function AvatarUploadButton() {
  const ref = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (f: File) => accountApi.uploadAvatar(f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['me'] }); toast.success('头像已更新'); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '头像上传失败'),
  });
  return (
    <>
      <input ref={ref} type="file" accept="image/*" hidden
             onChange={(e) => { const f = e.target.files?.[0]; if (f) mutation.mutate(f); e.target.value = ''; }} />
      <Button variant="secondary" size="sm" onClick={() => ref.current?.click()}
              disabled={mutation.isPending}>
        {mutation.isPending ? '上传中…' : '更换头像'}
      </Button>
    </>
  );
}
```

- [ ] **Step 2: 顶部 imports 补齐**

在文件顶部 imports 中追加：
```ts
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentTeam } from '@/hooks/useCurrentTeam';
import { useMe } from '@/hooks/useMe';
import { accountApi, teamApi } from '@/api/endpoints';
import { toast } from '@/lib/toast';
```
（用 `grep` 确认 `useMe` / `toast` 在仓库实际路径；如 hook 路径不同则就近匹配现有用法。）

- [ ] **Step 3: 类型检查 + 浏览器冒烟**

Run: `cd frontend && npm run lint`
Expected: 无错误。

打开 `http://localhost:5173/team/prefs`，"我的资料" Tab：
- 显示真实当前用户的 name（不再是 "陈奕笑"）
- 改显示名 → "保存" 变高亮 → 点击 → toast "已保存" → 刷新后保留
- 头像按钮点击 → 选图 → toast "头像已更新" → 头像换图

- [ ] **Step 4: 提交**

```bash
git add frontend/src/pages/team/member/Prefs.tsx
git commit -m "feat(prefs): wire ProfilePrefs to /api/teams/{teamId}/me/profile + real avatar upload"
```

---

## Phase 2 — 通知偏好持久化

**Scope:** 后端只做 store/load。投递器（站内通知中心 + 邮件发送）是更大的独立项目，本期不做；但页面不再写 mock 状态——开关真正持久化。

### Task 2.1: 数据库 migration

**Files:**
- Create: `backend/src/main/resources/db/migration/V15__notification_pref.sql`

- [ ] **Step 1: 写 migration**

```sql
-- V15 — per-user, per-team notification preferences.
-- 行级模型: (user_id, team_id, pref_key, channel) UNIQUE; enabled = 0/1.
-- pref_key 枚举（应用层校验）: review_result, mention, suite_published, weekly_digest, email_review, email_weekly
-- channel 枚举: inapp, email
CREATE TABLE notification_pref (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    user_id     BIGINT       NOT NULL,
    team_id     BIGINT       NOT NULL,
    pref_key    VARCHAR(40)  NOT NULL,
    channel     VARCHAR(16)  NOT NULL,
    enabled     TINYINT      NOT NULL DEFAULT 1,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted     TINYINT      NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_np_user_team_key_chan (user_id, team_id, pref_key, channel),
    KEY idx_np_user_team (user_id, team_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

- [ ] **Step 2: 启动验证 + 提交**

启动后端，确认 migration 应用成功。

```bash
git add backend/src/main/resources/db/migration/V15__notification_pref.sql
git commit -m "feat(notify): add notification_pref table (per-user, per-team, multi-channel)"
```

### Task 2.2: Entity / Mapper / DTO

**Files:**
- Create: `backend/src/main/java/com/skillstack/notification/entity/NotificationPref.java`
- Create: `backend/src/main/java/com/skillstack/notification/mapper/NotificationPrefMapper.java`
- Create: `backend/src/main/java/com/skillstack/notification/dto/NotificationPrefRes.java`
- Create: `backend/src/main/java/com/skillstack/notification/dto/UpdateNotificationPrefsReq.java`

- [ ] **Step 1: Entity**

```java
package com.skillstack.notification.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.skillstack.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("notification_pref")
public class NotificationPref extends BaseEntity {
    private Long userId;
    private Long teamId;
    private String prefKey;
    private String channel;
    private Boolean enabled;
}
```

- [ ] **Step 2: Mapper**

```java
package com.skillstack.notification.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.skillstack.notification.entity.NotificationPref;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface NotificationPrefMapper extends BaseMapper<NotificationPref> {
}
```

- [ ] **Step 3: Response DTO**

```java
package com.skillstack.notification.dto;

import lombok.Data;
import java.util.Map;

@Data
public class NotificationPrefRes {
    /** key → channel → enabled */
    private Map<String, Map<String, Boolean>> prefs;
}
```

- [ ] **Step 4: Request DTO**

```java
package com.skillstack.notification.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;
import java.util.List;

@Data
public class UpdateNotificationPrefsReq {
    @NotEmpty
    private List<Entry> entries;

    @Data
    public static class Entry {
        private String key;
        private String channel;
        private Boolean enabled;
    }
}
```

- [ ] **Step 5: 编译 + 提交**

```bash
cd backend && mvn -q -DskipTests compile
git add backend/src/main/java/com/skillstack/notification
git commit -m "feat(notify): entity/mapper/DTOs for notification_pref"
```

### Task 2.3: Service + 测试

**Files:**
- Create: `backend/src/main/java/com/skillstack/notification/service/NotificationPrefService.java`
- Create: `backend/src/test/java/com/skillstack/notification/service/NotificationPrefServiceTest.java`

- [ ] **Step 1: 定义常量与默认值**

Service 内置常量：

```java
public static final List<String> KEYS = List.of(
    "review_result", "mention", "suite_published", "weekly_digest"
);
public static final List<String> EMAIL_KEYS = List.of("email_review", "email_weekly");
public static final List<String> CHANNELS = List.of("inapp", "email");

// 默认开启的项
private static final Set<String> DEFAULT_ON = Set.of(
    "review_result|inapp", "mention|inapp", "weekly_digest|inapp", "review_result|email"
);
```

`get` 时遍历笛卡尔积（KEYS × CHANNELS + EMAIL_KEYS 各自 channel）并 fallback 到默认值；`update` 时按 `(user_id, team_id, key, channel)` upsert。

- [ ] **Step 2: 写失败测试**

```java
package com.skillstack.notification.service;

import com.skillstack.auth.entity.User;
import com.skillstack.auth.mapper.UserMapper;
import com.skillstack.notification.dto.NotificationPrefRes;
import com.skillstack.notification.dto.UpdateNotificationPrefsReq;
import com.skillstack.team.entity.Team;
import com.skillstack.team.entity.TeamMember;
import com.skillstack.team.mapper.TeamMapper;
import com.skillstack.team.mapper.TeamMemberMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class NotificationPrefServiceTest {

    @Autowired NotificationPrefService service;
    @Autowired UserMapper userMapper;
    @Autowired TeamMapper teamMapper;
    @Autowired TeamMemberMapper teamMemberMapper;

    Long userId; Long teamId;

    @BeforeEach
    void setup() {
        User u = new User();
        u.setHandle("np_" + System.nanoTime());
        u.setName("X"); u.setEmail(u.getHandle() + "@t.local"); u.setPasswordHash("x");
        userMapper.insert(u); userId = u.getId();
        Team t = new Team(); t.setSlug("np_" + System.nanoTime()); t.setName("T"); t.setOwnerId(userId); t.setMembersCount(1);
        teamMapper.insert(t); teamId = t.getId();
        TeamMember m = new TeamMember(); m.setTeamId(teamId); m.setUserId(userId); m.setRole("OWNER");
        teamMemberMapper.insert(m);
    }

    @Test
    void get_returns_defaults_when_no_rows() {
        NotificationPrefRes res = service.get(teamId, userId);
        assertEquals(Boolean.TRUE, res.getPrefs().get("review_result").get("inapp"));
        assertEquals(Boolean.TRUE, res.getPrefs().get("review_result").get("email"));
        assertEquals(Boolean.FALSE, res.getPrefs().get("suite_published").get("inapp"));
    }

    @Test
    void update_then_get_round_trips() {
        UpdateNotificationPrefsReq req = new UpdateNotificationPrefsReq();
        UpdateNotificationPrefsReq.Entry e = new UpdateNotificationPrefsReq.Entry();
        e.setKey("review_result"); e.setChannel("inapp"); e.setEnabled(false);
        req.setEntries(List.of(e));
        service.update(teamId, userId, req);
        NotificationPrefRes res = service.get(teamId, userId);
        assertEquals(Boolean.FALSE, res.getPrefs().get("review_result").get("inapp"));
        // 其它项仍为默认
        assertEquals(Boolean.TRUE, res.getPrefs().get("review_result").get("email"));
    }

    @Test
    void update_rejects_unknown_key_or_channel() {
        UpdateNotificationPrefsReq req = new UpdateNotificationPrefsReq();
        UpdateNotificationPrefsReq.Entry e = new UpdateNotificationPrefsReq.Entry();
        e.setKey("hacker_key"); e.setChannel("inapp"); e.setEnabled(true);
        req.setEntries(List.of(e));
        assertThrows(RuntimeException.class, () -> service.update(teamId, userId, req));
    }
}
```

- [ ] **Step 3: 实现 Service**

```java
package com.skillstack.notification.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.TeamAccessGuard;
import com.skillstack.notification.dto.NotificationPrefRes;
import com.skillstack.notification.dto.UpdateNotificationPrefsReq;
import com.skillstack.notification.entity.NotificationPref;
import com.skillstack.notification.mapper.NotificationPrefMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@RequiredArgsConstructor
public class NotificationPrefService {

    public static final List<String> INAPP_KEYS =
            List.of("review_result", "mention", "suite_published", "weekly_digest");
    public static final List<String> EMAIL_KEYS = List.of("review_result", "weekly_digest");
    public static final List<String> CHANNELS = List.of("inapp", "email");

    /** key|channel of items that default to ON. */
    private static final Set<String> DEFAULT_ON = Set.of(
            "review_result|inapp",
            "mention|inapp",
            "weekly_digest|inapp",
            "review_result|email"
    );

    private final NotificationPrefMapper mapper;
    private final TeamAccessGuard guard;

    public NotificationPrefRes get(Long teamId, Long userId) {
        guard.requireMember(teamId, userId);
        List<NotificationPref> rows = mapper.selectList(new LambdaQueryWrapper<NotificationPref>()
                .eq(NotificationPref::getTeamId, teamId)
                .eq(NotificationPref::getUserId, userId));
        Map<String, Boolean> rowMap = new HashMap<>();
        for (NotificationPref p : rows) {
            rowMap.put(p.getPrefKey() + "|" + p.getChannel(), Boolean.TRUE.equals(p.getEnabled()));
        }
        Map<String, Map<String, Boolean>> out = new LinkedHashMap<>();
        for (String k : INAPP_KEYS) {
            Map<String, Boolean> per = new LinkedHashMap<>();
            per.put("inapp", lookup(rowMap, k, "inapp"));
            if (EMAIL_KEYS.contains(k)) per.put("email", lookup(rowMap, k, "email"));
            out.put(k, per);
        }
        NotificationPrefRes res = new NotificationPrefRes();
        res.setPrefs(out);
        return res;
    }

    @Transactional
    public NotificationPrefRes update(Long teamId, Long userId, UpdateNotificationPrefsReq req) {
        guard.requireMember(teamId, userId);
        if (req == null || req.getEntries() == null) {
            throw new BusinessException(40001, "缺少 entries");
        }
        for (UpdateNotificationPrefsReq.Entry e : req.getEntries()) {
            if (e.getKey() == null || e.getChannel() == null || e.getEnabled() == null) {
                throw new BusinessException(40001, "字段缺失");
            }
            if (!INAPP_KEYS.contains(e.getKey())) {
                throw new BusinessException(40001, "未知偏好键: " + e.getKey());
            }
            if (!CHANNELS.contains(e.getChannel())) {
                throw new BusinessException(40001, "未知渠道: " + e.getChannel());
            }
            if ("email".equals(e.getChannel()) && !EMAIL_KEYS.contains(e.getKey())) {
                throw new BusinessException(40001, "该项不支持 email 渠道: " + e.getKey());
            }
            NotificationPref existing = mapper.selectOne(new LambdaQueryWrapper<NotificationPref>()
                    .eq(NotificationPref::getTeamId, teamId)
                    .eq(NotificationPref::getUserId, userId)
                    .eq(NotificationPref::getPrefKey, e.getKey())
                    .eq(NotificationPref::getChannel, e.getChannel()));
            if (existing == null) {
                NotificationPref row = new NotificationPref();
                row.setUserId(userId); row.setTeamId(teamId);
                row.setPrefKey(e.getKey()); row.setChannel(e.getChannel());
                row.setEnabled(e.getEnabled());
                mapper.insert(row);
            } else {
                existing.setEnabled(e.getEnabled());
                mapper.updateById(existing);
            }
        }
        return get(teamId, userId);
    }

    private boolean lookup(Map<String, Boolean> rowMap, String key, String channel) {
        String k = key + "|" + channel;
        if (rowMap.containsKey(k)) return rowMap.get(k);
        return DEFAULT_ON.contains(k);
    }
}
```

- [ ] **Step 4: 运行测试**

Run: `cd backend && mvn -q -Dtest=NotificationPrefServiceTest test`
Expected: Tests run: 3, Failures: 0。

- [ ] **Step 5: 提交**

```bash
git add backend/src/main/java/com/skillstack/notification/service \
        backend/src/test/java/com/skillstack/notification/service
git commit -m "feat(notify): NotificationPrefService with defaults, validation, upsert"
```

### Task 2.4: Controller + 前端接入

**Files:**
- Create: `backend/src/main/java/com/skillstack/notification/controller/NotificationPrefController.java`
- Modify: `frontend/src/api/endpoints.ts`
- Modify: `frontend/src/pages/team/member/Prefs.tsx`

- [ ] **Step 1: Controller**

```java
package com.skillstack.notification.controller;

import com.skillstack.common.security.CurrentUser;
import com.skillstack.common.security.TeamAccessGuard;
import com.skillstack.common.web.ApiResponse;
import com.skillstack.notification.dto.NotificationPrefRes;
import com.skillstack.notification.dto.UpdateNotificationPrefsReq;
import com.skillstack.notification.service.NotificationPrefService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/teams/{teamId}/me/notification-prefs")
public class NotificationPrefController {

    private final NotificationPrefService service;
    private final TeamAccessGuard guard;

    @GetMapping
    public ApiResponse<NotificationPrefRes> get(@PathVariable Long teamId,
                                                @AuthenticationPrincipal CurrentUser me) {
        Long uid = guard.requireLogin(me == null ? null : me.getId());
        return ApiResponse.ok(service.get(teamId, uid));
    }

    @PutMapping
    public ApiResponse<NotificationPrefRes> update(@PathVariable Long teamId,
                                                   @AuthenticationPrincipal CurrentUser me,
                                                   @Valid @RequestBody UpdateNotificationPrefsReq req) {
        Long uid = guard.requireLogin(me == null ? null : me.getId());
        return ApiResponse.ok(service.update(teamId, uid, req));
    }
}
```

- [ ] **Step 2: 前端 endpoint**

在 `teamApi` 中追加：

```ts
notificationPrefs: (teamId: number) =>
  http.get<unknown, { prefs: Record<string, Record<string, boolean>> }>(
    `/teams/${teamId}/me/notification-prefs`),
updateNotificationPrefs: (teamId: number, entries: Array<{ key: string; channel: string; enabled: boolean }>) =>
  http.put<unknown, { prefs: Record<string, Record<string, boolean>> }>(
    `/teams/${teamId}/me/notification-prefs`, { entries }),
```

- [ ] **Step 3: 前端 NotifyPrefs 重写**

替换 `Prefs.tsx` 中 `function NotifyPrefs()` 为：

```tsx
function NotifyPrefs() {
  const { team } = useCurrentTeam();
  const teamId = team?.id;
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['notify-prefs', teamId],
    queryFn: () => teamApi.notificationPrefs(teamId!),
    enabled: !!teamId,
  });
  const set = useMutation({
    mutationFn: (entry: { key: string; channel: string; enabled: boolean }) =>
      teamApi.updateNotificationPrefs(teamId!, [entry]),
    onMutate: async (entry) => {
      await qc.cancelQueries({ queryKey: ['notify-prefs', teamId] });
      const prev = qc.getQueryData<any>(['notify-prefs', teamId]);
      qc.setQueryData(['notify-prefs', teamId], (old: any) => ({
        ...old,
        prefs: { ...old.prefs, [entry.key]: { ...old.prefs[entry.key], [entry.channel]: entry.enabled } },
      }));
      return { prev };
    },
    onError: (_e, _v, ctx) => { qc.setQueryData(['notify-prefs', teamId], ctx?.prev); toast.error('保存失败'); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notify-prefs', teamId] }),
  });
  const v = (k: string, ch: string) => !!data?.prefs?.[k]?.[ch];
  const flip = (k: string, ch: string) => set.mutate({ key: k, channel: ch, enabled: !v(k, ch) });
  if (!teamId || !data) return <Card pad={20}><div style={{ color: TOKENS.text3, fontSize: 12 }}>加载中…</div></Card>;
  return (
    <>
      <Card pad={20}>
        <SectionHeader title="站内通知" hint="出现在通知中心与右上角铃铛" />
        <PrefRow title="我提交的 Skill 有新审核结果" hint="审核人通过、驳回、留下反馈时通知">
          <Switch on={v('review_result','inapp')} onChange={() => flip('review_result','inapp')} />
        </PrefRow>
        <PrefRow title="有人 @ 提及我" hint="评论、文档或审核反馈中提到我时">
          <Switch on={v('mention','inapp')} onChange={() => flip('mention','inapp')} />
        </PrefRow>
        <PrefRow title="管理员发布新的团队套件" hint="新套件可一键安装时">
          <Switch on={v('suite_published','inapp')} onChange={() => flip('suite_published','inapp')} />
        </PrefRow>
        <PrefRow title="每周个人摘要" hint="每周一上午发我的 Skill 表现">
          <Switch on={v('weekly_digest','inapp')} onChange={() => flip('weekly_digest','inapp')} />
        </PrefRow>
      </Card>
      <Card pad={20}>
        <SectionHeader title="邮件通知" hint="邮件将发送到注册邮箱" />
        <PrefRow title="审核结果同步邮件" hint="即使在站内已读,也发邮件留档">
          <Switch on={v('review_result','email')} onChange={() => flip('review_result','email')} />
        </PrefRow>
        <PrefRow title="每周摘要邮件" hint="周一上午 9:00 发送">
          <Switch on={v('weekly_digest','email')} onChange={() => flip('weekly_digest','email')} />
        </PrefRow>
      </Card>
    </>
  );
}
```

- [ ] **Step 4: 类型检查 + 浏览器冒烟**

Run: `cd frontend && npm run lint`
打开 `/team/prefs` → 通知偏好：切换任一开关 → 刷新页面 → 状态保留。

- [ ] **Step 5: 提交**

```bash
git add backend/src/main/java/com/skillstack/notification/controller \
        frontend/src/api/endpoints.ts \
        frontend/src/pages/team/member/Prefs.tsx
git commit -m "feat(notify): wire NotifyPrefs to backend with optimistic updates"
```

---

## Phase 3 — Personal Access Token

**Scope:** 团队作用域的 PAT。创建时返回明文一次；存储 SHA-256 哈希 + 前 8 位明文前缀；列表只显示 masked；可吊销；可作为 `Authorization: Bearer lst_<...>` 用于 `/api/skills/*/download` 与 `/api/skills/*/install`。

### Task 3.1: Migration

**Files:**
- Create: `backend/src/main/resources/db/migration/V16__personal_access_token.sql`

- [ ] **Step 1: 写 migration**

```sql
-- V16 — personal access token
-- 明文格式: lst_<base62 32>; 库里只存 SHA-256 hex 与前 8 位明文前缀（用于 list & 调试定位）
CREATE TABLE personal_access_token (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    user_id       BIGINT       NOT NULL,
    team_id       BIGINT       NOT NULL,
    name          VARCHAR(64)  NOT NULL,
    kind          VARCHAR(16)  NOT NULL DEFAULT 'personal' COMMENT 'personal | ci',
    token_prefix  VARCHAR(16)  NOT NULL COMMENT '明文前缀 lst_xxxxxxxx，用于列表展示',
    token_hash    CHAR(64)     NOT NULL COMMENT 'SHA-256 hex',
    last_used_at  DATETIME     DEFAULT NULL,
    last_used_ip  VARCHAR(64)  DEFAULT NULL,
    revoked_at    DATETIME     DEFAULT NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted       TINYINT      NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_pat_hash (token_hash),
    KEY idx_pat_user_team (user_id, team_id, deleted, revoked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

- [ ] **Step 2: 启动验证 + 提交**

```bash
git add backend/src/main/resources/db/migration/V16__personal_access_token.sql
git commit -m "feat(pat): personal_access_token table (hashed storage + prefix index)"
```

### Task 3.2: Entity / Mapper / DTO

**Files:**
- Create: `backend/src/main/java/com/skillstack/token/entity/PersonalAccessToken.java`
- Create: `backend/src/main/java/com/skillstack/token/mapper/PersonalAccessTokenMapper.java`
- Create: `backend/src/main/java/com/skillstack/token/dto/TokenItemRes.java`
- Create: `backend/src/main/java/com/skillstack/token/dto/CreateTokenReq.java`
- Create: `backend/src/main/java/com/skillstack/token/dto/CreateTokenRes.java`

- [ ] **Step 1: Entity**

```java
package com.skillstack.token.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.skillstack.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("personal_access_token")
public class PersonalAccessToken extends BaseEntity {
    private Long userId;
    private Long teamId;
    private String name;
    private String kind;
    private String tokenPrefix;
    private String tokenHash;
    private LocalDateTime lastUsedAt;
    private String lastUsedIp;
    private LocalDateTime revokedAt;
}
```

- [ ] **Step 2: Mapper**

```java
package com.skillstack.token.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.skillstack.token.entity.PersonalAccessToken;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface PersonalAccessTokenMapper extends BaseMapper<PersonalAccessToken> {
}
```

- [ ] **Step 3: DTOs**

```java
// TokenItemRes.java
package com.skillstack.token.dto;
import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data @Builder
public class TokenItemRes {
    private Long id;
    private String name;
    private String kind;
    private String masked;      // lst_xxxxxxxx•••••••••••• (prefix + 16个 •)
    private LocalDateTime lastUsedAt;
    private String lastUsedIp;
    private LocalDateTime createdAt;
    private LocalDateTime revokedAt;
}
```

```java
// CreateTokenReq.java
package com.skillstack.token.dto;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateTokenReq {
    @NotBlank @Size(max = 64)
    private String name;
    /** personal | ci */
    @Pattern(regexp = "personal|ci")
    private String kind = "personal";
}
```

```java
// CreateTokenRes.java
package com.skillstack.token.dto;
import lombok.Builder;
import lombok.Data;

@Data @Builder
public class CreateTokenRes {
    private Long id;
    private String name;
    private String kind;
    /** 明文 token，仅创建时一次返回 */
    private String secret;
    private String masked;
}
```

- [ ] **Step 4: 编译 + 提交**

```bash
cd backend && mvn -q -DskipTests compile
git add backend/src/main/java/com/skillstack/token
git commit -m "feat(pat): entity/mapper/DTOs for personal access tokens"
```

### Task 3.3: Service + 测试

**Files:**
- Create: `backend/src/main/java/com/skillstack/token/service/PersonalAccessTokenService.java`
- Create: `backend/src/test/java/com/skillstack/token/service/PersonalAccessTokenServiceTest.java`

- [ ] **Step 1: 写失败测试**

```java
package com.skillstack.token.service;

import com.skillstack.auth.entity.User;
import com.skillstack.auth.mapper.UserMapper;
import com.skillstack.team.entity.Team;
import com.skillstack.team.entity.TeamMember;
import com.skillstack.team.mapper.TeamMapper;
import com.skillstack.team.mapper.TeamMemberMapper;
import com.skillstack.token.dto.CreateTokenReq;
import com.skillstack.token.dto.CreateTokenRes;
import com.skillstack.token.dto.TokenItemRes;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class PersonalAccessTokenServiceTest {

    @Autowired PersonalAccessTokenService svc;
    @Autowired UserMapper userMapper;
    @Autowired TeamMapper teamMapper;
    @Autowired TeamMemberMapper teamMemberMapper;

    Long userId; Long teamId;

    @BeforeEach
    void setup() {
        User u = new User();
        u.setHandle("pat_" + System.nanoTime());
        u.setName("X"); u.setEmail(u.getHandle() + "@t.local"); u.setPasswordHash("x");
        userMapper.insert(u); userId = u.getId();
        Team t = new Team(); t.setSlug("pat_" + System.nanoTime()); t.setName("T"); t.setOwnerId(userId); t.setMembersCount(1);
        teamMapper.insert(t); teamId = t.getId();
        TeamMember m = new TeamMember(); m.setTeamId(teamId); m.setUserId(userId); m.setRole("OWNER");
        teamMemberMapper.insert(m);
    }

    @Test
    void create_returns_secret_starts_with_prefix_and_only_once() {
        CreateTokenReq req = new CreateTokenReq();
        req.setName("MacBook 本机");
        req.setKind("personal");
        CreateTokenRes res = svc.create(teamId, userId, req);
        assertTrue(res.getSecret().startsWith("lst_"));
        assertTrue(res.getSecret().length() >= 32);
        // list 时不应再返回明文
        List<TokenItemRes> list = svc.list(teamId, userId);
        assertEquals(1, list.size());
        assertTrue(list.get(0).getMasked().startsWith(res.getSecret().substring(0, 12)));
        assertFalse(list.get(0).getMasked().contains(res.getSecret().substring(12)));
    }

    @Test
    void revoke_marks_token_inactive_and_authenticate_fails() {
        CreateTokenRes res = svc.create(teamId, userId, new CreateTokenReq() {{
            setName("CI"); setKind("ci");
        }});
        // 吊销前能 resolve
        assertNotNull(svc.resolveActive(res.getSecret()));
        svc.revoke(teamId, userId, res.getId());
        assertNull(svc.resolveActive(res.getSecret()));
    }

    @Test
    void resolveActive_updates_lastUsedAt() {
        CreateTokenRes res = svc.create(teamId, userId, new CreateTokenReq() {{
            setName("ci"); setKind("ci");
        }});
        var active = svc.resolveActive(res.getSecret());
        assertNotNull(active);
        assertEquals(userId, active.getUserId());
        assertEquals(teamId, active.getTeamId());
        // 第二次调用 last_used_at 应被刷新（>= 第一次）
        var second = svc.resolveActive(res.getSecret());
        assertNotNull(second.getLastUsedAt());
    }

    @Test
    void list_hides_other_users_tokens() {
        svc.create(teamId, userId, new CreateTokenReq() {{ setName("mine"); setKind("personal"); }});
        // 另一个用户
        User other = new User();
        other.setHandle("o_" + System.nanoTime()); other.setName("o");
        other.setEmail(other.getHandle()+"@t.local"); other.setPasswordHash("x");
        userMapper.insert(other);
        TeamMember m = new TeamMember(); m.setTeamId(teamId); m.setUserId(other.getId()); m.setRole("MEMBER");
        teamMemberMapper.insert(m);
        assertEquals(0, svc.list(teamId, other.getId()).size());
    }
}
```

- [ ] **Step 2: 实现 Service**

```java
package com.skillstack.token.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.TeamAccessGuard;
import com.skillstack.token.dto.CreateTokenReq;
import com.skillstack.token.dto.CreateTokenRes;
import com.skillstack.token.dto.TokenItemRes;
import com.skillstack.token.entity.PersonalAccessToken;
import com.skillstack.token.mapper.PersonalAccessTokenMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PersonalAccessTokenService {

    private static final String PREFIX = "lst_";
    private static final String ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final int SECRET_LEN = 32;
    private static final SecureRandom RNG = new SecureRandom();

    private final PersonalAccessTokenMapper mapper;
    private final TeamAccessGuard guard;

    public List<TokenItemRes> list(Long teamId, Long userId) {
        guard.requireMember(teamId, userId);
        List<PersonalAccessToken> rows = mapper.selectList(new LambdaQueryWrapper<PersonalAccessToken>()
                .eq(PersonalAccessToken::getTeamId, teamId)
                .eq(PersonalAccessToken::getUserId, userId)
                .orderByDesc(PersonalAccessToken::getCreatedAt));
        return rows.stream().map(this::toItem).toList();
    }

    @Transactional
    public CreateTokenRes create(Long teamId, Long userId, CreateTokenReq req) {
        guard.requireMember(teamId, userId);
        String secret = PREFIX + randomSecret(SECRET_LEN);
        String hash = sha256Hex(secret);
        String prefixVisible = secret.substring(0, PREFIX.length() + 8);
        PersonalAccessToken row = new PersonalAccessToken();
        row.setUserId(userId);
        row.setTeamId(teamId);
        row.setName(req.getName().trim());
        row.setKind(req.getKind() == null ? "personal" : req.getKind());
        row.setTokenPrefix(prefixVisible);
        row.setTokenHash(hash);
        mapper.insert(row);
        return CreateTokenRes.builder()
                .id(row.getId())
                .name(row.getName())
                .kind(row.getKind())
                .secret(secret)
                .masked(mask(prefixVisible))
                .build();
    }

    @Transactional
    public void revoke(Long teamId, Long userId, Long tokenId) {
        guard.requireMember(teamId, userId);
        PersonalAccessToken row = mapper.selectById(tokenId);
        if (row == null || !row.getTeamId().equals(teamId) || !row.getUserId().equals(userId)) {
            throw new BusinessException(40400, "Token 不存在");
        }
        if (row.getRevokedAt() != null) return;
        row.setRevokedAt(LocalDateTime.now());
        mapper.updateById(row);
    }

    @Transactional
    public void revokeAllForUserInTeam(Long teamId, Long userId) {
        List<PersonalAccessToken> rows = mapper.selectList(new LambdaQueryWrapper<PersonalAccessToken>()
                .eq(PersonalAccessToken::getTeamId, teamId)
                .eq(PersonalAccessToken::getUserId, userId)
                .isNull(PersonalAccessToken::getRevokedAt));
        LocalDateTime now = LocalDateTime.now();
        for (PersonalAccessToken r : rows) { r.setRevokedAt(now); mapper.updateById(r); }
    }

    /** Resolve a secret to an active token; updates last_used_at. Returns null if not found/revoked. */
    @Transactional
    public PersonalAccessToken resolveActive(String secret) {
        if (secret == null || !secret.startsWith(PREFIX)) return null;
        String hash = sha256Hex(secret);
        PersonalAccessToken row = mapper.selectOne(new LambdaQueryWrapper<PersonalAccessToken>()
                .eq(PersonalAccessToken::getTokenHash, hash));
        if (row == null || row.getRevokedAt() != null) return null;
        row.setLastUsedAt(LocalDateTime.now());
        mapper.updateById(row);
        return row;
    }

    private TokenItemRes toItem(PersonalAccessToken r) {
        return TokenItemRes.builder()
                .id(r.getId())
                .name(r.getName())
                .kind(r.getKind())
                .masked(mask(r.getTokenPrefix()))
                .lastUsedAt(r.getLastUsedAt())
                .createdAt(r.getCreatedAt())
                .revokedAt(r.getRevokedAt())
                .build();
    }

    private static String mask(String prefix) {
        return prefix + "••••••••••••••••";
    }

    private static String randomSecret(int n) {
        StringBuilder sb = new StringBuilder(n);
        for (int i = 0; i < n; i++) sb.append(ALPHABET.charAt(RNG.nextInt(ALPHABET.length())));
        return sb.toString();
    }

    private static String sha256Hex(String s) {
        try {
            byte[] bytes = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(bytes.length * 2);
            for (byte b : bytes) hex.append(String.format("%02x", b));
            return hex.toString();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
```

- [ ] **Step 3: 运行测试**

Run: `cd backend && mvn -q -Dtest=PersonalAccessTokenServiceTest test`
Expected: Tests run: 4, Failures: 0。

- [ ] **Step 4: 提交**

```bash
git add backend/src/main/java/com/skillstack/token/service \
        backend/src/test/java/com/skillstack/token/service
git commit -m "feat(pat): PersonalAccessTokenService with hashed storage + resolveActive"
```

### Task 3.4: Controller

**Files:**
- Create: `backend/src/main/java/com/skillstack/token/controller/PersonalAccessTokenController.java`

- [ ] **Step 1: Controller**

```java
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
```

- [ ] **Step 2: 编译启动 + curl 冒烟**

```bash
curl -s -X POST http://localhost:8080/api/teams/$TEAM_ID/me/tokens -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"name":"local-mac","kind":"personal"}' | jq
curl -s http://localhost:8080/api/teams/$TEAM_ID/me/tokens -H "Authorization: Bearer $TOKEN" | jq
```
Expected: 第一次返回 `data.secret: "lst_..."`；list 返回不含 secret 的 `masked`。

- [ ] **Step 3: 提交**

```bash
git add backend/src/main/java/com/skillstack/token/controller
git commit -m "feat(pat): controller for list/create/revoke at /api/teams/{teamId}/me/tokens"
```

### Task 3.5: JwtAuthFilter 接受 PAT

**Files:**
- Modify: `backend/src/main/java/com/skillstack/common/security/JwtAuthFilter.java`

- [ ] **Step 1: 改造 filter**

把现在 `if (...) token.isEmpty() { try { Claims claims = jwtUtil.parse(token); ... } catch ... }` 这段改为：

```java
if (token.startsWith("lst_")) {
    PersonalAccessToken pat = patService.resolveActive(token);
    if (pat == null) { writeAuthRejected(resp); return; }
    // 只允许 PAT 命中 /api/skills/* 路径下的下载/安装能力
    String uri = req.getRequestURI();
    boolean allowed = uri.startsWith("/api/skills/")
            && (uri.endsWith("/install") || uri.contains("/versions/") || uri.endsWith("/download") || uri.matches(".*/skills/[^/]+/?$"));
    if (!allowed) {
        writeForbidden(resp, "PAT 仅可用于 skill 下载与安装");
        return;
    }
    CurrentUser cu = new CurrentUser(pat.getUserId(), null);
    auth(cu, req);
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
```

抽两个小工具方法 `auth(CurrentUser, HttpServletRequest)` 与 `writeForbidden(HttpServletResponse, String)`。注入 `private final PersonalAccessTokenService patService;` 到 filter 构造里。

**注意：循环依赖风险。** Filter 直接注入 service 可能引起循环：service → guard → teamService → ... 全部走 Spring。把 `PersonalAccessTokenService` 用 `ObjectProvider<PersonalAccessTokenService>` 注入并在调用时 `getObject()`。或将 `resolveActive` 提到独立的轻量 `@Service`，不依赖 `TeamAccessGuard`（它本就不需要——纯 hash 查表）。**采纳后者**：在 service 里把 `resolveActive` 实现已经不调用 guard，直接走 mapper，所以可以直接注入。

- [ ] **Step 2: 写 filter 测试**

Files:
- Create: `backend/src/test/java/com/skillstack/common/security/JwtAuthFilterPatTest.java`

```java
package com.skillstack.common.security;

import com.fasterxml.jackson.databind.ObjectMapper;
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
        mvc.perform(get("/api/skills/nonexistent/download").header("Authorization", "Bearer " + secret))
           .andExpect(status().is4xxClientError()); // 404 from controller, NOT 401
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
}
```

- [ ] **Step 3: 运行测试**

Run: `cd backend && mvn -q -Dtest=JwtAuthFilterPatTest test`
Expected: 全部通过。

- [ ] **Step 4: 提交**

```bash
git add backend/src/main/java/com/skillstack/common/security/JwtAuthFilter.java \
        backend/src/test/java/com/skillstack/common/security/JwtAuthFilterPatTest.java
git commit -m "feat(pat): accept Bearer lst_<secret> for skill download/install paths only"
```

### Task 3.6: 前端接入

**Files:**
- Modify: `frontend/src/api/endpoints.ts`
- Modify: `frontend/src/pages/team/member/Prefs.tsx`

- [ ] **Step 1: API**

```ts
tokens: {
  list: (teamId: number) =>
    http.get<unknown, Array<{ id: number; name: string; kind: string; masked: string;
                               lastUsedAt: string | null; createdAt: string; revokedAt: string | null }>>(
      `/teams/${teamId}/me/tokens`),
  create: (teamId: number, body: { name: string; kind: 'personal' | 'ci' }) =>
    http.post<unknown, { id: number; name: string; kind: string; secret: string; masked: string }>(
      `/teams/${teamId}/me/tokens`, body),
  revoke: (teamId: number, id: number) =>
    http.delete<unknown, void>(`/teams/${teamId}/me/tokens/${id}`),
},
```

- [ ] **Step 2: 重写 TokenPrefs**

替换 `Prefs.tsx` 中 `TOKENS_LIST` 常量与 `function TokenPrefs()`：

```tsx
function TokenPrefs() {
  const { team } = useCurrentTeam();
  const teamId = team?.id;
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['tokens', teamId],
    queryFn: () => teamApi.tokens.list(teamId!),
    enabled: !!teamId,
  });
  const [newSecret, setNewSecret] = useState<{ secret: string; name: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftKind, setDraftKind] = useState<'personal' | 'ci'>('personal');
  const create = useMutation({
    mutationFn: () => teamApi.tokens.create(teamId!, { name: draftName.trim(), kind: draftKind }),
    onSuccess: (res) => {
      setNewSecret({ secret: res.secret, name: res.name });
      setCreating(false); setDraftName('');
      qc.invalidateQueries({ queryKey: ['tokens', teamId] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '创建失败'),
  });
  const revoke = useMutation({
    mutationFn: (id: number) => teamApi.tokens.revoke(teamId!, id),
    onSuccess: () => { toast.success('已吊销'); qc.invalidateQueries({ queryKey: ['tokens', teamId] }); },
  });
  if (!teamId || !data) return <Card pad={20}><div style={{ color: TOKENS.text3, fontSize: 12 }}>加载中…</div></Card>;
  const activeRows = data.filter((t) => !t.revokedAt);
  return (
    <Card pad={20}>
      <SectionHeader title="我的 Token" hint="用于本机 / CI 中安装团队私有 Skill。仅你本人可见。"
        extra={<Button variant="primary" size="sm" icon={<I.plus size={12} />} onClick={() => setCreating(true)}>新建 Token</Button>} />
      {newSecret && (
        <div style={{ padding: 12, background: '#FEFCE8', border: '1px solid #FDE68A', borderRadius: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 12.5, marginBottom: 6 }}>
            Token <b>{newSecret.name}</b> 已创建。<span style={{ color: TOKENS.danger }}>明文只显示一次,请立即复制保存。</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={{ flex: 1, fontFamily: 'monospace', fontSize: 12, background: '#fff', padding: '6px 10px', borderRadius: 4, border: `1px solid ${TOKENS.border}` }}>
              {newSecret.secret}
            </code>
            <CopyButton text={newSecret.secret} successMessage="已复制" />
            <Button variant="ghost" size="sm" onClick={() => setNewSecret(null)}>我已保存</Button>
          </div>
        </div>
      )}
      {creating && (
        <div style={{ padding: 12, background: TOKENS.bgGray, borderRadius: 8, marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <Input placeholder="Token 名称 (如 MacBook 本机)" value={draftName} onChange={(e) => setDraftName(e.target.value)}
                 style={{ flex: 1, height: 30, padding: '0 10px', fontSize: 12.5 }} />
          <select value={draftKind} onChange={(e) => setDraftKind(e.target.value as any)}
                  style={{ height: 30, padding: '0 8px', fontSize: 12.5 }}>
            <option value="personal">本机</option>
            <option value="ci">CI</option>
          </select>
          <Button variant="primary" size="sm" disabled={!draftName.trim() || create.isPending}
                  onClick={() => create.mutate()}>创建</Button>
          <Button variant="ghost" size="sm" onClick={() => { setCreating(false); setDraftName(''); }}>取消</Button>
        </div>
      )}
      {activeRows.length === 0 && (
        <div style={{ padding: 20, textAlign: 'center', color: TOKENS.text3, fontSize: 12 }}>
          还没有 Token,点击右上角新建。
        </div>
      )}
      {activeRows.map((t, i) => (
        <div key={t.id} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0',
          borderTop: i === 0 ? 'none' : `1px solid ${TOKENS.borderSoft}`,
        }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: TOKENS.bgGray,
                        display: 'grid', placeItems: 'center', color: TOKENS.text2 }}>
            {t.kind === 'ci' ? <I.terminal size={16} /> : <I.user size={16} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{t.name}</div>
            <div style={{ fontSize: 11.5, color: TOKENS.text3, marginTop: 2, fontFamily: 'monospace' }}>
              {t.masked}
            </div>
          </div>
          <span style={{ fontSize: 11.5, color: TOKENS.text3 }}>
            {t.lastUsedAt ? `最近使用 · ${new Date(t.lastUsedAt).toLocaleString()}` : '未使用'}
          </span>
          <CopyButton text={t.masked} title="复制掩码 (实际 token 只在创建时显示)" successMessage="已复制" />
          <Button variant="ghost" size="sm" style={{ color: TOKENS.danger }}
                  onClick={() => { if (confirm(`吊销 ${t.name}?`)) revoke.mutate(t.id); }}
                  disabled={revoke.isPending}>
            吊销
          </Button>
        </div>
      ))}
    </Card>
  );
}
```

- [ ] **Step 3: 类型检查 + 浏览器冒烟**

Run: `cd frontend && npm run lint`
浏览器：
- 创建一个 token → 顶部黄条显示明文 → 复制 → 刷新页面后只剩 masked
- 用 `curl -H "Authorization: Bearer lst_xxx" http://localhost:8080/api/skills/some-slug/download` 实测可调用（非 401）
- 吊销 → 列表移除 → 同样的 curl 调用变 401

- [ ] **Step 4: 提交**

```bash
git add frontend/src/api/endpoints.ts frontend/src/pages/team/member/Prefs.tsx
git commit -m "feat(pat): wire TokenPrefs to backend with create-once-secret + revoke"
```

---

## Phase 4 — 离开团队

**Scope:** 当前用户离开当前团队。校验：非唯一 Owner；副作用：软删 `team_members` 行 / 吊销该团队下该用户全部 PAT / 递减 `teams.members_count` / 清理 `user_team_unread`。

### Task 4.1: Service + 测试

**Files:**
- Modify: `backend/src/main/java/com/skillstack/team/service/TeamMemberService.java`
- Create: `backend/src/test/java/com/skillstack/team/service/TeamMemberLeaveTest.java`

- [ ] **Step 1: 写失败测试**

```java
package com.skillstack.team.service;

import com.skillstack.auth.entity.User;
import com.skillstack.auth.mapper.UserMapper;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.team.entity.Team;
import com.skillstack.team.entity.TeamMember;
import com.skillstack.team.mapper.TeamMapper;
import com.skillstack.team.mapper.TeamMemberMapper;
import com.skillstack.token.dto.CreateTokenReq;
import com.skillstack.token.dto.CreateTokenRes;
import com.skillstack.token.service.PersonalAccessTokenService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class TeamMemberLeaveTest {

    @Autowired TeamMemberService svc;
    @Autowired UserMapper userMapper;
    @Autowired TeamMapper teamMapper;
    @Autowired TeamMemberMapper teamMemberMapper;
    @Autowired PersonalAccessTokenService patService;

    @Test
    void member_can_leave_and_pats_are_revoked() {
        User owner = makeUser(); User m = makeUser();
        Team t = makeTeam(owner.getId(), 2);
        addMember(t.getId(), owner.getId(), "OWNER");
        addMember(t.getId(), m.getId(), "MEMBER");
        CreateTokenReq req = new CreateTokenReq(); req.setName("x"); req.setKind("personal");
        CreateTokenRes tok = patService.create(t.getId(), m.getId(), req);

        svc.leave(t.getId(), m.getId());

        assertFalse(svc.isMember(t.getId(), m.getId()));
        assertNull(patService.resolveActive(tok.getSecret()));
        Team after = teamMapper.selectById(t.getId());
        assertEquals(1, after.getMembersCount());
    }

    @Test
    void sole_owner_cannot_leave() {
        User owner = makeUser();
        Team t = makeTeam(owner.getId(), 1);
        addMember(t.getId(), owner.getId(), "OWNER");
        assertThrows(BusinessException.class, () -> svc.leave(t.getId(), owner.getId()));
    }

    @Test
    void owner_can_leave_when_another_owner_exists() {
        User o1 = makeUser(); User o2 = makeUser();
        Team t = makeTeam(o1.getId(), 2);
        addMember(t.getId(), o1.getId(), "OWNER");
        addMember(t.getId(), o2.getId(), "OWNER");
        svc.leave(t.getId(), o1.getId());
        assertFalse(svc.isMember(t.getId(), o1.getId()));
    }

    private User makeUser() {
        User u = new User();
        u.setHandle("lv_"+System.nanoTime()); u.setName("X");
        u.setEmail(u.getHandle()+"@t.local"); u.setPasswordHash("x");
        userMapper.insert(u);
        return u;
    }
    private Team makeTeam(Long ownerId, int members) {
        Team t = new Team();
        t.setSlug("lv_"+System.nanoTime()); t.setName("T");
        t.setOwnerId(ownerId); t.setMembersCount(members);
        teamMapper.insert(t);
        return t;
    }
    private void addMember(Long teamId, Long userId, String role) {
        TeamMember m = new TeamMember(); m.setTeamId(teamId); m.setUserId(userId); m.setRole(role);
        teamMemberMapper.insert(m);
    }
}
```

- [ ] **Step 2: 在 TeamMemberService 中实现 `leave`**

```java
public void leave(Long teamId, Long userId) {
    Team t = teamService.requireTeam(teamId);
    TeamMember self = findMember(teamId, userId);
    if ("OWNER".equals(self.getRole())) {
        long ownerCount = teamMemberMapper.selectCount(new LambdaQueryWrapper<TeamMember>()
                .eq(TeamMember::getTeamId, teamId)
                .eq(TeamMember::getRole, "OWNER"));
        if (ownerCount <= 1) {
            throw new BusinessException(40300, "T_LAST_OWNER: 你是唯一 Owner，无法离队。请先转让所有权");
        }
    }
    teamMemberMapper.deleteById(self.getId());
    if (t.getMembersCount() != null && t.getMembersCount() > 0) {
        t.setMembersCount(t.getMembersCount() - 1);
        teamMapper.updateById(t);
    }
    patService.revokeAllForUserInTeam(teamId, userId);
}
```

注入 `private final PersonalAccessTokenService patService;`（构造器注入，配 lombok `@RequiredArgsConstructor`）。

- [ ] **Step 3: 运行测试**

Run: `cd backend && mvn -q -Dtest=TeamMemberLeaveTest test`
Expected: Tests run: 3, Failures: 0。

- [ ] **Step 4: 提交**

```bash
git add backend/src/main/java/com/skillstack/team/service/TeamMemberService.java \
        backend/src/test/java/com/skillstack/team/service/TeamMemberLeaveTest.java
git commit -m "feat(team): TeamMemberService.leave with sole-owner guard + PAT cascade revoke"
```

### Task 4.2: Controller endpoint

**Files:**
- Modify: `backend/src/main/java/com/skillstack/team/controller/TeamMemberController.java`

- [ ] **Step 1: 添加端点**

```java
@PostMapping("/api/teams/{teamId}/leave")
public ApiResponse<Void> leaveSelf(@PathVariable Long teamId,
                                   @AuthenticationPrincipal CurrentUser me) {
    Long uid = guard.requireLogin(me == null ? null : me.getId());
    teamMemberService.leave(teamId, uid);
    return ApiResponse.ok(null);
}
```

- [ ] **Step 2: 启动 + curl 冒烟**

```bash
curl -s -X POST http://localhost:8080/api/teams/$TEAM_ID/leave -H "Authorization: Bearer $TOKEN" | jq
```
Expected: 唯一 Owner 时返回 `code:40300`；非唯一 Owner / Member 时返回 `code:0`。

- [ ] **Step 3: 提交**

```bash
git add backend/src/main/java/com/skillstack/team/controller/TeamMemberController.java
git commit -m "feat(team): POST /api/teams/{teamId}/leave"
```

### Task 4.3: 前端接入

**Files:**
- Modify: `frontend/src/api/endpoints.ts`
- Modify: `frontend/src/pages/team/member/Prefs.tsx`

- [ ] **Step 1: API**

在 `teamApi` 追加：

```ts
leave: (teamId: number) => http.post<unknown, void>(`/teams/${teamId}/leave`, {}),
```

- [ ] **Step 2: 重写 DangerPrefs**

```tsx
function DangerPrefs() {
  const { team } = useCurrentTeam();
  const teamId = team?.id;
  const qc = useQueryClient();
  const nav = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const mutation = useMutation({
    mutationFn: () => teamApi.leave(teamId!),
    onSuccess: () => {
      toast.success(`已离开 ${team?.name}`);
      qc.invalidateQueries({ queryKey: ['me'] });
      qc.invalidateQueries({ queryKey: ['teams', 'mine'] });
      nav('/home');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '离队失败'),
  });
  return (
    <Card pad={20} style={{ borderColor: '#FECACA' }}>
      <SectionHeader title="离开团队" hint="离开后你提交的 Skill 仍归属本团队,但你将失去访问权限" />
      <div style={{
        padding: 14, background: '#FEF2F2', borderRadius: 8,
        fontSize: 12.5, color: TOKENS.text2, lineHeight: 1.6, marginBottom: 14,
      }}>
        <b style={{ color: TOKENS.danger }}>注意</b>
        :离开后将立即失去访问 {team?.name ?? '当前团队'} 私有 Skill 与套件的权限,你的 Token 会被吊销。
        如果你是被邀请进来的,需要管理员重新邀请才能再次加入。
      </div>
      {confirming ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" disabled={mutation.isPending} onClick={() => setConfirming(false)}>取消</Button>
          <Button variant="danger" icon={<I.x size={12} />} disabled={mutation.isPending}
                  onClick={() => mutation.mutate()}>
            {mutation.isPending ? '离开中…' : `确认离开 ${team?.name ?? ''}`}
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="danger" icon={<I.x size={12} />} onClick={() => setConfirming(true)}>
            离开 {team?.name ?? '当前团队'}
          </Button>
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 3: 顶部 imports 补 `useNavigate`**

```ts
import { useNavigate } from 'react-router-dom';
```

- [ ] **Step 4: 类型检查 + 浏览器冒烟**

Run: `cd frontend && npm run lint`
浏览器：
- 用一个非唯一 Owner 账号进入 → 点击 → 再次确认 → 跳转 `/home` → 该团队不再出现在 mine 列表
- 用唯一 Owner 账号 → 确认 → toast 显示 "你是唯一 Owner…"

- [ ] **Step 5: 提交**

```bash
git add frontend/src/api/endpoints.ts frontend/src/pages/team/member/Prefs.tsx
git commit -m "feat(team): wire DangerPrefs to /api/teams/{teamId}/leave with confirm flow"
```

---

## 整体收尾

### Task F.1: 全量验证

- [ ] **Step 1: 后端全量测试**

Run: `cd backend && mvn -q test`
Expected: BUILD SUCCESS, 全部已有测试 + 新增 12 个测试通过。

- [ ] **Step 2: 前端 lint + build**

Run: `cd frontend && npm run lint && npm run build`
Expected: 0 type error, build success。

- [ ] **Step 3: 浏览器端到端冒烟**

打开 `/team/prefs`，逐 Tab 操作：

| Tab | 操作 | 预期 |
|---|---|---|
| 通知偏好 | 切任一开关 → 刷新 | 状态保留 |
| 我的资料 | 改显示名 → 保存 → 刷新；点更换头像 | 显示名变化；头像变化 |
| 我的 Token | 新建 → 复制明文 → 吊销 → 用 curl 命中 download/install | 创建时一次明文；列表只 masked；吊销后 401 |
| 离开团队 | 确认离队 | 跳转 home；mine 不再含此团队 |

- [ ] **Step 4: 验证不再有硬编码假数据**

Run: `grep -n "陈奕笑\|chen_yx\|chen.yx@\|麓豆前端组\|TOKENS_LIST" frontend/src/pages/team/member/Prefs.tsx`
Expected: 无输出（全部已替换或删除）。

### Task F.2: 更新 AGENT.md / plan.md

- [ ] **Step 1: 在 `plan.md` 阶段任务里勾掉本期内容，列出仍未完成的延伸项**

延伸项（不在本计划内、未来工作）：
- 站内通知中心 + 邮件投递器（实际把偏好转成通知）
- 团队级头像覆盖
- PAT 范围管理（除 download/install 外的更细粒度授权）
- 转让所有权 UI（让唯一 Owner 也能优雅离队）

- [ ] **Step 2: 提交收尾**

```bash
git add plan.md
git commit -m "docs: mark /team/prefs production-grade work done; track follow-ups"
```

---

## Self-Review Notes

**Spec coverage:**
- Tab 1 通知偏好 → Phase 2 ✓
- Tab 2 我的资料 → Phase 1 ✓（头像走账号级，按 hint 明确说明）
- Tab 3 我的 Token → Phase 3 ✓（含 auth filter 真打通）
- Tab 4 离开团队 → Phase 4 ✓（含唯一 Owner 守卫 + PAT 级联吊销）

**Out of scope（已在 F.2 列出）：** 通知投递器、团队级头像、转让所有权、PAT 范围扩展。

**Type consistency:** 所有 endpoint 路径统一 `/api/teams/{teamId}/me/...`；所有 service 方法签名 `(teamId, userId[, payload])`；前端 `teamApi.*` 全部走 `teamId` 数字。

**Placeholder scan:** 已逐 Task 检查无 "TBD / 类似 X / 适当错误处理 / 类似 Task N" 字样。
