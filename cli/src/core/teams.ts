import type { Api } from './api';
import { userError } from './errors';

export interface MyTeam {
  id: number;
  slug: string;
  name: string;
  role?: string;
  members?: number;
  unread?: number;
  color?: string;
}

/** Fetch the teams the current user belongs to (GET /api/teams/mine). */
export async function fetchMyTeams(api: Api): Promise<MyTeam[]> {
  const list = await api.get<MyTeam[]>('/api/teams/mine');
  return Array.isArray(list) ? list : [];
}

/** Match a team by numeric id or slug (case-insensitive) within a known list. */
export function matchTeam(teams: MyTeam[], ref: string): MyTeam | undefined {
  const trimmed = String(ref).trim();
  const asNum = Number(trimmed);
  if (Number.isInteger(asNum) && asNum > 0) {
    const byId = teams.find(t => t.id === asNum);
    if (byId) return byId;
  }
  const lower = trimmed.toLowerCase();
  return teams.find(t => t.slug?.toLowerCase() === lower);
}

function availableLabel(teams: MyTeam[]): string {
  return teams.length ? teams.map(t => `${t.id} ${t.slug}`).join(', ') : '(none)';
}

/** Resolve a team ref (id or slug) against the caller's teams; throws if not found. */
export async function resolveTeam(api: Api, ref: string): Promise<MyTeam> {
  const teams = await fetchMyTeams(api);
  const found = matchTeam(teams, ref);
  if (found) return found;
  throw userError(`team not found in your teams: "${ref}". use an id or slug: ${availableLabel(teams)}`);
}
