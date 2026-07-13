# Skill Desktop Client V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first runnable Skill desktop-management experience inside the existing Spring Boot + React codebase: browser login, `user_skills` cloud list, local install-state model, My Skill / Skills Plaza / Team Recommendations / Settings screens.

**Architecture:** Phase 1 implements the desktop client as a dedicated React route under the existing frontend so product and data semantics can be verified before packaging a real Electron/Tauri shell. The backend owns cloud state through `user_skills`; local install state is represented by a frontend local-storage adapter in phase 1 and can later move to desktop SQLite without changing API contracts. Existing CLI device authorization endpoints are reused for browser login.

**Tech Stack:** Spring Boot 3.2, MyBatis-Plus, Flyway, MySQL 8, React 18, Vite, TypeScript, TanStack Query, Vitest.

---

## File Map

### Backend

- Create: `backend/src/main/resources/db/migration/V29__user_skills.sql`
  - Adds `user_skills` table exactly aligned with the approved spec.
- Create: `backend/src/main/java/com/skillstack/userskill/entity/UserSkill.java`
  - MyBatis-Plus entity for `user_skills`.
- Create: `backend/src/main/java/com/skillstack/userskill/mapper/UserSkillMapper.java`
  - BaseMapper plus joined list query for My Skill page.
- Create: `backend/src/main/java/com/skillstack/userskill/dto/UserSkillImportReq.java`
  - Request for personal import/upsert.
- Create: `backend/src/main/java/com/skillstack/userskill/dto/UserSkillSubscribeReq.java`
  - Request for adding a plaza/recommended Skill.
- Create: `backend/src/main/java/com/skillstack/userskill/dto/UserSkillItem.java`
  - Response item including cloud record plus joined public Skill state.
- Create: `backend/src/main/java/com/skillstack/userskill/service/UserSkillService.java`
  - Business logic: list, import/upsert, subscribe idempotently, delete.
- Create: `backend/src/main/java/com/skillstack/userskill/controller/UserSkillController.java`
  - REST endpoints under `/api/user-skills`.
- Modify: `backend/src/main/java/com/skillstack/review/service/ReviewService.java`
  - On create-review approval, backfill `user_skills.skill_id` by `review_id`.

### Frontend

- Modify: `frontend/src/api/endpoints.ts`
  - Add `userSkillApi` types and methods.
- Create: `frontend/src/pages/desktop/types.ts`
  - Shared desktop client types.
- Create: `frontend/src/pages/desktop/localInstallStore.ts`
  - Phase-1 local install-state adapter using localStorage.
- Create: `frontend/src/pages/desktop/status.ts`
  - Pure functions that combine cloud list + local installs into UI states.
- Create: `frontend/src/pages/desktop/status.test.ts`
  - Vitest coverage for the 8 confirmed states.
- Create: `frontend/src/pages/desktop/DesktopLogin.tsx`
  - Browser-login screen that uses `authApi.cliDeviceInit` / `authApi.cliDevicePoll`.
- Create: `frontend/src/pages/desktop/DesktopLayout.tsx`
  - Desktop shell with sidebar, account menu, notification affordance.
- Create: `frontend/src/pages/desktop/MySkillsPage.tsx`
  - My Skill grouped view and icon actions.
- Create: `frontend/src/pages/desktop/PlazaPage.tsx`
  - Desktop plaza view reusing public Skill list.
- Create: `frontend/src/pages/desktop/RecommendationsPage.tsx`
  - Phase-1 team recommendations view with add-to-mine interactions; suite-backed data can replace the static list later.
- Create: `frontend/src/pages/desktop/DesktopSettingsPage.tsx`
  - Install target settings mock backed by local storage.
- Modify: `frontend/src/router.tsx`
  - Add `/desktop`, `/desktop/plaza`, `/desktop/recommendations`, `/desktop/settings`.

### Verification

- Backend compile: `cd backend && mvn test`
- Frontend tests: `cd frontend && npm run test -- status.test.ts --run`
- Frontend typecheck/build: `cd frontend && npm run lint`
- Manual smoke: run `./scripts/services.sh start`, open `http://localhost:5173/desktop`.

---

## Task 1: Backend Migration And Entity

**Files:**
- Create: `backend/src/main/resources/db/migration/V29__user_skills.sql`
- Create: `backend/src/main/java/com/skillstack/userskill/entity/UserSkill.java`
- Create: `backend/src/main/java/com/skillstack/userskill/mapper/UserSkillMapper.java`

- [ ] **Step 1: Add Flyway migration**

Create `backend/src/main/resources/db/migration/V29__user_skills.sql`:

```sql
-- User Skill cloud list for desktop client v1.
-- Stores both personal imported Skills and plaza/recommended subscribed Skills.
CREATE TABLE user_skills (
    id             BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键 ID',
    user_id        BIGINT       NOT NULL DEFAULT 0 COMMENT '用户 ID',
    type           ENUM('PERSONAL','SUBSCRIBED') NOT NULL DEFAULT 'PERSONAL' COMMENT '类型：PERSONAL=个人导入，SUBSCRIBED=广场添加',

    skill_id       BIGINT       NOT NULL DEFAULT 0 COMMENT '关联 skills.id；SUBSCRIBED 必填；PERSONAL 发布到广场后回填；0 表示未关联公开 Skill',
    review_id      BIGINT       NOT NULL DEFAULT 0 COMMENT '关联发布审核 reviews.id；个人 Skill 提交发布审核后记录；0 表示无审核单',

    slug           VARCHAR(96)  NOT NULL DEFAULT '' COMMENT 'Skill slug，沿用 skills.slug',
    name           VARCHAR(128) NOT NULL DEFAULT '' COMMENT 'Skill 名称，沿用 skills.name',
    short_desc     VARCHAR(512) NOT NULL DEFAULT '' COMMENT '一句话描述，沿用 skills.short_desc',
    cat_code       VARCHAR(32)  NOT NULL DEFAULT '' COMMENT '分类编码，沿用 skills.cat_code',
    icon           VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '图标，沿用 reviews.icon，预留图标 key/URL',
    version        VARCHAR(32)  NOT NULL DEFAULT '0.1.0' COMMENT '当前云端版本，沿用 skills.version / skill_versions.version',

    zip_url        VARCHAR(512) NOT NULL DEFAULT '' COMMENT '个人导入 Skill 的 zip storage key，沿用 reviews.zip_url / skill_versions.zip_url',
    files_count    INT          NOT NULL DEFAULT 0 COMMENT 'zip 内文件数量，沿用 reviews.files_count / skill_versions.files_count',
    safety         ENUM('pass','warn','fail') NOT NULL DEFAULT 'pass' COMMENT '安全检查结果，沿用 skills.safety',
    eval_score     INT          NOT NULL DEFAULT 0 COMMENT '评测分数，沿用 skills.eval_score',
    langs          JSON         NOT NULL DEFAULT (JSON_ARRAY()) COMMENT '语言数组 JSON，沿用 skills.langs',

    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT      NOT NULL DEFAULT 0 COMMENT '逻辑删除标记：0=未删除，1=已删除',

    PRIMARY KEY (id),
    UNIQUE KEY uk_user_skills_user_type_slug (user_id, type, slug),
    KEY idx_user_skills_user_type_skill (user_id, type, skill_id),
    KEY idx_user_skills_user_type (user_id, type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户 Skill 清单：个人导入与广场添加';
```

- [ ] **Step 2: Add entity**

Create `backend/src/main/java/com/skillstack/userskill/entity/UserSkill.java`:

