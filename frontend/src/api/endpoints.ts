import { http } from './client';
import type {
  Skill,
  Team,
  MyTeam,
  TeamMember,
  Suite,
  Review,
  Invite,
  PhoneInvite,
  Activity,
} from '@/mocks';

// Backend always wraps result as { code, message, data } and client unwraps `data` already.

export interface PageRes<T> {
  items: T[];
  records?: T[];
  total: number;
  page: number;
  size: number;
}

export interface MyPhoneInvite {
  id: number;
  teamId: number;
  teamName: string;
  teamSlug: string;
  invitedBy: string;
  note: string;
  at: string;
}

export interface SkillReviewUserRef {
  id: number | null;
  name: string;
  handle: string | null;
  avatar: string;
  /** 头像图片 URL（上传 / 飞书 SSO）。无图时使用 `avatar` 字符占位。 */
  avatarUrl?: string | null;
  color: string;
  isAuthor: boolean;
}

export interface SkillReviewReplyRes {
  id: number;
  user: SkillReviewUserRef;
  date: string;
  body: string;
}

export interface SkillReviewItemRes {
  id: number;
  user: SkillReviewUserRef;
  rating: number;
  version: string;
  date: string;
  body: string;
  mine: boolean;
  replies: SkillReviewReplyRes[];
}

export interface SkillReviewSummaryRes {
  avg: number | string;
  total: number;
  distribution: Array<{ star: number; count: number }>;
  items: SkillReviewItemRes[];
  myReviewId: number | null;
}

export interface PromptCardRes {
  id: number;
  slug: string;
  teamSlug?: string;
  name: string;
  shortDesc?: string;
  cat?: string;
  /** 自定义上传图标完整 URL（无则前端回退到默认 code 图标） */
  iconUrl?: string | null;
  visibility: 'PUBLIC' | 'TEAM_PRIVATE';
  status: 'APPROVED' | 'UNLISTED';
  version: string;
  score?: number;
  stars?: number;
  exports?: number;
  updated?: string;
  tags?: string[];
  author?: {
    id?: number;
    name?: string;
    handle?: string;
  };
}

export interface PromptResolveResult {
  markdown: string;
  resolvedRefs: Array<{ id: number; teamSlug: string; slug: string; name: string; version: string }>;
}

export interface PromptDetailRes extends PromptCardRes {
  teamName?: string;
  catName?: string;
  contentMd: string;
  resolved?: PromptResolveResult;
}

export interface PromptVersionRes {
  id: number;
  version: string;
  changelog?: string;
  contentMd?: string;
  refsCount?: number;
  publishedAt?: string;
}

export interface SuiteAssetItemRes {
  type: 'SKILL' | 'PROMPT';
  id: number;
  slug: string;
  name: string;
  shortDesc?: string;
  catCode?: string;
  icon?: string;
  iconUrl?: string;
  version?: string;
  visibility?: 'PUBLIC' | 'TEAM_PRIVATE';
  installs?: number;
  stars?: number;
  exports?: number;
  position?: number;
}

export interface CreateSkillRes {
  id: number | null;
  slug: string;
  status: string;
  pendingReview: boolean;
  /** review-first 流程下，新建的 review 行 PK；DIRECT_PUBLISH 直接物化时为 null。 */
  reviewId?: number | null;
}

export interface ReviewPayloadReq {
  name?: string;
  slug?: string;
  shortDesc?: string;
  cat?: string;
  visibility?: 'PUBLIC' | 'TEAM_PRIVATE';
  version?: string;
  icon?: string;
  /** 自定义上传图标 storage key；null=不变，""=清除，非空=替换 */
  iconKey?: string;
  tags?: string[];
  langs?: string[];
  filesCount?: number;
  zipUrl?: string;
  /** Prompt 专用 */
  contentMd?: string;
  /** Prompt 专用：版本说明 */
  changelog?: string;
}

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

export interface SkillParseCheck {
  status: 'pass' | 'warn' | 'fail';
  name: string;
  detail: string;
}

export interface SkillFileEntry {
  path: string;
  size: number;
}

export interface SkillMdContent {
  path: string;
  content: string;
  size: number;
  truncated: boolean;
}

export interface SkillParseResult {
  zipUrl: string;
  size: number;
  sha256: string;
  entryCount: number;
  fileCount: number;
  skillMdPath: string | null;
  hasSkillMd: boolean;
  hasFrontmatter: boolean;
  parsed: {
    name?: string | null;
    version?: string | null;
    description?: string | null;
    category?: string | null;
    tags?: string[] | null;
    langs?: string[] | null;
  } | null;
  checks: SkillParseCheck[];
  ok: boolean;
}

