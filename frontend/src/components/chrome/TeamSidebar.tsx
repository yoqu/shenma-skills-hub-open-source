import type { ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { TOKENS } from '@/lib/tokens';
import {
  Badge,
  TeamAvatar,
} from '@/components/ui';

import { I, type IconProps } from '@/components/icons';
import { useCurrentTeam, useReviews, useTeam, useSession, mapMe } from '@/api/data';
import type { TeamRole } from '@/mocks/team';
import { SIDEBAR_ROUTES } from '@/router';

export type SidebarKey =
  | 'overview'
  | 'skills'
  | 'prompts'
  | 'reviews'
  | 'members'
  | 'invites'
  | 'suites'
  | 'settings'
  | 'mine'
  | 'prefs';

interface SidebarItem {
  id: SidebarKey;
  label: string;
  icon: ComponentType<IconProps>;
  count?: number;
  accent?: boolean;
}

export interface TeamSidebarProps {
  active: SidebarKey;
  collapsed?: boolean;
  role?: TeamRole;
  onNavigate?: (id: SidebarKey) => void;
}

export function TeamSidebar({ active, collapsed, role = 'Admin', onNavigate }: TeamSidebarProps) {
  const navigate = useNavigate();
  const { teamSlug } = useCurrentTeam();
  const { data: session } = useSession();
  const me = session ? mapMe(session) : undefined;
  const isAdmin = role === 'Admin' || role === 'Owner' || me?.platformRole === 'SUPER_ADMIN';
  const { data: team } = useTeam();
  const { data: pendingReviews = [] } = useReviews(isAdmin ? 'PENDING_REVIEW' : undefined);
  const skillCount = (team?.publicSkills ?? 0) + (team?.privateSkills ?? 0);

  const homeSlug = teamSlug || team?.slug;
  const goHome = () => {
    if (homeSlug) navigate(`/teams/${homeSlug}`);
  };

  const handleNavigate = (id: SidebarKey) => {
    if (onNavigate) {
      onNavigate(id);
    } else {
      // Default navigation if no callback provided
      const routes = isAdmin ? SIDEBAR_ROUTES.admin : SIDEBAR_ROUTES.member;
      const path = routes[id as keyof typeof routes];
      if (path) {
        navigate(path);
      }
    }
  };
  const adminItems: SidebarItem[] = [
    { id: 'overview', label: '工作台', icon: I.grid },
    { id: 'skills', label: 'Skill 库', icon: I.cube, count: skillCount },
    { id: 'prompts', label: 'Prompt 库', icon: I.code },
    { id: 'reviews', label: '审核队列', icon: I.inbox, count: pendingReviews.length, accent: true },
    { id: 'mine', label: '我的提交', icon: I.upload },
    { id: 'members', label: '成员', icon: I.users, count: team?.members ?? 0 },
    { id: 'invites', label: '邀请', icon: I.send },
    { id: 'suites', label: '套件', icon: I.layers, count: team?.suites ?? 0 },
    { id: 'settings', label: '团队设置', icon: I.cog },
    { id: 'prefs', label: '我的偏好', icon: I.bell },
  ];
  const memberItems: SidebarItem[] = [
    { id: 'overview', label: '工作台', icon: I.grid },
    { id: 'skills', label: 'Skill 库', icon: I.cube, count: skillCount },
    { id: 'prompts', label: 'Prompt 库', icon: I.code },
    { id: 'mine', label: '我的提交', icon: I.upload },
    { id: 'members', label: '团队成员', icon: I.users, count: team?.members ?? 0 },
    { id: 'suites', label: '套件', icon: I.layers, count: team?.suites ?? 0 },
    { id: 'prefs', label: '我的偏好', icon: I.cog },
  ];
  const items = isAdmin ? adminItems : memberItems;
  const subtitle = isAdmin ? '管理工作台' : '成员工作台';

  return (
    <aside
      style={{
        width: collapsed ? 60 : 232,
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
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: `1px solid ${TOKENS.borderSoft}`,
          marginBottom: 8,
        }}
      >
        <TeamAvatar
          name={team?.name}
          avatar={team?.avatar}
          logoUrl={team?.logoUrl}
          color={team?.color}
          size={32}
          radius={8}
        />
        {!collapsed && (
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: TOKENS.text, lineHeight: 1.2 }}>
              {team?.name ?? '团队'}
            </div>
            <div
              style={{
                fontSize: 11,
                color: TOKENS.text3,
                marginTop: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              {subtitle}
              <span
                style={{
                  fontSize: 9.5,
                  padding: '0 5px',
                  height: 14,
                  lineHeight: '14px',
                  borderRadius: 3,
                  fontWeight: 600,
                  letterSpacing: 0.2,
                  background: isAdmin ? TOKENS.primarySoft : '#F1F5F9',
                  color: isAdmin ? TOKENS.primaryDeep : TOKENS.text2,
                }}
              >
                {role.toUpperCase()}
              </span>
            </div>
          </div>
        )}
      </div>

      {homeSlug && (
        <button
          type="button"
          onClick={goHome}
          title="进入团队主页"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: collapsed ? '7px 0' : '7px 10px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            borderRadius: 6,
            cursor: 'pointer',
            border: `1px dashed ${TOKENS.border}`,
            background: 'transparent',
            color: TOKENS.text2,
            fontSize: 12.5,
            fontWeight: 500,
            marginBottom: 8,
          }}
        >
          <I.globe size={14} />
          {!collapsed && (
            <>
              <span style={{ flex: 1, textAlign: 'left' }}>团队主页</span>
              <span style={{ fontSize: 10.5, color: TOKENS.text3 }}>访客视角</span>
            </>
          )}
        </button>
      )}

      {items.map((it) => {
        const Ico = it.icon;
        const isActive = active === it.id;
        return (
          <div
            key={it.id}
            onClick={() => handleNavigate(it.id)}
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
            {!collapsed && (
              <>
                <span style={{ flex: 1 }}>{it.label}</span>
                {it.count !== undefined && (
                  <Badge
                    tone={it.accent ? 'primary' : 'neutral'}
                    size="sm"
                    style={{ padding: '1px 6px', fontSize: 10 }}
                  >
                    {it.count}
                  </Badge>
                )}
              </>
            )}
          </div>
        );
      })}

    </aside>
  );
}