```java
package com.skillstack.userskill.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.skillstack.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("user_skills")
public class UserSkill extends BaseEntity {
    private Long userId;
    /** PERSONAL / SUBSCRIBED */
    private String type;
    /** 0 表示未关联公开 Skill。 */
    private Long skillId;
    /** 0 表示无审核单。 */
    private Long reviewId;
    private String slug;
    private String name;
    private String shortDesc;
    private String catCode;
    private String icon;
    private String version;
    /** storage key，沿用 reviews.zip_url / skill_versions.zip_url 口径。 */
    private String zipUrl;
    private Integer filesCount;
    /** pass / warn / fail */
    private String safety;
    private Integer evalScore;
    /** JSON 字符串 ["TS","Py"] */
    private String langs;
}
```

- [ ] **Step 3: Add mapper**

Create `backend/src/main/java/com/skillstack/userskill/mapper/UserSkillMapper.java`:

```java
package com.skillstack.userskill.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.skillstack.userskill.entity.UserSkill;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;
import java.util.Map;

@Mapper
public interface UserSkillMapper extends BaseMapper<UserSkill> {

    @Select("""
            SELECT us.id, us.user_id, us.type, us.skill_id, us.review_id,
                   us.slug, us.name, us.short_desc, us.cat_code, us.icon,
                   us.version, us.zip_url, us.files_count, us.safety, us.eval_score,
                   us.langs, us.created_at, us.updated_at,
                   s.version AS public_version,
                   s.status AS public_status,
                   s.visibility AS public_visibility,
                   s.deleted AS public_deleted,
                   s.installs AS public_installs,
                   s.stars AS public_stars
              FROM user_skills us
              LEFT JOIN skills s ON s.id = us.skill_id
             WHERE us.deleted = 0
               AND us.user_id = #{userId}
             ORDER BY FIELD(us.type, 'PERSONAL', 'SUBSCRIBED'), us.updated_at DESC, us.id DESC
            """)
    List<Map<String, Object>> selectMineWithSkill(@Param("userId") Long userId);

    @Update("""
            UPDATE user_skills
               SET skill_id = #{skillId}, updated_at = NOW()
             WHERE review_id = #{reviewId}
               AND type = 'PERSONAL'
               AND deleted = 0
            """)
    int backfillSkillIdByReviewId(@Param("reviewId") Long reviewId,
                                  @Param("skillId") Long skillId);
}
```

- [ ] **Step 4: Compile**

Run:

```bash
cd backend && mvn -DskipTests compile
```

Expected: compile succeeds. If it fails due to Java version mismatch in local machine, record the exact error and use the project JDK configured in IntelliJ.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/resources/db/migration/V29__user_skills.sql \
        backend/src/main/java/com/skillstack/userskill/entity/UserSkill.java \
        backend/src/main/java/com/skillstack/userskill/mapper/UserSkillMapper.java
