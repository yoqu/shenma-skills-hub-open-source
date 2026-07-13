# Unified Notification Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a unified in-app notification inbox that captures review, comment, invite, suite, and team-member events; reroute the TopBar bell to a real notification center; and rewire the preferences card to actual delivery rules.

**Architecture:** Add a single `notifications` table and a `NotificationService` that other domain services call inline within their existing `@Transactional` paths. Service skips writes when the recipient's `NotificationPref` (per team, per key, per channel) is off. A dedicated `NotificationController` exposes `/api/me/notifications*` for list/unread-count/mark-read. Frontend adds `/team/notifications` page, rewires the TopBar bell to it with a polling unread-count badge, and rewrites `NotificationPrefsCard` to expose the real pref keys.

**Tech Stack:** Spring Boot 3.2, MyBatis Plus, MySQL 8, Flyway, JUnit 5; React 18, TanStack Query, React Router, Tailwind, Axios.

---

## File Structure

**Database**
- Create: `backend/src/main/resources/db/migration/V19__notifications.sql`

**Backend — notification module (extend existing)**
- Create: `backend/src/main/java/com/skillstack/notification/entity/Notification.java`
- Create: `backend/src/main/java/com/skillstack/notification/mapper/NotificationMapper.java`
- Create: `backend/src/main/java/com/skillstack/notification/dto/NotificationItem.java`
- Create: `backend/src/main/java/com/skillstack/notification/dto/NotificationUnreadCountRes.java`
- Create: `backend/src/main/java/com/skillstack/notification/dto/NotificationQuery.java`
- Create: `backend/src/main/java/com/skillstack/notification/service/NotificationService.java`
- Create: `backend/src/main/java/com/skillstack/notification/service/NotificationType.java` (enum)
- Create: `backend/src/main/java/com/skillstack/notification/controller/NotificationController.java`
- Modify: `backend/src/main/java/com/skillstack/notification/service/NotificationPrefService.java` (replace `INAPP_KEYS`, `EMAIL_KEYS`, `DEFAULT_ON`)

**Backend — domain integrations**
- Modify: `backend/src/main/java/com/skillstack/review/service/ReviewService.java` (approve/reject/requestChanges/submitDraft/resubmit)
- Modify: `backend/src/main/java/com/skillstack/skill/service/SkillService.java` (`createReviewFirst`)
- Modify: `backend/src/main/java/com/skillstack/review/service/ReviewCommentService.java` (`create`)
- Modify: `backend/src/main/java/com/skillstack/team/service/InviteService.java` (`createPhoneInvite`, `acceptPhoneInvite`, `joinByCode`)
- Modify: `backend/src/main/java/com/skillstack/suite/service/SuiteService.java` (`create`, `updateItems`)
- Modify: `backend/src/main/java/com/skillstack/team/service/TeamMemberService.java` (`updateRole`, `remove`)
- Modify: `backend/src/main/java/com/skillstack/auth/mapper/UserMapper.java` (add `selectByPhone` if missing)

**Backend — tests**
- Create: `backend/src/test/java/com/skillstack/notification/service/NotificationServiceTest.java`
- Create: `backend/src/test/java/com/skillstack/notification/controller/NotificationControllerTest.java`
- Modify: `backend/src/test/java/com/skillstack/notification/service/NotificationPrefServiceTest.java`
- Modify: `backend/src/test/java/com/skillstack/review/service/ReviewServiceTest.java`
- Modify: `backend/src/test/java/com/skillstack/review/service/ReviewCommentServiceTest.java`

**Frontend**
- Modify: `frontend/src/api/endpoints.ts` (add `notificationApi`, replace `notificationPrefs` shape consumers if needed)
- Create: `frontend/src/pages/team/Notifications.tsx`
- Modify: `frontend/src/router.tsx` (add `/team/notifications`)
- Modify: `frontend/src/components/chrome/TopBar.tsx` (bell target + unread badge)
- Modify: `frontend/src/components/notifications/NotificationPrefsCard.tsx` (rewrite for real keys)

Each module file stays focused: `NotificationService` is the only writer; `NotificationController` is read/markread only; domain services call `notificationService.notify(...)` without touching pref or row state directly.

---

## Task 1: Create `notifications` table migration

**Files:**
- Create: `backend/src/main/resources/db/migration/V19__notifications.sql`

- [ ] **Step 1: Write the migration**

```sql
-- V19 — unified in-app notifications inbox.
-- 由 NotificationService 写入；NotificationController 提供 /me 维度的读、未读计数、标记已读。
CREATE TABLE notifications (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    user_id      BIGINT       NOT NULL,
    team_id      BIGINT       DEFAULT NULL,
    type         VARCHAR(48)  NOT NULL,
    category     VARCHAR(32)  NOT NULL,
    title        VARCHAR(160) NOT NULL,
    body         VARCHAR(512) DEFAULT NULL,
    target_url   VARCHAR(256) DEFAULT NULL,
    actor_id     BIGINT       DEFAULT NULL,
    source_type  VARCHAR(32)  DEFAULT NULL,
    source_id    BIGINT       DEFAULT NULL,
    read_at      DATETIME     DEFAULT NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted      TINYINT      NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_notifications_user_read_created (user_id, read_at, created_at),
    KEY idx_notifications_user_team_created (user_id, team_id, created_at),
    KEY idx_notifications_source (source_type, source_id),
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_notifications_team FOREIGN KEY (team_id) REFERENCES teams(id),
    CONSTRAINT fk_notifications_actor FOREIGN KEY (actor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

- [ ] **Step 2: Verify migration runs cleanly**

Run: `cd backend && mvn -q -DskipTests compile`
Then trigger Flyway via the test harness once with Task 2's entity in place. (No standalone Flyway test exists; rely on `mvn test` in later tasks to apply migrations against the test DB.)

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/resources/db/migration/V19__notifications.sql
git commit -m "feat(notification): add notifications table migration"
```

---

## Task 2: Notification entity + mapper

**Files:**
- Create: `backend/src/main/java/com/skillstack/notification/entity/Notification.java`
- Create: `backend/src/main/java/com/skillstack/notification/mapper/NotificationMapper.java`

- [ ] **Step 1: Write the entity**

```java
package com.skillstack.notification.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.skillstack.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("notifications")
public class Notification extends BaseEntity {
    private Long userId;
    private Long teamId;
    private String type;
    private String category;
    private String title;
    private String body;
    private String targetUrl;
    private Long actorId;
    private String sourceType;
    private Long sourceId;
    private LocalDateTime readAt;
}
```

- [ ] **Step 2: Write the mapper**

```java
package com.skillstack.notification.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.skillstack.notification.entity.Notification;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface NotificationMapper extends BaseMapper<Notification> {

    /** Mark all of a user's unread notifications as read, optionally scoped to a team. */
    int markAllRead(@Param("userId") Long userId,
                    @Param("teamId") Long teamId,
                    @Param("now") java.time.LocalDateTime now);
}
```

- [ ] **Step 3: Add mapper XML for `markAllRead`**

Create: `backend/src/main/resources/mapper/NotificationMapper.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
        "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="com.skillstack.notification.mapper.NotificationMapper">
    <update id="markAllRead">
        UPDATE notifications
           SET read_at = #{now}
         WHERE user_id = #{userId}
           AND read_at IS NULL
           AND deleted = 0
        <if test="teamId != null">
           AND team_id = #{teamId}
        </if>
    </update>
</mapper>
```

(If the project does not use mapper XML elsewhere — verify in `backend/src/main/resources/mapper/` — instead implement `markAllRead` with a `LambdaUpdateWrapper` directly inside `NotificationService` and skip the XML.)

- [ ] **Step 4: Verify compile**

Run: `cd backend && mvn -q -DskipTests compile`
Expected: BUILD SUCCESS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/skillstack/notification/entity/Notification.java \
        backend/src/main/java/com/skillstack/notification/mapper/NotificationMapper.java \
        backend/src/main/resources/mapper/NotificationMapper.xml
