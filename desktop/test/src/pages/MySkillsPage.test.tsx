import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SkillCardRes, UserSkillItemRes } from '@/api/endpoints';
import type { DesktopSkillView, LocalInstallEntry } from '../../../src/pages/types';
import MySkillsPage, {
  installAllSkillViews,
  localEnabledToastMessage,
  matchesMySkillSearch,
  matchesTeamSkillSearch,
  mySkillCardStatusLabel,
  toDialogSkill,
} from '../../../src/pages/MySkillsPage';

const testState = vi.hoisted(() => ({
  toast: vi.fn(),
  mutationOptions: [] as Array<{ onError?: (error: unknown) => void; onSuccess?: () => void }>,
  localInstalls: [] as LocalInstallEntry[],
  myTeams: [] as Array<{ id: number; name: string }>,
  teamGroups: [] as Array<{ team: { id: number; name: string }; items: SkillCardRes[] }>,
}));

vi.mock('@skillstack/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@skillstack/ui')>();
  return {
    ...actual,
    toast: testState.toast,
  };
});

const cloudSkill = {
  id: 1,
  source: 'PERSONAL',
  skillId: 0,
  reviewId: 0,
  slug: 'demo-skill',
  name: 'Demo Skill',
  shortDesc: 'Demo skill description.',
  catCode: 'dev',
  icon: 'D',
  version: '1.0.0',
  updatedAt: '2026-06-01T12:00:00',
  createdAt: '2026-05-30T08:00:00',
  zipUrl: 'skill-versions/demo.zip',
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
  author: { id: 1, name: 'Alice', handle: 'alice' },
} satisfies UserSkillItemRes;

const publicCloudSkill = {
  ...cloudSkill,
  id: 2,
  source: 'PUBLIC',
  skillId: 20,
  slug: 'public-skill',
  name: 'Public Skill',
  version: '1.0.0',
  publicVersion: '1.2.0',
  publicStatus: 'APPROVED',
  author: { id: 7, name: 'Root Admin', handle: 'root' },
} satisfies UserSkillItemRes;

const localSkill = {
  userSkillId: 1,
  source: 'PERSONAL',
  skillId: 0,
  slug: 'demo-skill',
  name: 'Demo Skill',
  version: '0.9.0',
  agent: 'CLAUDE',
  installPath: '/tmp/demo-skill',
  installedAt: '2026-05-29T00:00:00.000Z',
  updatedAt: '2026-05-29T00:00:00.000Z',
  enabledClaude: true,
  enabledCodex: false,
} satisfies LocalInstallEntry;

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
    if (queryKey[0] === 'desktop-me') {
      return { data: { myTeams: testState.myTeams } };
    }

    if (queryKey[0] === 'desktop-user-skills') {
      return { isLoading: false, isError: false, data: [cloudSkill, publicCloudSkill] };
    }

    if (queryKey[0] === 'desktop-local-skills') {
      return {
        isLoading: false,
        isError: false,
        data: testState.localInstalls.length > 0 ? testState.localInstalls : [localSkill],
        refetch: vi.fn(),
      };
    }

    if (queryKey[0] === 'desktop-my-skills-team-library') {
      return { isLoading: false, isError: false, data: testState.teamGroups };
    }

    return { isLoading: false, isError: false, data: [] };
  },
  useMutation: (options: { onError?: (error: unknown) => void; onSuccess?: () => void } = {}) => {
    testState.mutationOptions.push(options);
    return {
      isPending: false,
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
    };
  },
}));