git commit -m "新增用户Skill清单表"
```

---

## Task 2: Backend DTOs, Service, Controller

**Files:**
- Create: `backend/src/main/java/com/skillstack/userskill/dto/UserSkillImportReq.java`
- Create: `backend/src/main/java/com/skillstack/userskill/dto/UserSkillSubscribeReq.java`
- Create: `backend/src/main/java/com/skillstack/userskill/dto/UserSkillItem.java`
- Create: `backend/src/main/java/com/skillstack/userskill/service/UserSkillService.java`
- Create: `backend/src/main/java/com/skillstack/userskill/controller/UserSkillController.java`

- [ ] **Step 1: Add request DTO for personal import**

Create `backend/src/main/java/com/skillstack/userskill/dto/UserSkillImportReq.java`:

```java
package com.skillstack.userskill.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class UserSkillImportReq {
    @NotBlank
    @Size(max = 128)
    private String name;

    @NotBlank
    @Pattern(regexp = "^[a-z0-9][a-z0-9-]{1,94}$", message = "slug 必须为小写字母 / 数字 / 短横线")
    private String slug;

    @Size(max = 512)
    private String shortDesc;

    @Size(max = 32)
    private String catCode;

    @Size(max = 64)
    private String icon;

    @NotBlank
    @Pattern(regexp = "^\\d+\\.\\d+\\.\\d+(?:[-+][0-9A-Za-z.-]+)?$", message = "version 必须符合 SemVer,如 0.1.0")
    private String version;

    @NotBlank
    @Size(max = 512)
    private String zipUrl;

    private Integer filesCount;

    private List<String> langs;
}
```

- [ ] **Step 2: Add subscribe request DTO**

Create `backend/src/main/java/com/skillstack/userskill/dto/UserSkillSubscribeReq.java`:

```java
package com.skillstack.userskill.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UserSkillSubscribeReq {
    @NotNull
    private Long skillId;
}
```

- [ ] **Step 3: Add response DTO**

Create `backend/src/main/java/com/skillstack/userskill/dto/UserSkillItem.java`:

```java
package com.skillstack.userskill.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class UserSkillItem {
    private Long id;
    private String type;
    private Long skillId;
    private Long reviewId;
    private String slug;
    private String name;
    private String shortDesc;
    private String catCode;
    private String icon;
    private String version;
    private String zipUrl;
    private Integer filesCount;
    private String safety;
    private Integer evalScore;
    private String langs;
    private String publicVersion;
    private String publicStatus;
    private String publicVisibility;
    private Boolean publicDeleted;
    private Integer publicInstalls;
    private Integer publicStars;
}
```

- [ ] **Step 4: Add service**

Create `backend/src/main/java/com/skillstack/userskill/service/UserSkillService.java`:

```java
package com.skillstack.userskill.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.skill.entity.Skill;
import com.skillstack.skill.service.SkillService;
import com.skillstack.userskill.dto.UserSkillImportReq;
import com.skillstack.userskill.dto.UserSkillItem;
import com.skillstack.userskill.dto.UserSkillSubscribeReq;
import com.skillstack.userskill.entity.UserSkill;
import com.skillstack.userskill.mapper.UserSkillMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class UserSkillService {

    private static final ObjectMapper OM = new ObjectMapper();

    private final UserSkillMapper userSkillMapper;
    private final SkillService skillService;


    public List<UserSkillItem> listMine(Long userId) {
        List<Map<String, Object>> rows = userSkillMapper.selectMineWithSkill(userId);
        List<UserSkillItem> items = new ArrayList<>(rows.size());
        for (Map<String, Object> row : rows) {
            items.add(toItem(row));
        }
        return items;
    }

    @Transactional
    public UserSkillItem importPersonal(Long userId, UserSkillImportReq req) {
        UserSkill existing = userSkillMapper.selectOne(Wrappers.<UserSkill>lambdaQuery()
                .eq(UserSkill::getUserId, userId)
                .eq(UserSkill::getType, "PERSONAL")
                .eq(UserSkill::getSlug, req.getSlug()));

        UserSkill row = existing == null ? new UserSkill() : existing;
        row.setUserId(userId);
        row.setType("PERSONAL");
        if (row.getSkillId() == null) {
            row.setSkillId(0L);
        }
        if (row.getReviewId() == null) {
            row.setReviewId(0L);
        }
        row.setSlug(req.getSlug());
        row.setName(req.getName());
        row.setShortDesc(blankToEmpty(req.getShortDesc()));
        row.setCatCode(blankToEmpty(req.getCatCode()));
        row.setIcon(blankToEmpty(req.getIcon()));
        row.setVersion(req.getVersion());
        row.setZipUrl(req.getZipUrl());
        row.setFilesCount(req.getFilesCount() == null ? 0 : Math.max(0, req.getFilesCount()));
        row.setSafety("pass");
        row.setEvalScore(0);
        row.setLangs(toJsonArray(req.getLangs()));

        if (existing == null) {
            userSkillMapper.insert(row);
        } else {
            userSkillMapper.updateById(row);
        }
        return findMineItem(userId, row.getId());
    }

    @Transactional
    public UserSkillItem subscribe(Long userId, UserSkillSubscribeReq req) {
        Skill skill = skillService.findById(req.getSkillId());
        if (!"APPROVED".equals(skill.getStatus())) {
            throw new BusinessException(40900, "只有已上架 Skill 可以添加");
        }

        UserSkill existing = userSkillMapper.selectOne(Wrappers.<UserSkill>lambdaQuery()
                .eq(UserSkill::getUserId, userId)
                .eq(UserSkill::getType, "SUBSCRIBED")
                .eq(UserSkill::getSkillId, skill.getId()));
        if (existing != null) {
            return findMineItem(userId, existing.getId());
        }

        UserSkill row = new UserSkill();
        row.setUserId(userId);
        row.setType("SUBSCRIBED");
        row.setSkillId(skill.getId());
        row.setReviewId(0L);
        row.setSlug(skill.getSlug());
        row.setName(skill.getName());
        row.setShortDesc(blankToEmpty(skill.getShortDesc()));
        row.setCatCode(blankToEmpty(skill.getCatCode()));
        row.setIcon(blankToEmpty(skill.getIcon()));
        row.setVersion(skill.getVersion());
        row.setZipUrl("");
        row.setFilesCount(0);
        row.setSafety(skill.getSafety() == null ? "pass" : skill.getSafety());
        row.setEvalScore(skill.getEvalScore() == null ? 0 : skill.getEvalScore());
        row.setLangs(skill.getLangs() == null || skill.getLangs().isBlank() ? "[]" : skill.getLangs());
        userSkillMapper.insert(row);
        return findMineItem(userId, row.getId());
    }

    @Transactional
    public void deleteMine(Long userId, Long id) {
        UserSkill row = userSkillMapper.selectById(id);
        if (row == null || row.getDeleted() != null && row.getDeleted() == 1 || !userId.equals(row.getUserId())) {
            throw new BusinessException(40400, "用户 Skill 不存在");
        }
        userSkillMapper.deleteById(id);
    }

    public UserSkillItem findMineItem(Long userId, Long id) {
        List<UserSkillItem> items = listMine(userId);
        for (UserSkillItem item : items) {
            if (id.equals(item.getId())) {
                return item;
            }
        }
        throw new BusinessException(40400, "用户 Skill 不存在");
    }

    public int backfillPublishedSkill(Long reviewId, Long skillId) {
        if (reviewId == null || reviewId <= 0 || skillId == null || skillId <= 0) {
            return 0;
        }
        return userSkillMapper.backfillSkillIdByReviewId(reviewId, skillId);
    }

    private UserSkillItem toItem(Map<String, Object> row) {
        return UserSkillItem.builder()
                .id(toLong(row.get("id")))
                .type((String) row.get("type"))
                .skillId(toLong(row.get("skill_id")))
                .reviewId(toLong(row.get("review_id")))
                .slug((String) row.get("slug"))
                .name((String) row.get("name"))
                .shortDesc((String) row.get("short_desc"))
                .catCode((String) row.get("cat_code"))
                .icon((String) row.get("icon"))
                .version((String) row.get("version"))
                .zipUrl((String) row.get("zip_url"))
                .filesCount(toInt(row.get("files_count")))
                .safety((String) row.get("safety"))
                .evalScore(toInt(row.get("eval_score")))
                .langs(row.get("langs") == null ? "[]" : String.valueOf(row.get("langs")))
                .publicVersion((String) row.get("public_version"))
                .publicStatus((String) row.get("public_status"))
                .publicVisibility((String) row.get("public_visibility"))
                .publicDeleted(toInt(row.get("public_deleted")) != null && toInt(row.get("public_deleted")) == 1)
                .publicInstalls(toInt(row.get("public_installs")))
                .publicStars(toInt(row.get("public_stars")))
                .build();
    }

    private static String blankToEmpty(String value) {
        return value == null || value.isBlank() ? "" : value.trim();
    }

    private static String toJsonArray(List<String> values) {
        if (values == null || values.isEmpty()) {
            return "[]";
        }
        try {
            return OM.writeValueAsString(values);
        } catch (JsonProcessingException e) {
            return "[]";
        }
    }

    private static Long toLong(Object value) {
        return value instanceof Number number ? number.longValue() : null;
    }

    private static Integer toInt(Object value) {
        return value instanceof Number number ? number.intValue() : null;
    }
}
```

- [ ] **Step 5: Add controller**

Create `backend/src/main/java/com/skillstack/userskill/controller/UserSkillController.java`:

```java
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
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class UserSkillController {

    private final UserSkillService userSkillService;


    @GetMapping("/api/user-skills")
    public ApiResponse<List<UserSkillItem>> listMine(@AuthenticationPrincipal CurrentUser me) {
        if (me == null) {
            throw new BusinessException(40100, "未登录");
        }
        return ApiResponse.ok(userSkillService.listMine(me.getId()));
    }

    @PostMapping("/api/user-skills/import")
    public ApiResponse<UserSkillItem> importPersonal(@AuthenticationPrincipal CurrentUser me,
                                                     @Valid @RequestBody UserSkillImportReq req) {
        if (me == null) {
            throw new BusinessException(40100, "未登录");
        }
        return ApiResponse.ok(userSkillService.importPersonal(me.getId(), req));
    }

    @PostMapping("/api/user-skills/subscribe")
    public ApiResponse<UserSkillItem> subscribe(@AuthenticationPrincipal CurrentUser me,
                                                @Valid @RequestBody UserSkillSubscribeReq req) {
        if (me == null) {
            throw new BusinessException(40100, "未登录");
        }
        return ApiResponse.ok(userSkillService.subscribe(me.getId(), req));
    }

    @DeleteMapping("/api/user-skills/{id}")
    public ApiResponse<Void> deleteMine(@AuthenticationPrincipal CurrentUser me,
                                        @PathVariable Long id) {
        if (me == null) {
            throw new BusinessException(40100, "未登录");
        }
        userSkillService.deleteMine(me.getId(), id);
        return ApiResponse.ok(null);
    }
}
```

- [ ] **Step 6: Compile backend**

Run:

```bash
cd backend && mvn -DskipTests compile
```

Expected: compile succeeds.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/com/skillstack/userskill
git commit -m "新增用户Skill清单接口"
```

---

## Task 3: Backfill Published Skill On Review Approval

**Files:**
- Modify: `backend/src/main/java/com/skillstack/review/service/ReviewService.java`
- Modify: `backend/src/main/java/com/skillstack/userskill/service/UserSkillService.java` only if method signature needs adjustment

- [ ] **Step 1: Inject `UserSkillService` lazily**

Modify `ReviewService` constructor and fields:

```java
private final UserSkillService userSkillService;
```

Import:

```java
import com.skillstack.userskill.service.UserSkillService;
```

Constructor parameter:

```java
@Lazy UserSkillService userSkillService,
```

Assignment:

```java
this.userSkillService = userSkillService;
```

- [ ] **Step 2: Backfill after create-review approval**

In `ReviewService.approve`, after:

```java
r.setSkillId(s.getId());
r.setStatus("APPROVED");
```

add:

```java
userSkillService.backfillPublishedSkill(r.getId(), s.getId());
```

Do not add this to `VERSION_BUMP`; only first publish materializes a new `skills` row.

- [ ] **Step 3: Compile backend**

Run:

```bash
cd backend && mvn -DskipTests compile
```

Expected: compile succeeds.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/skillstack/review/service/ReviewService.java \
        backend/src/main/java/com/skillstack/userskill/service/UserSkillService.java
git commit -m "发布审核通过后回填用户Skill"
```

---

## Task 4: Frontend API And Local Install Store

**Files:**
- Modify: `frontend/src/api/endpoints.ts`
- Create: `frontend/src/pages/desktop/types.ts`
- Create: `frontend/src/pages/desktop/localInstallStore.ts`

- [ ] **Step 1: Add API types and client methods**

Append to `frontend/src/api/endpoints.ts` near other Skill API exports:

```ts
export type UserSkillType = 'PERSONAL' | 'SUBSCRIBED';

export interface UserSkillItemRes {
  id: number;
  type: UserSkillType;
  skillId: number;
  reviewId: number;
  slug: string;
  name: string;
  shortDesc: string;
  catCode: string;
  icon: string;
  version: string;
  zipUrl: string;
  filesCount: number;
  safety: 'pass' | 'warn' | 'fail';
  evalScore: number;
  langs: string;
  publicVersion?: string | null;
  publicStatus?: string | null;
  publicVisibility?: string | null;
  publicDeleted?: boolean | null;
  publicInstalls?: number | null;
  publicStars?: number | null;
}

export interface UserSkillImportReq {
  name: string;
  slug: string;
  shortDesc?: string;
  catCode?: string;
  icon?: string;
  version: string;
  zipUrl: string;
  filesCount?: number;
  langs?: string[];
}

export const userSkillApi = {
  mine: () => http.get<unknown, UserSkillItemRes[]>('/user-skills'),
  importPersonal: (body: UserSkillImportReq) =>
    http.post<unknown, UserSkillItemRes>('/user-skills/import', body),
  subscribe: (skillId: number) =>
    http.post<unknown, UserSkillItemRes>('/user-skills/subscribe', { skillId }),
  remove: (id: number) => http.delete<unknown, void>(`/user-skills/${id}`),
};
```

- [ ] **Step 2: Add desktop shared types**

Create `frontend/src/pages/desktop/types.ts`:

```ts
import type { UserSkillItemRes, UserSkillType } from '@/api/endpoints';

export type DesktopAgent = 'CLAUDE' | 'CODEX' | 'OPENCLAW';

export interface LocalInstallEntry {
  userSkillId: number;
  type: UserSkillType;
  skillId: number;
  slug: string;
  name: string;
  version: string;
  agent: DesktopAgent;
  installPath: string;
  installedAt: string;
  updatedAt: string;
}

export type DesktopSkillStatus =
  | 'PERSONAL_NOT_INSTALLED'
  | 'PERSONAL_INSTALLED_LATEST'
  | 'PERSONAL_INSTALLED_UPDATE'
  | 'PERSONAL_CLOUD_DELETED_LOCAL'
  | 'SUBSCRIBED_INSTALLED_LATEST'
  | 'SUBSCRIBED_NOT_INSTALLED'
  | 'SUBSCRIBED_INSTALLED_UPDATE'
  | 'SUBSCRIBED_UNLISTED_LOCAL';

export interface DesktopSkillView {
  cloud: UserSkillItemRes | null;
  local: LocalInstallEntry | null;
  status: DesktopSkillStatus;
  statusLabel: string;
  description: string;
  actions: Array<'view' | 'install' | 'update' | 'delete' | 'uninstall'>;
}
```

- [ ] **Step 3: Add local install store**

Create `frontend/src/pages/desktop/localInstallStore.ts`:

```ts
import type { LocalInstallEntry } from './types';

const KEY = 'skillstack.desktop.installs.v1';

export function readLocalInstalls(): LocalInstallEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeLocalInstalls(entries: LocalInstallEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(entries, null, 2));
}

export function upsertLocalInstall(entry: LocalInstallEntry) {
  const entries = readLocalInstalls();
  const next = entries.filter((item) => item.userSkillId !== entry.userSkillId);
  next.push(entry);
  writeLocalInstalls(next);
}

export function removeLocalInstall(userSkillId: number) {
  writeLocalInstalls(readLocalInstalls().filter((item) => item.userSkillId !== userSkillId));
}
```

- [ ] **Step 4: Typecheck frontend**

Run:

```bash
cd frontend && npm run lint
```

Expected: TypeScript succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/endpoints.ts frontend/src/pages/desktop/types.ts frontend/src/pages/desktop/localInstallStore.ts
git commit -m "新增桌面端Skill接口类型"
```

---

## Task 5: Frontend Status Calculation With Tests

**Files:**
- Create: `frontend/src/pages/desktop/status.ts`
- Create: `frontend/src/pages/desktop/status.test.ts`

- [ ] **Step 1: Add status calculation**

Create `frontend/src/pages/desktop/status.ts`:

```ts
import type { UserSkillItemRes } from '@/api/endpoints';
import type { DesktopSkillView, LocalInstallEntry } from './types';

function isUnlisted(cloud: UserSkillItemRes): boolean {
  return Boolean(cloud.publicDeleted)
    || cloud.publicStatus === 'UNLISTED'
    || cloud.publicStatus === 'ARCHIVED'
    || (cloud.type === 'SUBSCRIBED' && !cloud.publicStatus);
}

function effectiveCloudVersion(cloud: UserSkillItemRes): string {
  if (cloud.type === 'SUBSCRIBED') return cloud.publicVersion || cloud.version;
  return cloud.version;
}

function localByCloud(localInstalls: LocalInstallEntry[]): Map<number, LocalInstallEntry> {
  return new Map(localInstalls.map((item) => [item.userSkillId, item]));
}

export function buildDesktopSkillViews(
  cloudItems: UserSkillItemRes[],
  localInstalls: LocalInstallEntry[],
): DesktopSkillView[] {
  const byCloud = localByCloud(localInstalls);
  const cloudIds = new Set(cloudItems.map((item) => item.id));
  const views: DesktopSkillView[] = [];

  for (const cloud of cloudItems) {
    const local = byCloud.get(cloud.id) || null;
    if (cloud.type === 'PERSONAL') {
      if (!local) {
        views.push({
          cloud,
          local,
          status: 'PERSONAL_NOT_INSTALLED',
          statusLabel: '未安装',
          description: '未安装 · 可安装到本地',
          actions: ['view', 'install', 'delete'],
        });
      } else if (local.version === cloud.version) {
        views.push({
          cloud,
          local,
          status: 'PERSONAL_INSTALLED_LATEST',
          statusLabel: '最新',
          description: '已安装 · 最新',
          actions: ['view', 'delete'],
        });
      } else {
        views.push({
          cloud,
          local,
          status: 'PERSONAL_INSTALLED_UPDATE',
          statusLabel: '可更新',
          description: '已安装 · 云端有更新',
          actions: ['view', 'update', 'delete'],
        });
      }
      continue;
    }

    if (local && isUnlisted(cloud)) {
      views.push({
        cloud,
        local,
        status: 'SUBSCRIBED_UNLISTED_LOCAL',
        statusLabel: '已下架',
        description: '已下架 · 本地保留，仍可用',
        actions: ['view', 'uninstall'],
      });
    } else if (!local) {
      views.push({
        cloud,
        local,
        status: 'SUBSCRIBED_NOT_INSTALLED',
        statusLabel: '未安装',
        description: '未安装 · 可安装到本地',
        actions: ['view', 'install', 'delete'],
      });
    } else if (local.version === effectiveCloudVersion(cloud)) {
      views.push({
        cloud,
        local,
        status: 'SUBSCRIBED_INSTALLED_LATEST',
        statusLabel: '最新',
        description: '已安装 · 最新',
        actions: ['view', 'delete'],
      });
    } else {
      views.push({
        cloud,
        local,
        status: 'SUBSCRIBED_INSTALLED_UPDATE',
        statusLabel: '可更新',
        description: `已安装 · 可更新 · 本地 v${local.version}，云端 v${effectiveCloudVersion(cloud)}`,
        actions: ['view', 'update', 'delete'],
      });
    }
  }

  for (const local of localInstalls) {
    if (cloudIds.has(local.userSkillId)) continue;
    views.push({
      cloud: null,
      local,
      status: local.type === 'PERSONAL' ? 'PERSONAL_CLOUD_DELETED_LOCAL' : 'SUBSCRIBED_UNLISTED_LOCAL',
      statusLabel: local.type === 'PERSONAL' ? '仅本地' : '已下架',
      description: local.type === 'PERSONAL'
        ? '已安装 · 云端已删除 · 本地保留，仍可用'
        : '已下架 · 本地保留，仍可用',
      actions: ['view', 'uninstall'],
    });
  }

  return views;
}
```