/* ─── Auth ─────────────────────────── */

export interface PublicProviderVO {
  code: string;
  displayName: string;
  buttonLabel: string | null;
  iconUrl: string | null;
  sortOrder: number;
}

export const authApi = {
  /**
   * 发送短信验证码。响应体只回 ttl（秒），实际验证码只通过短信下发。
   * purpose=login 时后端会校验手机号必须已注册（未注册返回 40004）；
   * purpose=register 时后端会校验手机号必须未注册（已注册返回 40020）；
   * 不传时不做存在性预校验，保留旧行为（账户改绑等场景）。
   */
  smsCode: (phone: string, purpose?: 'login' | 'register' | 'change_phone') =>
    http.post<unknown, { ttl: number }>('/auth/sms-code', { phone, purpose }),
  login: (body: {
    identifier?: string;
    password?: string;
    phone?: string;
    smsCode?: string;
    remember?: boolean;
  }) => http.post<unknown, { token: string; user: any }>('/auth/login', body),
  providers: () =>
    http.get<unknown, PublicProviderVO[]>('/auth/providers'),
  oauthUrl: (provider: string) =>
    http.get<unknown, { authUrl: string; state: string }>(`/auth/oauth/${encodeURIComponent(provider)}/url`),
  oauthCallback: (provider: string, code: string, state: string) =>
    http.get<unknown, { token: string; user: any }>(
      `/auth/oauth/${encodeURIComponent(provider)}/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
    ),
  feishuUrl: () =>
    http.get<unknown, { auth_url: string; state: string }>('/auth/feishu/url'),
  feishuCallback: (code: string, state: string) =>
    http.get<unknown, { token: string; user: any }>(
      `/auth/feishu/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
    ),
  registerStep1: (body: { phone: string; smsCode: string }) =>
    http.post<unknown, { regToken: string }>('/auth/register/step1', body),
  registerStep2: (body: { regToken: string; handle: string; name: string; email: string; password: string }) =>
    http.post<unknown, { regToken: string }>('/auth/register/step2', body),
  registerStep3: (body: { regToken: string; avatar?: string; bio?: string; avatarColor?: string }) =>
    http.post<unknown, { regToken: string }>('/auth/register/step3', body),
  registerStep4: (body: { regToken: string; inviteCode?: string; createTeamName?: string }) =>
    http.post<unknown, { token: string; user: any }>('/auth/register/step4', body),
  me: () => http.get<unknown, any>('/me'),

  /* ─── CLI device authorization (smskill login --web) ──────────── */
  cliDeviceInit: () =>
    http.post<unknown, {
      deviceCode: string;
      userCode: string;
      verificationUri: string;
      expiresIn: number;
      interval: number;
    }>('/auth/cli/device-init'),
  cliDevicePoll: (deviceCode: string) =>
    http.post<unknown, { status: 'pending' | 'approved'; token?: string; user?: any }>(
      '/auth/cli/device-poll',
      { deviceCode },
    ),
  cliDeviceLookup: (userCode: string) =>
    http.get<unknown, { userCode: string; status: string; expiresIn: number; userAgent?: string }>(
      `/me/cli/device/${encodeURIComponent(userCode)}`,
    ),
  cliDeviceApprove: (userCode: string, remember: boolean) =>
    http.post<unknown, void>(`/me/cli/device/${encodeURIComponent(userCode)}/approve`, { remember }),
  cliDeviceDeny: (userCode: string) =>
    http.post<unknown, void>(`/me/cli/device/${encodeURIComponent(userCode)}/deny`),
};

/* ─── Account ──────────────────────── */
export const accountApi = {
  updateProfile: (body: { name: string; email?: string; avatar?: string }) =>
    http.put<unknown, any>('/me/profile', body),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    http.put<unknown, void>('/me/password', body),
  changePhone: (body: { currentPassword: string; phone: string; smsCode: string }) =>
    http.put<unknown, any>('/me/phone', body),
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return http.post<unknown, { avatarUrl: string }>('/me/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: [(d) => d],
    });
  },
};

