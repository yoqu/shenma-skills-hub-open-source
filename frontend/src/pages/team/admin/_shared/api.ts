/**
 * Admin 工作台共享的 API helpers.
 *
 * - `CURRENT_TEAM_ID` / `CURRENT_TEAM_SLUG`: 当前用户默认上下文(zhao_yc · ludou-fe)。
 *   Hardcoded for v1, 未来从 authApi.me() / teamApi.mine() 读取。
 * - `pageItems(res)`: 后端 PageResult 实际使用 `items` 字段,前端 endpoint 类型写的是
 *   `records`。这里做一次兼容性 unwrap, 调用方拿到的永远是 T[]。
 * - `mapSkill` / `mapMember` / `mapInvite` / ...: 后端返回字段命名与 mock 不一致
 *   (shortDesc vs short / description vs desc / actor vs who / role 大小写 等等),
 *   这里把后端 DTO 归一成前端 mock 类型, 让现有的纯展示组件零改动复用。
 *   缺字段时降级为合理默认 (空串 / 0 / 'Member'), 不让组件崩。
 */
import type {
  Activity,
  Invite,
  PhoneInvite,
  Review,
  Skill,
  Suite,
  Team,
  TeamMember,
  TeamRole,
} from '@/mocks';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** 后端 PageResult({items,total,page,size}) 与前端 PageRes({records,...}) 同时兼容。 */
export function pageItems<T>(res: any): T[] {
  if (!res) return [];
  if (Array.isArray(res)) return res as T[];
  if (Array.isArray(res.items)) return res.items as T[];
  if (Array.isArray(res.records)) return res.records as T[];
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

export function normRole(r?: string | null): TeamRole {
  if (!r) return 'Member';
  return ROLE_TITLE[r] ?? 'Member';
}

export function mmdd(s?: string | null): string {
  if (!s) return '';
  // backend 通常返回 YYYY-MM-DD 或 ISO; 前端 .slice(5) 取 MM-DD
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[2]}-${m[3]}` : s.slice(0, 10);
}

export function mapTeam(t: any): Team {
  return {
    slug: t?.slug ?? '',
    name: t?.name ?? '',
    desc: t?.description ?? t?.desc ?? '',
    members: t?.members ?? 0,
    publicSkills: t?.publicSkills ?? 0,
    privateSkills: t?.privateSkills ?? 0,
    suites: t?.suites ?? 0,
    avatar: t?.avatar ?? '',
    color: t?.color ?? '#4F46E5',
  };
}

export function mapSkill(s: any): Skill {
  return {
    slug: s?.slug ?? '',
    name: s?.name ?? '',
    short: s?.short ?? s?.shortDesc ?? '',
    cat: s?.cat ?? s?.catCode ?? '',
    icon: s?.icon ?? (s?.name?.[0]?.toUpperCase() ?? 'S'),
    installs: s?.installs ?? 0,
    stars: s?.stars ?? 0,
    score: typeof s?.score === 'number' ? s.score : Number(s?.score ?? 0),
    version: s?.version ?? '0.0.0',
    updated: s?.updated ?? '',
    visibility: (s?.visibility ?? 'PUBLIC') as Skill['visibility'],
    status: (s?.status ?? 'APPROVED') as Skill['status'],
    author: {
      name: s?.author?.name ?? '',
      handle: s?.author?.handle ?? '',
    },
    team: s?.team ?? '',
    tags: s?.tags ?? [],
    safety: (s?.safety ?? 'pass') as Skill['safety'],
    evalScore: s?.evalScore ?? 0,
    langs: s?.langs ?? [],
  };
}

export function mapMember(m: any): TeamMember {
  const avatarUrl = typeof m?.avatarUrl === 'string' && m.avatarUrl ? m.avatarUrl : undefined;
  return {
    handle: m?.handle ?? '',
    name: m?.name ?? '',
    role: normRole(m?.role),
    joined: m?.joined ?? '',
    skills: m?.skills ?? 0,
    lastActive: m?.lastActive ?? '',
    avatar: m?.avatar ?? (m?.name?.slice(-1) ?? ''),
    avatarUrl,
  };
}

/** 后端可能返回大写 status (ACTIVE/EXHAUSTED/...) 或小写, 统一为 mock 用的小写。 */
function normInviteStatus(s?: string | null): Invite['status'] {
  const v = (s ?? 'active').toLowerCase();
  if (v === 'active' || v === 'exhausted' || v === 'expired' || v === 'revoked') {
    return v;
  }
  return 'active';
}

export function mapInvite(inv: any): Invite & { id?: number } {
  return {
    code: inv?.code ?? '',
    uses: inv?.uses ?? 0,
    max: inv?.max ?? 0,
    expiresIn: inv?.expiresIn ?? '',
    createdBy: inv?.createdBy ?? '',
    createdAt: inv?.createdAt ?? '',
    role: normRole(inv?.role),
    status: normInviteStatus(inv?.status),
    id: inv?.id,
  };
}

function normPhoneStatus(s?: string | null): PhoneInvite['status'] {
  const v = (s ?? 'pending').toLowerCase();
  if (v === 'pending' || v === 'accepted' || v === 'declined') return v;
  return 'pending';
}

export function mapPhoneInvite(p: any): PhoneInvite & { id?: number } {
  return {
    phone: p?.phone ?? '',
    invitedBy: p?.invitedBy ?? '',
    at: p?.at ?? '',
    note: p?.note ?? '',
    status: normPhoneStatus(p?.status),
    id: p?.id,
  };
}

export function mapReview(r: any): Review & {
  rowId?: number;
  skillId?: number | null;
  kind?: string;
  cat?: string;
  icon?: string;
  langs?: string[];
  tags?: string[];
  changelog?: string;
} {
  return {
    id: r?.id ?? String(r?.rowId ?? ''),
    rowId: r?.rowId,
    skillId: r?.skillId ?? null,
    slug: r?.slug ?? '',
    name: r?.name ?? '',
    submittedBy: {
      name: r?.submittedBy?.name ?? '',
      handle: r?.submittedBy?.handle ?? '',
      avatar: r?.submittedBy?.avatar ?? (r?.submittedBy?.name?.slice(-1) ?? ''),
      avatarUrl: typeof r?.submittedBy?.avatarUrl === 'string' && r.submittedBy.avatarUrl
        ? r.submittedBy.avatarUrl
        : undefined,
    },
    submittedAt: r?.submittedAt ?? '',
    visibility: (r?.visibility ?? 'PUBLIC') as Review['visibility'],
    short: r?.short ?? r?.shortDesc ?? '',
    files: r?.files ?? 0,
    version: r?.version ?? '0.0.0',
    safety: (r?.safety ?? 'pass') as Review['safety'],
    evalScore: r?.evalScore ?? 0,
    status: (r?.status ?? 'PENDING_REVIEW') as Review['status'],
    reason: r?.reason,
    kind: r?.kind ?? 'CREATE',
    cat: r?.catCode ?? r?.cat,
    icon: r?.icon,
    langs: parseJsonArray(r?.langsJson),
    tags: parseJsonArray(r?.tagsJson),
    changelog: r?.changelog,
  };
}

function parseJsonArray(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[];
  if (typeof v !== 'string' || !v.trim()) return [];
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function mapSuite(s: any): Suite {
  return {
    id: String(s?.id ?? s?.slug ?? ''),
    name: s?.name ?? '',
    slug: s?.slug ?? '',
    desc: s?.desc ?? s?.description ?? '',
    visibility: (s?.visibility ?? 'TEAM_PRIVATE') as Suite['visibility'],
    skills: s?.skills ?? s?.skillsCount ?? 0,
    installs: s?.installs ?? 0,
    updated: s?.updated ?? mmdd(s?.updatedAt),
  };
}

export function mapActivity(a: any): Activity {
  return {
    who: a?.who ?? a?.actor ?? '',
    what: a?.what ?? '',
    target: a?.target ?? '',
    when: a?.when ?? a?.timeAgo ?? '',
    kind: (a?.kind ?? 'submit') as Activity['kind'],
    extra: a?.extra,
  };
}

/* 后端 review.detail 里 SkillInSuite 字段 shortDesc, 兼容到前端 short。 */
export type SuiteSkillItem = Skill & { id?: number; position?: number };
export function mapSuiteSkill(s: any): SuiteSkillItem {
  const base = mapSkill(s);
  return { ...base, id: s?.id, position: s?.position };
}
