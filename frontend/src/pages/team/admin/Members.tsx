import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TOKENS } from '@/lib/tokens';
import { Button, Card, DashTopBar, EmptyState } from '@/components/ui';
import { Tabs } from '@/components/chrome';
import { I } from '@/components/icons';
import { useTeamMembers, useMyTeams } from '@/api/data';
import type { TeamMember, TeamRole } from '@/mocks/team';
import { AdminShell } from './_shared/AdminShell';
import { MembersTable } from './Members/MembersTable';
import { MemberEditPane } from './Members/MemberEditPane';

type Filter = 'all' | TeamRole;

export default function AdminMembers() {
  const nav = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const membersQuery = useTeamMembers({ size: 50 });
  const members = membersQuery.data ?? [];
  const { me } = useMyTeams();

  const counts = useMemo(
    () => ({
      all: members.length,
      Owner: members.filter((m) => m.role === 'Owner').length,
      Admin: members.filter((m) => m.role === 'Admin').length,
      Member: members.filter((m) => m.role === 'Member').length,
    }),
    [members],
  );

  const list = useMemo(
    () =>
      members.filter((m) => filter === 'all' || m.role === filter),
    [filter, members],
  );

  const tabs = [
    { id: 'all', label: '全部成员', count: counts.all },
    { id: 'Owner', label: 'Owner', count: counts.Owner },
    { id: 'Admin', label: 'Admin', count: counts.Admin },
    { id: 'Member', label: 'Member', count: counts.Member },
  ];

  return (
    <AdminShell active="members">
      <DashTopBar
        title="成员"
        hint={`共 ${counts.all} 位 · 1 位 Owner · ${counts.Admin} 位 Admin · ${counts.Member} 位 Member`}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              icon={<I.send size={12} />}
              onClick={() => nav('/team/invites')}
            >
              批量邀请
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<I.plus size={12} />}
              onClick={() => nav('/team/invites')}
            >
              新增成员
            </Button>
          </>
        }
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
          padding: '20px 32px 40px',
          overflow: 'auto',
          display: 'grid',
          gridTemplateColumns: editing ? '1fr 360px' : '1fr',
          gap: 16,
        }}
      >
        <Card pad={0}>
          {membersQuery.isError ? (
            <EmptyState
              icon={<I.x size={20} />}
              title="成员加载失败"
              hint={membersQuery.error instanceof Error ? membersQuery.error.message : '请稍后重试'}
              action={
                <Button variant="secondary" size="sm" onClick={() => membersQuery.refetch()}>
                  重试
                </Button>
              }
            />
          ) : membersQuery.isLoading ? (
            <EmptyState icon={<I.clock size={20} />} title="正在加载成员…" />
          ) : (
            <MembersTable list={list} editing={editing} setEditing={setEditing} meHandle={me?.handle} />
          )}
        </Card>
        {editing && (
          <MemberEditPane member={editing} onClose={() => setEditing(null)} />
        )}
      </div>
    </AdminShell>
  );
}
