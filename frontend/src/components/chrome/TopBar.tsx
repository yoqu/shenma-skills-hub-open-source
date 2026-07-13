import { useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TOKENS } from '@/lib/tokens';
import { useBrandingStore } from '@/store/branding';
import { Avatar, Badge, Button, TeamAvatar } from '@/components/ui';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { I } from '@/components/icons';
import { NotificationPopover } from '@/components/notifications/NotificationPopover';
import { getToken, setToken } from '@/api/client';
import { useMyTeams } from '@/api/data';
import { notificationApi } from '@/api/endpoints';
import { useCurrentTeam } from '@/hooks/useCurrentTeam';

export type TopBarNav = 'home' | 'plaza' | 'myteam' | 'docs';

export interface TopBarProps {
  active?: TopBarNav;
  authed?: boolean;
  onNav?: (id: TopBarNav) => void;
}

const NAV: { id: TopBarNav; label: string }[] = [
  { id: 'home', label: '首页' },
  { id: 'plaza', label: 'Skills 广场' },
  { id: 'myteam', label: '我的团队' },
  { id: 'docs', label: '文档' },
];

const NAV_PATH: Record<TopBarNav, string> = {
  home: '/',
  plaza: '/plaza',
  myteam: '/team',
  docs: '/docs/cli-install',
};

