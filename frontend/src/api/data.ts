import { useQuery } from '@tanstack/react-query';
import { useCurrentTeam as useCurrentTeamHook } from '@/hooks/useCurrentTeam';
import { getToken, setToken } from './client';
import {
  activityApi,
  authApi,
  categoryApi,
  promptApi,
  reviewApi,
  skillApi,
  suiteApi,
  teamApi,
  userApi,
  type PageRes,
  type PromptCardRes,
} from './endpoints';
import type { Activity } from '@/mocks/activity';
import type { Invite, PhoneInvite } from '@/mocks/invites';
import type { Review } from '@/mocks/reviews';
import type { Skill, SkillStatus } from '@/mocks/skills';
import type { Suite } from '@/mocks/suites';
import type { MyTeam, Team, TeamMember, TeamRole, User } from '@/mocks/team';

type UnknownRecord = Record<string, unknown>;

function asRecord(v: unknown): UnknownRecord {
  return v && typeof v === 'object' ? (v as UnknownRecord) : {};
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '') return Number(v);
  return fallback;
}

export function pageItems<T>(res: PageRes<T> | { items?: T[] } | T[] | null | undefined): T[] {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  const r = res as PageRes<T> & { items?: T[] };
  if (Array.isArray(r.items)) return r.items;
  if (Array.isArray(r.records)) return r.records;
  return [];
}

const ROLE_TITLE: Record<string, TeamRole> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
  Owner: 'Owner',
  Admin: 'Admin',
  Member: 'Member',
  Viewer: 'Viewer',
};

export function normRole(role?: string | null): TeamRole {
  return role ? ROLE_TITLE[role] ?? 'Member' : 'Member';
}

function normStatus(status?: string | null): SkillStatus {
  if (status === 'PENDING') return 'PENDING_REVIEW';
  if (
    status === 'DRAFT' ||
    status === 'PENDING_REVIEW' ||
    status === 'APPROVED' ||
    status === 'REJECTED' ||
    status === 'UNLISTED'
  ) {
    return status;
  }
  return 'APPROVED';
}

