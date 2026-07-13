# Unified Notification Center 设计

- 日期：2026-05-22
- 状态：已确认，待实现
- 影响范围：backend（notification / review / suite / team / invite 模块）+ frontend（TopBar / team notifications / team prefs）+ 数据库 migration

## 1. 背景与问题

当前站内通知能力没有形成闭环：

1. 后端只有 `notification_pref` 偏好表和 `/api/teams/{teamId}/me/notification-prefs` 读写接口。
2. 没有通知事件表、收件箱 API、未读计数、已读状态和统一通知中心。
3. 前端右上角铃铛点击后直接进入 `/team/reviews`，把“审核队列”误当成“通知中心”。
4. 设置页的通知偏好已经出现“站内通知 / 邮件通知”概念，但没有和真实业务事件投递打通。

用户诉求：站内消息应是全平台统一架构，所有消息汇集到同一个地方；右上角通知图标不应只代表审核队列；设置界面的通知偏好应和所有通知卡点集成。

## 2. 设计目标

1. 新增统一通知收件箱，承载审核、评论、邀请、套件、团队成员变更等平台内消息。
2. 右上角铃铛进入统一通知中心，并展示真实未读数。
3. 通知偏好从静态配置变为实际投递规则，关闭某类 `inapp` 后不再写入站内通知。
4. 保留 `email` 偏好配置，但本阶段不做真实邮件投递。
5. 通知写入与业务动作保持同事务或同服务调用路径，避免“业务成功但通知丢失”造成体验断层。

## 3. 非目标

- 不实现邮件发送器、邮件模板、SMTP 或第三方邮件服务接入。
- 不实现 WebSocket / SSE 实时推送；未读数通过 React Query 轮询、失焦后刷新或页面动作 invalidate 更新。
- 不做复杂消息聚合，例如“10 人评论了同一审核”的合并摘要。
- 不做系统公告后台。
- 不把通知中心替代权限校验；目标页面和目标 API 仍必须做自己的权限判断。

## 4. 数据模型

### 4.1 新增 `notifications` 表

```sql
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

字段语义：

| 字段 | 说明 |
|---|---|
| `user_id` | 接收人，只能由本人读取 |
| `team_id` | 团队上下文；全局个人消息可为空 |
| `type` | 具体通知类型，例如 `REVIEW_APPROVED` |
| `category` | UI 分组：`review` / `invite` / `suite` / `team` / `system` |
| `title` / `body` | 列表展示文案 |
| `target_url` | 点击跳转地址 |
| `actor_id` | 触发人，系统通知可为空 |
| `source_type` / `source_id` | 源对象，便于测试、排查和后续去重 |
| `read_at` | 为空表示未读 |

### 4.2 通知类型

第一阶段实现以下类型：

| type | category | 接收人 | target_url |
|---|---|---|---|
| `REVIEW_SUBMITTED` | `review` | 当前团队 `OWNER` / `ADMIN`，排除提交者本人 | `/team/reviews` |
| `REVIEW_RESUBMITTED` | `review` | 当前团队 `OWNER` / `ADMIN`，排除提交者本人 | `/team/reviews` |
| `REVIEW_APPROVED` | `review` | review 提交者 | `/team/mine` |
| `REVIEW_REJECTED` | `review` | review 提交者 | `/team/mine` |
| `REVIEW_CHANGES_REQUESTED` | `review` | review 提交者 | `/team/mine` |
| `REVIEW_COMMENT` | `review` | 审核评论对话另一侧：审核人评论给提交者；提交者评论给团队 `OWNER` / `ADMIN` | `/team/mine` 或 `/team/reviews` |
| `PHONE_INVITE` | `invite` | 被邀请手机号对应的已注册用户 | `/team` |
| `SUITE_PUBLISHED` | `suite` | 当前团队成员，排除操作者本人 | `/team/suites` |
| `SUITE_UPDATED` | `suite` | 当前团队成员，排除操作者本人 | `/team/suites` |
| `TEAM_ROLE_CHANGED` | `team` | 被调整角色的成员 | `/team` |
| `TEAM_JOINED` | `team` | 新加入的成员 | `/team` |
| `TEAM_REMOVED` | `team` | 被移除的成员 | `/` |

## 5. 通知偏好

### 5.1 偏好 key

扩展现有 `NotificationPrefService` key：

| pref key | 控制的 type | 默认 inapp | 默认 email |
|---|---|---:|---:|
| `review_submitted` | `REVIEW_SUBMITTED`, `REVIEW_RESUBMITTED` | 开 | 关 |
| `review_result` | `REVIEW_APPROVED`, `REVIEW_REJECTED`, `REVIEW_CHANGES_REQUESTED` | 开 | 开 |
| `review_comment` | `REVIEW_COMMENT` | 开 | 关 |
| `phone_invite` | `PHONE_INVITE` | 开 | 开 |
| `suite_published` | `SUITE_PUBLISHED`, `SUITE_UPDATED` | 关 | 关 |
| `team_member_change` | `TEAM_ROLE_CHANGED`, `TEAM_JOINED`, `TEAM_REMOVED` | 开 | 关 |
| `weekly_digest` | 周报偏好预留 | 开 | 关 |

### 5.2 投递规则

`NotificationService.notify(...)` 写入通知前必须检查：

1. 接收人不为空。
2. 接收人不是被排除的操作者。
3. 若有 `team_id`，接收人仍是该团队成员；`TEAM_REMOVED` 可例外，因为接收人刚被移除。
4. 对应 `pref key + inapp` 为开启。

`email` 本阶段只保存偏好，不触发发送。

## 6. 后端架构

### 6.1 文件结构

```text
backend/src/main/java/com/skillstack/notification/
├── controller/
│   ├── NotificationController.java
│   └── NotificationPrefController.java
├── dto/
│   ├── NotificationItem.java
│   ├── NotificationUnreadCountRes.java
│   ├── NotificationQuery.java
│   ├── NotificationPrefRes.java
│   └── UpdateNotificationPrefsReq.java
├── entity/
│   ├── Notification.java
│   └── NotificationPref.java
├── mapper/
│   ├── NotificationMapper.java
│   └── NotificationPrefMapper.java
└── service/
    ├── NotificationService.java
    └── NotificationPrefService.java
