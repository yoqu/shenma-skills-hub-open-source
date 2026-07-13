import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TOKENS } from '@/lib/tokens';
import { getToken } from '@/api/client';
import { authApi } from '@/api/endpoints';
import { Avatar } from '@/components/ui';
import { TopBar } from '@/components/chrome';
import { I } from '@/components/icons';

const TOP_BAR_HEIGHT = 60;

const NAV_ITEMS = [
  { icon: I.user, label: '基础资料', to: '/profile/basic' },
  { icon: I.shield, label: '安全设置', to: '/profile/security' },
  { icon: I.terminal, label: 'CLI Token', to: '/profile/cli-token' },
] as const;

export default function SettingsLayout() {
  const nav = useNavigate();
  const token = getToken();

  useEffect(() => {
    if (!token) nav('/login', { replace: true });
  }, [nav, token]);

  const meQuery = useQuery({
    queryKey: ['session', 'profile'],
    queryFn: () => authApi.me(),
    enabled: !!token,
  });
  const me = meQuery.data as Record<string, any> | undefined;

  if (!token) return null;

  const avatarChar = me?.avatar || (me?.name ? String(me.name).slice(0, 1) : '?');

  return (
    <div style={{ minHeight: '100vh', background: TOKENS.bgAlt }}>
      <TopBar active="home" authed />

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          minHeight: `calc(100vh - ${TOP_BAR_HEIGHT}px)`,
        }}
      >
        {/* Left sidebar */}
        <aside
          style={{
            width: 220,
            flexShrink: 0,
            background: '#fff',
            borderRight: `1px solid ${TOKENS.border}`,
            padding: '20px 16px',
            overflowY: 'auto',
          }}
        >
          {/* User info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <Avatar
              name={me?.name || 'U'}
              char={avatarChar}
              url={me?.avatarUrl}
              size={36}
              color={TOKENS.primary}
            />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: TOKENS.text,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {me?.name || '加载中…'}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: TOKENS.text3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                @{me?.handle || ''}
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav>
            {NAV_ITEMS.map(({ icon: Icon, label, to }) => (
              <NavLink
                key={to}
                to={to}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 14,
                  cursor: 'pointer',
                  textDecoration: 'none',
                  marginBottom: 2,
                  background: isActive ? TOKENS.primarySoft : 'transparent',
                  color: isActive ? TOKENS.primary : TOKENS.text2,
                  fontWeight: isActive ? 600 : 400,
                })}
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Right content area */}
        <main
          style={{
            flex: 1,
            background: TOKENS.bgAlt,
            overflowY: 'auto',
            padding: 32,
          }}
        >
          <div style={{ maxWidth: 680, width: '100%' }}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