export function mmdd(value?: string | null): string {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[2]}-${match[3]}` : value.slice(0, 10);
}

export function mapTeam(raw: unknown): Team {
  const t = asRecord(raw);
  const reviewMode = str(t.reviewMode);
  return {
    id: typeof t.id === 'number' ? t.id : undefined,
    slug: str(t.slug),
    name: str(t.name),
    desc: str(t.description, str(t.desc)),
    members: num(t.members),
    publicSkills: num(t.publicSkills),
    privateSkills: num(t.privateSkills),
    suites: num(t.suites),
    avatar: str(t.avatar, str(t.avatarChar, str(t.name).slice(0, 1))),
    logoUrl: str(t.logoUrl),
    color: str(t.color, '#4F46E5'),
    reviewMode: reviewMode === 'DIRECT_PUBLISH' ? 'DIRECT_PUBLISH' : 'REVIEW_REQUIRED',
    publicHome: typeof t.publicHome === 'boolean' ? t.publicHome : true,
    createdAt: typeof t.createdAt === 'string' ? t.createdAt : undefined,
  };
}

export function mapMyTeam(raw: unknown): MyTeam {
  const t = asRecord(raw);
  return {
    id: String(t.id ?? t.slug ?? ''),
    slug: str(t.slug),
    name: str(t.name),
    avatar: str(t.avatar, str(t.name).slice(0, 1)),
    logoUrl: str(t.logoUrl),
    color: str(t.color, '#4F46E5'),
    role: normRole(str(t.role)),
    members: num(t.members),
    unread: num(t.unread),
  };
}

export function mapMe(raw: unknown): User {
  const me = asRecord(raw);
  const platformRole = str(me.platformRole);
  const status = str(me.status);
  const avatarUrl = str(me.avatarUrl);
  return {
    handle: str(me.handle),
    name: str(me.name),
    role: normRole(str(me.role)),
    avatar: str(me.avatar, str(me.name).slice(0, 1)),
    avatarUrl: avatarUrl || undefined,
    email: str(me.email),
    phone: str(me.phone),
    joinedDays: num(me.joinedDays),
    platformRole: platformRole === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'USER',
    accountStatus: status === 'DISABLED' ? 'DISABLED' : 'ACTIVE',
  };
}

export function mapSkill(raw: unknown): Skill & { id?: number } {
  const s = asRecord(raw);
  const author = asRecord(s.author);
  return {
    id: typeof s.id === 'number' ? s.id : undefined,
    slug: str(s.slug),
    name: str(s.name),
    short: str(s.short, str(s.shortDesc)),
    cat: str(s.cat, str(s.catCode)),
    icon: str(s.icon, str(s.name).slice(0, 1).toUpperCase() || 'S'),
    iconUrl: str(s.iconUrl) || undefined,
    installs: num(s.installs),
    stars: num(s.stars),
    score: num(s.score),
    version: str(s.version, '0.0.0'),
    updated: str(s.updated, str(s.updatedAt)),
    visibility: str(s.visibility, 'PUBLIC') as Skill['visibility'],
    status: normStatus(str(s.status)),
    author: {
      id: typeof author.id === 'number' ? author.id : undefined,
      name: str(author.name),
      handle: str(author.handle),
    },
    team: typeof s.team === 'string' ? s.team : str(asRecord(s.team).slug),
    tags: Array.isArray(s.tags) ? (s.tags as string[]) : [],
    safety: str(s.safety, 'pass') as Skill['safety'],
    evalScore: num(s.evalScore),
    langs: Array.isArray(s.langs) ? (s.langs as string[]) : [],
    filesCount: typeof s.filesCount === 'number' ? s.filesCount : undefined,
    license: typeof s.license === 'string' ? s.license : undefined,
    readme: typeof s.readme === 'string' ? s.readme : undefined,
    descriptionMd: typeof s.descriptionMd === 'string' ? s.descriptionMd : undefined,
  };
}

export type PromptCard = PromptCardRes;

export function mapPrompt(raw: unknown): PromptCard {
  const p = asRecord(raw);
  const author = asRecord(p.author);
  return {
    id: num(p.id),
    slug: str(p.slug),
    teamSlug: str(p.teamSlug),
    name: str(p.name),
    shortDesc: str(p.shortDesc),
    cat: str(p.cat),
    iconUrl: str(p.iconUrl) || undefined,
    visibility: str(p.visibility, 'TEAM_PRIVATE') as PromptCard['visibility'],
    status: str(p.status, 'APPROVED') as PromptCard['status'],
    version: str(p.version, '0.1.0'),
    score: num(p.score),
    stars: num(p.stars),
    exports: num(p.exports),
    updated: str(p.updated),
    tags: Array.isArray(p.tags) ? (p.tags as string[]) : [],
    author: {
      id: typeof author.id === 'number' ? author.id : undefined,
      name: str(author.name),
      handle: str(author.handle),
    },
  };
}

export function mapMember(raw: unknown): TeamMember & { userId?: number } {
  const m = asRecord(raw);
  const avatarUrl = str(m.avatarUrl);
  return {
    userId: typeof m.userId === 'number' ? m.userId : undefined,
    handle: str(m.handle),
    name: str(m.name),
    role: normRole(str(m.role)),
    joined: str(m.joined),
    skills: num(m.skills),
    lastActive: str(m.lastActive),
    avatar: str(m.avatar, str(m.name).slice(0, 1)),
    avatarUrl: avatarUrl || undefined,
  };
}

function normInviteStatus(status?: string | null): Invite['status'] {
  const v = (status ?? 'active').toLowerCase();
  if (v === 'active' || v === 'exhausted' || v === 'expired' || v === 'revoked') return v;
  return 'active';
}

export function mapInvite(raw: unknown): Invite & { id?: number } {
  const inv = asRecord(raw);
  return {
    id: typeof inv.id === 'number' ? inv.id : undefined,
    code: str(inv.code),
    uses: num(inv.uses, num(inv.used)),
    max: num(inv.max, num(inv.maxUses)),
    expiresIn: str(inv.expiresIn, str(inv.expiresLabel)),
    createdBy: str(inv.createdBy),
    createdAt: str(inv.createdAt),
    role: normRole(str(inv.role)),
    status: normInviteStatus(str(inv.status)),
  };
}

function normPhoneStatus(status?: string | null): PhoneInvite['status'] {
  const v = (status ?? 'pending').toLowerCase();
  if (v === 'pending' || v === 'accepted' || v === 'declined') return v;
  return 'pending';
}

export function mapPhoneInvite(raw: unknown): PhoneInvite & { id?: number } {
  const p = asRecord(raw);
  return {
    id: typeof p.id === 'number' ? p.id : undefined,
    phone: str(p.phone),
    invitedBy: str(p.invitedBy),
    at: str(p.at),
    note: str(p.note),
    status: normPhoneStatus(str(p.status)),
  };
}

export function mapReview(raw: unknown): Review & { rowId?: number; skillId?: number } {
  const r = asRecord(raw);
  const submittedBy = asRecord(r.submittedBy);
  return {
    id: str(r.id, String(r.rowId ?? '')),
    rowId: typeof r.rowId === 'number' ? r.rowId : undefined,
    targetType: str(r.targetType, 'SKILL') as Review['targetType'],
    targetId: typeof r.targetId === 'number' ? r.targetId : undefined,
    skillId: typeof r.skillId === 'number' ? r.skillId : undefined,
    slug: str(r.slug),
    name: str(r.name),
    submittedBy: {
      name: str(submittedBy.name),
      handle: str(submittedBy.handle),
      avatar: str(submittedBy.avatar, str(submittedBy.name).slice(0, 1)),
      avatarUrl: str(submittedBy.avatarUrl) || undefined,
    },
    submittedAt: str(r.submittedAt),
    visibility: str(r.visibility, 'PUBLIC') as Review['visibility'],
    short: str(r.short, str(r.shortDesc)),
    files: num(r.files),
    version: str(r.version, '0.0.0'),
    safety: str(r.safety, 'pass') as Review['safety'],
    evalScore: num(r.evalScore),
    status: str(r.status, 'PENDING_REVIEW') as Review['status'],
    reason: typeof r.reason === 'string' ? r.reason : undefined,
    changelog: typeof r.changelog === 'string' ? r.changelog : undefined,
    kind: typeof r.kind === 'string' ? r.kind : undefined,
    catCode: typeof r.catCode === 'string' ? r.catCode : undefined,
    tagsJson: typeof r.tagsJson === 'string' ? r.tagsJson : undefined,
    payloadJson: typeof r.payloadJson === 'string' ? r.payloadJson : undefined,
  };
}

export function mapSuite(raw: unknown): Suite & { rowId?: number } {
  const s = asRecord(raw);
  return {
    rowId: typeof s.id === 'number' ? s.id : undefined,
    id: String(s.id ?? s.slug ?? ''),
    name: str(s.name),
    slug: str(s.slug),
    desc: str(s.desc, str(s.description)),
    visibility: str(s.visibility, 'TEAM_PRIVATE') as Suite['visibility'],
    skills: num(s.skills, num(s.skillsCount)),
    installs: num(s.installs),
    updated: str(s.updated, mmdd(str(s.updatedAt))),
  };
}

export function mapActivity(raw: unknown): Activity {
  const a = asRecord(raw);
  const kind = str(a.kind, 'submit') as Activity['kind'];
  const whatByKind: Record<Activity['kind'], string> = {
    approve: '通过了',
    submit: '提交了',
    invite: '发起了邀请',
    release: '发布了新版本',
    unlist: '下架了',
    join: '加入了团队',
    suite: '更新了套件',
    reject: '拒绝了',
  };
  const avatarChar = str(a.actorAvatar) || undefined;
  const avatarUrl = str(a.actorAvatarUrl) || undefined;
  return {
    who: str(a.who, str(a.actor)),
    what: str(a.what, whatByKind[kind]),
    target: str(a.target),
    when: str(a.when, str(a.timeAgo)),
    kind,
    extra: typeof a.extra === 'string' ? a.extra : undefined,
    whoAvatar: avatarChar,
    whoAvatarUrl: avatarUrl,
  };
}

/**
 * Read the current session.
 *
 * Fail-closed semantics (RISK-AUTH-02):
 *  - no token in localStorage → null, never auto-create a session.
 *  - bad / expired token → backend rejects with 40110, axios interceptor clears the
 *    local token and triggers a reset event; this function returns null and the
 *    caller is responsible for redirecting to /login.
 */
export async function fetchSession() {
  if (!getToken()) return null;
  try {
    return await authApi.me();
  } catch {
    // interceptor already cleared the token if backend signaled reset.
    setToken(null);
    return null;
  }
}

export function useSession(enabled = true) {
  return useQuery({
    queryKey: ['session', 'me'],
    queryFn: fetchSession,
    enabled,
    staleTime: 5 * 60 * 1000,
    // 会话信息保持 5 分钟缓存即可；不需要随每次路由切换重新拉 /me
    refetchOnMount: false,
    retry: false,
  });
}

export function useTeam(slug?: string) {
  const { teamId, teamSlug } = useCurrentTeam();
  const resolvedSlug = slug ?? teamSlug;
  const numericTeamId = parseInt(String(teamId));
  // 显式传入 slug 时使用公开接口（公开页面），否则用成员鉴权接口（工作台，不要求 publicHome）
  const useMemberEndpoint = !slug && !isNaN(numericTeamId) && numericTeamId > 0;

  return useQuery({
    queryKey: ['team', useMemberEndpoint ? teamId : resolvedSlug],
    queryFn: async () =>
      useMemberEndpoint
        ? mapTeam(await teamApi.memberDetail(numericTeamId))
        : mapTeam(await teamApi.detail(resolvedSlug!)),
    enabled: useMemberEndpoint ? true : !!resolvedSlug,
  });
}

export function usePublicTeams() {
  return useQuery({
    queryKey: ['teams', 'public'],
    queryFn: async () => (await teamApi.publicList()).map(mapTeam),
  });
}

export function useMyTeams(enabled = true) {
  const session = useSession(enabled);
  const raw = session.data as { myTeams?: unknown[] } | undefined;
  return {
    ...session,
    data: (raw?.myTeams ?? []).map(mapMyTeam),
    me: raw ? mapMe(raw) : undefined,
  };
}

export function useCurrentTeam() {
  const { teamId: teamIdStr, teamSlug, role, isReady } = useCurrentTeamHook();
  // Convert string teamId to number for API calls
  const teamId = teamIdStr ? parseInt(teamIdStr, 10) : undefined;
  return {
    teamId,
    teamSlug,
    role,
    isReady,
  };
}

export function usePublicSkills(params: Parameters<typeof skillApi.plaza>[0] = {}) {
  return useQuery({
    queryKey: ['skills', 'public', params],
    queryFn: async () => pageItems(await skillApi.plaza({ page: 1, size: 24, ...params })).map(mapSkill),
  });
}

export function usePublicPrompts(params: Parameters<typeof promptApi.plaza>[0] = {}) {
  return useQuery({
    queryKey: ['prompts', 'public', params],
    queryFn: async () => pageItems(await promptApi.plaza({ page: 1, size: 24, ...params })).map(mapPrompt),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryApi.all(),
  });
}

export function useTeamSkills(params: Parameters<typeof skillApi.teamSkills>[1] = {}) {
  const { teamId, isReady } = useCurrentTeam();
  return useQuery({
    queryKey: ['team-skills', teamId, params],
    queryFn: async () => pageItems(await skillApi.teamSkills(teamId!, params)).map(mapSkill),
    enabled: isReady,
  });
}

export function useTeamPrompts(params: Parameters<typeof promptApi.teamPrompts>[1] = {}) {
  const { teamId, isReady } = useCurrentTeam();
  return useQuery({
    queryKey: ['team-prompts', teamId, params],
    queryFn: async () => pageItems(await promptApi.teamPrompts(teamId!, params)).map(mapPrompt),
    enabled: isReady,
  });
}

export function useTeamMembers(params: Parameters<typeof teamApi.members>[1] = {}) {
  const { teamId, isReady } = useCurrentTeam();
  return useQuery({
    queryKey: ['team-members', teamId, params],
    queryFn: async () => pageItems(await teamApi.members(teamId!, params)).map(mapMember),
    enabled: isReady,
  });
}

export function useReviews(status?: string) {
  const { teamId, isReady } = useCurrentTeam();
  return useQuery({
    queryKey: ['reviews', teamId, status ?? 'all'],
    queryFn: async () =>
      pageItems(await reviewApi.queue(teamId!, { status, page: 1, size: 50 })).map(mapReview),
    enabled: isReady,
  });
}

export function useSuites(params: Parameters<typeof suiteApi.list>[1] = {}) {
  const { teamId, isReady } = useCurrentTeam();
  return useQuery({
    queryKey: ['suites', teamId, params],
    queryFn: async () => pageItems(await suiteApi.list(teamId!, params)).map(mapSuite),
    enabled: isReady,
  });
}

export function useInvites() {
  const { teamId, isReady } = useCurrentTeam();
  return useQuery({
    queryKey: ['invites', teamId],
    queryFn: async () => ({
      codes: (await teamApi.invites.codes(teamId!)).map(mapInvite),
      phones: (await teamApi.invites.phones(teamId!)).map(mapPhoneInvite),
    }),
    enabled: isReady,
  });
}

export function useActivity(limit = 20) {
  const { teamId, isReady } = useCurrentTeam();
  return useQuery({
    queryKey: ['activity', teamId, limit],
    queryFn: async () => (await activityApi.feed(teamId!, limit)).map(mapActivity),
    enabled: isReady,
  });
}

export function useMyPhoneInvites() {
  return useQuery({
    queryKey: ['my-phone-invites'],
    queryFn: () => teamApi.invites.myPendingPhones(),
  });
}

export function useUserProfile(handle: string) {
  return useQuery({
    queryKey: ['user', handle],
    queryFn: () => userApi.profile(handle),
    enabled: Boolean(handle),
  });
}
