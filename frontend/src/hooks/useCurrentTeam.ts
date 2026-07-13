import { useEffect } from 'react';
import { useMyTeams } from '@/api/data';
import { useCurrentTeamStore } from '@/store/currentTeam';
import type { MyTeam } from '@/mocks/team';

/**
 * Hook to manage and access the current team context.
 *
 * - 当前团队 ID 存放在全局 zustand store 中（`useCurrentTeamStore`），
 *   所有调用方共享同一份 state，任意位置切换团队都会即时生效。
 * - 初始值在 store 创建时从 localStorage 读取；`setCurrentTeamId` 会同步写回。
 * - 如果存储的 teamId 已不在用户的团队列表里，自动回退到第一支团队。
 * - 用户没有任何团队时返回 `isReady=true` 但 `role=undefined`，
 *   方便上层渲染 NoTeamPage 而非空白页。
 *
 * @param authed - Whether the user is authenticated (controls query)
 */
export function useCurrentTeam(authed: boolean = false) {
  const { data: teams, isFetched } = useMyTeams(authed);
  const currentTeamId = useCurrentTeamStore((s) => s.currentTeamId);
  const setCurrentTeamId = useCurrentTeamStore((s) => s.setCurrentTeamId);

  // Auto-recover from missing or stale teamId.
  useEffect(() => {
    if (!teams) return;
    if (teams.length === 0) return;
    const matches = teams.some((t) => t.id === currentTeamId || t.slug === currentTeamId);
    if (matches) return;
    const fallbackId = teams[0].id;
    if (fallbackId === currentTeamId) return;
    setCurrentTeamId(fallbackId);
  }, [teams, currentTeamId, setCurrentTeamId]);

  const currentTeam: MyTeam | undefined = (teams || []).find(
    (t) => t.id === currentTeamId || t.slug === currentTeamId
  );

  const hasNoTeams = isFetched && Array.isArray(teams) && teams.length === 0;
  const isReady = hasNoTeams || currentTeam !== undefined;
  const teamSlug = currentTeam?.slug || '';

  return {
    teamId: currentTeam?.id || '',
    teamSlug,
    role: currentTeam?.role,
    setCurrentTeamId,
    isReady,
    hasNoTeams,
  };
}