/* ─── Team ─────────────────────────── */
export const teamApi = {
  create: (name: string, slug?: string) =>
    http.post<unknown, { id: number; slug: string; name: string }>('/teams', { name, slug }),
  publicList: () => http.get<unknown, Team[]>('/teams'),
  mine: () => http.get<unknown, MyTeam[]>('/teams/mine'),
  detail: (slug: string) => http.get<unknown, Team>(`/teams/${slug}`),
  memberDetail: (teamId: number) => http.get<unknown, any>(`/teams/${teamId}/detail`),
  settings: (teamId: number) => http.get<unknown, any>(`/teams/${teamId}/settings`),
  updateSettings: (teamId: number, body: any) => http.put<unknown, any>(`/teams/${teamId}/settings`, body),
  uploadLogo: (teamId: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return http.post<unknown, { logoUrl: string }>(`/teams/${teamId}/logo`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: [(d) => d],
    });
  },
  members: (teamId: number, q: { role?: string; q?: string; page?: number; size?: number } = {}) =>
    http.get<unknown, PageRes<TeamMember>>(`/teams/${teamId}/members`, { params: q }),
  updateMember: (teamId: number, userId: number, body: { role: string }) =>
    http.put<unknown, void>(`/teams/${teamId}/members/${userId}`, body),
  removeMember: (teamId: number, userId: number) => http.delete<unknown, void>(`/teams/${teamId}/members/${userId}`),
  invites: {
    codes: (teamId: number) => http.get<unknown, Invite[]>(`/teams/${teamId}/invites/codes`),
    createCode: (teamId: number, body: { max: number; expiresInDays: number; role: string }) =>
      http.post<unknown, Invite>(`/teams/${teamId}/invites/codes`, body),
    deleteCode: (teamId: number, id: number) => http.delete<unknown, void>(`/teams/${teamId}/invites/codes/${id}`),
    phones: (teamId: number) => http.get<unknown, PhoneInvite[]>(`/teams/${teamId}/invites/phones`),
    addPhone: (teamId: number, body: { phone: string; note?: string }) =>
      http.post<unknown, PhoneInvite>(`/teams/${teamId}/invites/phones`, body),
    cancelPhone: (teamId: number, id: number) =>
      http.post<unknown, void>(`/teams/${teamId}/invites/phones/${id}/cancel`),
    myPendingPhones: () =>
      http.get<unknown, MyPhoneInvite[]>('/me/invites/phones'),
    acceptPhone: (teamId: number, id: number) =>
      http.post<unknown, void>(`/teams/${teamId}/invites/phones/${id}/accept`),
  },
  joinByCode: (code: string) => http.post<unknown, { teamId: number; team: Team }>('/teams/join-by-code', { code }),
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

  notificationPrefs: (teamId: number) =>
    http.get<unknown, { prefs: Record<string, Record<string, boolean>> }>(
      `/teams/${teamId}/me/notification-prefs`),

  updateNotificationPrefs: (teamId: number, entries: Array<{ key: string; channel: string; enabled: boolean }>) =>
    http.put<unknown, { prefs: Record<string, Record<string, boolean>> }>(
      `/teams/${teamId}/me/notification-prefs`, { entries }),

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
  leave: (teamId: number) => http.post<unknown, void>(`/teams/${teamId}/leave`, {}),
};

/* ─── Notification ─────────────────── */
export const notificationApi = {
  list: (q: { teamId?: number; status?: 'unread' | 'all'; page?: number; size?: number }) =>
    http.get<unknown, PageRes<NotificationItem>>('/me/notifications', { params: q }),
  unreadCount: (teamId?: number) =>
    http.get<unknown, { unread: number }>('/me/notifications/unread-count', {
      params: teamId ? { teamId } : {},
    }),
  markRead: (id: number) => http.post<unknown, void>(`/me/notifications/${id}/read`, {}),
  markAllRead: (teamId?: number) =>
    http.post<unknown, { updated: number }>('/me/notifications/read-all', {}, {
      params: teamId ? { teamId } : {},
    }),
};

