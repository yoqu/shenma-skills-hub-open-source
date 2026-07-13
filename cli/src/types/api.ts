export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export interface SkillCard {
  id: number;
  slug: string;
  name: string;
  shortDesc?: string;
  version?: string;
  installs?: number;
  stars?: number;
  safety?: string;
  visibility?: string;
  status?: string;
  team?: string;
  tags?: string[];
}

export interface TeamRef {
  id?: number;
  slug?: string;
  name?: string;
}

export interface TeamDetail {
  id: number;
  slug: string;
  name: string;
}

export interface SkillDetail extends Omit<SkillCard, 'team'> {
  catName?: string;
  updated?: string;
  publishedAt?: string;
  team?: TeamRef | string;
}

export interface SkillVersionItem {
  version: string;
  note?: string;
  date?: string;
  installs?: number;
  latest?: boolean;
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
  checks: Array<{ status: 'pass' | 'warn' | 'fail'; name: string; detail: string }>;
  ok: boolean;
}

export interface CreateSkillRes {
  id: number | null;
  slug: string;
  status: string;
  pendingReview: boolean;
  reviewId?: number | null;
}

export interface UploadTextRes {
  zipUrl: string;
  url: string;
}

export interface SkillInSuite {
  id: number;
  slug: string;
  name: string;
  version: string;
  position: number;
  installs?: number;
}

export interface SuiteAssetItem {
  type: 'SKILL' | 'PROMPT';
  id: number;
  slug: string;
  name: string;
  version?: string;
  position: number;
  installs?: number;
  exports?: number;
}

export interface SuiteListItem {
  id: number;
  slug: string;
  name: string;
  desc?: string;
  visibility?: string;
  skills?: number;
  installs?: number;
  updatedAt?: string;
}

export interface SuiteDetail {
  id: number;
  slug: string;
  name: string;
  desc?: string;
  teamId: number;
  teamSlug?: string;
  teamName?: string;
  visibility?: string;
  installs?: number;
  skillsCount?: number;
  items?: SuiteAssetItem[];
  skills: SkillInSuite[];
}

export interface PromptCard {
  id: number;
  slug: string;
  teamSlug?: string;
  name: string;
  shortDesc?: string;
  version?: string;
  exports?: number;
  stars?: number;
  visibility?: string;
  status?: string;
  tags?: string[];
}

export interface PromptDetail extends PromptCard {
  teamName?: string;
  contentMd?: string;
}

export interface LoginUser {
  id: number;
  handle?: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  platformRole?: string;
  status?: string;
  myTeams?: Array<{ id: number; slug?: string; name?: string; role?: string }>;
}

export interface LoginRes {
  token: string;
  user: LoginUser;
}

export interface CliDeviceInitRes {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

export interface CliDevicePollRes {
  status: 'pending' | 'approved';
  token?: string;
  user?: LoginUser;
}

export interface CliWebInfoRes {
  webBaseUrl: string;
  tokenPagePath: string;
  verifyPagePath: string;
}
