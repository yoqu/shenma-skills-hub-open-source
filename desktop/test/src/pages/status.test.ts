import { describe, expect, it } from 'vitest';
import type { UserSkillItemRes } from '@/api/endpoints';
import type { LocalInstallEntry } from '../../../src/pages/types';
import { buildDesktopSkillViews } from '../../../src/pages/status';

function cloud(overrides: Partial<UserSkillItemRes>): UserSkillItemRes {
  return {
    id: 1,
    source: 'PERSONAL',
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
    source: 'PERSONAL',
    skillId: 0,
    slug: 'demo',
    name: 'Demo',
    version: '0.9.0',
    agent: 'CLAUDE',
    installPath: '/tmp/demo',
    installedAt: '2026-05-29T00:00:00.000Z',
    updatedAt: '2026-05-29T00:00:00.000Z',
    enabledClaude: true,
    enabledCodex: false,
    ...overrides,
  };
}

describe('buildDesktopSkillViews', () => {
  it('个人云端有记录但本地未启用时显示已禁用', () => {
    const [view] = buildDesktopSkillViews([cloud({ source: 'PERSONAL' })], []);
    expect(view.status).toBe('INSTALLED_DISABLED');
    expect(view.statusLabel).toBe('已禁用');
    expect(view.description).toBe('已禁用 · 可启用');
    expect(view.actions).toEqual(['view', 'install', 'delete']);
  });

  it('个人已安装最新', () => {
    const [view] = buildDesktopSkillViews([cloud({ source: 'PERSONAL' })], [local({ source: 'PERSONAL' })]);
    expect(view.status).toBe('INSTALLED_LATEST');
    expect(view.statusLabel).toBe('最新');
    expect(view.description).toBe('已安装 · 最新');
    expect(view.actions).toEqual(['view', 'delete']);
  });

  it('真实本地扫描没有云端关系 id 时按 slug 匹配', () => {
    const [view] = buildDesktopSkillViews(
      [cloud({ id: 10, source: 'PERSONAL', slug: 'demo', version: '0.9.0' })],
      [local({ userSkillId: 0, source: 'PERSONAL', slug: 'demo', version: '0.9.0' })],
    );

    expect(view.status).toBe('INSTALLED_LATEST');
    expect(view.local?.slug).toBe('demo');
  });

  it('本地记录缺少 enabled 字段时按未启用处理', () => {
    const legacyLocal = {
      ...local({ source: 'PERSONAL', slug: 'legacy-enabled', version: '1.0.0' }),
      enabledClaude: undefined,
      enabledCodex: undefined,
    } as unknown as LocalInstallEntry;

    const [view] = buildDesktopSkillViews(
      [cloud({ id: 22, source: 'PERSONAL', slug: 'legacy-enabled', version: '1.0.0' })],
      [legacyLocal],
    );

    expect(view.status).toBe('INSTALLED_DISABLED');
    expect(view.statusLabel).toBe('已禁用');
  });


  it('个人已安装云端有更新', () => {
    const [view] = buildDesktopSkillViews(
      [cloud({ source: 'PERSONAL', version: '0.9.0' })],
      [local({ source: 'PERSONAL', version: '0.8.0' })],
    );
    expect(view.status).toBe('INSTALLED_UPDATE');
    expect(view.statusLabel).toBe('可更新');
    expect(view.description).toBe('本地 v0.8.0，云端 v0.9.0');
    expect(view.actions).toEqual(['view', 'update', 'delete']);
  });

  it('个人云端已删除本地保留', () => {
    const [view] = buildDesktopSkillViews([], [local({ source: 'PERSONAL' })]);
    expect(view.status).toBe('LOCAL_ONLY');
    expect(view.statusLabel).toBe('仅本地');
    expect(view.description).toBe('已安装 · 仅本地');
    expect(view.actions).toEqual(['view', 'uninstall']);
  });

  it('订阅已安装最新', () => {
    const [view] = buildDesktopSkillViews(
      [cloud({ source: 'PUBLIC', skillId: 10, publicVersion: '0.9.0', publicStatus: 'APPROVED' })],
      [local({ source: 'PUBLIC', skillId: 10, version: '0.9.0' })],
    );
    expect(view.status).toBe('INSTALLED_LATEST');
    expect(view.statusLabel).toBe('最新');
    expect(view.description).toBe('已安装 · 最新');
  });

  it('订阅云端有记录但本地未启用时显示已禁用', () => {
    const [view] = buildDesktopSkillViews(
      [cloud({ source: 'PUBLIC', skillId: 10, publicVersion: '0.9.0', publicStatus: 'APPROVED' })],
      [],
    );
    expect(view.status).toBe('INSTALLED_DISABLED');
    expect(view.statusLabel).toBe('已禁用');
    expect(view.description).toBe('已禁用 · 可启用');
  });

  it('订阅已添加但本地禁用时不显示为可安装或已安装', () => {
    const [view] = buildDesktopSkillViews(
      [cloud({ id: 20, source: 'PUBLIC', skillId: 200, slug: 'disabled-public', publicVersion: '1.0.0', publicStatus: 'APPROVED' })],
      [local({
        userSkillId: 20,
        source: 'PUBLIC',
        skillId: 200,
        slug: 'disabled-public',
        version: '1.0.0',
        enabledClaude: false,
        enabledCodex: false,
      })],
    );

    expect(view.status).toBe('INSTALLED_DISABLED');
    expect(view.statusLabel).toBe('已禁用');
    expect(view.description).toBe('已禁用 · 可启用');
    expect(view.actions).toEqual(['view', 'install', 'delete']);
  });

  it('个人已添加但本地禁用时不显示为最新', () => {
    const [view] = buildDesktopSkillViews(
      [cloud({ id: 21, source: 'PERSONAL', slug: 'disabled-personal', version: '1.0.0' })],
      [local({
        userSkillId: 21,
        source: 'PERSONAL',
        slug: 'disabled-personal',
        version: '1.0.0',
        enabledClaude: false,
        enabledCodex: false,
      })],
    );

    expect(view.status).toBe('INSTALLED_DISABLED');
    expect(view.statusLabel).toBe('已禁用');
    expect(view.actions).toEqual(['view', 'install', 'delete']);
  });

  it('订阅已安装可更新', () => {
    const [view] = buildDesktopSkillViews(
      [cloud({ source: 'PUBLIC', skillId: 10, publicVersion: '0.9.0', publicStatus: 'APPROVED' })],
      [local({ source: 'PUBLIC', skillId: 10, version: '0.8.0' })],
    );
    expect(view.status).toBe('INSTALLED_UPDATE');
    expect(view.description).toContain('本地 v0.8.0，云端 v0.9.0');
  });

  it('订阅云端不可用时按仅本地展示本地保留项', () => {
    const [view] = buildDesktopSkillViews(
      [cloud({ source: 'PUBLIC', skillId: 10, publicVersion: '0.9.0', publicStatus: 'UNLISTED' })],
      [local({ source: 'PUBLIC', skillId: 10, version: '0.9.0' })],
    );
    expect(view.status).toBe('LOCAL_ONLY');
    expect(view.statusLabel).toBe('仅本地');
    expect(view.description).toBe('已安装 · 仅本地');
    expect(view.actions).toEqual(['view', 'uninstall']);
  });

  it('订阅云端不可用且本地禁用时展示已禁用', () => {
    const [view] = buildDesktopSkillViews(
      [cloud({ source: 'PUBLIC', skillId: 10, publicVersion: '0.9.0', publicStatus: 'UNLISTED' })],
      [local({
        source: 'PUBLIC',
        skillId: 10,
        version: '0.9.0',
        enabledClaude: false,
        enabledCodex: false,
      })],
    );
    expect(view.status).toBe('INSTALLED_DISABLED');
    expect(view.statusLabel).toBe('已禁用');
    expect(view.description).toBe('已禁用 · 可启用');
  });

  it('订阅云端不可用且未安装时不展示不可安装项', () => {
    const views = buildDesktopSkillViews(
      [cloud({ source: 'PUBLIC', skillId: 10, publicVersion: '0.9.0', publicStatus: 'UNLISTED' })],
      [],
    );
    expect(views).toEqual([]);
  });
});