export function TopBar({
  active = 'home',
  authed = false,
  onNav,
}: TopBarProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: teams, me } = useMyTeams(authed);
  const brandName = useBrandingStore((s) => s.name);
  const { teamSlug, setCurrentTeamId, isReady } = useCurrentTeam(authed);
  const currentTeam = teams.find((t) => t.slug === teamSlug);
  const [open, setOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const { data: unreadResp } = useQuery({
    queryKey: ['notif-unread'],
    queryFn: () => notificationApi.unreadCount(),
    enabled: authed,
    refetchInterval: authed ? 60_000 : false,
    refetchOnWindowFocus: authed,
  });
  const unread = unreadResp?.unread ?? 0;

  function handleLogout() {
    setToken(null);
    queryClient.clear();
    navigate('/');
  }

  const menuItemStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 10px',
    borderRadius: 7,
    cursor: 'pointer',
    fontSize: 13,
    color: TOKENS.text,
    fontFamily: 'inherit',
  };

  function handleNav(id: TopBarNav) {
    if (onNav) onNav(id);
    else navigate(NAV_PATH[id]);
  }

  function handleSwitchTeam(teamId: string) {
    setCurrentTeamId(teamId);
    navigate('/team');
    setOpen(false);
  }

  return (
    <header
      className="topbar"
      style={{
        height: 60,
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        gap: 32,
        borderBottom: `1px solid ${TOKENS.border}`,
        background: '#fff',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <div
        className="topbar-brand"
        onClick={() => navigate('/')}
        style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
      >
        <BrandLogo iconSize={36} labelSize={16} />
        <Badge tone="primary" size="sm" style={{ marginLeft: 4 }}>
          Team
        </Badge>
      </div>

      <nav className="topbar-nav" style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
        {NAV.filter((it) => authed || it.id !== 'myteam').map((it) => (
          <Button variant="ghost"
            key={it.id}
            type="button"
            onClick={() => handleNav(it.id)}
            style={{
              padding: '7px 12px',
              fontSize: 13.5,
              fontWeight: 500,
              color: active === it.id ? TOKENS.text : TOKENS.text2,
              background: active === it.id ? TOKENS.bgGray : 'transparent',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {it.label}
          </Button>
        ))}
      </nav>

      <div
        className="topbar-actions"
        style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}
      >
        {authed && currentTeam && (
          <div style={{ position: 'relative' }}>
            <Button variant="ghost"
              type="button"
              onClick={() => {
                setOpen((o) => !o);
                setPublishOpen(false);
                setUserOpen(false);
                setNotifOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                height: 36,
                padding: '0 8px 0 6px',
                background: open ? TOKENS.bgGray : TOKENS.bgAlt,
                border: `1px solid ${TOKENS.borderSoft}`,
                borderRadius: 8,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <TeamAvatar
                name={currentTeam.name}
                avatar={currentTeam.avatar}
                logoUrl={currentTeam.logoUrl}
                color={currentTeam.color}
                size={24}
                radius={6}
              />
              <div style={{ textAlign: 'left', lineHeight: 1.1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: TOKENS.text }}>{currentTeam.name}</div>
                <div style={{ fontSize: 10.5, color: TOKENS.text3, marginTop: 2 }}>
                  {currentTeam.role} · {currentTeam.members} 人
                </div>
              </div>
              <I.chevR size={12} style={{ color: TOKENS.text3, transform: 'rotate(90deg)', marginLeft: 2 }} />
            </Button>
            {open && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  width: 280,
                  background: '#fff',
                  border: `1px solid ${TOKENS.border}`,
                  borderRadius: 10,
                  boxShadow: '0 10px 30px rgba(15,23,42,.10)',
                  padding: 6,
                  zIndex: 20,
                }}
              >
                <div style={{ padding: '6px 10px 4px', fontSize: 11, color: TOKENS.text3 }}>
                  切换团队 · 全局生效
                </div>
                {teams.map((tm) => {
                  const isCur = tm.id === currentTeam.id || tm.slug === currentTeam.slug;
                  return (
                    <div
                      key={tm.id}
                      onClick={() => handleSwitchTeam(tm.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 10px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        background: isCur ? TOKENS.primarySoft : 'transparent',
                      }}
                    >
                      <TeamAvatar
                        name={tm.name}
                        avatar={tm.avatar}
                        logoUrl={tm.logoUrl}
                        color={tm.color}
                        size={28}
                        radius={6}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 12.5,
                            fontWeight: 600,
                            color: TOKENS.text,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          {tm.name}
                          {tm.unread > 0 && (
                            <span
                              style={{
                                fontSize: 10,
                                background: TOKENS.danger,
                                color: '#fff',
                                padding: '0 5px',
                                borderRadius: 999,
                                fontWeight: 600,
                              }}
                            >
                              {tm.unread}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: TOKENS.text3, marginTop: 1 }}>
                          {tm.role} · {tm.members} 人
                        </div>
                      </div>
                      {isCur && <I.check size={14} style={{ color: TOKENS.primary }} />}
                    </div>
                  );
                })}
                <div style={{ borderTop: `1px solid ${TOKENS.borderSoft}`, marginTop: 6, paddingTop: 6 }}>
                  <div
                    onClick={() => {
                      setOpen(false);
                      navigate('/team/create');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      color: TOKENS.text2,
                      fontSize: 12.5,
                    }}
                  >
                    <I.plus size={13} /> 创建新团队
                  </div>
                  <div
                    onClick={() => {
                      setOpen(false);
                      navigate('/team/join');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      color: TOKENS.text2,
                      fontSize: 12.5,
                    }}
                  >
                    <I.send size={13} /> 输入邀请码加入
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {authed ? (
          <>
            <div style={{ position: 'relative' }}>
              <Button
                variant="ghost"
                size="sm"
                icon={<I.plus size={14} />}
                onClick={() => {
                  setPublishOpen((o) => !o);
                  setOpen(false);
                  setUserOpen(false);
                  setNotifOpen(false);
                }}
              >
                发布
              </Button>
              {publishOpen && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 19 }}
                    onClick={() => setPublishOpen(false)}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      right: 0,
                      width: 180,
                      background: '#fff',
                      border: `1px solid ${TOKENS.border}`,
                      borderRadius: 10,
                      boxShadow: '0 10px 30px rgba(15,23,42,.10)',
                      padding: 6,
                      zIndex: 20,
                    }}
                  >
                    <div
                      onClick={() => {
                        setPublishOpen(false);
                        navigate('/create/skill');
                      }}
                      style={menuItemStyle}
                    >
                      <I.plus size={13} style={{ color: TOKENS.text3 }} />
                      发布 Skill
                    </div>
                    <div
                      onClick={() => {
                        setPublishOpen(false);
                        navigate('/create/prompt');
                      }}
                      style={menuItemStyle}
                    >
                      <I.code size={13} style={{ color: TOKENS.text3 }} />
                      发布 Prompt
                    </div>
                    <div
                      onClick={() => {
                        setPublishOpen(false);
                        navigate('/create/suite');
                      }}
                      style={menuItemStyle}
                    >
                      <I.layers size={13} style={{ color: TOKENS.text3 }} />
                      发布套件
                    </div>
                  </div>
                </>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <Button variant="ghost"
                type="button"
                onClick={() => {
                  setNotifOpen((o) => !o);
                  setOpen(false);
                  setPublishOpen(false);
                  setUserOpen(false);
                }}
                aria-label="通知"
                style={{
                  position: 'relative',
                  display: 'grid',
                  placeItems: 'center',
                  width: 32,
                  height: 32,
                  background: notifOpen ? TOKENS.bgGray : 'transparent',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  color: TOKENS.text2,
                }}
              >
                <I.bell size={18} />
                {unread > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      minWidth: 16,
                      height: 16,
                      padding: '0 4px',
                      borderRadius: 999,
                      background: TOKENS.primary,
                      color: '#fff',
                      fontSize: 10,
                      lineHeight: '16px',
                      textAlign: 'center',
                      fontWeight: 600,
                    }}
                  >
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </Button>
              {notifOpen && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 19 }}
                    onClick={() => setNotifOpen(false)}
                  />
                  <NotificationPopover unread={unread} onClose={() => setNotifOpen(false)} />
                </>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <Button variant="ghost"
                type="button"
                onClick={() => {
                  setUserOpen((o) => !o);
                  setOpen(false);
                  setPublishOpen(false);
                  setNotifOpen(false);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Avatar
                  name={me?.name || brandName}
                  char={me?.avatar || me?.name?.slice(0, 1) || '神'}
                  url={me?.avatarUrl}
                  size={28}
                  color={TOKENS.primary}
                />
              </Button>
              {userOpen && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 19 }}
                    onClick={() => setUserOpen(false)}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      right: 0,
                      width: 200,
                      background: '#fff',
                      border: `1px solid ${TOKENS.border}`,
                      borderRadius: 10,
                      boxShadow: '0 10px 30px rgba(15,23,42,.10)',
                      padding: 6,
                      zIndex: 20,
                    }}
                  >
                    {/* User info header */}
                    <div style={{ padding: '8px 10px 8px', borderBottom: `1px solid ${TOKENS.borderSoft}`, marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: TOKENS.text }}>{me?.name || brandName}</div>
                      {me?.handle && (
                        <div style={{ fontSize: 11.5, color: TOKENS.text3, marginTop: 2 }}>@{me.handle}</div>
                      )}
                    </div>

                    {/* 个人资料 */}
                    <div
                      onClick={() => { setUserOpen(false); navigate('/profile'); }}
                      style={menuItemStyle}
                    >
                      <I.user size={13} style={{ color: TOKENS.text3 }} />
                      个人资料
                    </div>

                    {/* 平台管理（仅超级管理员可见） */}
                    {me?.platformRole === 'SUPER_ADMIN' && (
                      <div
                        onClick={() => { setUserOpen(false); navigate('/admin'); }}
                        style={menuItemStyle}
                      >
                        <I.shield size={13} style={{ color: TOKENS.primary }} />
                        平台管理
                      </div>
                    )}

                    {/* 加入团队（仅无团队时显示） */}
                    {teams.length === 0 && (
                      <div
                        onClick={() => { setUserOpen(false); navigate('/team'); }}
                        style={menuItemStyle}
                      >
                        <I.users size={13} style={{ color: TOKENS.text3 }} />
                        加入团队
                      </div>
                    )}

                    <div style={{ borderTop: `1px solid ${TOKENS.borderSoft}`, marginTop: 4, paddingTop: 4 }} />

                    {/* 退出登录 */}
                    <div
                      onClick={() => { setUserOpen(false); handleLogout(); }}
                      style={{ ...menuItemStyle, color: '#EF4444' }}
                    >
                      <I.signOut size={13} style={{ color: '#EF4444' }} />
                      退出登录
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <>
            <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
              登录
            </Button>
            <Button variant="primary" size="sm" onClick={() => navigate('/register')}>
              注册
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
