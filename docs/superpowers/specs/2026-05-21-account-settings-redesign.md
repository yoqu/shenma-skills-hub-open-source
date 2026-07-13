# Account Settings 重构设计文档

**日期：** 2026-05-21  
**状态：** 待实现  
**范围：** 账号设置页面完整重构，含头像上传、布局重构、后端存储抽象

---

## 1. 背景与目标

当前 `/profile` 页面是一个平铺的两栏表单，将基础资料、密码修改、手机号修改混合在一起。目标：

- 重构为左侧菜单 + 中间内容区的 Settings 布局（GitHub/Linear 风格）
- 新增头像图片上传功能，取代纯字符 avatar
- 密码修改和手机号修改迁移到「安全设置」Tab
- 基础资料表单增加前端验证
- 后端新增文件上传接口，存储层通过接口抽象支持未来切换对象存储

---

## 2. 路由结构

```
/profile              → redirect 到 /profile/basic
/profile/basic        → 基础资料（头像上传 + 姓名 + 邮箱）
/profile/security     → 安全设置（修改密码 + 修改手机号）
/profile/notifications → 通知偏好（占位页）
/profile/tokens       → API Token（占位页）
```

原 `/profile` 路由替换为嵌套路由，共享 `SettingsLayout`。

---

## 3. 前端架构

### 3.1 文件结构

```
frontend/src/
├── pages/account/
│   └── settings/
│       ├── SettingsLayout.tsx       ← 侧边栏 + <Outlet />
│       ├── BasicProfile.tsx         ← 基础资料表单
│       ├── Security.tsx             ← 安全设置（密码 + 手机）
│       ├── Notifications.tsx        ← 占位页
│       └── Tokens.tsx               ← 占位页
└── components/ui/
    └── AvatarUpload.tsx             ← 新增：头像上传组件
```

原 `pages/account/Profile.tsx` 删除。

### 3.2 SettingsLayout

- TopBar + 下方两列布局
- 左侧侧边栏：固定 220px，使用 `NavLink` 实现激活态高亮
- 侧边栏项目：

  | 图标 | 标签 | 路由 | 状态 |
  |------|------|------|------|
  | User | 基础资料 | /profile/basic | 功能完整 |
  | Shield | 安全设置 | /profile/security | 功能完整 |
  | Bell | 通知偏好 | /profile/notifications | 占位 |
  | Key | API Token | /profile/tokens | 占位 |

- 右侧内容区：`max-width: 680px`，内边距 32px，承载 `<Outlet />`
- 整体背景：`TOKENS.bgAlt`，侧边栏背景：白色，右边框 `TOKENS.border`

### 3.3 BasicProfile 表单

**字段与验证规则：**

| 字段 | 必填 | 验证规则 | 错误提示 |
|------|------|----------|----------|
| 显示名 | 是 | 1–64 字符，不能为空 | 「显示名不能为空」/ 「最多 64 个字符」 |
| 邮箱 | 否 | 若填写，须符合 email 格式 | 「请输入有效的邮箱地址」 |
| 头像字符 | 否 | 最多 8 个字符，作为无图时的 fallback | — |

**验证时机：** blur 时验证单字段，submit 时全量验证。

**头像区域：** 由 `AvatarUpload` 组件承担，独立于表单 submit，见 3.4。

**提交：** `PUT /api/me/profile`，body `{ name, email?, avatar? }`

**状态反馈：** 成功/失败用带左边框的 status bar（已有实现，保留）。

### 3.4 AvatarUpload 组件

```
props:
  currentUrl?: string        ← avatarUrl（来自 /me）
  currentChar?: string       ← avatar char（fallback）
  name: string               ← 用于 char avatar 显示
  onSuccess: (url: string) → void
```