- [ ] **Step 2: Add tests for all confirmed states**

Create `frontend/src/pages/desktop/status.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { UserSkillItemRes } from '@/api/endpoints';
import type { LocalInstallEntry } from './types';
import { buildDesktopSkillViews } from './status';

function cloud(overrides: Partial<UserSkillItemRes>): UserSkillItemRes {
  return {
    id: 1,
    type: 'PERSONAL',
    skillId: 0,
    reviewId: 0,
    slug: 'demo',
    name: 'Demo',
    shortDesc: '',
    catCode: '',
    icon: '',
    version: '0.9.0',
    zipUrl: 'skill-versions/1/demo.zip',
    filesCount: 1,
    safety: 'pass',
    evalScore: 0,
    langs: '[]',
    publicVersion: null,
    publicStatus: null,
    publicVisibility: null,
    publicDeleted: false,
    publicInstalls: 0,
    publicStars: 0,
    ...overrides,
  };
}

function local(overrides: Partial<LocalInstallEntry>): LocalInstallEntry {
  return {
    userSkillId: 1,
    type: 'PERSONAL',
    skillId: 0,
    slug: 'demo',
    name: 'Demo',
    version: '0.9.0',
    agent: 'CLAUDE',
    installPath: '/tmp/demo',
    installedAt: '2026-05-29T00:00:00.000Z',
    updatedAt: '2026-05-29T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildDesktopSkillViews', () => {
  it('个人未安装', () => {
    const [view] = buildDesktopSkillViews([cloud({ type: 'PERSONAL' })], []);
    expect(view.status).toBe('PERSONAL_NOT_INSTALLED');
    expect(view.actions).toEqual(['view', 'install', 'delete']);
  });

  it('个人已安装最新', () => {
    const [view] = buildDesktopSkillViews([cloud({ type: 'PERSONAL' })], [local({ type: 'PERSONAL' })]);
    expect(view.status).toBe('PERSONAL_INSTALLED_LATEST');
    expect(view.actions).toEqual(['view', 'delete']);
  });

  it('个人已安装云端有更新', () => {
    const [view] = buildDesktopSkillViews(
      [cloud({ type: 'PERSONAL', version: '0.9.0' })],
      [local({ type: 'PERSONAL', version: '0.8.0' })],
    );
    expect(view.status).toBe('PERSONAL_INSTALLED_UPDATE');
    expect(view.actions).toEqual(['view', 'update', 'delete']);
  });

  it('个人云端已删除本地保留', () => {
    const [view] = buildDesktopSkillViews([], [local({ type: 'PERSONAL' })]);
    expect(view.status).toBe('PERSONAL_CLOUD_DELETED_LOCAL');
    expect(view.actions).toEqual(['view', 'uninstall']);
  });

  it('订阅已安装最新', () => {
    const [view] = buildDesktopSkillViews(
      [cloud({ type: 'SUBSCRIBED', skillId: 10, publicVersion: '0.9.0', publicStatus: 'APPROVED' })],
      [local({ type: 'SUBSCRIBED', skillId: 10, version: '0.9.0' })],
    );
    expect(view.status).toBe('SUBSCRIBED_INSTALLED_LATEST');
  });

  it('订阅未安装', () => {
    const [view] = buildDesktopSkillViews(
      [cloud({ type: 'SUBSCRIBED', skillId: 10, publicVersion: '0.9.0', publicStatus: 'APPROVED' })],
      [],
    );
    expect(view.status).toBe('SUBSCRIBED_NOT_INSTALLED');
  });

  it('订阅已安装可更新', () => {
    const [view] = buildDesktopSkillViews(
      [cloud({ type: 'SUBSCRIBED', skillId: 10, publicVersion: '0.9.0', publicStatus: 'APPROVED' })],
      [local({ type: 'SUBSCRIBED', skillId: 10, version: '0.8.0' })],
    );
    expect(view.status).toBe('SUBSCRIBED_INSTALLED_UPDATE');
    expect(view.description).toContain('本地 v0.8.0，云端 v0.9.0');
  });

  it('订阅已下架本地保留', () => {
    const [view] = buildDesktopSkillViews(
      [cloud({ type: 'SUBSCRIBED', skillId: 10, publicVersion: '0.9.0', publicStatus: 'UNLISTED' })],
      [local({ type: 'SUBSCRIBED', skillId: 10, version: '0.9.0' })],
    );
    expect(view.status).toBe('SUBSCRIBED_UNLISTED_LOCAL');
    expect(view.actions).toEqual(['view', 'uninstall']);
  });
});
```

- [ ] **Step 3: Run status tests**

Run:

```bash
cd frontend && npm run test -- src/pages/desktop/status.test.ts --run
```

Expected: all 8 tests pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/desktop/status.ts frontend/src/pages/desktop/status.test.ts
git commit -m "新增桌面端Skill状态计算"
```

---

## Task 6: Desktop Login And Layout

**Files:**
- Create: `frontend/src/pages/desktop/DesktopLogin.tsx`
- Create: `frontend/src/pages/desktop/DesktopLayout.tsx`
- Modify: `frontend/src/router.tsx`

- [ ] **Step 1: Add desktop login page**

Create `frontend/src/pages/desktop/DesktopLogin.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { authApi } from '@/api/endpoints';
import { setToken } from '@/api/client';
import { Button } from '@/components/ui';

type LoginState = 'idle' | 'waiting' | 'done' | 'error';

