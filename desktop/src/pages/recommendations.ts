import type { SkillCardRes, UserSkillItemRes } from '@/api/endpoints';

interface TeamRef {
  id?: number | string | null;
}

interface SessionWithTeams {
  myTeams?: TeamRef[] | null;
}

export function getPrimaryTeamId(session: SessionWithTeams | null | undefined): number | null {
  const firstTeam = session?.myTeams?.[0];
  const id = Number(firstTeam?.id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function buildTeamRecommendationParams() {
  return {
    page: 1,
    size: 50,
    status: 'APPROVED',
  };
}

export function countUnaddedTeamRecommendations(
  recommendations: SkillCardRes[],
  userSkills: UserSkillItemRes[],
): number {
  const subscribedSkillIds = new Set(
    userSkills
      .filter((item) => (item.source === 'TEAM' || item.source === 'PUBLIC') && item.skillId > 0)
      .map((item) => item.skillId),
  );

  return recommendations.filter((item) => {
    const skillId = Number(item.id);
    return Number.isFinite(skillId) && skillId > 0 && !subscribedSkillIds.has(skillId);
  }).length;
}