**交互流程：**
1. 默认显示当前头像（`currentUrl` 存在则显示 `<img>`，否则显示字符 Avatar）
2. 点击头像区域 → 触发隐藏的 `<input type="file" accept="image/*">`
3. 文件选中后前端校验：
   - 类型：`image/jpeg | image/png | image/gif | image/webp`
   - 大小：≤ 2MB
   - 不符合时直接提示，不发请求
4. 校验通过 → 立即 `POST /api/me/avatar`（multipart/form-data）
5. 上传中：头像区域显示 loading overlay
6. 成功：更新预览图，调用 `onSuccess(url)`，刷新 session（invalidate `['session', 'profile']`）
7. 失败：显示错误提示文字

**视觉：**
- 头像尺寸：80×80，圆形
- hover 时显示半透明遮罩 + 「更换」文字
- 无 crop，直接原图上传

### 3.5 Security 页

两个独立 Card，垂直排列，间距 20px：

1. **修改密码** Card
   - 字段：当前密码、新密码（≥6位）、确认新密码（与新密码一致）
   - `PUT /api/me/password`

2. **修改手机号** Card
   - 字段：当前密码、新手机号（中国大陆格式）、验证码（6位数字）
   - `PUT /api/me/phone`

验证规则与当前实现一致，仅迁移至新页面。

### 3.6 Notifications / Tokens 占位页

```tsx
// 统一占位内容
<Card>
  <div>该功能正在建设中，敬请期待</div>
</Card>
```

### 3.7 API 层变更

在 `endpoints.ts` 的 `accountApi` 中新增：

```typescript
uploadAvatar: (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return http.post<unknown, { avatarUrl: string }>('/me/avatar', form);
}
```

`http` 客户端发送 `multipart/form-data` 时不设置 `Content-Type`（让浏览器自动附带 boundary）。

---

## 4. 后端架构

### 4.1 存储抽象层

新增包 `com.skillstack.common.storage`：

```
common/storage/
├── StorageService.java          ← 接口
├── LocalStorageService.java     ← 本地磁盘实现
└── StorageProperties.java       ← 配置属性类
```

**StorageService 接口：**

```java
public interface StorageService {
    /**
     * 存储文件。
     * @param file   上传的文件
     * @param prefix 存储路径前缀，如 "avatars/123"
     * @return 存储 key（相对路径），如 "avatars/123/uuid.jpg"
     */
    String store(MultipartFile file, String prefix) throws IOException;

    /**
     * 删除文件。key 不存在时静默忽略。
     */
    void delete(String key);

    /**
     * 将存储 key 转为可访问的 URL。
     */
    String resolveUrl(String key);
}
```

**LocalStorageService 实现：**

- 文件写入 `${skillstack.storage.local.base-dir}/{key}`，key = `{prefix}/{uuid}.{ext}`
- `resolveUrl(key)` 返回 `${skillstack.storage.local.base-url}/{key}`
- `delete(key)` 删除本地文件，不存在时静默
- 用 `@ConditionalOnProperty(name = "skillstack.storage.type", havingValue = "local", matchIfMissing = true)` 注册

**StorageProperties 配置：**

```yaml
# application.yml 新增
skillstack:
  storage:
    type: local                          # local | minio（未来扩展）
    local:
      base-dir: ${user.home}/skillstack-uploads
      base-url: /uploads
```

**静态资源映射：** 在 `WebMvcConfigurer` 中添加：

```java
registry.addResourceHandler("/uploads/**")
        .addResourceLocations("file:" + basDir + "/");
```

SecurityConfig 中放行 `/uploads/**`（无需认证）。

### 4.2 数据库迁移

新建 `V7__add_avatar_url.sql`：

```sql
ALTER TABLE users
    ADD COLUMN avatar_url VARCHAR(512) NULL COMMENT '头像图片路径（存储 key）' AFTER avatar;
```

> 注：`avatar_url` 存储 key（相对路径），不存 URL，由 `StorageService.resolveUrl()` 转换。这样切换存储后端时不需要更新数据库数据。

### 4.3 实体与 DTO 变更

**User 实体** 新增字段：

