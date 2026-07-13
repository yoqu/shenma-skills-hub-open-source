import type { UserSkillItemRes } from '@/api/endpoints';
import type { DesktopSkillView, LocalInstallEntry } from './types';

function isAddedSource(source: string | undefined): boolean {
  return source === 'TEAM' || source === 'PUBLIC';
}

function isUnlisted(cloud: UserSkillItemRes): boolean {
  return Boolean(cloud.publicDeleted)
    || cloud.publicStatus === 'UNLISTED'
    || cloud.publicStatus === 'ARCHIVED'
    || (isAddedSource(cloud.source) && !cloud.publicStatus);
}

function effectiveCloudVersion(cloud: UserSkillItemRes): string {
  if (isAddedSource(cloud.source)) return cloud.publicVersion || cloud.version;
  return cloud.version;
}

export function isLocalEnabled(local: LocalInstallEntry | null | undefined): boolean {
  return Boolean(local?.enabledClaude || local?.enabledCodex);
}

function localByCloud(localInstalls: LocalInstallEntry[]): {
  byCloudId: Map<number, LocalInstallEntry>;
  bySlug: Map<string, LocalInstallEntry>;
} {
  const byCloudId = new Map<number, LocalInstallEntry>();
  const bySlug = new Map<string, LocalInstallEntry>();

  for (const item of localInstalls) {
    if (item.userSkillId > 0) {
      byCloudId.set(item.userSkillId, item);
    }
    bySlug.set(item.slug, item);
  }

  return { byCloudId, bySlug };
}

export function buildDesktopSkillViews(
  cloudItems: UserSkillItemRes[],
  localInstalls: LocalInstallEntry[],
): DesktopSkillView[] {
  const byCloud = localByCloud(localInstalls);
  const cloudIds = new Set(cloudItems.map((item) => item.id));
  const cloudSlugs = new Set(cloudItems.map((item) => item.slug));
  const views: DesktopSkillView[] = [];

  for (const cloud of cloudItems) {
    const local = byCloud.byCloudId.get(cloud.id) || byCloud.bySlug.get(cloud.slug) || null;

    if (!local && isUnlisted(cloud)) {
      continue;
    }

    if (local && isUnlisted(cloud)) {
      const enabled = isLocalEnabled(local);
      views.push({
        cloud,
        local,
        status: enabled ? 'LOCAL_ONLY' : 'INSTALLED_DISABLED',
        statusLabel: enabled ? '仅本地' : '已禁用',
        description: enabled ? '已安装 · 仅本地' : '已禁用 · 可启用',
        actions: enabled ? ['view', 'uninstall'] : ['view', 'install', 'uninstall'],
      });
    } else if (!local) {
      views.push({
        cloud,
        local,
        status: 'INSTALLED_DISABLED',
        statusLabel: '已禁用',
        description: '已禁用 · 可启用',
        actions: ['view', 'install', 'delete'],
      });
    } else if (!isLocalEnabled(local)) {
      views.push({
        cloud,
        local,
        status: 'INSTALLED_DISABLED',
        statusLabel: '已禁用',
        description: '已禁用 · 可启用',
        actions: ['view', 'install', 'delete'],
      });
    } else if (local.version === effectiveCloudVersion(cloud)) {
      views.push({
        cloud,
        local,
        status: 'INSTALLED_LATEST',
        statusLabel: '最新',
        description: '已安装 · 最新',
        actions: ['view', 'delete'],
      });
    } else {
      views.push({
        cloud,
        local,
        status: 'INSTALLED_UPDATE',
        statusLabel: '可更新',
        description: `本地 v${local.version}，云端 v${effectiveCloudVersion(cloud)}`,
        actions: ['view', 'update', 'delete'],
      });
    }
  }

  for (const local of localInstalls) {
    if (cloudIds.has(local.userSkillId) || cloudSlugs.has(local.slug)) continue;
    const enabled = isLocalEnabled(local);
    views.push({
      cloud: null,
      local,
      status: enabled ? 'LOCAL_ONLY' : 'INSTALLED_DISABLED',
      statusLabel: enabled ? '仅本地' : '已禁用',
      description: enabled ? '已安装 · 仅本地' : '已禁用 · 可启用',
      actions: enabled ? ['view', 'uninstall'] : ['view', 'install', 'uninstall'],
    });
  }

  return views;
}