git commit -m "feat(notification): add Notification entity and mapper"
```

---

## Task 3: Notification DTOs and type enum

**Files:**
- Create: `backend/src/main/java/com/skillstack/notification/dto/NotificationItem.java`
- Create: `backend/src/main/java/com/skillstack/notification/dto/NotificationUnreadCountRes.java`
- Create: `backend/src/main/java/com/skillstack/notification/dto/NotificationQuery.java`
- Create: `backend/src/main/java/com/skillstack/notification/service/NotificationType.java`

- [ ] **Step 1: Write `NotificationItem` DTO**

```java
package com.skillstack.notification.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class NotificationItem {
    private Long id;
    private String type;
    private String category;
    private String title;
    private String body;
    private Long teamId;
    private String teamName;
    private Long actorId;
    private String actorName;
    private String targetUrl;
    private boolean read;
    private LocalDateTime createdAt;
}
```

- [ ] **Step 2: Write `NotificationUnreadCountRes`**

```java
package com.skillstack.notification.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class NotificationUnreadCountRes {
    private long unread;
}
```

- [ ] **Step 3: Write `NotificationQuery`**

```java
package com.skillstack.notification.dto;

import com.skillstack.common.web.PageQuery;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class NotificationQuery extends PageQuery {
    private Long teamId;
    /** "unread" or "all"; null treated as "all". */
    private String status;
}
```

- [ ] **Step 4: Write `NotificationType` enum**

```java
package com.skillstack.notification.service;

/**
 * Notification types and the pref-key + category they map to.
 *
 * <p>Order matches the design spec table. Keep in sync with {@link NotificationPrefService#INAPP_KEYS}.</p>
 */
public enum NotificationType {
    REVIEW_SUBMITTED("review_submitted", "review"),
    REVIEW_RESUBMITTED("review_submitted", "review"),
    REVIEW_APPROVED("review_result", "review"),
    REVIEW_REJECTED("review_result", "review"),
    REVIEW_CHANGES_REQUESTED("review_result", "review"),
    REVIEW_COMMENT("review_comment", "review"),
    PHONE_INVITE("phone_invite", "invite"),
    SUITE_PUBLISHED("suite_published", "suite"),
    SUITE_UPDATED("suite_published", "suite"),
    TEAM_ROLE_CHANGED("team_member_change", "team"),
    TEAM_JOINED("team_member_change", "team"),
    TEAM_REMOVED("team_member_change", "team");

    private final String prefKey;
    private final String category;

    NotificationType(String prefKey, String category) {
        this.prefKey = prefKey;
        this.category = category;
    }

    public String prefKey() { return prefKey; }
    public String category() { return category; }
}
```

- [ ] **Step 5: Verify compile**

Run: `cd backend && mvn -q -DskipTests compile`
Expected: BUILD SUCCESS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/skillstack/notification/dto/ \
        backend/src/main/java/com/skillstack/notification/service/NotificationType.java
git commit -m "feat(notification): add Notification DTOs and type enum"
```

---

## Task 4: Update `NotificationPrefService` to new key set

**Files:**
- Modify: `backend/src/main/java/com/skillstack/notification/service/NotificationPrefService.java:20-31`

- [ ] **Step 1: Update key constants**

Replace the `INAPP_KEYS`, `EMAIL_KEYS`, and `DEFAULT_ON` block with the new spec keys:

```java
public static final List<String> INAPP_KEYS = List.of(
        "review_submitted",
        "review_result",
        "review_comment",
        "phone_invite",
        "suite_published",
        "team_member_change",
        "weekly_digest"
);
public static final List<String> EMAIL_KEYS = List.of(
        "review_result",
        "phone_invite",
        "weekly_digest"
);
public static final List<String> CHANNELS = List.of("inapp", "email");

private static final Set<String> DEFAULT_ON = Set.of(
        "review_submitted|inapp",
        "review_result|inapp",
        "review_comment|inapp",
        "phone_invite|inapp",
        "team_member_change|inapp",
        "weekly_digest|inapp",
        "review_result|email",
        "phone_invite|email"
);
```

`suite_published|inapp` and `suite_published|email` default OFF, matching spec §5.1.

- [ ] **Step 2: Add a public lookup helper `NotificationPrefService.isEnabled`**

After the `lookup(...)` method, add a package-private helper that `NotificationService` can call without re-reading prefs by hand:

```java
/**
 * Returns whether the (key, channel) pair is enabled for the given user+team,
 * falling back to {@link #DEFAULT_ON} when the user has no row.
 *
 * <p>Used by NotificationService for delivery-time gating. Does NOT enforce
 * team membership — callers must already have validated that the recipient
 * should receive a team-scoped notification.</p>
 */
public boolean isEnabled(Long userId, Long teamId, String prefKey, String channel) {
    if (userId == null || prefKey == null || channel == null) return false;
    LambdaQueryWrapper<NotificationPref> w = new LambdaQueryWrapper<NotificationPref>()
            .eq(NotificationPref::getUserId, userId)
            .eq(NotificationPref::getPrefKey, prefKey)
            .eq(NotificationPref::getChannel, channel);
    if (teamId != null) {
        w.eq(NotificationPref::getTeamId, teamId);
    } else {
        w.isNull(NotificationPref::getTeamId);
    }
    NotificationPref row = mapper.selectOne(w);
    if (row != null) return Boolean.TRUE.equals(row.getEnabled());
    return DEFAULT_ON.contains(prefKey + "|" + channel);
}
```

NOTE: The existing `notification_pref` schema has `team_id BIGINT NOT NULL`. Global-scope notifications (e.g., `PHONE_INVITE`, `TEAM_REMOVED`) therefore have no per-team row and will always fall back to the default. That is acceptable for v1 — global prefs come later.

- [ ] **Step 3: Update `NotificationPrefServiceTest` to assert new defaults**

In `backend/src/test/java/com/skillstack/notification/service/NotificationPrefServiceTest.java`, replace the assertions in `get_returns_defaults_when_no_rows` with:

```java
@Test
void get_returns_defaults_when_no_rows() {
    NotificationPrefRes res = service.get(teamId, userId);
    assertEquals(Boolean.TRUE,  res.getPrefs().get("review_submitted").get("inapp"));
    assertEquals(Boolean.TRUE,  res.getPrefs().get("review_result").get("inapp"));
    assertEquals(Boolean.TRUE,  res.getPrefs().get("review_result").get("email"));
    assertEquals(Boolean.TRUE,  res.getPrefs().get("review_comment").get("inapp"));
    assertEquals(Boolean.TRUE,  res.getPrefs().get("phone_invite").get("inapp"));
    assertEquals(Boolean.TRUE,  res.getPrefs().get("phone_invite").get("email"));
    assertEquals(Boolean.FALSE, res.getPrefs().get("suite_published").get("inapp"));
    assertEquals(Boolean.TRUE,  res.getPrefs().get("team_member_change").get("inapp"));
    assertEquals(Boolean.TRUE,  res.getPrefs().get("weekly_digest").get("inapp"));
    assertFalse(res.getPrefs().get("review_comment").containsKey("email")); // not email-supported
}
```

Add a second test that the old `mention` key is rejected as unknown:

```java
@Test
void update_rejects_legacy_mention_key() {
    UpdateNotificationPrefsReq req = new UpdateNotificationPrefsReq();
    UpdateNotificationPrefsReq.Entry e = new UpdateNotificationPrefsReq.Entry();
    e.setKey("mention"); e.setChannel("inapp"); e.setEnabled(true);
    req.setEntries(List.of(e));
    BusinessException ex = assertThrows(BusinessException.class,
            () -> service.update(teamId, userId, req));
    assertTrue(ex.getMessage().contains("未知偏好键"));
}
```

- [ ] **Step 4: Run the pref service test**

Run: `cd backend && mvn -q test -Dtest=NotificationPrefServiceTest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/skillstack/notification/service/NotificationPrefService.java \
        backend/src/test/java/com/skillstack/notification/service/NotificationPrefServiceTest.java
git commit -m "feat(notification): switch pref keys to unified notification center set"
```

---

## Task 5: Write `NotificationService` skeleton + first test

**Files:**
- Create: `backend/src/main/java/com/skillstack/notification/service/NotificationService.java`
- Create: `backend/src/test/java/com/skillstack/notification/service/NotificationServiceTest.java`

- [ ] **Step 1: Write the failing test**

