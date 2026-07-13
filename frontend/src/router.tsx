import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Placeholder } from '@/pages/Placeholder';
import { TOKENS } from '@/lib/tokens';

// Public
import Home from '@/pages/public/Home';
import Plaza from '@/pages/public/Plaza';
import SkillDetail from '@/pages/public/SkillDetail';
import PromptDetail from '@/pages/public/PromptDetail';
import TeamPublic from '@/pages/public/TeamPublic';
import UserProfile from '@/pages/public/UserProfile';
import CliInstallDocs from '@/pages/docs/CliInstall';

// Auth
import Login from '@/pages/auth/Login';
import Register from '@/pages/auth/Register';
import AuthCallback from '@/pages/auth/AuthCallback';
import CliAuth from '@/pages/auth/CliAuth';

// Account settings
import SettingsLayout from '@/pages/account/settings/SettingsLayout';
import BasicProfile from '@/pages/account/settings/BasicProfile';
import Security from '@/pages/account/settings/Security';
import CliToken from '@/pages/account/settings/CliToken';

// Team — role-aware shared routes
import {
  TeamDashboardRoute,
  TeamSkillsRoute,
  TeamPromptsRoute,
  TeamMembersRoute,
  TeamSuitesRoute,
  TeamPrefsRoute,
  RequireWriter,
  RequireTeam,
} from '@/pages/team/RoleAware';

// Admin-only
import AdminReviews from '@/pages/team/admin/Reviews';
import AdminInvites from '@/pages/team/admin/Invites';
import AdminSettings from '@/pages/team/admin/Settings';

// Member-only
import MemberMySubmissions from '@/pages/team/member/MySubmissions';

// Create
import CreateSkill from '@/pages/create/CreateSkill';
import CreateSuite from '@/pages/create/CreateSuite';
import CreateTeamPage from '@/pages/team/CreateTeamPage';
import JoinTeamPage from '@/pages/team/JoinTeamPage';
import Notifications from '@/pages/team/Notifications';

// Platform Super Admin
import { RequireSuperAdmin } from '@/pages/admin/AdminLayout';
import AdminDashboard from '@/pages/admin/Dashboard';
import AdminSettingsPage from '@/pages/admin/Settings';
import AdminUsersPage from '@/pages/admin/Users';
import AdminTeamsPage from '@/pages/admin/Teams';
import AdminTeamDetailPage from '@/pages/admin/TeamDetail';
import AdminSkillsPage from '@/pages/admin/Skills';
import AdminSuitesPage from '@/pages/admin/Suites';
import AdminOAuthPage from '@/pages/admin/OAuth';

const CreatePrompt = lazy(() => import('@/pages/create/CreatePrompt'));

/** Sidebar route mappings for admin and member roles. */
export const SIDEBAR_ROUTES = {
  admin: {
    overview: '/team',
    skills: '/team/skills',
    prompts: '/team/prompts',
    reviews: '/team/reviews',
    mine: '/team/mine',
    members: '/team/members',
    invites: '/team/invites',
    suites: '/team/suites',
    settings: '/team/settings',
    prefs: '/team/prefs',
  },
  member: {
    overview: '/team',
    skills: '/team/skills',
    prompts: '/team/prompts',
    mine: '/team/mine',
    members: '/team/members',
    suites: '/team/suites',
    prefs: '/team/prefs',
  },
} as const;

