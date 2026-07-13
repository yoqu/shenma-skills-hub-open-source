import { Navigate } from 'react-router-dom';
import type { ReactElement } from 'react';
import { useCurrentTeam } from '@/hooks/useCurrentTeam';
import { getToken } from '@/api/client';
import { useSession, mapMe } from '@/api/data';
import NoTeamPage from '@/pages/team/NoTeamPage';
import AdminDashboard from '@/pages/team/admin/Dashboard';
import AdminSkills from '@/pages/team/admin/Skills';
import AdminPrompts from '@/pages/team/admin/Prompts';
import AdminMembers from '@/pages/team/admin/Members';
import AdminSuites from '@/pages/team/admin/Suites';
import AdminPrefs from '@/pages/team/admin/Prefs';
import MemberDashboard from '@/pages/team/member/Dashboard';
import MemberSkills from '@/pages/team/member/Skills';
import MemberPrompts from '@/pages/team/member/Prompts';
import MemberMembers from '@/pages/team/member/Members';
import MemberSuites from '@/pages/team/member/Suites';
import MemberPrefs from '@/pages/team/member/Prefs';

function roleIsWriter(role?: string) {
  return role === 'Admin' || role === 'Owner';
}

/**
 * Common entry guard for any team-scoped route.
 *  - Unauthenticated users go to /login.
 *  - Authenticated users without a team see the NoTeamPage (no blank screen).
 *  - SUPER_ADMIN 始终被视为 writer。
 */
function TeamRouteGate({
  render,
  requireWriter = false,
}: {
  render: (role: string, isWriter: boolean) => ReactElement;
  requireWriter?: boolean;
}) {
  if (!getToken()) return <Navigate to="/login" replace />;
  const { role, isReady, hasNoTeams } = useCurrentTeam(true);
  const { data: session } = useSession();
  const me = session ? mapMe(session) : undefined;
  const isSuperAdmin = me?.platformRole === 'SUPER_ADMIN';
  if (!isReady) return null;
  if (hasNoTeams || !role) return <NoTeamPage />;
  const writer = isSuperAdmin || roleIsWriter(role);
  if (requireWriter && !writer) return <Navigate to="/team" replace />;
  return render(role, writer);
}

export function TeamDashboardRoute() {
  return (
    <TeamRouteGate render={(_role, writer) => (writer ? <AdminDashboard /> : <MemberDashboard />)} />
  );
}

export function TeamSkillsRoute() {
  return (
    <TeamRouteGate render={(_role, writer) => (writer ? <AdminSkills /> : <MemberSkills />)} />
  );
}

export function TeamPromptsRoute() {
  return (
    <TeamRouteGate render={(_role, writer) => (writer ? <AdminPrompts /> : <MemberPrompts />)} />
  );
}

export function TeamMembersRoute() {
  return (
    <TeamRouteGate render={(_role, writer) => (writer ? <AdminMembers /> : <MemberMembers />)} />
  );
}

export function TeamSuitesRoute() {
  return (
    <TeamRouteGate render={(_role, writer) => (writer ? <AdminSuites /> : <MemberSuites />)} />
  );
}

export function TeamPrefsRoute() {
  return (
    <TeamRouteGate render={(_role, writer) => (writer ? <AdminPrefs /> : <MemberPrefs />)} />
  );
}

/** Admin-only route guard (TEAM-CTX-005). */
export function RequireWriter({ children }: { children: ReactElement }) {
  return <TeamRouteGate requireWriter render={() => children} />;
}

/** Generic logged-in-with-team guard. */
export function RequireTeam({ children }: { children: ReactElement }) {
  return <TeamRouteGate render={() => children} />;
}