/* ─── Skill ────────────────────────── */
export const skillApi = {
  plaza: (q: {
    page?: number;
    size?: number;
    q?: string;
  } = {}) => http.get<unknown, PageRes<Skill>>('/skills', { params: q }),
  detail: (slug: string) => http.get<unknown, Skill>(`/skills/${slug}`),
  versions: (slug: string) => http.get<unknown, any[]>(`/skills/${slug}/versions`),
  versionFiles: (slug: string, version: string) =>
    http.get<unknown, SkillFileEntry[]>(
      `/skills/${slug}/versions/${encodeURIComponent(version)}/files`,
    ),
  skillMd: (slug: string, version: string) =>
    http.get<unknown, SkillMdContent>(
      `/skills/${slug}/versions/${encodeURIComponent(version)}/skill-md`,
    ),
  drafts: () => http.get<unknown, Skill[]>('/skills/me/drafts'),
  create: (body: any) => http.post<unknown, CreateSkillRes>('/skills', body),
  saveDraft: (body: any) => http.post<unknown, CreateSkillRes>('/skills/drafts', body),
  install: (id: number) => http.post<unknown, { installs: number }>(`/skills/${id}/install`),
  submitVersion: (id: number, body: { version: string; changelog?: string; zipUrl?: string }) =>
    http.post<unknown, CreateSkillRes>(`/skills/${id}/versions`, body),
  uploadVersionZip: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return http.post<unknown, { zipUrl: string; url: string }>('/skills/versions/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: [(d) => d],
    });
  },
  uploadVersionMd: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return http.post<unknown, { zipUrl: string; url: string }>('/skills/versions/upload-md', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: [(d) => d],
    });
  },
  uploadVersionText: (content: string) =>
    http.post<unknown, { zipUrl: string; url: string }>('/skills/versions/upload-text', { content }),
  uploadDescriptionImage: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return http.post<unknown, { url: string }>('/skills/description-images', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: [(d) => d],
    });
  },
  uploadIcon: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return http.post<unknown, { key: string; url: string }>('/skills/icon-images', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: [(d) => d],
    });
  },
  parseVersionZip: (zipUrl: string) =>
    http.post<unknown, SkillParseResult>('/skills/versions/parse', { zipUrl }),
  star: (id: number) => http.post<unknown, { stars: number; starred: boolean }>(`/skills/${id}/star`),
  unstar: (id: number) => http.delete<unknown, { stars: number; starred: boolean }>(`/skills/${id}/star`),
  updateVisibility: (id: number, visibility: 'PUBLIC' | 'TEAM_PRIVATE') =>
    http.patch<unknown, void>(`/skills/${id}/visibility`, { visibility }),
  updateAdminProfile: (
    id: number,
    body: {
      name: string;
      shortDesc: string;
      cat: string;
      icon?: string;
      iconKey?: string;
      visibility: 'PUBLIC' | 'TEAM_PRIVATE';
      tags: string[];
    },
  ) => http.patch<unknown, void>(`/skills/${id}/admin-profile`, body),
  updateStatus: (id: number, status: 'APPROVED' | 'UNLISTED') =>
    http.patch<unknown, void>(`/skills/${id}/status`, { status }),
  transferOwner: (id: number, ownerId: number) =>
    http.patch<unknown, void>(`/skills/${id}/owner`, { ownerId }),
  remove: (id: number) => http.delete<unknown, void>(`/skills/${id}`),
  reviews: (id: number) => http.get<unknown, SkillReviewSummaryRes>(`/skills/${id}/reviews`),
  submitReview: (id: number, body: { rating: number; body: string; version: string }) =>
    http.post<unknown, SkillReviewSummaryRes>(`/skills/${id}/reviews`, body),
  replyReview: (id: number, reviewId: number, body: { body: string }) =>
    http.post<unknown, SkillReviewReplyRes>(`/skills/${id}/reviews/${reviewId}/replies`, body),
  download: async (slug: string, version?: string): Promise<{ blob: Blob; fileName: string }> => {
    const token = (await import('./client')).getToken();
    const qs = version ? `?version=${encodeURIComponent(version)}` : '';
    const res = await fetch(`/api/skills/${slug}/download${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) {
      let msg = `下载失败 (${res.status})`;
      try {
        const env = await res.json();
        if (env?.message) msg = env.message;
      } catch {
        /* binary body — keep generic message */
      }
      throw new Error(msg);
    }
    const blob = await res.blob();
    const disp = res.headers.get('content-disposition') || '';
    const utf = disp.match(/filename\*=UTF-8''([^;]+)/i);
    const ascii = disp.match(/filename="?([^";]+)"?/i);
    const fileName = utf ? decodeURIComponent(utf[1]) : ascii ? ascii[1] : `${slug}.zip`;
    return { blob, fileName };
  },
  teamSkills: (
    teamId: number,
    q: {
      status?: string;
      visibility?: string;
      cat?: string;
      authorId?: number;
      updatedWithin?: number;
      q?: string;
      page?: number;
      size?: number;
    } = {},
  ) => http.get<unknown, PageRes<Skill>>(`/teams/${teamId}/skills`, { params: q }),
};

/* ─── Prompt ───────────────────────── */
export const promptApi = {
  plaza: (q: { page?: number; size?: number; q?: string } = {}) =>
    http.get<unknown, PageRes<PromptCardRes>>('/prompts', { params: q }),
  teamPrompts: (
    teamId: number,
    q: {
      page?: number;
      size?: number;
      status?: string;
      visibility?: string;
      cat?: string;
      authorId?: number;
      updatedWithin?: number;
      q?: string;
    } = {},
  ) =>
    http.get<unknown, PageRes<PromptCardRes>>(`/teams/${teamId}/prompts`, { params: q }),
  detail: (teamSlug: string, promptSlug: string) =>
    http.get<unknown, PromptDetailRes>(`/teams/${teamSlug}/prompts/${promptSlug}`),
  detailById: (id: number) => http.get<unknown, PromptDetailRes>(`/prompts/${id}`),
  versions: (id: number) => http.get<unknown, PromptVersionRes[]>(`/prompts/${id}/versions`),
  versionDetail: (id: number, version: string) =>
    http.get<unknown, PromptVersionRes>(`/prompts/${id}/versions/${encodeURIComponent(version)}`),
  resolve: (body: { contentMd: string; teamSlug: string; raw?: boolean }) =>
    http.post<unknown, PromptResolveResult>('/prompts/resolve', body),
  create: (body: any) =>
    http.post<unknown, { id: number | null; slug: string; status: string; pendingReview: boolean; reviewId?: number }>(
      '/prompts',
      body,
    ),
  saveDraft: (body: any) =>
    http.post<unknown, { id: number | null; slug: string; status: string; pendingReview: boolean; reviewId?: number }>(
      '/prompts/drafts',
      body,
    ),
  uploadIcon: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return http.post<unknown, { key: string; url: string }>('/prompts/icon-images', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: [(d) => d],
    });
  },
  submitVersion: (id: number, body: { version: string; changelog?: string; contentMd: string; tags?: string[] }) =>
    http.post<unknown, { id: number | null; slug: string; status: string; pendingReview: boolean; reviewId?: number }>(
      `/prompts/${id}/versions`,
      body,
    ),
  reviews: (id: number) => http.get<unknown, SkillReviewSummaryRes>(`/prompts/${id}/reviews`),
  submitReview: (id: number, body: { rating: number; body: string; version: string }) =>
    http.post<unknown, SkillReviewSummaryRes>(`/prompts/${id}/reviews`, body),
  replyReview: (id: number, reviewId: number, body: { body: string }) =>
    http.post<unknown, SkillReviewReplyRes>(`/prompts/${id}/reviews/${reviewId}/replies`, body),
  updateVisibility: (id: number, visibility: 'PUBLIC' | 'TEAM_PRIVATE') =>
    http.patch<unknown, void>(`/prompts/${id}/visibility`, { visibility }),
  updateAdminProfile: (
    id: number,
    body: {
      name: string;
      shortDesc: string;
      cat: string;
      iconKey?: string;
      visibility: 'PUBLIC' | 'TEAM_PRIVATE';
      tags: string[];
    },
  ) => http.patch<unknown, void>(`/prompts/${id}/admin-profile`, body),
  updateStatus: (id: number, status: 'APPROVED' | 'UNLISTED') =>
    http.patch<unknown, void>(`/prompts/${id}/status`, { status }),
  remove: (id: number) => http.delete<unknown, void>(`/prompts/${id}`),
  download: async (teamSlug: string, promptSlug: string, raw = false): Promise<{ blob: Blob; fileName: string }> => {
    const token = (await import('./client')).getToken();
    const qs = raw ? '?raw=true' : '';
    const res = await fetch(`/api/teams/${encodeURIComponent(teamSlug)}/prompts/${encodeURIComponent(promptSlug)}/download${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) {
      let msg = `下载失败 (${res.status})`;
      try {
        const env = await res.json();
        if (env?.message) msg = env.message;
      } catch {
        /* markdown body — keep generic message */
      }
      throw new Error(msg);
    }
    const blob = await res.blob();
    const disp = res.headers.get('content-disposition') || '';
    const utf = disp.match(/filename\*=UTF-8''([^;]+)/i);
    const ascii = disp.match(/filename="?([^";]+)"?/i);
    const fileName = utf ? decodeURIComponent(utf[1]) : ascii ? ascii[1] : `${promptSlug}.md`;
    return { blob, fileName };
  },
};