```

### 6.2 API

```text
GET  /api/me/notifications?teamId=&status=unread|all&page=&size=
GET  /api/me/notifications/unread-count?teamId=
POST /api/me/notifications/{id}/read
POST /api/me/notifications/read-all?teamId=
```

响应结构遵循现有 `ApiResponse<T>` envelope。

`GET /api/me/notifications` 返回 `PageResult<NotificationItem>`：

```json
{
  "items": [
    {
      "id": 1,
      "type": "REVIEW_APPROVED",
      "category": "review",
      "title": "你的 Skill 审核已通过",
      "body": "skill-name v1.0.0 已发布到团队 Skill 库",
      "teamId": 1,
      "teamName": "麓豆前端组",
      "actorName": "管理员",
      "targetUrl": "/team/mine",
      "read": false,
      "createdAt": "2026-05-22T14:20:00"
    }
  ],
  "total": 1,
  "page": 1,
  "size": 20
}
```

### 6.3 权限

- 所有通知 API 必须登录。
- 用户只能读取、标记自己的通知。
- `teamId` 过滤时，必须是该团队成员。
- `read-all?teamId=` 只标记本人且匹配 team 的通知。
- `read-all` 不传 `teamId` 时标记本人所有通知。

### 6.4 业务接入点

| 模块 | 方法 | 通知动作 |
|---|---|---|
| `SkillService.createReviewFirst` | 创建非草稿 review | 通知团队审核人 `REVIEW_SUBMITTED` |
| `ReviewService.submitDraft` | 草稿提交 | 通知团队审核人 `REVIEW_SUBMITTED` |
| `ReviewService.resubmit` | 重新提交 | 通知团队审核人 `REVIEW_RESUBMITTED` |
| `ReviewService.approve` | 审核通过 | 通知提交者 `REVIEW_APPROVED` |
| `ReviewService.reject` | 审核驳回 | 通知提交者 `REVIEW_REJECTED` |
| `ReviewService.requestChanges` | 请求修改 | 通知提交者 `REVIEW_CHANGES_REQUESTED` |
| `ReviewCommentService.create` | 新评论 | 通知对话另一侧 `REVIEW_COMMENT` |
| `InviteService.createPhoneInvite` | 手机号邀请 | 若手机号已有用户，通知该用户 `PHONE_INVITE` |
| `SuiteService.create` | 新套件 | 通知团队成员 `SUITE_PUBLISHED` |
| `SuiteService.updateItems` | 更新套件内容 | 通知团队成员 `SUITE_UPDATED` |
| `TeamMemberService.updateMember` | 修改角色 | 通知被修改成员 `TEAM_ROLE_CHANGED` |
| `InviteService.acceptPhoneInvite` / `joinByCode` | 加入团队 | 通知加入者 `TEAM_JOINED` |
| `TeamMemberService.removeMember` | 移除成员 | 通知被移除成员 `TEAM_REMOVED` |

## 7. 前端架构

### 7.1 API 层

在 `frontend/src/api/endpoints.ts` 新增：

```ts
export const notificationApi = {
  list: (q: { teamId?: number; status?: 'unread' | 'all'; page?: number; size?: number }) =>
    http.get<unknown, PageRes<NotificationItem>>('/me/notifications', { params: q }),
  unreadCount: (teamId?: number) =>
    http.get<unknown, { unread: number }>('/me/notifications/unread-count', { params: teamId ? { teamId } : {} }),
  markRead: (id: number) => http.post<unknown, void>(`/me/notifications/${id}/read`, {}),
  markAllRead: (teamId?: number) =>
    http.post<unknown, void>('/me/notifications/read-all', {}, { params: teamId ? { teamId } : {} }),
};
```

### 7.2 路由

新增团队工作区路由：

```text
/team/notifications
```

该路由使用 `RequireTeam` 包裹，普通成员和管理员都可访问。

### 7.3 通知中心页面

新增文件：

```text
frontend/src/pages/team/Notifications.tsx
```

页面结构：

- 顶部 `DashTopBar`：标题“通知中心”，说明“来自所有团队协作事件的站内消息”。
- Tabs：`全部` / `未读`。
- 团队过滤：当前团队 / 全部团队。
- 操作：`全部标记已读`。
- 列表项：类型图标、标题、正文、团队名、触发人、时间、未读标记、单条已读按钮。
- 点击列表项：先标记已读，再跳转 `targetUrl`；无 `targetUrl` 时只标记已读。
- 空态：全部为空显示“还没有通知”；未读为空显示“没有未读通知”。

### 7.4 TopBar 铃铛

改造 `frontend/src/components/chrome/TopBar.tsx`：

- 铃铛点击进入 `/team/notifications`。
- 使用 `notificationApi.unreadCount()` 获取全局未读数。
- 未读数大于 0 时显示角标，超过 99 显示 `99+`。
- 登录态才请求未读数。
- 标记已读后通过 query invalidation 刷新角标。

### 7.5 通知偏好卡片

改造 `frontend/src/components/notifications/NotificationPrefsCard.tsx`：

- 展示真实 `pref key`：
  - 新审核提交
  - 审核结果
  - 审核评论
  - 手机号邀请
  - 套件发布 / 更新
  - 团队成员变化
  - 每周摘要
- 站内通知文案改为“影响通知中心和右上角铃铛未读”。
- 邮件通知文案改为“保存邮件偏好；实际邮件投递将在邮件服务接入后启用”。
- 不再出现 `mention`，因为当前代码没有 @ 提及系统。

## 8. UI 细节

- 通知列表使用现有 `Card` / `Button` / `Badge` / `DashTopBar` / `Tabs` 风格。
- 卡片边框半径维持现有 8px 以内。
- 类型图标使用现有 `I.bell` / `I.check` / `I.x` / `I.send` / `I.users` / `I.package` 等图标；没有完全匹配时使用最接近语义的现有图标。
- 移动端窄屏下列表项纵向排布，操作按钮换行，不遮挡正文。
- 通知中心不使用营销式 hero，不增加装饰背景。

## 9. 测试策略

### 9.1 后端测试

新增或扩展测试：

| 测试 | 覆盖 |
|---|---|
| `NotificationServiceTest` | 默认偏好、关闭 inapp 后不写通知、排除 actor、未读计数、mark read、mark all read |
| `NotificationControllerTest` | 用户只能读取自己的通知；`teamId` 非成员过滤返回 403 |
| `ReviewServiceTest` | approve / reject / requestChanges 写入提交者通知 |
| `ReviewCommentServiceTest` | 评论通知对话另一侧 |
| `NotificationPrefServiceTest` | 新 key 默认值和非法 key 校验 |

### 9.2 前端验证

至少执行：

```bash
npm run build
```

浏览器 smoke：

1. 登录测试账号。
2. 点击右上角铃铛，确认进入 `/team/notifications`，不是 `/team/reviews`。
3. 触发一个审核结果通知后，通知中心展示未读消息。
4. 点击单条通知后未读数下降。
5. 在 `/team/prefs` 关闭某类站内通知，重复触发对应事件后不再出现新通知。

## 10. 验收标准

1. 右上角铃铛进入统一通知中心。
2. 铃铛未读角标来自 `/api/me/notifications/unread-count`。
3. `/team/notifications` 能展示全部和未读通知，并支持单条已读和全部已读。
4. 审核提交、审核结果、审核评论、手机号邀请、套件发布/更新、团队成员变化均可写入通知。
5. 通知偏好关闭对应 `inapp` 后，该类通知不再写入。
6. 设置页通知偏好只展示真实接入的通知类型，不再保留未实现的 `mention`。
7. 邮件偏好可保存，但 UI 不承诺已经发送真实邮件。
8. 后端权限保证用户不能读取或标记他人的通知。

## 11. 实施风险

1. 当前工作树已有 review-first 和团队设置相关改动；实现时必须基于现有修改继续，不回滚用户或其他任务改动。
2. `NotificationService` 会被多个领域服务依赖，构造器注入时要避免循环依赖；如出现循环，使用小型 domain event helper 或延迟注入解耦。
3. `TEAM_REMOVED` 通知需要允许给已不在团队中的用户写入和读取，不能复用严格的 `requireMember` 过滤。
4. 现有 `user_team_unread` 是团队切换器未读计数，不应继续扩展为通知中心；实现后可逐步改为由 notifications 聚合，但本阶段不强制迁移旧数据。