describe('MySkillsPage', () => {
  beforeEach(() => {
    testState.toast.mockReset();
    testState.mutationOptions = [];
    testState.localInstalls = [];
    testState.myTeams = [];
    testState.teamGroups = [];
  });

  it('renders an explicit update action when an installed skill has a newer cloud version', () => {
    const html = renderToStaticMarkup(<MySkillsPage />);

    expect(html).toContain('可更新');
    expect(html).toContain('aria-label="更新 Demo Skill"');
  });

  it('shows version and author for personal imports and plaza-added skills', () => {
    const html = renderToStaticMarkup(<MySkillsPage />);

    expect(html).toContain('v1.0.0 · Alice');
    expect(html).toContain('v1.2.0 · Root Admin');
    expect(html).not.toContain('v1.0.0 · Alice · 2026-06-01');
  });

  it('uses current My Skills header copy with a three pixel title gap', () => {
    const html = renderToStaticMarkup(<MySkillsPage />);

    expect(html).toContain('管理个人、广场和团队 Skills，团队内容按团队名称分组展示');
    expect(html).toContain('margin-top:3px');
    expect(html).not.toContain('订阅来自广场和团队推荐；个人包含本地导入和我发布的 Skill');
  });

  it('uses disabled wording for local disable success toast', () => {
    expect(localEnabledToastMessage(false, 'Demo Skill')).toBe('已禁用 Demo Skill');
    expect(localEnabledToastMessage(true, 'Demo Skill')).toBe('已启用 Demo Skill');
  });

  it('only shows update and local-only status tags on My Skills cards', () => {
    expect(mySkillCardStatusLabel('可更新')).toBe('可更新');
    expect(mySkillCardStatusLabel('仅本地')).toBe('仅本地');
    expect(mySkillCardStatusLabel('最新')).toBeNull();
    expect(mySkillCardStatusLabel('已禁用')).toBeNull();
  });

  it('uses one success toast for one-click install/update after all targets succeed', async () => {
    const installView = vi.fn(async () => true);
    const notify = {
      success: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
    };

    await installAllSkillViews([
      skillView({ actions: ['update'], statusLabel: '可更新' }),
      skillView({ actions: ['install'], statusLabel: '已禁用' }),
      skillView({ actions: [], statusLabel: '最新' }),
    ], installView, notify);

    expect(installView).toHaveBeenCalledTimes(2);
    expect(installView).toHaveBeenNthCalledWith(1, expect.objectContaining({ statusLabel: '可更新' }), { notify: false, refresh: false });
    expect(installView).toHaveBeenNthCalledWith(2, expect.objectContaining({ statusLabel: '已禁用' }), { notify: false, refresh: false });
    expect(notify.success).toHaveBeenCalledTimes(1);
    expect(notify.success).toHaveBeenCalledWith('所有 Skills 已是最新版本');
    expect(notify.warning).not.toHaveBeenCalled();
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('passes personal skill metadata into the detail dialog', () => {
    const skill = toDialogSkill(cloudSkill);

    expect(skill.version).toBe('1.0.0');
    expect(skill.author?.name).toBe('Alice');
    expect(skill.updated).toBe('2026-06-01');
  });

  it('keeps disabled local skills switched off on My Skills cards', () => {
    testState.localInstalls = [{
      ...localSkill,
      enabledClaude: false,
      enabledCodex: false,
    }];

    const html = renderToStaticMarkup(<MySkillsPage />);

    expect(html).toContain('aria-checked="false"');
    expect(html).toContain('aria-label="启用"');
    expect(html).toContain('class="desktop-skill-toggle desktop-hover-tooltip"');
    expect(html).toContain('data-tooltip="启用"');
    expect(html).not.toContain('未安装');
    expect(html).not.toContain('已添加 · 未启用');
  });

  it('keeps local records without enabled fields switched off until the user enables them', () => {
    testState.localInstalls = [{
      ...localSkill,
      enabledClaude: undefined,
      enabledCodex: undefined,
    } as unknown as LocalInstallEntry];

    const html = renderToStaticMarkup(<MySkillsPage />);

    expect(html).toContain('aria-checked="false"');
    expect(html).toContain('aria-label="启用"');
  });

  it('uses the card border colors for the search input', () => {
    const html = renderToStaticMarkup(<MySkillsPage />);
    const css = readFileSync(new URL('../../../src/styles.css', import.meta.url), 'utf8');

    expect(html).toContain('class="desktop-skill-search-input"');
    expect(html).toContain('placeholder="按名称、描述、标签搜索..."');
    expect(html).toContain('width:360px');
    expect(css).toContain('.desktop-skill-search-input {');
    expect(css).toContain('border-color: #E2E8F0 !important;');
    expect(css).toContain('.desktop-skill-search-input:focus {');
    expect(css).toContain('border-color: #c7d2fe !important;');
    expect(css).toContain('.desktop-skill-search-input::-webkit-search-cancel-button {');
    expect(css).toContain('-webkit-mask-size: 14px 14px;');
    expect(css).toContain('background-color: #334E7D;');
    expect(css).toContain('.desktop-hover-tooltip[data-tooltip]:hover::before');
    expect(css).not.toContain('.desktop-skill-toggle[data-tooltip]:hover::before');
  });

  it('uses the shared desktop confirmation dialog instead of native confirm for deletion', () => {
    const source = readFileSync(new URL('../../../src/pages/MySkillsPage.tsx', import.meta.url), 'utf8');

    expect(source).toContain('ConfirmDialog');
    expect(source).not.toContain('window.confirm');
  });

  it('matches personal skills with the same searchable fields as plaza', () => {
    expect(matchesMySkillSearch(skillView({
      cloud: {
        ...cloudSkill,
        name: 'Visible Name',
        slug: 'visible-slug',
        shortDesc: 'Handles release notes.',
        author: { id: 5, name: 'Dana Author', handle: 'dana' },
      },
    }), 'release')).toBe(true);
    expect(matchesMySkillSearch(skillView({
      cloud: {
        ...cloudSkill,
        name: 'Visible Name',
        slug: 'visible-slug',
        shortDesc: 'Handles release notes.',
        author: { id: 5, name: 'Dana Author', handle: 'dana' },
      },
    }), 'Dana')).toBe(true);
    expect(matchesMySkillSearch(skillView({ cloud: { ...cloudSkill, shortDesc: 'No match here' } }), 'missing')).toBe(false);
  });

  it('matches team recommendation skills with the same searchable fields as plaza', () => {
    const skill = skillCard({
      id: 101,
      slug: 'team-release',
      name: 'Team Release',
      shortDesc: 'Generates changelogs',
      author: { name: 'Team Author' },
      tags: ['automation'],
    });

    expect(matchesTeamSkillSearch(skill, 'changelog')).toBe(true);
    expect(matchesTeamSkillSearch(skill, 'Team Author')).toBe(true);
    expect(matchesTeamSkillSearch(skill, 'automation')).toBe(true);
    expect(matchesTeamSkillSearch(skill, 'missing')).toBe(false);
  });

  it('uses the same empty text for the team skill section', () => {
    const html = renderToStaticMarkup(<MySkillsPage />);

    expect(html).toContain('暂无 Skill');
    expect(html).not.toContain('暂无团队 Skill');
  });

  it('renders each team name as its own section and uses a team tag on team skill cards', () => {
    testState.myTeams = [
      { id: 10, name: '前端平台' },
      { id: 20, name: '后端平台' },
    ];
    testState.teamGroups = [
      {
        team: { id: 10, name: '前端平台' },
        items: [skillCard({ id: 101, slug: 'team-skill-a', name: 'Team Skill A' })],
      },
      {
        team: { id: 20, name: '后端平台' },
        items: [skillCard({ id: 201, slug: 'team-skill-b', name: 'Team Skill B' })],
      },
    ];

    const html = renderToStaticMarkup(<MySkillsPage />);

    expect(html.indexOf('前端平台')).toBeLessThan(html.indexOf('Team Skill A'));
    expect(html.indexOf('后端平台')).toBeLessThan(html.indexOf('Team Skill B'));
    expect(html.indexOf('>团队</span>', html.indexOf('Team Skill A'))).toBeGreaterThan(html.indexOf('Team Skill A'));
    expect(html.indexOf('>团队</span>', html.indexOf('Team Skill B'))).toBeGreaterThan(html.indexOf('Team Skill B'));
  });

  it('shows team install failures in the top-right toast', () => {
    renderToStaticMarkup(<MySkillsPage />);

    teamInstallMutation()?.onError?.(new Error('Team skill install failed.'));

    expect(testState.toast).toHaveBeenCalledWith({
      kind: 'error',
      message: 'Team skill install failed.',
    });
  });

  it('shows team install success in the top-right toast', () => {
    renderToStaticMarkup(<MySkillsPage />);

    teamInstallMutation()?.onSuccess?.();

    expect(testState.toast).toHaveBeenCalledWith({
      kind: 'success',
      message: '已添加并安装团队 Skill',
    });
  });
});

function teamInstallMutation() {
  return testState.mutationOptions.find((options) => options.onError && options.onSuccess);
}

function skillView(overrides: Partial<DesktopSkillView> = {}): DesktopSkillView {
  return {
    cloud: cloudSkill,
    local: localSkill,
    status: 'INSTALLED_UPDATE',
    statusLabel: '可更新',
    description: '',
    actions: ['update'],
    ...overrides,
  };
}

function skillCard(overrides: Partial<SkillCardRes> & { id: number; slug: string; name: string }): SkillCardRes {
  return {
    shortDesc: '',
    version: '1.0.0',
    author: { name: 'Team Author' },
    ...overrides,
  };
}
