import { http } from './client';

export interface PageRes<T> {
  items: T[];
  records?: T[];
  total: number;
  page: number;
  size: number;
}

export interface SkillCardRes {
  id?: number | string | null;
  slug: string;
  name: string;
  short?: string;
  shortDesc?: string;
  cat?: string;
  icon?: string;
  iconUrl?: string | null;
  version?: string;
  installs?: number;
  stars?: number;
  score?: number | string | null;
  updated?: string | null;
  visibility?: string;
  tags?: string[];
  author?: {
    id?: number | string | null;
    name?: string | null;
    handle?: string | null;
  };
}

export interface SkillDetailRes extends SkillCardRes {
  shortDesc?: string;
  descriptionMd?: string | null;
  catName?: string | null;
  status?: string | null;
  safety?: 'pass' | 'warn' | 'fail' | string | null;
  evalScore?: number | null;
  publishedAt?: string | null;
  langs?: string[] | null;
  filesCount?: number | null;
  license?: string | null;
  team?: {
    id?: number | string | null;
    slug?: string | null;
    name?: string | null;
  } | null;
}

export interface SkillMdContentRes {
  path: string | null;
  content: string;
  size: number;
  truncated?: boolean | null;
}

export interface TeamSkillQuery {
  status?: string;
  visibility?: string;
  cat?: string;
  authorId?: number;
  updatedWithin?: number;
  q?: string;
  page?: number;
  size?: number;
}

export interface SkillParseCheck {
  status: 'pass' | 'warn' | 'fail';
  name: string;
  detail: string;
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

export interface CliDeviceInitRes {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

export interface CliDevicePollRes {
  status: 'pending' | 'approved' | 'denied' | 'expired';
  token?: string;
}

export const authApi = {
  me: () => http.get<unknown, any>('/me'),
  cliDeviceInit: () => http.post<unknown, CliDeviceInitRes>('/auth/cli/device-init', {}),
  cliDevicePoll: (deviceCode: string) =>
    http.post<unknown, CliDevicePollRes>('/auth/cli/device-poll', { deviceCode }),
};

export const skillApi = {
  plaza: (q: { page?: number; size?: number; q?: string } = {}) =>
    http.get<unknown, PageRes<SkillCardRes>>('/skills', { params: q }),
  detail: (slug: string) =>
    http.get<unknown, SkillDetailRes>(`/skills/${encodeURIComponent(slug)}`),
  skillMd: (slug: string, version: string) =>
    http.get<unknown, SkillMdContentRes>(
      `/skills/${encodeURIComponent(slug)}/versions/${encodeURIComponent(version)}/skill-md`,
    ),
  teamSkills: (teamId: number, q: TeamSkillQuery = {}) =>
    http.get<unknown, PageRes<SkillCardRes>>(`/teams/${teamId}/skills`, { params: q }),
  uploadVersionZip: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return http.post<unknown, { zipUrl: string; url: string }>('/skills/versions/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: [(data) => data],
    });
  },
  uploadVersionMd: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return http.post<unknown, { zipUrl: string; url: string }>('/skills/versions/upload-md', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: [(data) => data],
    });
  },
  parseVersionZip: (zipUrl: string) =>
    http.post<unknown, SkillParseResult>('/skills/versions/parse', { zipUrl }),
};

export type UserSkillSource = 'PERSONAL' | 'TEAM' | 'PUBLIC';

export interface UserSkillItemRes {
  id: number;
  source: UserSkillSource;
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
  author?: {
    id?: number | string | null;
    name?: string | null;
    handle?: string | null;
  } | null;
  createdAt?: string | null;
  updatedAt?: string | null;
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