/* ─── Category ─────────────────────── */
export const categoryApi = {
  all: () => http.get<unknown, { id: string; name: string; count: number }[]>('/categories'),
};

/* ─── Review ───────────────────────── */
export const reviewApi = {
  queue: (teamId: number, q: { status?: string; targetType?: string; page?: number; size?: number } = {}) =>
    http.get<unknown, PageRes<Review>>(`/teams/${teamId}/reviews`, { params: q }),
  detail: (id: number) => http.get<unknown, any>(`/reviews/${id}`),
  approve: (id: number, body: { comment?: string } = {}) => http.post<unknown, void>(`/reviews/${id}/approve`, body),
  reject: (id: number, body: { reason: string }) => http.post<unknown, void>(`/reviews/${id}/reject`, body),
  requestChanges: (id: number, body: { reason: string }) =>
    http.post<unknown, void>(`/reviews/${id}/request-changes`, body),
  withdraw: (id: number) => http.post<unknown, void>(`/reviews/${id}/withdraw`),
  resubmit: (id: number, body?: ReviewPayloadReq) =>
    http.post<unknown, void>(`/reviews/${id}/resubmit`, body ?? {}),
  editPayload: (id: number, body: ReviewPayloadReq) =>
    http.patch<unknown, void>(`/reviews/${id}`, body),
  submit: (id: number) => http.post<unknown, void>(`/reviews/${id}/submit`, {}),
  remove: (id: number) => http.delete<unknown, void>(`/reviews/${id}`),
  listComments: (id: number) => http.get<unknown, ReviewCommentItem[]>(`/reviews/${id}/comments`),
  postComment: (id: number, body: { body: string }) =>
    http.post<unknown, ReviewCommentItem>(`/reviews/${id}/comments`, body),
  files: (id: number) => http.get<unknown, ReviewFileTree>(`/reviews/${id}/files`),
};