export default function DesktopLogin() {
  const [state, setState] = useState<LoginState>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    return () => {
      cancelled = true;
      void cancelled;
    };
  }, []);

  async function startLogin() {
    setError('');
    setState('waiting');
    try {
      const init = await authApi.cliDeviceInit();
      window.open(init.verificationUri, '_blank', 'noopener,noreferrer');
      const deadline = Date.now() + init.expiresIn * 1000;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, Math.max(1, init.interval) * 1000));
        const poll = await authApi.cliDevicePoll(init.deviceCode);
        if (poll.status === 'approved' && poll.token) {
          setToken(poll.token);
          setState('done');
          window.location.assign('/desktop');
          return;
        }
      }
      setState('error');
      setError('登录授权已过期，请重新发起登录');
    } catch (e) {
      setState('error');
      setError(e instanceof Error ? e.message : '登录失败');
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fff', display: 'grid', placeItems: 'center', position: 'relative' }}>
      <div style={{ textAlign: 'center', width: 380 }}>
        <div style={{ width: 86, height: 86, border: '1px solid #e5e7eb', borderRadius: 24, margin: '0 auto 28px', display: 'grid', placeItems: 'center', fontSize: 42, fontWeight: 900 }}>
          S
        </div>
        <div style={{ fontSize: 36, fontWeight: 850, marginBottom: 12 }}>SkillStack</div>
        <div style={{ fontSize: 18, color: '#8b8f98', marginBottom: 28 }}>
          {state === 'waiting' ? '已打开浏览器，等待登录完成' : '登录以开始使用'}
        </div>
        <Button type="button" variant="primary" onClick={startLogin} disabled={state === 'waiting'} style={{ borderRadius: 28, height: 56, padding: '0 32px', fontSize: 19 }}>
          {state === 'waiting' ? '等待浏览器登录' : '通过浏览器登录'}
        </Button>
        {error && <div style={{ marginTop: 18, color: '#dc2626', fontSize: 13 }}>{error}</div>}
      </div>
      <div style={{ position: 'absolute', right: 30, bottom: 26, color: '#9ca3af', fontWeight: 650 }}>v0.1.0</div>
    </div>
  );
}
```

- [ ] **Step 2: Add desktop layout**

Create `frontend/src/pages/desktop/DesktopLayout.tsx`:

```tsx
import { useState } from 'react';
import { Bell } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getToken, setToken } from '@/api/client';
import { authApi } from '@/api/endpoints';

const navItems = [
  { to: '/desktop', label: '我的 Skill', end: true },
  { to: '/desktop/plaza', label: 'Skills 广场' },
  { to: '/desktop/recommendations', label: '团队推荐' },
];

export default function DesktopLayout() {
  const navigate = useNavigate();
  const token = getToken();
  const [accountOpen, setAccountOpen] = useState(false);
  const me = useQuery({ queryKey: ['desktop-me'], queryFn: authApi.me, enabled: Boolean(token) });

  if (!token) {
    window.location.assign('/desktop/login');
    return null;
  }

  function logout() {
    setToken(null);
    navigate('/desktop/login', { replace: true });
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7f8', display: 'grid', gridTemplateColumns: '220px minmax(0,1fr)' }}>
      <aside style={{ background: '#e9e9ea', padding: 16, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 22 }}>SkillStack</div>
        <nav style={{ display: 'grid', gap: 6, fontSize: 14 }}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                textDecoration: 'none',
                color: isActive ? '#111827' : '#4b5563',
                background: isActive ? '#fff' : 'transparent',
                fontWeight: isActive ? 750 : 500,
                padding: '10px 12px',
                borderRadius: 10,
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ marginTop: 'auto', position: 'relative' }}>
          {accountOpen && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 58, borderRadius: 18, background: 'rgba(255,255,255,.96)', border: '1px solid rgba(229,231,235,.9)', boxShadow: '0 18px 42px rgba(17,24,39,.16)', padding: 14 }}>
            <button type="button" style={menuButton} onClick={() => navigate('/desktop/settings')}>设置</button>
            <button type="button" style={menuButton}>关于</button>
            <button type="button" style={{ ...menuButton, color: '#ef4444' }} onClick={logout}>退出登录</button>
          </div>
          )}
          <button type="button" onClick={() => setAccountOpen((value) => !value)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 2px 2px', border: 0, background: 'transparent', width: '100%', font: 'inherit', textAlign: 'left' }}>
            <span style={{ width: 42, height: 42, borderRadius: 999, background: '#059669', color: 'white', display: 'grid', placeItems: 'center', fontWeight: 800 }}>{(me.data?.name || me.data?.handle || 'U').slice(0, 1).toUpperCase()}</span>
            <span style={{ fontSize: 15, fontWeight: 750 }}>{me.data?.name || me.data?.handle || '未命名用户'}</span>
            <span style={{ color: '#6b7280', marginLeft: 'auto' }}>⌄</span>
          </button>
        </div>
      </aside>
      <main style={{ padding: '30px 38px', background: '#fbfbfc' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button type="button" title="通知" style={{ width: 34, height: 34, borderRadius: 999, border: '1px solid #e5e7eb', background: '#fff', display: 'grid', placeItems: 'center' }}>
            <Bell size={16} />
          </button>
        </div>
        <Outlet />
      </main>
    </div>
  );
}

const menuButton: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  border: 0,
  background: 'transparent',
  padding: '9px 4px',
  color: '#374151',
  fontWeight: 650,
  font: 'inherit',
};
```

- [ ] **Step 3: Register desktop routes**

Modify `frontend/src/router.tsx` imports:

```tsx
import DesktopLogin from '@/pages/desktop/DesktopLogin';
import DesktopLayout from '@/pages/desktop/DesktopLayout';
```

Add routes before fallback:

```tsx
{
  path: '/desktop/login',
  element: <DesktopLogin />,
},
{
  path: '/desktop',
  element: <DesktopLayout />,
  children: [
    { index: true, element: <Placeholder name="我的 Skill" hint="桌面端我的 Skill 页面" /> },
    { path: 'plaza', element: <Placeholder name="Skills 广场" hint="桌面端广场页面" /> },
    { path: 'recommendations', element: <Placeholder name="团队推荐" hint="桌面端团队推荐页面" /> },
    { path: 'settings', element: <Placeholder name="设置" hint="桌面端安装目标设置" /> },
  ],
},
```

- [ ] **Step 4: Typecheck frontend**

Run:

```bash
cd frontend && npm run lint
```

Expected: TypeScript succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/desktop/DesktopLogin.tsx frontend/src/pages/desktop/DesktopLayout.tsx frontend/src/router.tsx
git commit -m "新增桌面端登录和布局"
```

---

## Task 7: My Skill Page

**Files:**
- Create: `frontend/src/pages/desktop/MySkillsPage.tsx`
- Modify: `frontend/src/router.tsx`

- [ ] **Step 1: Add My Skill page**