export const router = createBrowserRouter([
  // Public
  { path: '/', element: <Home /> },
  { path: '/plaza', element: <Plaza /> },
  { path: '/skills/:slug', element: <SkillDetail /> },
  { path: '/prompts/:teamSlug/:promptSlug', element: <PromptDetail /> },
  { path: '/teams/:slug', element: <TeamPublic /> },
  { path: '/u/:handle', element: <UserProfile /> },

  // Docs
  { path: '/docs/cli-install', element: <CliInstallDocs /> },

  // Auth
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  { path: '/auth/callback', element: <AuthCallback /> },
  { path: '/auth/feishu/callback', element: <AuthCallback fixedProvider="feishu" /> },
  { path: '/auth/oauth/:provider/callback', element: <AuthCallback /> },
  { path: '/cli-auth', element: <CliAuth /> },

  // Account settings (nested)
  {
    path: '/profile',
    element: <SettingsLayout />,
    children: [
      { index: true, element: <Navigate to="basic" replace /> },
      { path: 'basic', element: <BasicProfile /> },
      { path: 'security', element: <Security /> },
      { path: 'cli-token', element: <CliToken /> },
    ],
  },

  // Team workspace — role-aware
  { path: '/team', element: <TeamDashboardRoute /> },
  { path: '/team/skills', element: <TeamSkillsRoute /> },
  { path: '/team/prompts', element: <TeamPromptsRoute /> },
  { path: '/team/members', element: <TeamMembersRoute /> },
  { path: '/team/suites', element: <TeamSuitesRoute /> },

  // Admin-only (writer guard)
  { path: '/team/reviews', element: <RequireWriter><AdminReviews /></RequireWriter> },
  { path: '/team/invites', element: <RequireWriter><AdminInvites /></RequireWriter> },
  { path: '/team/settings', element: <RequireWriter><AdminSettings /></RequireWriter> },

  // Member-only (any team member)
  { path: '/team/mine', element: <RequireTeam><MemberMySubmissions /></RequireTeam> },
  { path: '/team/notifications', element: <RequireTeam><Notifications /></RequireTeam> },

  // Role-aware: 我的偏好 (admin sees admin shell w/o leave-team tab)
  { path: '/team/prefs', element: <TeamPrefsRoute /> },

  // Create (any team member)
  { path: '/create/skill', element: <RequireTeam><CreateSkill /></RequireTeam> },
  { path: '/create/prompt', element: <RequireTeam><LazyPage><CreatePrompt /></LazyPage></RequireTeam> },
  { path: '/team/prompts/:promptId/edit', element: <RequireWriter><LazyPage><CreatePrompt /></LazyPage></RequireWriter> },
  { path: '/team/prompts/:promptId/new-version', element: <RequireTeam><LazyPage><CreatePrompt /></LazyPage></RequireTeam> },
  { path: '/team/prompts/rework/:reviewId', element: <RequireTeam><LazyPage><CreatePrompt /></LazyPage></RequireTeam> },
  { path: '/create/suite', element: <RequireTeam><CreateSuite /></RequireTeam> },

  // Team creation (any authenticated user, no team required)
  { path: '/team/create', element: <CreateTeamPage /> },
  { path: '/team/join', element: <JoinTeamPage /> },

  // Platform Super Admin (guarded; non-super-admins redirect to /team)
  { path: '/admin', element: <RequireSuperAdmin><AdminDashboard /></RequireSuperAdmin> },
  { path: '/admin/settings', element: <RequireSuperAdmin><AdminSettingsPage /></RequireSuperAdmin> },
  { path: '/admin/users', element: <RequireSuperAdmin><AdminUsersPage /></RequireSuperAdmin> },
  { path: '/admin/teams', element: <RequireSuperAdmin><AdminTeamsPage /></RequireSuperAdmin> },
  { path: '/admin/teams/:id', element: <RequireSuperAdmin><AdminTeamDetailPage /></RequireSuperAdmin> },
  { path: '/admin/skills', element: <RequireSuperAdmin><AdminSkillsPage /></RequireSuperAdmin> },
  { path: '/admin/suites', element: <RequireSuperAdmin><AdminSuitesPage /></RequireSuperAdmin> },
  { path: '/admin/oauth', element: <RequireSuperAdmin><AdminOAuthPage /></RequireSuperAdmin> },

  // Fallback
  { path: '*', element: <Placeholder name="404 · 页面不存在" hint="检查 URL,或回到首页 /" /> },
]);

function LazyPage({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: TOKENS.text3 }}>
          加载中...
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