export interface ReviewFileTree {
  available: boolean;
  message?: string;
  entries: { path: string; type: string; binary: boolean; size: number }[];
  contents: Record<string, string>;
}

export interface ReviewCommentItem {
  id: number;
  /** mine（提交者）/ review（审核人） */
  kind: 'mine' | 'review';
  body: string;
  /** YYYY-MM-DD HH:mm */
  ts: string;
  author: {
    id: number;
    handle: string;
    name: string;
    avatar: string;
    /** 头像图片 URL（上传 / 飞书 SSO）。无图时使用 `avatar` 字符占位。 */
    avatarUrl?: string | null;
    role?: string;
  };
}

/* ─── Suite ────────────────────────── */
export const suiteApi = {
  list: (teamId: number, q: { visibility?: string; page?: number; size?: number } = {}) =>
    http.get<unknown, PageRes<Suite>>(`/teams/${teamId}/suites`, { params: q }),
  /** 公共团队页用：按 (team, slug) 双键定位。 */
  detailByTeamSlug: (teamId: number, slug: string) =>
    http.get<unknown, Suite & { skills: Skill[]; items?: SuiteAssetItemRes[] }>(`/teams/${teamId}/suites/by-slug/${slug}`),
  /** 兼容旧路径，必须传 teamId。 */
  detail: (slug: string, teamId?: number) =>
    http.get<unknown, Suite & { skills: Skill[]; items?: SuiteAssetItemRes[] }>(`/suites/${slug}`, { params: teamId ? { teamId } : {} }),
  create: (teamId: number, body: any) => http.post<unknown, Suite>(`/teams/${teamId}/suites`, body),
  updateItems: (
    id: number,
    body: { items: { type?: 'SKILL' | 'PROMPT'; itemId?: number; skillId?: number; position: number }[] },
  ) =>
    http.put<unknown, void>(`/suites/${id}/items`, body),
  remove: (id: number) => http.delete<unknown, void>(`/suites/${id}`),
  install: (id: number) => http.post<unknown, { installs: number }>(`/suites/${id}/install`),
};

/* ─── Activity ─────────────────────── */
export const activityApi = {
  feed: (teamId: number, limit = 20) =>
    http.get<unknown, Activity[]>(`/teams/${teamId}/activity`, { params: { limit } }),
};

/* ─── User ─────────────────────────── */
export const userApi = {
  profile: (handle: string) => http.get<unknown, any>(`/users/${handle}`),
};

/* ─── Site / Admin ─────────────────── */

export interface BrandingRes {
  name: string;
  tagline: string;
  logoUrl: string;
  footer: string;
}

export interface SiteSettingVO {
  key: string;
  value: string | null;
  valueType: 'STRING' | 'URL' | 'BOOL' | 'JSON';
  updatedBy: number | null;
  updatedAt: string | null;
}