```java
package com.skillstack.notification.service;

import com.skillstack.auth.entity.User;
import com.skillstack.auth.mapper.UserMapper;
import com.skillstack.notification.dto.NotificationItem;
import com.skillstack.notification.dto.NotificationQuery;
import com.skillstack.notification.entity.Notification;
import com.skillstack.notification.mapper.NotificationMapper;
import com.skillstack.common.web.PageResult;
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
class NotificationServiceTest {

    @Autowired NotificationService service;
    @Autowired NotificationMapper mapper;
    @Autowired UserMapper userMapper;
    @Autowired TeamMapper teamMapper;
    @Autowired TeamMemberMapper teamMemberMapper;

    Long teamId; Long ownerId; Long memberId;

    @BeforeEach
    void setup() {
        User owner = new User();
        owner.setHandle("owner_" + System.nanoTime());
        owner.setName("O"); owner.setEmail(owner.getHandle() + "@t"); owner.setPasswordHash("x");
        userMapper.insert(owner); ownerId = owner.getId();

        User mem = new User();
        mem.setHandle("mem_" + System.nanoTime());
        mem.setName("M"); mem.setEmail(mem.getHandle() + "@t"); mem.setPasswordHash("x");
        userMapper.insert(mem); memberId = mem.getId();

        Team t = new Team(); t.setSlug("nt_" + System.nanoTime()); t.setName("T");
        t.setOwnerId(ownerId); t.setMembersCount(2);
        teamMapper.insert(t); teamId = t.getId();

        TeamMember om = new TeamMember(); om.setTeamId(teamId); om.setUserId(ownerId); om.setRole("OWNER");
        teamMemberMapper.insert(om);
        TeamMember mm = new TeamMember(); mm.setTeamId(teamId); mm.setUserId(memberId); mm.setRole("MEMBER");
        teamMemberMapper.insert(mm);
    }

    @Test
    void notify_writes_row_for_recipient_with_default_pref_on() {
        Long id = service.notify(NotificationType.REVIEW_APPROVED, memberId, teamId, ownerId,
                "你的 Skill 审核已通过", "demo-skill v1.0.0 已发布", "/team/mine",
                "review", 42L);
        assertNotNull(id);
        Notification row = mapper.selectById(id);
        assertEquals(memberId, row.getUserId());
        assertEquals("REVIEW_APPROVED", row.getType());
        assertEquals("review", row.getCategory());
        assertNull(row.getReadAt());
    }
}
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && mvn -q test -Dtest=NotificationServiceTest`
Expected: FAIL — `NotificationService` does not exist.

- [ ] **Step 3: Implement `NotificationService` (skeleton: notify only)**

```java
package com.skillstack.notification.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.skillstack.auth.entity.User;
import com.skillstack.auth.mapper.UserMapper;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.security.TeamAccessGuard;
import com.skillstack.common.web.PageResult;
import com.skillstack.notification.dto.NotificationItem;
import com.skillstack.notification.dto.NotificationQuery;
import com.skillstack.notification.entity.Notification;
import com.skillstack.notification.mapper.NotificationMapper;
import com.skillstack.team.entity.Team;
import com.skillstack.team.mapper.TeamMapper;
import com.skillstack.team.service.TeamMemberService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationMapper mapper;
    private final NotificationPrefService prefService;
    private final TeamMemberService teamMemberService;
    private final UserMapper userMapper;
    private final TeamMapper teamMapper;
    private final TeamAccessGuard guard;

    /**
     * Write one notification row if the recipient's inapp pref is on.
     * Returns the row id, or null when delivery was suppressed.
     *
     * <p>Callers must already have ensured the recipient should logically receive
     * this notification (e.g., excluded the actor). Team-membership is enforced
     * here for all team-scoped types EXCEPT TEAM_REMOVED, where the recipient
     * has just been removed.</p>
     */
    @Transactional
    public Long notify(NotificationType type,
                       Long recipientId,
                       Long teamId,
                       Long actorId,
                       String title,
                       String body,
                       String targetUrl,
                       String sourceType,
                       Long sourceId) {
        if (recipientId == null) return null;
        if (actorId != null && actorId.equals(recipientId)) return null;
        if (teamId != null && type != NotificationType.TEAM_REMOVED) {
            if (!teamMemberService.isMember(teamId, recipientId)) return null;
        }
        if (!prefService.isEnabled(recipientId, teamId, type.prefKey(), "inapp")) return null;

        Notification n = new Notification();
        n.setUserId(recipientId);
        n.setTeamId(teamId);
        n.setType(type.name());
        n.setCategory(type.category());
        n.setTitle(title);
        n.setBody(body);
        n.setTargetUrl(targetUrl);
        n.setActorId(actorId);
        n.setSourceType(sourceType);
        n.setSourceId(sourceId);
        mapper.insert(n);
        return n.getId();
    }

    /** Fan-out helper for team-wide notifications (e.g., suite published). */
    public void notifyTeamMembers(NotificationType type,
                                  Long teamId,
                                  Long actorId,
                                  String title,
                                  String body,
                                  String targetUrl,
                                  String sourceType,
                                  Long sourceId,
                                  Collection<Long> recipientIds) {
        if (recipientIds == null) return;
        for (Long uid : recipientIds) {
            notify(type, uid, teamId, actorId, title, body, targetUrl, sourceType, sourceId);
        }
    }

    // ---------- read APIs added in Task 6 ----------
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `cd backend && mvn -q test -Dtest=NotificationServiceTest`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/skillstack/notification/service/NotificationService.java \
        backend/src/test/java/com/skillstack/notification/service/NotificationServiceTest.java
git commit -m "feat(notification): NotificationService write path with pref-gated delivery"
```

---

## Task 6: Add NotificationService read APIs (list / unread / mark-read)

**Files:**
- Modify: `backend/src/main/java/com/skillstack/notification/service/NotificationService.java`
- Modify: `backend/src/test/java/com/skillstack/notification/service/NotificationServiceTest.java`

- [ ] **Step 1: Write failing tests**

Append to `NotificationServiceTest`:

```java
@Test
void list_filters_by_status_and_marks_read() {
    Long id1 = service.notify(NotificationType.REVIEW_APPROVED, memberId, teamId, ownerId,
            "t1", "b1", "/team/mine", "review", 1L);
    Long id2 = service.notify(NotificationType.REVIEW_REJECTED, memberId, teamId, ownerId,
            "t2", "b2", "/team/mine", "review", 2L);

    NotificationQuery q = new NotificationQuery();
    q.setStatus("all"); q.setTeamId(teamId); q.setPage(1); q.setSize(10);
    PageResult<NotificationItem> all = service.listMine(memberId, q);
    assertEquals(2, all.getTotal());

    assertEquals(2L, service.unreadCount(memberId, null));
    service.markRead(memberId, id1);
    assertEquals(1L, service.unreadCount(memberId, null));

    q.setStatus("unread");
    PageResult<NotificationItem> unread = service.listMine(memberId, q);
    assertEquals(1, unread.getTotal());
    assertEquals(id2, unread.getItems().get(0).getId());
}

@Test
void mark_read_rejects_other_users_row() {
    Long id = service.notify(NotificationType.REVIEW_APPROVED, memberId, teamId, ownerId,
            "x", "y", "/", "review", 9L);
    assertThrows(BusinessException.class, () -> service.markRead(ownerId, id));
}

@Test
void mark_all_read_scoped_to_team_id() {
    service.notify(NotificationType.REVIEW_APPROVED, memberId, teamId, ownerId,
            "t1", "b1", "/", "review", 1L);
    service.notify(NotificationType.REVIEW_REJECTED, memberId, null, ownerId,
            "t2", "b2", "/", "review", 2L);
    int affected = service.markAllRead(memberId, teamId);
    assertEquals(1, affected);
    assertEquals(1L, service.unreadCount(memberId, null));
}

@Test
void notify_suppressed_when_pref_off() {
    // Turn off review_result inapp for member
    com.skillstack.notification.dto.UpdateNotificationPrefsReq req =
            new com.skillstack.notification.dto.UpdateNotificationPrefsReq();
    com.skillstack.notification.dto.UpdateNotificationPrefsReq.Entry e =
            new com.skillstack.notification.dto.UpdateNotificationPrefsReq.Entry();
    e.setKey("review_result"); e.setChannel("inapp"); e.setEnabled(false);
    req.setEntries(java.util.List.of(e));
    prefService.update(teamId, memberId, req);

    Long id = service.notify(NotificationType.REVIEW_APPROVED, memberId, teamId, ownerId,
            "t", "b", "/", "review", 3L);
    assertNull(id);
}

@Test
void notify_suppressed_when_actor_equals_recipient() {
    Long id = service.notify(NotificationType.REVIEW_APPROVED, memberId, teamId, memberId,
            "t", "b", "/", "review", 4L);
    assertNull(id);
}

@Autowired NotificationPrefService prefService;
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && mvn -q test -Dtest=NotificationServiceTest`
Expected: FAIL — `listMine`, `unreadCount`, `markRead`, `markAllRead` do not exist.

