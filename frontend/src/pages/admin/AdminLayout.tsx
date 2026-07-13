import type { ReactNode } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { TOKENS } from '@/lib/tokens';
import { TopBar } from '@/components/chrome';
import { I, type IconProps } from '@/components/icons';
import { useMyTeams } from '@/api/data';
import type { ComponentType } from 'react';

type AdminNavKey = 'overview' | 'settings' | 'users' | 'teams' | 'skills' | 'suites' | 'oauth';

interface AdminNavItem {
  key: AdminNavKey;
  label: string;
  path: string;
  icon: ComponentType<IconProps>;
}

const NAV: AdminNavItem[] = [
  { key: 'overview', label: '概览', path: '/admin', icon: I.grid },
  { key: 'settings', label: '站点设置', path: '/admin/settings', icon: I.cog },
  { key: 'oauth', label: '登录方式', path: '/admin/oauth', icon: I.lock },
  { key: 'users', label: '用户', path: '/admin/users', icon: I.users },
  { key: 'teams', label: '团队', path: '/admin/teams', icon: I.layers },
  { key: 'skills', label: 'Skill', path: '/admin/skills', icon: I.cube },
  { key: 'suites', label: '套件', path: '/admin/suites', icon: I.inbox },
];

interface RequireSuperAdminProps {
  children: ReactNode;
}

/** Route guard: only `me.platformRole === 'SUPER_ADMIN'` may render children. */
export function RequireSuperAdmin({ children }: RequireSuperAdminProps) {
  const { me, isLoading, isError } = useMyTeams(true);
  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: TOKENS.text3 }}>
        加载中…
      </div>
    );
  }
  if (isError || !me) return <Navigate to="/login?next=/admin" replace />;
  if (me.platformRole !== 'SUPER_ADMIN') return <Navigate to="/team" replace />;
  return <>{children}</>;
}

interface AdminLayoutProps {
  active: AdminNavKey;
  title?: string;
  children: ReactNode;
}

/**
 * Wrapper for every `/admin/**` page: TopBar + left sidebar + main column.
 *
 * Visual shell mirrors `team/admin/_shared/AdminShell` so super-admins see a
 * familiar layout, but the sidebar items target the cross-tenant `/admin/*`
 * routes (not team-scoped ones).
 */
export function AdminLayout({ active, children }: AdminLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        background: TOKENS.bgAlt,
      }}
    >
      <TopBar authed />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <aside
          style={{
            width: 232,
            flex: '0 0 auto',
            borderRight: `1px solid ${TOKENS.border}`,
            background: TOKENS.bgAlt,
            padding: '20px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div
            style={{
              padding: '8px 10px 16px',
              borderBottom: `1px solid ${TOKENS.borderSoft}`,
              marginBottom: 8,
            }}
          >
            <div style={{ fontSize: 11, color: TOKENS.text3, letterSpacing: 0.5 }}>
              控制台
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: TOKENS.text,
                marginTop: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <I.shield size={15} style={{ color: TOKENS.primary }} />
              平台管理
            </div>
          </div>
          {NAV.map((it) => {
            const Ico = it.icon;
            const isActive = active === it.key;
            return (
              <div
                key={it.key}
                onClick={() => navigate(it.path)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '7px 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: isActive ? '#fff' : 'transparent',
                  border: isActive ? `1px solid ${TOKENS.borderSoft}` : '1px solid transparent',
                  color: isActive ? TOKENS.text : TOKENS.text2,
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                  boxShadow: isActive ? '0 1px 2px rgba(15,23,42,.04)' : 'none',
                }}
              >
                <Ico size={15} />
                <span style={{ flex: 1 }}>{it.label}</span>
              </div>
            );
          })}
          <div style={{ marginTop: 'auto', padding: '12px 4px', fontSize: 11, color: TOKENS.text3 }}>
            {location.pathname}
          </div>
        </aside>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