```java
private String avatarUrl;   // 头像存储 key
```

**MeRes DTO** 新增字段：

```java
private String avatarUrl;   // resolveUrl 后的完整可访问 URL
```

`UserService.buildMeRes()` 中填充时需判空：`user.getAvatarUrl() != null ? storageService.resolveUrl(user.getAvatarUrl()) : null`。

**UpdateMeProfileReq** 不变（不处理头像，头像由独立接口处理）。

### 4.4 新增接口

`UserController` 新增：

```
POST /api/me/avatar
Content-Type: multipart/form-data
Auth: 必须登录
Body: file (MultipartFile)
Response: { avatarUrl: string }  ← 可访问的完整 URL
```

**处理逻辑（UserService.uploadAvatar）：**

1. 校验：文件非空，Content-Type 为 `image/*`，大小 ≤ 2MB
2. 如果用户已有 `avatarUrl`（旧 key），调用 `storageService.delete(oldKey)` 删除旧文件
3. 调用 `storageService.store(file, "avatars/" + userId)` 获取新 key
4. 更新 `users.avatar_url = newKey`
5. 返回 `storageService.resolveUrl(newKey)`

**错误响应：**

| 场景 | HTTP | code | message |
|------|------|------|---------|
| 文件为空 | 400 | 40001 | 请选择要上传的图片 |
| 非图片类型 | 400 | 40002 | 仅支持 JPG / PNG / GIF / WebP |
| 超过 2MB | 400 | 40003 | 图片大小不能超过 2MB |

---

## 5. Avatar 显示优先级

全站所有用到 avatar 显示的地方均遵守：

```
avatarUrl（图片）> avatar（字符）> name 首字母 > 默认占位
```

本次仅修改 `BasicProfile` 页的头像展示。TopBar、`UserProfile` 公开页等其他位置留存当前逻辑，后续统一更新 `Avatar` 组件。

---

## 6. 路由变更

**router.tsx 改动：**

```
删除：{ path: '/profile', element: <Profile /> }

新增：
{
  path: '/profile',
  element: <SettingsLayout />,
  children: [
    { index: true, element: <Navigate to="basic" replace /> },
    { path: 'basic', element: <BasicProfile /> },
    { path: 'security', element: <Security /> },
    { path: 'notifications', element: <Notifications /> },
    { path: 'tokens', element: <Tokens /> },
  ]
}
```

---

## 7. 不在本次范围内

- TopBar / UserProfile 公开页的头像显示更新（avatarUrl 优先级）
- 头像裁剪（crop）功能
- MinIO / S3 存储实现
- 通知偏好、API Token 功能实现
- bio 字段（DB 中尚不存在，待独立需求）
- 图片 CDN / resize

---

## 8. 实现检查清单

### 后端
- [ ] `V7__add_avatar_url.sql` 迁移文件
- [ ] `StorageService` 接口
- [ ] `LocalStorageService` 实现
- [ ] `StorageProperties` 配置类 + `application.yml` 新增配置
- [ ] `WebMvcConfigurer` 静态资源映射
- [ ] `SecurityConfig` 放行 `/uploads/**`
- [ ] `User` 实体新增 `avatarUrl`
- [ ] `MeRes` DTO 新增 `avatarUrl`
- [ ] `UserService.uploadAvatar()` 方法
- [ ] `UserController` 新增 `POST /api/me/avatar`

### 前端
- [ ] `AvatarUpload.tsx` 组件
- [ ] `SettingsLayout.tsx`（侧边栏 + Outlet）
- [ ] `BasicProfile.tsx`（表单 + 验证 + 头像上传）
- [ ] `Security.tsx`（密码 + 手机）
- [ ] `Notifications.tsx`（占位）
- [ ] `Tokens.tsx`（占位）
- [ ] `endpoints.ts` 新增 `accountApi.uploadAvatar`
- [ ] `router.tsx` 路由变更
- [ ] 删除旧 `Profile.tsx`