- [ ] **Step 3: Add read methods to `NotificationService`**

Append below `notifyTeamMembers`:

```java
public PageResult<NotificationItem> listMine(Long userId, NotificationQuery q) {
    if (userId == null) throw new BusinessException(40100, "请先登录");
    if (q.getTeamId() != null) guard.requireMember(q.getTeamId(), userId);

    Page<Notification> page = new Page<>(q.getPage(), q.getSize());
    LambdaQueryWrapper<Notification> w = new LambdaQueryWrapper<Notification>()
            .eq(Notification::getUserId, userId)
            .orderByDesc(Notification::getCreatedAt);
    if (q.getTeamId() != null) w.eq(Notification::getTeamId, q.getTeamId());
    if ("unread".equals(q.getStatus())) w.isNull(Notification::getReadAt);

    IPage<Notification> rows = mapper.selectPage(page, w);
    List<NotificationItem> items = new ArrayList<>(rows.getRecords().size());
    for (Notification r : rows.getRecords()) items.add(toItem(r));
    return PageResult.of(items, rows.getTotal(), rows.getCurrent(), rows.getSize());
}

public long unreadCount(Long userId, Long teamId) {
    if (userId == null) return 0;
    LambdaQueryWrapper<Notification> w = new LambdaQueryWrapper<Notification>()
            .eq(Notification::getUserId, userId)
            .isNull(Notification::getReadAt);
    if (teamId != null) w.eq(Notification::getTeamId, teamId);
    return mapper.selectCount(w);
}

@Transactional
public void markRead(Long userId, Long notificationId) {
    if (userId == null) throw new BusinessException(40100, "请先登录");
    Notification n = mapper.selectById(notificationId);
    if (n == null) throw new BusinessException(40400, "通知不存在");
    if (!userId.equals(n.getUserId())) throw new BusinessException(40300, "无权操作");
    if (n.getReadAt() != null) return;
    n.setReadAt(LocalDateTime.now());
    mapper.updateById(n);
}

@Transactional
public int markAllRead(Long userId, Long teamId) {
    if (userId == null) throw new BusinessException(40100, "请先登录");
    if (teamId != null) guard.requireMember(teamId, userId);
    return mapper.markAllRead(userId, teamId, LocalDateTime.now());
}

private NotificationItem toItem(Notification r) {
    NotificationItem it = new NotificationItem();
    it.setId(r.getId());
    it.setType(r.getType());
    it.setCategory(r.getCategory());
    it.setTitle(r.getTitle());
    it.setBody(r.getBody());
    it.setTeamId(r.getTeamId());
    it.setActorId(r.getActorId());
    it.setTargetUrl(r.getTargetUrl());
    it.setRead(r.getReadAt() != null);
    it.setCreatedAt(r.getCreatedAt());
    if (r.getTeamId() != null) {
        Team t = teamMapper.selectById(r.getTeamId());
        if (t != null) it.setTeamName(t.getName());
    }
    if (r.getActorId() != null) {
        User u = userMapper.selectById(r.getActorId());
        if (u != null) it.setActorName(u.getName());
    }
    return it;
}
```

If you decided in Task 2 to skip the mapper XML, replace the body of `markAllRead` with a `LambdaUpdateWrapper`:

```java
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
// ...
public int markAllRead(Long userId, Long teamId) {
    if (userId == null) throw new BusinessException(40100, "请先登录");
    if (teamId != null) guard.requireMember(teamId, userId);
    LambdaUpdateWrapper<Notification> w = new LambdaUpdateWrapper<Notification>()
            .eq(Notification::getUserId, userId)
            .isNull(Notification::getReadAt)
            .set(Notification::getReadAt, LocalDateTime.now());
    if (teamId != null) w.eq(Notification::getTeamId, teamId);
    return mapper.update(null, w);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && mvn -q test -Dtest=NotificationServiceTest`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/skillstack/notification/service/NotificationService.java \
        backend/src/test/java/com/skillstack/notification/service/NotificationServiceTest.java
git commit -m "feat(notification): list, unread-count, mark-read on NotificationService"
```

---

## Task 7: NotificationController

**Files:**
- Create: `backend/src/main/java/com/skillstack/notification/controller/NotificationController.java`
- Create: `backend/src/test/java/com/skillstack/notification/controller/NotificationControllerTest.java`

- [ ] **Step 1: Write controller test (slim, single happy-path)**

Use the same pattern as `NotificationPrefServiceTest` — `@SpringBootTest` + `@Transactional`, instantiate the controller via `@Autowired` and call methods directly (the repo's other controller tests follow the same pattern; check `ReviewControllerTest` for the local idiom).

```java
package com.skillstack.notification.controller;

import com.skillstack.auth.entity.User;
import com.skillstack.auth.mapper.UserMapper;
import com.skillstack.common.security.CurrentUser;
import com.skillstack.common.web.ApiResponse;
import com.skillstack.common.web.PageResult;
import com.skillstack.notification.dto.NotificationItem;
import com.skillstack.notification.dto.NotificationQuery;
import com.skillstack.notification.dto.NotificationUnreadCountRes;
import com.skillstack.notification.service.NotificationService;
import com.skillstack.notification.service.NotificationType;
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
class NotificationControllerTest {

    @Autowired NotificationController controller;
    @Autowired NotificationService service;
    @Autowired UserMapper userMapper;
    @Autowired TeamMapper teamMapper;
    @Autowired TeamMemberMapper teamMemberMapper;

    Long teamId; Long ownerId; Long memberId;

    @BeforeEach
    void setup() {
        User a = new User(); a.setHandle("a_" + System.nanoTime()); a.setName("A");
        a.setEmail(a.getHandle() + "@t"); a.setPasswordHash("x");
        userMapper.insert(a); ownerId = a.getId();
        User b = new User(); b.setHandle("b_" + System.nanoTime()); b.setName("B");
        b.setEmail(b.getHandle() + "@t"); b.setPasswordHash("x");
        userMapper.insert(b); memberId = b.getId();
        Team t = new Team(); t.setSlug("nc_" + System.nanoTime()); t.setName("T");
        t.setOwnerId(ownerId); t.setMembersCount(2);
        teamMapper.insert(t); teamId = t.getId();
        TeamMember om = new TeamMember(); om.setTeamId(teamId); om.setUserId(ownerId); om.setRole("OWNER");
        teamMemberMapper.insert(om);
        TeamMember mm = new TeamMember(); mm.setTeamId(teamId); mm.setUserId(memberId); mm.setRole("MEMBER");
        teamMemberMapper.insert(mm);
    }

    private CurrentUser as(Long uid) {
        CurrentUser cu = new CurrentUser();
        cu.setId(uid);
        return cu;
    }

    @Test
    void list_unread_and_mark_read_round_trip() {
        Long id = service.notify(NotificationType.REVIEW_APPROVED, memberId, teamId, ownerId,
                "t", "b", "/", "review", 1L);

        NotificationQuery q = new NotificationQuery();
        q.setStatus("unread"); q.setPage(1); q.setSize(10);
        ApiResponse<PageResult<NotificationItem>> resp = controller.list(q, as(memberId));
        assertEquals(0, resp.getCode());
        assertEquals(1, resp.getData().getTotal());

        ApiResponse<NotificationUnreadCountRes> cnt = controller.unreadCount(null, as(memberId));
        assertEquals(1, cnt.getData().getUnread());

        controller.markRead(id, as(memberId));
        assertEquals(0, controller.unreadCount(null, as(memberId)).getData().getUnread());
    }
}
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && mvn -q test -Dtest=NotificationControllerTest`
Expected: FAIL — controller does not exist.

- [ ] **Step 3: Implement the controller**

```java
package com.skillstack.notification.controller;

import com.skillstack.common.security.CurrentUser;
import com.skillstack.common.security.TeamAccessGuard;
import com.skillstack.common.web.ApiResponse;
import com.skillstack.common.web.PageResult;
import com.skillstack.notification.dto.NotificationItem;
import com.skillstack.notification.dto.NotificationQuery;
import com.skillstack.notification.dto.NotificationUnreadCountRes;
import com.skillstack.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/me/notifications")
public class NotificationController {

    private final NotificationService service;
    private final TeamAccessGuard guard;

    @GetMapping
    public ApiResponse<PageResult<NotificationItem>> list(
            @ModelAttribute NotificationQuery q,
            @AuthenticationPrincipal CurrentUser me) {
        Long uid = guard.requireLogin(me == null ? null : me.getId());
        return ApiResponse.ok(service.listMine(uid, q));
    }

