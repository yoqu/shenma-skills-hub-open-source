import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Compass,
  Info,
  LogOut,
  Package,
  Settings,
} from 'lucide-react';
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Avatar, ConfirmDialog, Pressable, TOKENS } from '@skillstack/ui';
import { authApi } from '@/api/endpoints';
import { getToken, setToken, subscribeSession } from '@/api/client';

const navItems = [
  { to: '/', label: '我的 Skills', end: true, icon: Package },
  { to: '/plaza', label: 'Skills 广场', icon: Compass },
];

type DraggableRegionStyle = React.CSSProperties & {
  WebkitAppRegion: 'drag';
};

export default function DesktopLayout() {
  const navigate = useNavigate();
  const [token, setTokenState] = useState(() => getToken());
  const [accountOpen, setAccountOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement | null>(null);
  const me = useQuery({ queryKey: ['desktop-me'], queryFn: authApi.me, enabled: Boolean(token) });

  useEffect(() => {
    return subscribeSession((nextToken) => {
      setTokenState(nextToken);
      if (!nextToken) {
        navigate('/login', { replace: true });
      }
    });
  }, [navigate]);

  useEffect(() => {
    if (token) {
      void window.skillstackDesktop?.setWindowMode('app');
    }
  }, [token]);

  useEffect(() => {
    if (!accountOpen) {
      return;
    }

    function closeOnOutsidePointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && accountRef.current?.contains(target)) {
        return;
      }
      setAccountOpen(false);
    }

    document.addEventListener('pointerdown', closeOnOutsidePointerDown);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointerDown);
  }, [accountOpen]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const avatarChar = me.data?.avatar || (me.data?.name ? String(me.data.name).slice(0, 1) : '?');

  async function logout() {
    setAccountOpen(false);
    setLogoutConfirmOpen(false);
    await window.skillstackDesktop?.setWindowMode('login');
    setToken(null);
    setTokenState(null);
    navigate('/login', { replace: true });
  }

  function requestLogout() {
    setAccountOpen(false);
    setLogoutConfirmOpen(true);
  }

  function openSettings() {
    setAccountOpen(false);
    navigate('/settings');
  }

  return (
    <div style={shellStyle}>
      <div style={appDragRegionStyle} />
      <aside style={sidebarStyle}>
        <div style={brandStyle}>SkillStack</div>
        <nav style={navStyle}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                ...navLinkStyle,
                color: isActive ? TOKENS.primary : TOKENS.text2,
                background: isActive ? TOKENS.primarySoft : 'transparent',
                fontWeight: isActive ? 750 : 600,
              })}
            >
              <item.icon size={16} strokeWidth={2.1} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div ref={accountRef} style={accountWrapStyle}>
          {accountOpen && (
            <div style={accountMenuStyle}>
              <div style={accountMenuListStyle}>
                <Pressable style={menuButtonStyle} onClick={openSettings}>
                  <Settings size={16} strokeWidth={2} />
                  <span style={menuButtonLabelStyle}>设置</span>
                </Pressable>
                <Pressable style={menuButtonStyle}>
                  <Info size={16} strokeWidth={2} />
                  <span style={menuButtonLabelStyle}>关于</span>
                </Pressable>
                <Pressable
                  style={{
                    ...menuButtonStyle,
                    color: TOKENS.danger,
                  }}
                  onClick={requestLogout}
                >
                  <LogOut size={16} strokeWidth={2} />
                  <span style={menuButtonLabelStyle}>退出登录</span>
                </Pressable>
              </div>
            </div>
          )}
          <Pressable
            onClick={() => setAccountOpen((value) => !value)}
            style={accountButtonStyle}
          >
            <Avatar
              name={me.data?.name || 'U'}
              char={avatarChar}
              url={me.data?.avatarUrl}
              size={36}
              color={TOKENS.primary}
            />
            <div style={accountTextStyle}>
              <div style={accountNameStyle}>{me.data?.name || '加载中…'}</div>
              <div style={accountHandleStyle}>@{me.data?.handle || ''}</div>
            </div>
            <div style={accountChevronStyle} aria-hidden="true">
              {accountOpen ? <ChevronDown size={16} strokeWidth={1.4} /> : <ChevronUp size={16} strokeWidth={1.4} />}
            </div>
          </Pressable>
        </div>
      </aside>

      <main style={mainStyle}>
        <Outlet />
      </main>

      <ConfirmDialog
        open={logoutConfirmOpen}
        danger
        title="退出登录"
        description="确定要退出登录吗？"
        confirmLabel="退出登录"
        confirmAriaLabel="确认退出登录"
        onCancel={() => setLogoutConfirmOpen(false)}
        onConfirm={() => void logout()}
      />
    </div>
  );
}

const shellStyle: React.CSSProperties = {
  height: '100vh',
  display: 'grid',
  gridTemplateColumns: '232px minmax(0, 1fr)',
  background: TOKENS.bgAlt,
  position: 'relative',
  overflow: 'hidden',
};

const appDragRegionStyle: DraggableRegionStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  height: 56,
  WebkitAppRegion: 'drag',
  zIndex: 10,
};

const sidebarStyle: React.CSSProperties = {
  background: TOKENS.bgGray,
  padding: '56px 16px 16px',
  display: 'flex',
  flexDirection: 'column',
  borderRight: `1px solid ${TOKENS.border}`,
};

const brandStyle: React.CSSProperties = {
  fontSize: 24,
  lineHeight: 1,
  fontWeight: 850,
  color: TOKENS.text,
  margin: '0 0 36px 0',
};

const navStyle: React.CSSProperties = {
  display: 'grid',
  gap: 10,
  fontSize: 13,
};

const navLinkStyle: React.CSSProperties = {
  textDecoration: 'none',
  padding: '11px 14px',
  borderRadius: 10,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
};

const accountWrapStyle: React.CSSProperties = {
  marginTop: 'auto',
  position: 'relative',
};

const accountMenuStyle: React.CSSProperties = {
  position: 'absolute',
  left: -6,
  bottom: 58,
  width: 218,
  borderRadius: 18,
  background: TOKENS.bg,
  border: `1px solid ${TOKENS.border}`,
  boxShadow: '0 18px 42px rgba(15, 23, 42, .14), 0 4px 12px rgba(15, 23, 42, .08)',
  padding: 8,
  overflow: 'hidden',
};

const menuButtonStyle: React.CSSProperties = {
  width: '100%',
  border: 0,
  background: 'transparent',
  padding: '10px 12px',
  color: TOKENS.text,
  fontWeight: 650,
  textAlign: 'left',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  borderRadius: 10,
  fontSize: 14,
  lineHeight: '20px',
  cursor: 'pointer',
};

const accountMenuListStyle: React.CSSProperties = {
  display: 'grid',
  gap: 4,
};

const menuButtonLabelStyle: React.CSSProperties = {
  flex: 1,
};

const accountButtonStyle: React.CSSProperties = {
  width: '100%',
  border: 0,
  background: 'transparent',
  padding: '10px 10px 2px 16px',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  textAlign: 'left',
};

const accountNameStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 750,
  color: TOKENS.text,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const accountTextStyle: React.CSSProperties = {
  minWidth: 0,
};

const accountHandleStyle: React.CSSProperties = {
  fontSize: 12,
  color: TOKENS.text3,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const accountChevronStyle: React.CSSProperties = {
  marginLeft: 'auto',
  color: TOKENS.text3,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
};

const mainStyle: React.CSSProperties = {
  minWidth: 0,
  padding: '56px 0 44px 38px',
  minHeight: 0,
  overflow: 'hidden',
};