export interface UpdateSettingsRes {
  appliedKeys: string[];
  unknownKeys: string[];
  branding: BrandingRes;
}

export type PlatformRole = 'USER' | 'SUPER_ADMIN';
export type UserAccountStatus = 'ACTIVE' | 'DISABLED';
export type TeamAccountStatus = 'ACTIVE' | 'DISABLED';

export interface AdminUserListItem {
  id: number;
  handle: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  platformRole: PlatformRole;
  status: UserAccountStatus;
  teamsCount: number;
  joinedAt: string | null;
  lastLogin: string | null;
}

export interface AdminUserTeamRef {
  id: number;
  slug: string;
  name: string;
  role: string;
}

export interface AdminUserDetail extends AdminUserListItem {
  bio: string | null;
  teams: AdminUserTeamRef[];
}

export interface AdminTeamListItem {
  id: number;
  slug: string;
  name: string;
  ownerHandle: string | null;
  ownerName: string | null;
  membersCount: number;
  skillsCount: number;
  suitesCount: number;
  status: TeamAccountStatus;
  createdAt: string | null;
}

export interface AdminTeamDetail extends AdminTeamListItem {
  description?: string | null;
  logoUrl?: string | null;
}

export interface AdminSkillListItem {
  id: number;
  slug: string;
  name: string;
  teamId: number;
  teamName: string;
  authorId: number | null;
  authorHandle: string | null;
  status: string;
  visibility: string;
  installs: number;
  stars: number;
  publishedAt: string | null;
}

export interface AdminSuiteListItem {
  id: number;
  slug: string;
  name: string;
  teamId: number;
  teamName: string;
  visibility: string;
  installs: number;
  skillsCount: number;
  createdAt: string | null;
}

export interface AdminUsersQuery {
  q?: string;
  platformRole?: PlatformRole | '';
  status?: UserAccountStatus | '';
  page?: number;
  size?: number;
}

export interface AdminTeamsQuery {
  q?: string;
  status?: TeamAccountStatus | '';
  page?: number;
  size?: number;
}

export interface AdminSkillsQuery {
  q?: string;
  teamId?: number | '';
  status?: string;
  visibility?: string;
  page?: number;
  size?: number;
}

export interface AdminSuitesQuery {
  q?: string;
  teamId?: number | '';
  page?: number;
  size?: number;
}

export interface AdminTeamMember {
  userId: number;
  handle: string;
  name: string;
  avatar?: string;
  /** 头像图片 URL（上传 / 飞书 SSO）。无图时使用 `avatar` 字符占位。 */
  avatarUrl?: string | null;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  joined?: string;
  skills?: number;
  lastActive?: string;
}

export interface AdminUpdateTeamReq {
  name?: string;
  slug?: string;
  status?: 'ACTIVE' | 'DISABLED';
}

export interface AdminAddTeamMemberReq {
  userId: number;
  role: 'ADMIN' | 'MEMBER';
}

export interface AdminTeamMembersQuery {
  q?: string;
  role?: 'OWNER' | 'ADMIN' | 'MEMBER' | '';
  page?: number;
  size?: number;
}

export const siteApi = {
  branding: () => http.get<unknown, BrandingRes>('/site/branding'),
};

export interface AdminProviderVO {
  code: string;
  displayName: string;
  enabled: boolean;
  clientId: string | null;
  clientSecretSet: boolean;
  redirectUri: string | null;
  scope: string | null;
  authorizeUrl: string | null;
  tokenUrl: string | null;
  userinfoUrl: string | null;
  iconUrl: string | null;
  buttonLabel: string | null;
  sortOrder: number;
  extraJson: string | null;
  updatedAt: string | null;
}

export interface UpdateProviderReq {
  displayName?: string;
  enabled?: boolean;
  clientId?: string;
  clientSecret?: string | null;
  redirectUri?: string;
  scope?: string;
  authorizeUrl?: string;
  tokenUrl?: string;
  userinfoUrl?: string;
  iconUrl?: string;
  buttonLabel?: string;
  sortOrder?: number;
  extraJson?: string | null;
}

export interface AdminSmsProviderVO {
  code: string;
  displayName: string;
  enabled: boolean;
  providerType: 'HTTP' | 'LINGYANG_CHAOXIN';
  endpointUrl: string | null;
  method: string | null;
  headersJson: string | null;
  bodyTemplate: string | null;
  successStatus: number | null;
  successJsonPath: string | null;
  successExpectedValue: string | null;
  extraJson: string | null;
  secretJson: string | null;
  secretJsonSet: boolean;
  updatedAt: string | null;
}