Create `frontend/src/pages/desktop/MySkillsPage.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userSkillApi } from '@/api/endpoints';
import { Button } from '@/components/ui';
import { buildDesktopSkillViews } from './status';
import { readLocalInstalls, removeLocalInstall, upsertLocalInstall } from './localInstallStore';
import type { DesktopSkillView, LocalInstallEntry } from './types';

export default function MySkillsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'updates' | 'notInstalled'>('all');
  const [localVersion, setLocalVersion] = useState(0);
  const mine = useQuery({ queryKey: ['desktop-user-skills'], queryFn: userSkillApi.mine });
  const locals = useMemo(() => readLocalInstalls(), [localVersion]);
  const views = useMemo(() => buildDesktopSkillViews(mine.data || [], locals), [mine.data, locals]);

  const removeCloud = useMutation({
    mutationFn: userSkillApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['desktop-user-skills'] }),
  });

  const filtered = views.filter((view) => {
    if (filter === 'updates') return view.actions.includes('update');
    if (filter === 'notInstalled') return view.actions.includes('install');
    return true;
  });

  function install(view: DesktopSkillView) {
    const cloud = view.cloud;
    if (!cloud) return;
    const now = new Date().toISOString();
    const entry: LocalInstallEntry = {
      userSkillId: cloud.id,
      type: cloud.type,
      skillId: cloud.skillId,
      slug: cloud.slug,
      name: cloud.name,
      version: cloud.type === 'SUBSCRIBED' ? cloud.publicVersion || cloud.version : cloud.version,
      agent: 'CLAUDE',
      installPath: `~/.claude/skills/${cloud.slug}`,
      installedAt: now,
      updatedAt: now,
    };
    upsertLocalInstall(entry);
    setLocalVersion((value) => value + 1);
  }

  async function deleteSkill(view: DesktopSkillView) {
    if (!view.cloud) return;
    await removeCloud.mutateAsync(view.cloud.id);
    removeLocalInstall(view.cloud.id);
    setLocalVersion((value) => value + 1);
  }

  function uninstall(view: DesktopSkillView) {
    const id = view.cloud?.id || view.local?.userSkillId;
    if (!id) return;
    removeLocalInstall(id);
    setLocalVersion((value) => value + 1);
  }

  const personal = filtered.filter((view) => (view.cloud?.type || view.local?.type) === 'PERSONAL');
  const subscribed = filtered.filter((view) => (view.cloud?.type || view.local?.type) === 'SUBSCRIBED');

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>我的 Skill</h1>
          <p style={{ margin: '5px 0 0', color: '#6b7280', fontSize: 13 }}>订阅来自广场和团队推荐；个人包含本地导入和我发布的 Skill</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="button" variant="secondary">本地导入</Button>
          <Button type="button" variant="primary">一键更新/安装</Button>
        </div>
      </header>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>全部 {views.length}</FilterButton>
        <FilterButton active={filter === 'updates'} onClick={() => setFilter('updates')}>可更新 {views.filter((v) => v.actions.includes('update')).length}</FilterButton>
        <FilterButton active={filter === 'notInstalled'} onClick={() => setFilter('notInstalled')}>未安装 {views.filter((v) => v.actions.includes('install')).length}</FilterButton>
      </div>

      {mine.isLoading ? <div>加载中...</div> : (
        <>
          <Group title="个人" items={personal} onInstall={install} onUpdate={install} onDelete={deleteSkill} onUninstall={uninstall} />
          <Group title="订阅" items={subscribed} onInstall={install} onUpdate={install} onDelete={deleteSkill} onUninstall={uninstall} />
        </>
      )}
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{ padding: '7px 10px', border: `1px solid ${active ? '#111827' : '#e5e7eb'}`, borderRadius: 999, background: '#fff', fontWeight: active ? 650 : 500 }}>
      {children}
    </button>
  );
}

function Group(props: {
  title: string;
  items: DesktopSkillView[];
  onInstall: (view: DesktopSkillView) => void;
  onUpdate: (view: DesktopSkillView) => void;
  onDelete: (view: DesktopSkillView) => void;
  onUninstall: (view: DesktopSkillView) => void;
}) {
  return (
    <section style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, borderBottom: '1px solid #e5e7eb', paddingBottom: 8 }}>
        <div style={{ fontSize: 17, fontWeight: 800 }}>{props.title}</div>
        <span style={{ background: '#f1f2f4', color: '#6b7280', borderRadius: 999, padding: '4px 9px', fontSize: 13 }}>{props.items.length}</span>
      </div>
      <div style={{ display: 'grid', gap: 9 }}>
        {props.items.map((view) => (
          <SkillRow
            key={`${view.cloud?.id || 'local'}-${view.local?.userSkillId || 'cloud'}`}
            view={view}
            onInstall={props.onInstall}
            onUpdate={props.onUpdate}
            onDelete={props.onDelete}
            onUninstall={props.onUninstall}
          />
        ))}
      </div>
    </section>
  );
}

function SkillRow(props: {
  view: DesktopSkillView;
  onInstall: (view: DesktopSkillView) => void;
  onUpdate: (view: DesktopSkillView) => void;
  onDelete: (view: DesktopSkillView) => void;
  onUninstall: (view: DesktopSkillView) => void;
}) {
  const view = props.view;
  const label = view.cloud?.name || view.local?.name || view.cloud?.slug || view.local?.slug || 'Skill';
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 13px', background: view.statusLabel === '仅本地' || view.statusLabel === '已下架' ? '#fafafa' : '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 750, display: 'flex', alignItems: 'center', gap: 8 }}>
            {label}
            <span style={{ fontSize: 12, color: statusColor(view.statusLabel), background: statusBg(view.statusLabel), padding: '4px 8px', borderRadius: 999 }}>{view.statusLabel}</span>
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>{view.description}</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {view.actions.includes('view') && <button title="查看" type="button">👁</button>}
          {view.actions.includes('install') && <button title="安装" type="button" onClick={() => props.onInstall(view)}>↓</button>}
          {view.actions.includes('update') && <button title="更新" type="button" onClick={() => props.onUpdate(view)}>↻</button>}
          {view.actions.includes('delete') && <button title="删除云端数据，并卸载本地技能" type="button" onClick={() => void props.onDelete(view)}>🗑</button>}
          {view.actions.includes('uninstall') && <button title="卸载本地技能，不影响云端数据" type="button" onClick={() => props.onUninstall(view)}>⌧</button>}
        </div>
      </div>
    </div>
  );
}

function statusColor(label: string) {
  if (label === '最新') return '#047857';
  if (label === '可更新') return '#b45309';
  if (label === '未安装') return '#2563eb';
  if (label === '已下架') return '#991b1b';
  return '#4b5563';
}

function statusBg(label: string) {
  if (label === '最新') return '#d1fae5';
  if (label === '可更新') return '#fef3c7';
  if (label === '未安装') return '#dbeafe';
  if (label === '已下架') return '#fee2e2';
  return '#f3f4f6';
}
```

- [ ] **Step 2: Wire route**

Modify `/desktop` index route in `frontend/src/router.tsx`:

```tsx
import MySkillsPage from '@/pages/desktop/MySkillsPage';
```

Replace the `/desktop` index placeholder:

```tsx
{ index: true, element: <MySkillsPage /> },
```

- [ ] **Step 3: Typecheck frontend**

Run:

```bash
cd frontend && npm run lint
```

Expected: TypeScript succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/desktop/MySkillsPage.tsx frontend/src/router.tsx
git commit -m "实现桌面端我的Skill页面"
```

---

## Task 8: Plaza And Recommendations Pages

**Files:**
- Create: `frontend/src/pages/desktop/PlazaPage.tsx`
- Create: `frontend/src/pages/desktop/RecommendationsPage.tsx`
- Create: `frontend/src/pages/desktop/DesktopSettingsPage.tsx`
- Modify: `frontend/src/router.tsx`

- [ ] **Step 1: Add Plaza page**

Create `frontend/src/pages/desktop/PlazaPage.tsx`:

```tsx
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { skillApi, userSkillApi } from '@/api/endpoints';
import { Button } from '@/components/ui';

