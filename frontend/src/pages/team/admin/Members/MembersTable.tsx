import { TOKENS } from '@/lib/tokens';
import { Avatar, Badge, Button, Checkbox, EmptyState, type BadgeTone } from '@/components/ui';
import { I } from '@/components/icons';
import type { TeamMember, TeamRole } from '@/mocks/team';

const ROLE_TONE: Record<TeamRole, BadgeTone> = {
  Owner: 'primary',
  Admin: 'info',
  Member: 'neutral',
  Viewer: 'neutral',
};

const COLS = '32px 2fr 110px 1fr 100px 120px 100px';

export interface MembersTableProps {
  list: TeamMember[];
  editing: TeamMember | null;
  setEditing: (m: TeamMember | null) => void;
  meHandle?: string;
}

export function MembersTable({ list, editing, setEditing, meHandle }: MembersTableProps) {
  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: COLS,
          padding: '10px 16px',
          fontSize: 11,
          color: TOKENS.text3,
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          borderBottom: `1px solid ${TOKENS.borderSoft}`,
          background: TOKENS.bgAlt,
        }}
      >
        <span>
          <Checkbox aria-label="全选成员" />
        </span>
        <span>成员</span>
        <span>角色</span>
        <span>加入时间</span>
        <span>Skill 数</span>
        <span>最近活跃</span>
        <span>操作</span>
      </div>
      {list.length === 0 && (
        <EmptyState
          icon={<I.users size={20} />}
          title="还没有符合条件的成员"
          hint="可以通过「邀请」邀请同事加入团队"
        />
      )}
      {list.map((m, i) => {
        const isMe = !!meHandle && m.handle === meHandle;
        const active = editing !== null && editing.handle === m.handle;
        return (
          <div
            key={m.handle}
            style={{
              display: 'grid',
              gridTemplateColumns: COLS,
              padding: '14px 16px',
              alignItems: 'center',
              fontSize: 13,
              borderBottom:
                i < list.length - 1 ? `1px solid ${TOKENS.borderSoft}` : 'none',
              background: active ? TOKENS.primarySoft : 'transparent',
            }}
          >
            <Checkbox aria-label={`选择成员 ${m.name}`} disabled={m.role === 'Owner'} />
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Avatar name={m.name} char={m.avatar} url={m.avatarUrl} size={32} />
              <div>
                <div
                  style={{
                    fontWeight: 600,
                    color: TOKENS.text,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {m.name}
                  {isMe && (
                    <Badge tone="primary" size="sm" style={{ fontSize: 10 }}>
                      你
                    </Badge>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: TOKENS.text3 }}>@{m.handle}</div>
              </div>
            </div>
            <Badge tone={ROLE_TONE[m.role]} size="sm">
              {m.role}
            </Badge>
            <span style={{ color: TOKENS.text2, fontSize: 12.5 }}>{m.joined}</span>
            <span style={{ color: TOKENS.text2, fontSize: 12.5 }}>{m.skills} 个</span>
            <span style={{ color: TOKENS.text3, fontSize: 12 }}>{m.lastActive}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <Button variant="ghost" size="sm" onClick={() => setEditing(m)}>
                调整
              </Button>
              {m.role !== 'Owner' && (
                <Button variant="ghost"
                  type="button"
                  disabled
                  title="更多成员操作即将开放"
                  aria-label={`${m.name} 的更多操作`}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'not-allowed',
                    color: TOKENS.text3,
                    padding: 4,
                    opacity: 0.5,
                  }}
                >
                  <I.more size={14} />
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
