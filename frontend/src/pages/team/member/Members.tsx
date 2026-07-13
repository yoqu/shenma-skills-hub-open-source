import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TOKENS } from '@/lib/tokens';
import { hashColor } from '@/lib/utils';
import { Avatar, Badge, Button, Card, DashTopBar, EmptyState, SearchInput } from '@/components/ui';
import { Tabs, type TabItem } from '@/components/chrome';
import { I } from '@/components/icons';
import { useTeamMembers } from '@/api/data';
import type { TeamRole } from '@/mocks/team';
import { MemberShell } from './_shared/MemberShell';

type Filter = 'all' | Exclude<TeamRole, 'Viewer'>;

const ROLE_TONE: Record<Exclude<TeamRole, 'Viewer'>, 'warning' | 'primary' | 'neutral'> = {
  Owner: 'warning',
  Admin: 'primary',
  Member: 'neutral',
};

export default function Members() {
  const nav = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const membersQuery = useTeamMembers({ size: 50 });
  const members = membersQuery.data ?? [];

  const counts = {
    all: members.length,
    Owner: members.filter((m) => m.role === 'Owner').length,
    Admin: members.filter((m) => m.role === 'Admin').length,
    Member: members.filter((m) => m.role === 'Member').length,
  };
  const tabs: TabItem[] = [
    { id: 'all', label: '全部成员', count: counts.all },
    { id: 'Owner', label: 'Owner', count: counts.Owner },
    { id: 'Admin', label: 'Admin', count: counts.Admin },
    { id: 'Member', label: 'Member', count: counts.Member },
  ];
  const list = members
    .filter((m) => filter === 'all' || m.role === filter)
    .filter((m) => !q || m.name.includes(q) || m.handle.includes(q));

  return (
    <MemberShell active="members">
      <DashTopBar
        title="团队成员"
        hint={`共 ${counts.all} 位同事 · 你可以查看 TA 提交的 Skill,但不能改角色`}
      />
      <div
        style={{
          background: '#fff',
          borderBottom: `1px solid ${TOKENS.border}`,
          padding: '0 32px',
        }}
      >
        <Tabs tabs={tabs} active={filter} onChange={(id) => setFilter(id as Filter)} />
      </div>
      <div
        style={{
          padding: '20px 32px',
          background: '#fff',
          borderBottom: `1px solid ${TOKENS.borderSoft}`,
          display: 'flex',
          gap: 10,
          alignItems: 'center',
        }}
      >
        <div style={{ flex: 1, maxWidth: 360 }}>
          <SearchInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="按姓名或 handle 搜索…"
            style={{ height: 32, fontSize: 12.5, borderRadius: 6 }}
          />
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: TOKENS.text3 }}>
          {list.length} 位
        </span>
      </div>
      <div style={{ padding: '20px 32px 40px', overflow: 'auto' }}>
        {membersQuery.isError ? (
          <Card pad={24}>
            <EmptyState
              icon={<I.x size={20} />}
              title="成员加载失败"
              action={
                <Button variant="secondary" size="sm" onClick={() => membersQuery.refetch()}>
                  重试
                </Button>
              }
            />
          </Card>
        ) : membersQuery.isLoading ? (
          <Card pad={24}>
            <EmptyState icon={<I.clock size={20} />} title="正在加载成员…" />
          </Card>
        ) : list.length === 0 ? (
          <Card pad={24}>
            <EmptyState
              icon={<I.users size={20} />}
              title={q ? '未匹配到成员' : '团队还没有其他成员'}
              hint={q ? '换个关键词试试' : '管理员邀请同事加入后会显示在这里'}
            />
          </Card>
        ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 12,
          }}
        >
          {list.map((m) => {
            const tone = m.role === 'Viewer' ? 'neutral' : ROLE_TONE[m.role];
            return (
              <Card
                key={m.handle}
                pad={14}
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar
                    name={m.name}
                    char={m.avatar}
                    url={m.avatarUrl}
                    size={44}
                    color={hashColor(m.handle)}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <b style={{ fontSize: 13.5 }}>{m.name}</b>
                      <Badge tone={tone} size="sm" style={{ fontSize: 10 }}>
                        {m.role}
                      </Badge>
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: TOKENS.text3,
                        marginTop: 2,
                        fontFamily: 'monospace',
                      }}
                    >
                      @{m.handle}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 11.5,
                    color: TOKENS.text3,
                  }}
                >
                  <span>{m.skills} 个 Skill</span>
                  <span>加入 {m.joined.slice(0, 7)}</span>
                </div>
                <div style={{ fontSize: 11.5, color: TOKENS.text3 }}>
                  最近活跃 · {m.lastActive}
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: 6,
                    paddingTop: 8,
                    borderTop: `1px solid ${TOKENS.borderSoft}`,
                  }}
                >
                  <Button
                    variant="secondary"
                    size="sm"
                    style={{ flex: 1, height: 28, fontSize: 11.5 }}
                    onClick={() => nav(`/u/${m.handle}`)}
                  >
                    查看 Skill
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    style={{ height: 28, fontSize: 11.5 }}
                    disabled
                    title="@提及功能即将开放"
                  >
                    @ 提及
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
        )}
      </div>
    </MemberShell>
  );
}
