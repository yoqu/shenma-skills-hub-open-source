import type { CSSProperties, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { TOKENS } from '@/lib/tokens';
import { TopBar, TeamSidebar, type SidebarKey } from '@/components/chrome';
import { SIDEBAR_ROUTES } from '@/router';

export interface MemberShellProps {
  active: SidebarKey;
  children: ReactNode;
  /** Optional override of root style — used by MySubmissions to add `position: relative` for the modal. */
  rootStyle?: CSSProperties;
  rootRef?: React.Ref<HTMLDivElement>;
}

/** Wrapper used by every Member screen: TopBar + Member TeamSidebar + main column. */
export function MemberShell({ active, children, rootStyle, rootRef }: MemberShellProps) {
  const navigate = useNavigate();

  const handleSidebarNavigate = (id: SidebarKey) => {
    const path = SIDEBAR_ROUTES.member[id as keyof typeof SIDEBAR_ROUTES.member];
    if (path) {
      navigate(path);
    }
  };

  return (
    <div
      ref={rootRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        background: TOKENS.bgAlt,
        ...rootStyle,
      }}
    >
      <TopBar active="myteam" authed />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <TeamSidebar active={active} role="Member" onNavigate={handleSidebarNavigate} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
