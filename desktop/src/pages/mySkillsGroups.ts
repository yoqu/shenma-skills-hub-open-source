import type { DesktopSkillView } from './types';
import type { UserSkillItemRes } from '@/api/endpoints';

export interface TeamSkillGroupLike {
  items: Array<{ id?: number | string | null }>;
}

export function selectPersonalSkillViews(views: DesktopSkillView[]): DesktopSkillView[] {
  return views.filter((view) => {
    const source = view.cloud?.source || view.local?.source;
    return source === 'PERSONAL' || source === 'PUBLIC';
  });
}

export function countVisibleMySkills(personal: DesktopSkillView[], teamGroups: TeamSkillGroupLike[]): number {
  return personal.length + teamGroups.reduce((sum, group) => sum + group.items.length, 0);
}

export function selectMySkillsFilterCounts(views: DesktopSkillView[], teamGroups: TeamSkillGroupLike[]) {
  const personal = selectPersonalSkillViews(views);
  return {
    all: countVisibleMySkills(personal, teamGroups),
    enabled: views.filter(isMySkillEnabled).length,
    updates: views.filter((view) => view.actions.includes('update')).length,
  };
}

export function selectFilteredTeamSkillGroups<TGroup extends TeamSkillGroupLike>(
  filter: 'all' | 'enabled' | 'updates',
  teamGroups: TGroup[],
  subscribedBySkillId: Map<number, DesktopSkillView>,
): TGroup[] {
  if (filter === 'all') return teamGroups;

  return teamGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((skill) => {
        const skillId = Number(skill.id);
        const view = Number.isFinite(skillId) ? subscribedBySkillId.get(skillId) ?? null : null;
        if (filter === 'updates') {
          return Boolean(view?.actions.includes('update'));
        }
        return Boolean(view && isMySkillEnabled(view));
      }),
    }))
    .filter((group) => group.items.length > 0);
}

export async function subscribeAndInstallTeamSkill(
  skillId: number,
  deps: {
    subscribe: (skillId: number) => Promise<UserSkillItemRes>;
    install: (cloud: UserSkillItemRes) => Promise<void>;
    remove: (userSkillId: number) => Promise<unknown>;
    uninstall: (slug: string, userSkillId?: number) => Promise<unknown>;
    invalidate: (queryKey: string[]) => Promise<unknown>;
  },
) {
  const cloud = await deps.subscribe(skillId);
  await deps.invalidate(['desktop-user-skills']);
  try {
    await deps.install(cloud);
    await deps.invalidate(['desktop-local-skills']);
  } catch (error) {
    await deps.uninstall(cloud.slug, cloud.id).catch(() => undefined);
    await deps.remove(cloud.id);
    await deps.invalidate(['desktop-user-skills']);
    await deps.invalidate(['desktop-local-skills']);
    throw error;
  }
}

function isMySkillEnabled(view: DesktopSkillView): boolean {
  return Boolean(view.local?.enabledClaude || view.local?.enabledCodex);
}