    @GetMapping("/unread-count")
    public ApiResponse<NotificationUnreadCountRes> unreadCount(
            @RequestParam(value = "teamId", required = false) Long teamId,
            @AuthenticationPrincipal CurrentUser me) {
        Long uid = guard.requireLogin(me == null ? null : me.getId());
        return ApiResponse.ok(new NotificationUnreadCountRes(service.unreadCount(uid, teamId)));
    }

    @PostMapping("/{id}/read")
    public ApiResponse<Void> markRead(@PathVariable Long id,
                                      @AuthenticationPrincipal CurrentUser me) {
        Long uid = guard.requireLogin(me == null ? null : me.getId());
        service.markRead(uid, id);
        return ApiResponse.ok();
    }

    @PostMapping("/read-all")
    public ApiResponse<Void> markAllRead(@RequestParam(value = "teamId", required = false) Long teamId,
                                         @AuthenticationPrincipal CurrentUser me) {
        Long uid = guard.requireLogin(me == null ? null : me.getId());
        service.markAllRead(uid, teamId);
        return ApiResponse.ok();
    }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd backend && mvn -q test -Dtest=NotificationControllerTest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/skillstack/notification/controller/NotificationController.java \
        backend/src/test/java/com/skillstack/notification/controller/NotificationControllerTest.java
git commit -m "feat(notification): /api/me/notifications endpoints"
```

---

## Task 8: Wire review state transitions into notifications

**Files:**
- Modify: `backend/src/main/java/com/skillstack/review/service/ReviewService.java`
- Modify: `backend/src/main/java/com/skillstack/skill/service/SkillService.java:371-408` (`createReviewFirst`)
- Modify: `backend/src/test/java/com/skillstack/review/service/ReviewServiceTest.java`

Notifications: `REVIEW_APPROVED`, `REVIEW_REJECTED`, `REVIEW_CHANGES_REQUESTED` → submitter; `REVIEW_SUBMITTED` (from `createReviewFirst` + `submitDraft`) and `REVIEW_RESUBMITTED` (from `resubmit`) → team OWNER/ADMIN excluding submitter.

- [ ] **Step 1: Write failing tests in `ReviewServiceTest`**

Open `backend/src/test/java/com/skillstack/review/service/ReviewServiceTest.java`, autowire `NotificationMapper`, and add — adapt the field names to whatever the existing test already exposes (`reviewerId`, `submitterId`, `r.getId()`):

```java
@Autowired com.skillstack.notification.mapper.NotificationMapper notificationMapper;

@Test
void approve_writes_notification_to_submitter() {
    long before = notificationMapper.selectCount(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<com.skillstack.notification.entity.Notification>()
                    .eq(com.skillstack.notification.entity.Notification::getUserId, submitterId)
                    .eq(com.skillstack.notification.entity.Notification::getType, "REVIEW_APPROVED"));
    reviewService.approve(reviewId, reviewerId, "looks good");
    long after = notificationMapper.selectCount(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<com.skillstack.notification.entity.Notification>()
                    .eq(com.skillstack.notification.entity.Notification::getUserId, submitterId)
                    .eq(com.skillstack.notification.entity.Notification::getType, "REVIEW_APPROVED"));
    assertEquals(before + 1, after);
}

@Test
void reject_writes_notification_to_submitter() {
    reviewService.reject(reviewId, reviewerId, "missing tests");
    long n = notificationMapper.selectCount(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<com.skillstack.notification.entity.Notification>()
                    .eq(com.skillstack.notification.entity.Notification::getUserId, submitterId)
                    .eq(com.skillstack.notification.entity.Notification::getType, "REVIEW_REJECTED"));
    assertEquals(1, n);
}

@Test
void request_changes_writes_notification_to_submitter() {
    reviewService.requestChanges(reviewId, reviewerId, "rename file");
    long n = notificationMapper.selectCount(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<com.skillstack.notification.entity.Notification>()
                    .eq(com.skillstack.notification.entity.Notification::getUserId, submitterId)
                    .eq(com.skillstack.notification.entity.Notification::getType, "REVIEW_CHANGES_REQUESTED"));
    assertEquals(1, n);
}
```

If `ReviewServiceTest` does not already create the review with a separate submitter and reviewer, add a small helper at the top of the test class:

```java
private Long reviewId, submitterId, reviewerId, teamId;
// populate in @BeforeEach to mirror the existing fixture; see existing tests.
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && mvn -q test -Dtest=ReviewServiceTest`
Expected: FAIL — notifications not yet written.

- [ ] **Step 3: Inject `NotificationService` into `ReviewService`**

Edit the constructor signature (currently lines 65–76) to add `NotificationService notificationService`, store in a field, and pass it from Spring DI. Example diff at the bottom of the method block:

```java
private final NotificationService notificationService;

public ReviewService(ReviewMapper reviewMapper, UserMapper userMapper, TeamAccessGuard guard,
                     SkillMapper skillMapper, SkillTagMapper skillTagMapper,
                     SkillVersionService skillVersionService,
                     @Lazy SkillService skillService,
                     NotificationService notificationService) {
    this.reviewMapper = reviewMapper; this.userMapper = userMapper; this.guard = guard;
    this.skillMapper = skillMapper; this.skillTagMapper = skillTagMapper;
    this.skillVersionService = skillVersionService; this.skillService = skillService;
    this.notificationService = notificationService;
}
```

- [ ] **Step 4: Write notify-after-state-change helper inside `ReviewService`**

Add a private helper that wraps the call to `notificationService.notify`:

```java
private void notifySubmitter(NotificationType type, Review r, Long actorId, String title, String body, String targetUrl) {
    notificationService.notify(type, r.getSubmitterId(), r.getTeamId(), actorId,
            title, body, targetUrl, "review", r.getId());
}

private void notifyTeamReviewers(NotificationType type, Review r, Long actorId, String title, String body, String targetUrl) {
    List<TeamMemberRes> writers = reviewMapper.selectWriters(r.getTeamId()); // see Step 6 if absent
    for (TeamMemberRes m : writers) {
        if (m.getUserId().equals(actorId)) continue;
        notificationService.notify(type, m.getUserId(), r.getTeamId(), actorId,
                title, body, targetUrl, "review", r.getId());
    }
}
```

If `ReviewMapper` does not have `selectWriters`, instead inject `TeamMapper` and use the existing `teamMapper.selectMembers(teamId, "OWNER", null, 0, 1000)` + `"ADMIN"` calls and union the lists (see `backend/src/main/java/com/skillstack/team/mapper/TeamMapper.java:55`). Avoid adding new SQL if an existing query already returns the data.

- [ ] **Step 5: Call notify from each transition**

In `approve(...)` (line 159), after `reviewMapper.updateById(r);` near line 249 (and inside the `VERSION_BUMP` branch near line 174), call:

```java
notifySubmitter(NotificationType.REVIEW_APPROVED, r, reviewerId,
        "你的 Skill 审核已通过",
        r.getSkillName() + (r.getVersion() == null ? "" : " v" + r.getVersion()) + " 已发布到团队 Skill 库",
        "/team/mine");
```

In `reject(...)` (line 253) after `reviewMapper.updateById(r);`:

```java
notifySubmitter(NotificationType.REVIEW_REJECTED, r, reviewerId,
        "你的 Skill 审核未通过",
        reason,
        "/team/mine");
```

In `requestChanges(...)` (line 323) after `reviewMapper.updateById(r);`:

```java
notifySubmitter(NotificationType.REVIEW_CHANGES_REQUESTED, r, reviewerId,
        "审核人请求修改",
        reason,
        "/team/mine");
```

In `submitDraft(...)` (line 358) and `resubmit(Long, ReviewPayloadReq)` (line 298), at the end of the method (after `reviewMapper.clearDecision(r.getId());`):

```java
notifyTeamReviewers(
    /* submitDraft uses REVIEW_SUBMITTED; resubmit uses REVIEW_RESUBMITTED */
    type, r, r.getSubmitterId(),
    "有新审核请求：" + r.getSkillName(),
    null,
    "/team/reviews");
```

In `createReviewFirst(...)` (`SkillService.java:371`), at the end after `reviewMapper.insert(r);` and only when `!draft`:

```java
if (!draft) {
    notifyTeamReviewers(NotificationType.REVIEW_SUBMITTED, r, currentUserId,
            "有新审核请求：" + r.getSkillName(), null, "/team/reviews");
}
```

`SkillService` already injects `ReviewMapper`; add a `NotificationService` dependency the same way as `ReviewService` did, and either (a) call `reviewService` (which now has the helper) — preferred to avoid duplicating the fan-out logic, or (b) inline the fan-out.

Recommended: extract the fan-out into a small package-private helper on `ReviewService` so `SkillService.createReviewFirst` can call `reviewService.notifyReviewSubmitted(r, currentUserId)`.

- [ ] **Step 6: Run tests to verify pass**

Run: `cd backend && mvn -q test -Dtest=ReviewServiceTest`
Expected: PASS, including new approve/reject/request_changes tests.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/com/skillstack/review/service/ReviewService.java \
        backend/src/main/java/com/skillstack/skill/service/SkillService.java \
        backend/src/test/java/com/skillstack/review/service/ReviewServiceTest.java
git commit -m "feat(review): emit notifications on submit, approve, reject, request-changes"
```

---

## Task 9: Wire review comment notifications

**Files:**
- Modify: `backend/src/main/java/com/skillstack/review/service/ReviewCommentService.java:50-78`
- Modify: `backend/src/test/java/com/skillstack/review/service/ReviewCommentServiceTest.java`

The comment author and recipient depend on who wrote it: writer's comment → notify the submitter (`/team/mine`); submitter's comment → notify the team writers (`/team/reviews`), excluding the writing submitter.

- [ ] **Step 1: Write failing test**

Append to `ReviewCommentServiceTest`:

```java
@Test
void writer_comment_notifies_submitter() {
    commentService.create(reviewId, reviewerId, "请补充测试");
    long n = notificationMapper.selectCount(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<com.skillstack.notification.entity.Notification>()
                    .eq(com.skillstack.notification.entity.Notification::getUserId, submitterId)
                    .eq(com.skillstack.notification.entity.Notification::getType, "REVIEW_COMMENT"));
    assertEquals(1, n);
}

@Test
void submitter_comment_notifies_team_writers() {
    commentService.create(reviewId, submitterId, "已补充");
    long n = notificationMapper.selectCount(
            new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<com.skillstack.notification.entity.Notification>()
                    .eq(com.skillstack.notification.entity.Notification::getUserId, reviewerId)
                    .eq(com.skillstack.notification.entity.Notification::getType, "REVIEW_COMMENT"));
    assertEquals(1, n);
}
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && mvn -q test -Dtest=ReviewCommentServiceTest`
Expected: FAIL.

- [ ] **Step 3: Implement notification call**

Inject `NotificationService` into `ReviewCommentService` (Lombok `@RequiredArgsConstructor` — just add `private final NotificationService notificationService;`). After `commentMapper.insert(c);` in `create(...)` (around line 69), call a new helper or invoke the existing helper on `ReviewService` to fan out to writers when `!isWriter`:

```java
String preview = body.length() > 120 ? body.substring(0, 117) + "…" : body;
if (isWriter) {
    notificationService.notify(NotificationType.REVIEW_COMMENT,
            r.getSubmitterId(), r.getTeamId(), currentUserId,
            "审核人评论了你的 Skill", preview, "/team/mine",
            "review_comment", c.getId());
} else {
    // submitter commented — notify all writers except submitter
    reviewService.notifyReviewWritersForComment(r, currentUserId, preview);
}
```

Add `public void notifyReviewWritersForComment(Review r, Long actorId, String preview)` to `ReviewService` that reuses the fan-out helper from Task 8 but uses `NotificationType.REVIEW_COMMENT` and `target_url = "/team/reviews"`.

- [ ] **Step 4: Run tests to verify pass**

Run: `cd backend && mvn -q test -Dtest=ReviewCommentServiceTest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/skillstack/review/service/ReviewCommentService.java \
        backend/src/main/java/com/skillstack/review/service/ReviewService.java \
        backend/src/test/java/com/skillstack/review/service/ReviewCommentServiceTest.java
git commit -m "feat(review): emit REVIEW_COMMENT notification to opposite party"
```

---

## Task 10: Wire invite notifications

**Files:**
- Modify: `backend/src/main/java/com/skillstack/team/service/InviteService.java` (lines `createPhoneInvite` ~148, `acceptPhoneInvite` ~175, `joinByCode` ~84)
- Modify: `backend/src/main/java/com/skillstack/auth/mapper/UserMapper.java` (add `selectByPhone` if absent)

- [ ] **Step 1: Check/add `UserMapper.selectByPhone`**

Open `backend/src/main/java/com/skillstack/auth/mapper/UserMapper.java`. If there is no `selectByPhone`, add:

```java
@org.apache.ibatis.annotations.Select("SELECT * FROM users WHERE phone = #{phone} AND deleted = 0 LIMIT 1")
User selectByPhone(@org.apache.ibatis.annotations.Param("phone") String phone);
```

Verify whether `users.deleted` exists; check `V1__schema.sql`. If not, drop the `deleted` clause.

- [ ] **Step 2: Inject `NotificationService` and `UserMapper` into `InviteService`**

`InviteService` uses Lombok `@RequiredArgsConstructor`. Add `private final NotificationService notificationService;` and ensure `userMapper` is present (it already is — used in `acceptPhoneInvite`).

- [ ] **Step 3: Emit `PHONE_INVITE` in `createPhoneInvite`**

After `invitePhoneMapper.insert(p);` (line ~167), call:

```java
User invitee = userMapper.selectByPhone(raw);
if (invitee != null) {
    Team team = teamService.requireTeam(teamId);
    notificationService.notify(NotificationType.PHONE_INVITE, invitee.getId(), null, operatorId,
            "你被邀请加入团队：" + team.getName(),
            req.getNote() == null ? null : req.getNote(),
            "/team",
            "phone_invite", p.getId());
}
```

`team_id` is intentionally `null` because the invitee is not yet a member; the membership guard in `NotificationService.notify` would otherwise drop the message.

- [ ] **Step 4: Emit `TEAM_JOINED` in `joinByCode` and `acceptPhoneInvite`**

In `joinByCode` (line 84), after `teamMemberService.addMember(...)` (~line 118):

```java
Team team = teamService.requireTeam(code.getTeamId());
notificationService.notify(NotificationType.TEAM_JOINED, userId, code.getTeamId(), null,
        "你已加入团队：" + team.getName(),
        null, "/team", "team", code.getTeamId());
```

In `acceptPhoneInvite` (line 175), after the membership add (~line 187):

```java
Team team = teamService.requireTeam(teamId);
notificationService.notify(NotificationType.TEAM_JOINED, userId, teamId, p.getInvitedBy(),
        "你已加入团队：" + team.getName(),
        null, "/team", "team", teamId);
```

- [ ] **Step 5: Manual smoke (no new test added — covered by integration smoke)**

Run: `cd backend && mvn -q test`
Expected: existing invite tests still PASS. (No new InviteService test is required for v1 since the call sites are 3 thin inline calls; spec §9 lists the priority test files and InviteService is not among them.)

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/skillstack/team/service/InviteService.java \
        backend/src/main/java/com/skillstack/auth/mapper/UserMapper.java
git commit -m "feat(invite): emit PHONE_INVITE and TEAM_JOINED notifications"
```

---

## Task 11: Wire suite + team-member notifications

**Files:**
- Modify: `backend/src/main/java/com/skillstack/suite/service/SuiteService.java:153,189`
- Modify: `backend/src/main/java/com/skillstack/team/service/TeamMemberService.java:37,55`

- [ ] **Step 1: Add `NotificationService` to `SuiteService`**

Inject via `@RequiredArgsConstructor`-friendly final field. Resolve team member id list by adding a thin call:

```java
private List<Long> teamMemberIds(Long teamId) {
    return teamMapper.selectMembers(teamId, null, null, 0, 10000)
            .stream().map(TeamMemberRes::getUserId).toList();
}
```

`SuiteService` will need to inject `TeamMapper` (verify it isn't already injected — the file at lines 22+ shows current imports).

- [ ] **Step 2: Emit `SUITE_PUBLISHED` in `create`**

At the end of `create(...)` after `bumpTeamSuitesCount(teamId, 1);` (line 181):

```java
notificationService.notifyTeamMembers(NotificationType.SUITE_PUBLISHED, teamId, currentUserId,
        "新的团队套件已发布：" + s.getName(),
        s.getDescription(),
        "/team/suites",
        "suite", s.getId(),
        teamMemberIds(teamId));
```

- [ ] **Step 3: Emit `SUITE_UPDATED` in `updateItems`**

After `suiteMapper.updateById(s);` (line 219):

```java
notificationService.notifyTeamMembers(NotificationType.SUITE_UPDATED, s.getTeamId(), currentUserId,
        "团队套件已更新：" + s.getName(),
        null,
        "/team/suites",
        "suite", s.getId(),
        teamMemberIds(s.getTeamId()));
```

- [ ] **Step 4: Add `NotificationService` to `TeamMemberService`**

Add `private final NotificationService notificationService;` to the Lombok-generated constructor.

- [ ] **Step 5: Emit `TEAM_ROLE_CHANGED` in `updateRole`**

After `teamMemberMapper.updateById(target);` (line 50):

```java
Team team = teamService.requireTeam(teamId);
notificationService.notify(NotificationType.TEAM_ROLE_CHANGED, targetUserId, teamId, operatorId,
        "你在 " + team.getName() + " 的角色已变更为 " + role,
        null, "/team", "team_member", target.getId());
```

- [ ] **Step 6: Emit `TEAM_REMOVED` in `remove`**

Before `teamMemberMapper.deleteById(target.getId());` (line 60) so the recipient is still a member when the notification fires, OR after the delete with `type == TEAM_REMOVED` (the service explicitly skips the membership guard for `TEAM_REMOVED`). Use the latter to mirror spec §6.4:

```java
Team team = teamService.requireTeam(teamId);
notificationService.notify(NotificationType.TEAM_REMOVED, targetUserId, teamId, operatorId,
        "你已从团队 " + team.getName() + " 中移除",
        null, "/", "team_member", target.getId());
```

- [ ] **Step 7: Run full backend tests**

Run: `cd backend && mvn test`
Expected: PASS for all previously green tests plus the new ones in tasks 5–9. If any unrelated test fails, treat as a pre-existing failure noted in `git status`.

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java/com/skillstack/suite/service/SuiteService.java \
        backend/src/main/java/com/skillstack/team/service/TeamMemberService.java
git commit -m "feat(suite,team): emit suite + team-member notifications"
```

---

## Task 12: Frontend API for notifications

**Files:**
- Modify: `frontend/src/api/endpoints.ts`

- [ ] **Step 1: Add `NotificationItem` type**

At the top of `endpoints.ts` near other interfaces (around line 60), add:

```ts
export interface NotificationItem {
  id: number;
  type: string;
  category: 'review' | 'invite' | 'suite' | 'team' | 'system';
  title: string;
  body: string | null;
  teamId: number | null;
  teamName: string | null;
  actorId: number | null;
  actorName: string | null;
  targetUrl: string | null;
  read: boolean;
  createdAt: string;
}
```

- [ ] **Step 2: Add `notificationApi` object**

After `teamApi` block (around line 210), add:

```ts
export const notificationApi = {
  list: (q: { teamId?: number; status?: 'unread' | 'all'; page?: number; size?: number }) =>
    http.get<unknown, PageRes<NotificationItem>>('/me/notifications', { params: q }),
  unreadCount: (teamId?: number) =>
    http.get<unknown, { unread: number }>('/me/notifications/unread-count', {
      params: teamId ? { teamId } : {},
    }),
  markRead: (id: number) => http.post<unknown, void>(`/me/notifications/${id}/read`, {}),
  markAllRead: (teamId?: number) =>
    http.post<unknown, void>('/me/notifications/read-all', {}, {
      params: teamId ? { teamId } : {},
    }),
};
```

- [ ] **Step 3: Verify type-check**

Run: `cd frontend && npm run lint`
Expected: PASS (no TS errors).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/endpoints.ts
git commit -m "feat(notification): frontend notificationApi client"
```

---

## Task 13: Notifications page + route

**Files:**
- Create: `frontend/src/pages/team/Notifications.tsx`
- Modify: `frontend/src/router.tsx`

- [ ] **Step 1: Write the page**

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationApi, type NotificationItem } from '@/api/endpoints';
import { TOKENS } from '@/lib/tokens';
import { Card, Button, Badge } from '@/components/atoms';
import { DashTopBar } from '@/components/chrome/DashTopBar';
import { I } from '@/components/icons';
import { useCurrentTeam } from '@/hooks/useCurrentTeam';

type Tab = 'all' | 'unread';
type Scope = 'team' | 'all';

export default function NotificationsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { teamId } = useCurrentTeam(true);
  const [tab, setTab] = useState<Tab>('all');
  const [scope, setScope] = useState<Scope>('team');

  const status: 'all' | 'unread' = tab;
  const teamFilter = scope === 'team' ? teamId ?? undefined : undefined;

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', { teamFilter, status }],
    queryFn: () => notificationApi.list({ teamId: teamFilter, status, page: 1, size: 50 }),
  });

  const markRead = useMutation({
    mutationFn: (id: number) => notificationApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notif-unread'] });
    },
  });

  const markAll = useMutation({
    mutationFn: () => notificationApi.markAllRead(teamFilter),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notif-unread'] });
    },
  });

  function onItemClick(it: NotificationItem) {
    if (!it.read) markRead.mutate(it.id);
    if (it.targetUrl) navigate(it.targetUrl);
  }

  return (
    <div>
      <DashTopBar title="通知中心" subtitle="来自所有团队协作事件的站内消息" />

      <div style={{ display: 'flex', gap: 8, padding: '12px 16px', alignItems: 'center' }}>
        <Button variant={tab === 'all' ? 'primary' : 'ghost'} size="sm" onClick={() => setTab('all')}>全部</Button>
        <Button variant={tab === 'unread' ? 'primary' : 'ghost'} size="sm" onClick={() => setTab('unread')}>未读</Button>
        <div style={{ width: 1, height: 18, background: TOKENS.borderSoft, margin: '0 6px' }} />
        <Button variant={scope === 'team' ? 'primary' : 'ghost'} size="sm" onClick={() => setScope('team')}>当前团队</Button>
        <Button variant={scope === 'all' ? 'primary' : 'ghost'} size="sm" onClick={() => setScope('all')}>全部团队</Button>
        <div style={{ flex: 1 }} />
        <Button variant="ghost" size="sm" icon={<I.check size={14} />} onClick={() => markAll.mutate()}>
          全部标记已读
        </Button>
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        {isLoading && <div style={{ color: TOKENS.text3, fontSize: 12, padding: 12 }}>加载中…</div>}
        {!isLoading && data && data.items.length === 0 && (
          <Card pad={32}>
            <div style={{ textAlign: 'center', color: TOKENS.text3, fontSize: 13 }}>
              {tab === 'unread' ? '没有未读通知' : '还没有通知'}
            </div>
          </Card>
        )}
        {!isLoading && data && data.items.length > 0 && (
          <Card pad={0}>
            {data.items.map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => onItemClick(it)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '14px 16px',
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: `1px solid ${TOKENS.borderSoft}`,
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <CategoryIcon category={it.category} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: TOKENS.text }}>{it.title}</div>
                    {!it.read && <Badge tone="primary" size="xs">未读</Badge>}
                  </div>
                  {it.body && (
                    <div style={{ fontSize: 12, color: TOKENS.text2, marginTop: 4, lineHeight: 1.4 }}>{it.body}</div>
                  )}
                  <div style={{ fontSize: 11.5, color: TOKENS.text3, marginTop: 6, display: 'flex', gap: 10 }}>
                    {it.teamName && <span>{it.teamName}</span>}
                    {it.actorName && <span>{it.actorName}</span>}
                    <span>{formatTime(it.createdAt)}</span>
                  </div>
                </div>
              </button>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}

function CategoryIcon({ category }: { category: NotificationItem['category'] }) {
  const map: Record<NotificationItem['category'], keyof typeof I> = {
    review: 'check',
    invite: 'send',
    suite: 'package',
    team: 'users',
    system: 'bell',
  };
  const key = map[category] ?? 'bell';
  const Icon = I[key] as React.ComponentType<{ size?: number }>;
  return (
    <div
      style={{
        width: 28, height: 28, borderRadius: 6, display: 'grid', placeItems: 'center',
        background: TOKENS.bgGray, color: TOKENS.text2, flexShrink: 0,
      }}
    >
      <Icon size={14} />
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}
```

If `Badge` does not support `size="xs"` or `I.package` is missing, fall back to the closest existing variant (`size="sm"`, `I.box` / `I.archive` / `I.bell`); check `frontend/src/components/atoms/Badge.tsx` and `frontend/src/components/icons.tsx` first and use what exists.

- [ ] **Step 2: Register the route**

In `frontend/src/router.tsx`, import:

```ts
import Notifications from '@/pages/team/Notifications';
```

Add the route under "Member-only" alongside `/team/mine` (after line 104):

```tsx
{ path: '/team/notifications', element: <RequireTeam><Notifications /></RequireTeam> },
```

- [ ] **Step 3: Verify type-check + build**

Run: `cd frontend && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/team/Notifications.tsx frontend/src/router.tsx
git commit -m "feat(notification): /team/notifications inbox page"
```

---

## Task 14: TopBar bell rewire + unread badge

**Files:**
- Modify: `frontend/src/components/chrome/TopBar.tsx:310-327`

- [ ] **Step 1: Import the API and add unread query**

Inside the `TopBar` component body, after the existing hooks (around line 41):

```tsx
import { notificationApi } from '@/api/endpoints';
import { useQuery } from '@tanstack/react-query';

const { data: unreadResp } = useQuery({
  queryKey: ['notif-unread'],
  queryFn: () => notificationApi.unreadCount(),
  enabled: authed,
  refetchInterval: authed ? 60_000 : false,
  refetchOnWindowFocus: authed,
});
const unread = unreadResp?.unread ?? 0;
```

(`useQuery` is already imported elsewhere — confirm or add the import.)

- [ ] **Step 2: Update the bell `onClick` and add badge**

Replace the bell `<button>` block (currently lines 310–327) with:

```tsx
<button
  type="button"
  onClick={() => navigate('/team/notifications')}
  aria-label="通知"
  style={{
    position: 'relative',
    display: 'grid',
    placeItems: 'center',
    width: 32,
    height: 32,
    background: 'transparent',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    color: TOKENS.text2,
  }}
>
  <I.bell size={18} />
  {unread > 0 && (
    <span
      style={{
        position: 'absolute',
        top: 2,
        right: 2,
        minWidth: 16,
        height: 16,
        padding: '0 4px',
        borderRadius: 999,
        background: TOKENS.primary,
        color: '#fff',
        fontSize: 10,
        lineHeight: '16px',
        textAlign: 'center',
        fontWeight: 600,
      }}
    >
      {unread > 99 ? '99+' : unread}
    </span>
  )}
</button>
```

- [ ] **Step 3: Verify type-check**

Run: `cd frontend && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/chrome/TopBar.tsx
git commit -m "feat(topbar): bell opens /team/notifications with unread badge"
```

---

## Task 15: Rewrite `NotificationPrefsCard` for unified keys

**Files:**
- Modify: `frontend/src/components/notifications/NotificationPrefsCard.tsx`

- [ ] **Step 1: Replace the PrefRow rows with the spec keys**

Open `frontend/src/components/notifications/NotificationPrefsCard.tsx` and replace the inner contents of the two `<Card>` blocks (lines 66–102) with rows that match the new key set:

```tsx
<Card pad={20}>
  <SectionHeader title="站内通知" hint="影响通知中心和右上角铃铛未读" />
  <PrefRow title="新审核提交" hint="团队中有新的审核请求或重新提交时">
    <Switch on={v('review_submitted', 'inapp')} onChange={() => flip('review_submitted', 'inapp')} />
  </PrefRow>
  <PrefRow title="审核结果" hint="我提交的 Skill 被通过、驳回或请求修改时">
    <Switch on={v('review_result', 'inapp')} onChange={() => flip('review_result', 'inapp')} />
  </PrefRow>
  <PrefRow title="审核评论" hint="审核对话有新评论时">
    <Switch on={v('review_comment', 'inapp')} onChange={() => flip('review_comment', 'inapp')} />
  </PrefRow>
  <PrefRow title="手机号邀请" hint="有团队向我的手机号发送邀请时">
    <Switch on={v('phone_invite', 'inapp')} onChange={() => flip('phone_invite', 'inapp')} />
  </PrefRow>
  <PrefRow title="套件发布 / 更新" hint="团队套件被发布或内容变更时">
    <Switch on={v('suite_published', 'inapp')} onChange={() => flip('suite_published', 'inapp')} />
  </PrefRow>
  <PrefRow title="团队成员变化" hint="我被加入、移除或角色被调整时">
    <Switch on={v('team_member_change', 'inapp')} onChange={() => flip('team_member_change', 'inapp')} />
  </PrefRow>
  <PrefRow title="每周个人摘要" hint="每周一上午发我的 Skill 表现">
    <Switch on={v('weekly_digest', 'inapp')} onChange={() => flip('weekly_digest', 'inapp')} />
  </PrefRow>
</Card>
<Card pad={20}>
  <SectionHeader title="邮件通知" hint="保存邮件偏好；实际邮件投递将在邮件服务接入后启用" />
  {emailSupported('review_result') && (
    <PrefRow title="审核结果同步邮件" hint="即使在站内已读，也发邮件留档">
      <Switch on={v('review_result', 'email')} onChange={() => flip('review_result', 'email')} />
    </PrefRow>
  )}
  {emailSupported('phone_invite') && (
    <PrefRow title="手机号邀请同步邮件" hint="收到邀请时同时发邮件提醒">
      <Switch on={v('phone_invite', 'email')} onChange={() => flip('phone_invite', 'email')} />
    </PrefRow>
  )}
  {emailSupported('weekly_digest') && (
    <PrefRow title="每周摘要邮件" hint="周一上午 9:00 发送">
      <Switch on={v('weekly_digest', 'email')} onChange={() => flip('weekly_digest', 'email')} />
    </PrefRow>
  )}
</Card>
```

The `v`, `flip`, `emailSupported`, `PrefRow`, and `Switch` helpers stay unchanged.

- [ ] **Step 2: Verify type-check + build**

Run: `cd frontend && npm run lint && npm run build`
Expected: PASS for both. Build is included to catch the dropped `mention` reference.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/notifications/NotificationPrefsCard.tsx
git commit -m "feat(notification): rewrite prefs card for unified notification center keys"
```

---

## Task 16: Final verification

- [ ] **Step 1: Run full backend tests**

Run: `cd backend && mvn test`
Expected: all tests pass.

- [ ] **Step 2: Run frontend type-check + build**

Run: `cd frontend && npm run lint && npm run build`
Expected: both green.

- [ ] **Step 3: Browser smoke (manual)**

Start services: `./scripts/services.sh start`.

Walk the spec §9.2 checklist:
1. Log in, click the bell, confirm landing on `/team/notifications` (not `/team/reviews`).
2. Submit a skill (review-first), switch to an admin account, approve it; the submitter's `/team/notifications` should show a new unread row, and the bell badge should increment.
3. Click a notification row; the row is marked read, the bell badge decrements, and the page navigates to `targetUrl`.
4. In `/team/prefs`, turn off "审核结果" inapp; trigger another approve; the submitter sees no new notification.
5. Reload and confirm the unread count is consistent across the bell, `/team/notifications`, and the `unread-count` endpoint.

If any step fails, file the bug into `docs/superpowers/specs/` follow-ups — do not paper over with retries.

- [ ] **Step 4: Final commit (only if loose changes remain)**

```bash
git status
# only run the next line if there are uncommitted scope-relevant files
git add -p && git commit -m "chore(notification): final smoke fixes"
```

---

## Self-Review Notes

- Spec coverage check: §4 → Task 1, 2; §5 keys → Task 4; §6.1–6.2 → Tasks 2, 3, 5, 6, 7; §6.3 permission → Task 6, 7 (membership guard + 403 in `markRead`); §6.4 business hooks → Tasks 8–11; §7 frontend → Tasks 12–15; §9 tests → Tasks 4–9 (NotificationServiceTest, NotificationControllerTest, ReviewServiceTest+, ReviewCommentServiceTest+, NotificationPrefServiceTest+); §10 acceptance → Task 16.
- The `team_id NOT NULL` constraint on the existing `notification_pref` table means `PHONE_INVITE` and `TEAM_REMOVED` fall through to the default-on/off table only — flagged in Task 4 step 2.
- `NotificationType.REVIEW_SUBMITTED` and `REVIEW_RESUBMITTED` share the pref key `review_submitted`, which is added to `INAPP_KEYS` in Task 4. Confirmed type-name consistency across Tasks 3–11.
- `notifyTeamReviewers` is referenced from `ReviewService` (Task 8) and `SkillService.createReviewFirst` (Task 8 step 5). Both reuse the helper on `ReviewService` to keep fan-out in one place.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-22-unified-notification-center.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
