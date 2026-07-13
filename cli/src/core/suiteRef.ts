export interface SuiteRef {
  teamId: number;
  slug: string;
}

export function parseSuiteRef(input: string, defaultTeamId: number | undefined): SuiteRef {
  const s = (input ?? '').trim();
  if (!s) throw new Error('suite ref cannot be empty');
  const parts = s.split('/');
  if (parts.length === 1) {
    if (defaultTeamId == null) {
      throw new Error('suite ref missing team; pass <teamId>/<slug> or set defaultTeamId / SMSKILL_TEAM_ID');
    }
    if (!parts[0]) throw new Error('suite slug cannot be empty');
    return { teamId: defaultTeamId, slug: parts[0] };
  }
  if (parts.length !== 2) {
    throw new Error('suite ref format must be <teamId>/<slug>');
  }
  const teamId = Number(parts[0]);
  if (!Number.isInteger(teamId) || teamId <= 0) {
    throw new Error('suite ref teamId must be a positive integer');
  }
  if (!parts[1]) throw new Error('suite slug cannot be empty');
  return { teamId, slug: parts[1] };
}