export interface UpdateSmsProviderReq {
  displayName?: string;
  enabled?: boolean;
  providerType?: 'HTTP' | 'LINGYANG_CHAOXIN';
  endpointUrl?: string;
  method?: string;
  headersJson?: string | null;
  bodyTemplate?: string;
  successStatus?: number;
  successJsonPath?: string | null;
  successExpectedValue?: string | null;
  extraJson?: string | null;
  secretJson?: string | null;
}

export const adminApi = {
  // settings
  listSettings: () => http.get<unknown, SiteSettingVO[]>('/admin/settings'),
  updateSettings: (values: Record<string, string>) =>
    http.put<unknown, UpdateSettingsRes>('/admin/settings', { values }),
  uploadLogo: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return http.post<unknown, BrandingRes>('/admin/settings/logo', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: [(d) => d],
    });
  },

  // users
  listUsers: (q: AdminUsersQuery = {}) =>
    http.get<unknown, PageRes<AdminUserListItem>>('/admin/users', { params: q }),
  userDetail: (id: number) => http.get<unknown, AdminUserDetail>(`/admin/users/${id}`),
  disableUser: (id: number) => http.post<unknown, void>(`/admin/users/${id}/disable`, {}),
  enableUser: (id: number) => http.post<unknown, void>(`/admin/users/${id}/enable`, {}),
  promoteUser: (id: number) => http.post<unknown, void>(`/admin/users/${id}/promote`, {}),
  demoteUser: (id: number) => http.post<unknown, void>(`/admin/users/${id}/demote`, {}),
  resetUserPassword: (id: number) =>
    http.post<unknown, { tempPassword: string }>(`/admin/users/${id}/reset-password`, {}),

  // teams
  listTeams: (q: AdminTeamsQuery = {}) =>
    http.get<unknown, PageRes<AdminTeamListItem>>('/admin/teams', { params: q }),
  teamDetail: (id: number) => http.get<unknown, AdminTeamDetail>(`/admin/teams/${id}`),
  disableTeam: (id: number) => http.post<unknown, void>(`/admin/teams/${id}/disable`, {}),
  enableTeam: (id: number) => http.post<unknown, void>(`/admin/teams/${id}/enable`, {}),
  updateTeam: (id: number, body: AdminUpdateTeamReq) =>
    http.patch<unknown, void>(`/admin/teams/${id}`, body),
  listTeamMembers: (id: number, q: AdminTeamMembersQuery = {}) =>
    http.get<unknown, PageRes<AdminTeamMember>>(`/admin/teams/${id}/members`, { params: q }),
  addTeamMember: (id: number, body: AdminAddTeamMemberReq) =>
    http.post<unknown, void>(`/admin/teams/${id}/members`, body),
  updateTeamMemberRole: (id: number, userId: number, role: 'ADMIN' | 'MEMBER') =>
    http.put<unknown, void>(`/admin/teams/${id}/members/${userId}`, { role }),
  removeTeamMember: (id: number, userId: number) =>
    http.delete<unknown, void>(`/admin/teams/${id}/members/${userId}`),

  // skills
  listSkills: (q: AdminSkillsQuery = {}) =>
    http.get<unknown, PageRes<AdminSkillListItem>>('/admin/skills', { params: q }),
  unpublishSkill: (id: number) =>
    http.post<unknown, void>(`/admin/skills/${id}/unpublish`, {}),

  // suites
  listSuites: (q: AdminSuitesQuery = {}) =>
    http.get<unknown, PageRes<AdminSuiteListItem>>('/admin/suites', { params: q }),
  unpublishSuite: (id: number) =>
    http.post<unknown, void>(`/admin/suites/${id}/unpublish`, {}),

  // oauth providers
  listOAuthProviders: () =>
    http.get<unknown, AdminProviderVO[]>('/admin/oauth-providers'),
  getOAuthProvider: (code: string) =>
    http.get<unknown, AdminProviderVO>(`/admin/oauth-providers/${encodeURIComponent(code)}`),
  updateOAuthProvider: (code: string, body: UpdateProviderReq) =>
    http.put<unknown, AdminProviderVO>(`/admin/oauth-providers/${encodeURIComponent(code)}`, body),

  // sms provider
  getSmsProvider: () =>
    http.get<unknown, AdminSmsProviderVO>('/admin/sms-provider'),
  updateSmsProvider: (body: UpdateSmsProviderReq) =>
    http.put<unknown, AdminSmsProviderVO>('/admin/sms-provider', body),
};
