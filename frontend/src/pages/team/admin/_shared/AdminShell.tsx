import type { CSSProperties, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { TOKENS } from '@/lib/tokens';
import { TopBar, TeamSidebar, type SidebarKey } from '@/components/chrome';
import { SIDEBAR_ROUTES } from '@/router';

export interface AdminShellProps {
  active: SidebarKey;
  /** Page-level children (everything to the right of the sidebar, below the TopBar). */
  children: ReactNode;
  rootStyle?: CSSProperties;
  rootRef?: React.Ref<HTMLDivElement>;
}

/** Wrapper used by every Admin screen: TopBar + Admin TeamSidebar + main column. */
export function AdminShell({ active, children, rootStyle, rootRef }: AdminShellProps) {
  const navigate = useNavigate();

  const handleSidebarNavigate = (id: SidebarKey) => {
    const path = SIDEBAR_ROUTES.admin[id as keyof typeof SIDEBAR_ROUTES.admin];
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
        <TeamSidebar active={active} role="Admin" onNavigate={handleSidebarNavigate} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
