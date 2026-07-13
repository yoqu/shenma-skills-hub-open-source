import { describe, expect, it } from 'vitest';
import type { UserSkillItemRes } from '@/api/endpoints';
import type { DesktopSkillView } from '../../../src/pages/types';
import {
  countVisibleMySkills,
  selectFilteredTeamSkillGroups,
  selectMySkillsFilterCounts,
  selectPersonalSkillViews,
  subscribeAndInstallTeamSkill,
} from '../../../src/pages/mySkillsGroups';

describe('selectPersonalSkillViews', () => {
  it('keeps local personal imports and plaza-added subscribed skills in personal section', () => {
    const personal = view('PERSONAL', 'local-import');
    const subscribed = view('PUBLIC', 'plaza-added');
    const team = view('TEAM', 'team-added');

    expect(selectPersonalSkillViews([personal, subscribed, team]).map((item) => item.cloud?.slug))
      .toEqual(['local-import', 'plaza-added']);
  });

  it('counts all visible personal and team skills for the all filter', () => {
    const personal = [
      view('PERSONAL', 'local-import'),
      view('PUBLIC', 'plaza-added-a'),
      view('PUBLIC', 'plaza-added-b'),
    ];
    const teamGroups = [
      { items: [userSkill({ id: 11, skillId: 11, slug: 'team-recommendation' })] },
    ];

    expect(countVisibleMySkills(personal, teamGroups)).toBe(4);
  });

  it('keeps all count based on every visible skill when another filter is selected', () => {
    const views = [
      view('PERSONAL', 'local-import', ['view', 'delete'], true),
      view('PUBLIC', 'plaza-added-a', ['view', 'delete'], true),
      view('PUBLIC', 'plaza-added-b', ['view', 'update', 'delete']),
      view('PUBLIC', 'plaza-added-c', ['view', 'install', 'delete']),
    ];
    const teamGroups = [
      { items: [userSkill({ id: 11, skillId: 11, slug: 'team-recommendation' })] },
    ];

    expect(selectMySkillsFilterCounts(views, teamGroups)).toEqual({
      all: 5,
      enabled: 2,
      updates: 1,
    });
  });

  it('filters team skills with the same selected filter', () => {
    const latest = view('TEAM', 'team-latest', ['view', 'delete'], true);
    const update = view('TEAM', 'team-update', ['view', 'update', 'delete'], true);
    const subscribedNotInstalled = view('TEAM', 'team-not-installed', ['view', 'install', 'delete']);
    const subscribedBySkillId = new Map<number, DesktopSkillView>([
      [1, latest],
      [2, update],
      [3, subscribedNotInstalled],
    ]);
    const groups = [
      {
        team: { id: 1, name: 'A' },
        items: [
          skillCard({ id: 1, slug: 'team-latest' }),
          skillCard({ id: 2, slug: 'team-update' }),
          skillCard({ id: 3, slug: 'team-not-installed' }),
          skillCard({ id: 4, slug: 'team-unsubscribed' }),
        ],
      },
    ];

    expect(selectFilteredTeamSkillGroups('updates', groups, subscribedBySkillId)[0].items.map((item) => item.slug))
      .toEqual(['team-update']);
    expect(selectFilteredTeamSkillGroups('enabled', groups, subscribedBySkillId)[0].items.map((item) => item.slug))
      .toEqual(['team-latest', 'team-update']);
  });

  it('subscribes and installs a team skill into local skills', async () => {
    const cloud = userSkill({ skillId: 10 });
    const calls: string[] = [];

    await subscribeAndInstallTeamSkill(10, {
      subscribe: async (skillId) => {
        calls.push(`subscribe:${skillId}`);
        return cloud;
      },
      install: async (item) => {
        calls.push(`install:${item.skillId}`);
      },
      remove: async (id) => {
        calls.push(`remove:${id}`);
      },
      uninstall: async (slug, id) => {
        calls.push(`uninstall:${slug}:${id}`);
      },
      invalidate: async (queryKey) => {
        calls.push(`invalidate:${queryKey.join('/')}`);
      },
    });

    expect(calls).toEqual([
      'subscribe:10',
      'invalidate:desktop-user-skills',
      'install:10',
      'invalidate:desktop-local-skills',
    ]);
  });

  it('rolls back subscribed cloud data when local install fails', async () => {
    const cloud = userSkill({ id: 20, skillId: 10, slug: 'team-skill' });
    const calls: string[] = [];

    await expect(subscribeAndInstallTeamSkill(10, {
      subscribe: async (skillId) => {
        calls.push(`subscribe:${skillId}`);
        return cloud;
      },
      install: async (item) => {
        calls.push(`install:${item.skillId}`);
        throw new Error('local install failed');
      },
      remove: async (id) => {
        calls.push(`remove:${id}`);
      },
      uninstall: async (slug, id) => {
        calls.push(`uninstall:${slug}:${id}`);
      },
      invalidate: async (queryKey) => {
        calls.push(`invalidate:${queryKey.join('/')}`);
      },
    })).rejects.toThrow('local install failed');

    expect(calls).toEqual([
      'subscribe:10',
      'invalidate:desktop-user-skills',
      'install:10',
      'uninstall:team-skill:20',
      'remove:20',
      'invalidate:desktop-user-skills',
      'invalidate:desktop-local-skills',
    ]);
  });
});

function view(
  source: 'PERSONAL' | 'TEAM' | 'PUBLIC',
  slug: string,
  actions: DesktopSkillView['actions'] = ['view', 'install', 'delete'],
  enabled = false,
): DesktopSkillView {
  return {
    cloud: {
      id: source === 'PERSONAL' ? 1 : 2,
      source,
      skillId: source === 'PERSONAL' ? 0 : 10,
      reviewId: 0,
      slug,
      name: slug,
      shortDesc: '',
      catCode: '',
      icon: '',
      version: '1.0.0',
      zipUrl: '',
      filesCount: 0,
      safety: 'pass',
      evalScore: 0,
      langs: '[]',
    },
    local: enabled
      ? {
        userSkillId: source === 'PERSONAL' ? 1 : 2,
        source,
        skillId: source === 'PERSONAL' ? undefined : 10,
        slug,
        name: slug,
        version: '1.0.0',
        installPath: `/tmp/${slug}`,
        updatedAt: '2026-06-01T00:00:00.000Z',
        enabledClaude: true,
        enabledCodex: false,
      }
      : null,
    status: enabled ? 'INSTALLED_LATEST' : 'NOT_INSTALLED',
    statusLabel: enabled ? '最新' : '未安装',
    description: enabled ? '已安装 · 最新' : '未安装 · 可安装',
    actions,
  };
}

function userSkill(overrides: Partial<UserSkillItemRes>): UserSkillItemRes {
  return {
    id: 1,
    source: 'PUBLIC',
    skillId: 1,
    reviewId: 0,
    slug: 'demo',
    name: 'Demo',
    shortDesc: '',
    catCode: '',
    icon: '',
    version: '1.0.0',
    zipUrl: '',
    filesCount: 0,
    safety: 'pass',
    evalScore: 0,
    langs: '[]',
    ...overrides,
  };
}

function skillCard(overrides: { id: number; slug: string }) {
  return {
    id: overrides.id,
    slug: overrides.slug,
    name: overrides.slug,
  };
}