export default function PlazaPage() {
  const qc = useQueryClient();
  const skills = useQuery({ queryKey: ['desktop-plaza'], queryFn: () => skillApi.plaza({ page: 1, size: 12 }) });
  const mine = useQuery({ queryKey: ['desktop-user-skills'], queryFn: userSkillApi.mine });
  const subscribe = useMutation({
    mutationFn: userSkillApi.subscribe,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['desktop-user-skills'] }),
  });
  const added = new Set((mine.data || []).filter((item) => item.type === 'SUBSCRIBED').map((item) => item.skillId));
  const items = skills.data?.items || [];

  return (
    <div>
      <h1 style={{ margin: 0, fontSize: 24 }}>Skills 广场</h1>
      <p style={{ margin: '5px 0 18px', color: '#6b7280', fontSize: 13 }}>发现公开 Skill，添加后会进入我的 Skill，可选择后续安装。</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 12 }}>
        {items.map((skill: any) => (
          <section key={skill.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff', padding: 15 }}>
            <div style={{ fontWeight: 800 }}>{skill.name}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>v{skill.version} · {skill.installs ?? 0} 安装</div>
            <div style={{ fontSize: 13, color: '#4b5563', minHeight: 42, marginTop: 14 }}>{skill.shortDesc}</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <Button type="button" variant="secondary">查看</Button>
              {added.has(Number(skill.id)) ? (
                <Button type="button" variant="secondary" disabled>已在我的 Skill</Button>
              ) : (
                <Button type="button" variant="primary" onClick={() => subscribe.mutate(Number(skill.id))}>添加</Button>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add Recommendations page**

Create `frontend/src/pages/desktop/RecommendationsPage.tsx`:

```tsx
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { skillApi, userSkillApi } from '@/api/endpoints';
import { Button } from '@/components/ui';

export default function RecommendationsPage() {
  const qc = useQueryClient();
  const skills = useQuery({ queryKey: ['desktop-recommendations'], queryFn: () => skillApi.plaza({ page: 1, size: 3 }) });
  const mine = useQuery({ queryKey: ['desktop-user-skills'], queryFn: userSkillApi.mine });
  const subscribe = useMutation({
    mutationFn: userSkillApi.subscribe,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['desktop-user-skills'] }),
  });
  const recommended = skills.data?.items || [];
  const added = new Set((mine.data || []).filter((item) => item.type === 'SUBSCRIBED').map((item) => item.skillId));
  const count = mine.data?.length || 0;
  return (
    <div>
      <h1 style={{ margin: 0, fontSize: 24 }}>团队推荐</h1>
      <p style={{ margin: '5px 0 18px', color: '#6b7280', fontSize: 13 }}>团队维护的推荐清单，适合新设备初始化或统一工作流。</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 12, marginBottom: 18 }}>
        <section style={cardStyle}><div style={labelStyle}>推荐总数</div><div style={numStyle}>{recommended.length}</div></section>
        <section style={cardStyle}><div style={labelStyle}>未添加</div><div style={numStyle}>{recommended.filter((item) => !added.has(item.skillId)).length}</div></section>
        <section style={cardStyle}><div style={labelStyle}>我的 Skill</div><div style={numStyle}>{count}</div></section>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {recommended.map((item: any) => (
          <section key={item.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff', padding: 16, display: 'flex', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontWeight: 800 }}>{item.name}</div>
              <div style={{ marginTop: 5, color: '#6b7280', fontSize: 13 }}>{item.shortDesc || item.short}</div>
            </div>
            <Button
              type="button"
              variant={added.has(Number(item.id)) ? 'secondary' : 'primary'}
              disabled={added.has(Number(item.id))}
              onClick={() => subscribe.mutate(Number(item.id))}
            >
              {added.has(Number(item.id)) ? '已添加' : '添加'}
            </Button>
          </section>
        ))}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = { border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff', padding: 16 };
const labelStyle: React.CSSProperties = { fontSize: 13, color: '#6b7280' };
const numStyle: React.CSSProperties = { fontSize: 26, fontWeight: 850, marginTop: 4 };
```

- [ ] **Step 3: Add Settings page**

Create `frontend/src/pages/desktop/DesktopSettingsPage.tsx`:

```tsx
export default function DesktopSettingsPage() {
  return (
    <div>
      <h1 style={{ margin: 0, fontSize: 24 }}>设置</h1>
      <p style={{ margin: '5px 0 18px', color: '#6b7280', fontSize: 13 }}>安装目标和 Agent 路径。</p>
      <section style={{ borderRadius: 18, background: '#f7f7f8', padding: '20px 22px', marginBottom: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 17 }}>当前设备</div>
        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>MacBook Pro · 本地配置</div>
      </section>
      <section style={{ borderRadius: 18, background: '#f7f7f8', padding: '20px 22px', marginBottom: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 14 }}>默认安装目标</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button">Claude</button>
          <button type="button">Codex</button>
          <button type="button">OpenClaw</button>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Wire routes**

Modify `frontend/src/router.tsx` imports:

```tsx
import PlazaPage from '@/pages/desktop/PlazaPage';
import RecommendationsPage from '@/pages/desktop/RecommendationsPage';
import DesktopSettingsPage from '@/pages/desktop/DesktopSettingsPage';
```

Replace the `/desktop` child routes:

```tsx
{ path: 'plaza', element: <PlazaPage /> },
{ path: 'recommendations', element: <RecommendationsPage /> },
{ path: 'settings', element: <DesktopSettingsPage /> },
```

- [ ] **Step 5: Typecheck frontend**

Run:

```bash
cd frontend && npm run lint
```

Expected: TypeScript succeeds.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/desktop/PlazaPage.tsx \
        frontend/src/pages/desktop/RecommendationsPage.tsx \
        frontend/src/pages/desktop/DesktopSettingsPage.tsx \
        frontend/src/router.tsx
git commit -m "实现桌面端广场和推荐页面"
```

---

## Task 9: End-To-End Verification And Polish

**Files:**
- Modify only files touched by earlier tasks if verification exposes defects.

- [ ] **Step 1: Run backend verification**

Run:

```bash
cd backend && mvn test
```

Expected: build succeeds. If no backend tests exist, Maven still compiles test phase and reports build success.

- [ ] **Step 2: Run frontend status tests**

Run:

```bash
cd frontend && npm run test -- src/pages/desktop/status.test.ts --run
```

Expected: 8 desktop status tests pass.

- [ ] **Step 3: Run frontend typecheck**

Run:

```bash
cd frontend && npm run lint
```

Expected: TypeScript succeeds.

- [ ] **Step 4: Start app services**

Run:

```bash
./scripts/services.sh start
```

Expected:

```text
App services started successfully
Backend API: http://localhost:8080
Frontend: http://localhost:5173
```

- [ ] **Step 5: Manual smoke**

Open:

```text
http://localhost:5173/desktop
```

Expected:

- If logged out, user is redirected to `/desktop/login`.
- Clicking `通过浏览器登录` opens Web authorization.
- After login, `/desktop` shows My Skill page.
- `/desktop/plaza` shows plaza cards.
- `/desktop/settings` shows install target settings.

- [ ] **Step 6: Stop services if they were started by this task**

Run:

```bash
./scripts/services.sh stop
```

Expected: backend and frontend are stopped.

- [ ] **Step 7: Commit verification fixes**

If verification required fixes:

```bash
git add <fixed-files>
git commit -m "修复桌面端联调问题"
```

If no fixes were needed, do not create an empty commit.

---

## Self-Review

Spec coverage:

- Browser login is covered in Task 6.
- `user_skills` table and API are covered in Tasks 1-3.
- Local install state is covered in Task 4.
- 8 My Skill states are covered in Task 5 tests and Task 7 UI.
- My Skill / Plaza / Recommendations / Settings pages are covered in Tasks 6-8.
- Delete/uninstall semantics are covered in Task 7.

Known intentional phase-1 limits:

- This plan does not package Electron/Tauri. It implements the desktop client experience under `/desktop` first.
- Team recommendations use a phase-1 static list with real add-to-mine interactions; suite-backed recommendation data binding is the next implementation slice.
- Real file-system installation from the browser is simulated through local install records. Desktop shell file-system writes must be implemented when packaging the real client.
