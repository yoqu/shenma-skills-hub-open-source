import { describe, expect, it } from 'vitest';
import type { SkillCardRes, UserSkillItemRes } from '@/api/endpoints';
import {
  buildTeamRecommendationParams,
  countUnaddedTeamRecommendations,
  getPrimaryTeamId,
} from '../../../src/pages/recommendations';

describe('desktop team recommendations data source', () => {
  it('uses the first team from the current session as desktop current team fallback', () => {
    expect(getPrimaryTeamId({
      myTeams: [
        { id: 12 },
        { id: 18 },
      ],
    })).toBe(12);
  });

  it('does not select a team when the current session has no teams', () => {
    expect(getPrimaryTeamId({ myTeams: [] })).toBeNull();
    expect(getPrimaryTeamId({})).toBeNull();
  });

  it('queries only published and not-unlisted team skills', () => {
    expect(buildTeamRecommendationParams()).toEqual({
      page: 1,
      size: 50,
      status: 'APPROVED',
    });
  });

  it('counts team recommendations that have not been added to my skills yet', () => {
    expect(countUnaddedTeamRecommendations(
      [
        skill({ id: 1 }),
        skill({ id: 2 }),
      ],
      [],
    )).toBe(2);

    expect(countUnaddedTeamRecommendations(
      [
        skill({ id: 1 }),
        skill({ id: 2 }),
      ],
      [
        userSkill({ skillId: 1 }),
      ],
    )).toBe(1);
  });
});

function skill(overrides: Partial<SkillCardRes>): SkillCardRes {
  return {
    id: 1,
    slug: 'demo',
    name: 'Demo',
    ...overrides,
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
