import { useMemo, useState } from 'react';
import { TOKENS } from '@/lib/tokens';
import {
  Avatar,
  Badge,
  Button,
  Card,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
  EmptyState,
  Input,
  Select,
  toast,
} from '@/components/ui';
import { I } from '@/components/icons';
import {
  useAdminTeamMembers,
  useRemoveAdminTeamMember,
  useUpdateAdminTeamMemberRole,
} from '@/api/admin';
import type { AdminTeamMember } from '@/api/endpoints';
import { ConfirmDialog } from '../_shared/ConfirmDialog';
import { Pagination } from '../_shared/Pagination';
import { AddMemberDialog } from './AddMemberDialog';

const PAGE_SIZE = 20;

interface Props {
  teamId: number;
  teamName: string;
}

type Confirm =
  | { kind: 'kick'; member: AdminTeamMember }
  | { kind: 'role'; member: AdminTeamMember; nextRole: 'ADMIN' | 'MEMBER' };

export function MembersTab({ teamId, teamName }: Props) {
  const [q, setQ] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [role, setRole] = useState<'' | 'OWNER' | 'ADMIN' | 'MEMBER'>('');
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const listQuery = useAdminTeamMembers(teamId, {
    q: q || undefined,
    role: role || undefined,
    page,
    size: PAGE_SIZE,
  });
  const items: AdminTeamMember[] = useMemo(
    () => listQuery.data?.items ?? listQuery.data?.records ?? [],
    [listQuery.data],
  );
  const total = listQuery.data?.total ?? 0;

  const updateRole = useUpdateAdminTeamMemberRole(teamId);
  const removeMember = useRemoveAdminTeamMember(teamId);

  const submitSearch = () => {
    setPage(1);
    setQ(searchInput.trim());
  };

  const runConfirm = () => {
    if (!confirm) return;
    if (confirm.kind === 'kick') {
      removeMember.mutate(confirm.member.userId, {
        onSuccess: () => {
          toast({ kind: 'success', message: `已移除 @${confirm.member.handle}` });
          setConfirm(null);
        },
        onError: (e) =>
          toast({ kind: 'error', message: e instanceof Error ? e.message : '操作失败' }),
      });
    } else {
      updateRole.mutate(
        { userId: confirm.member.userId, role: confirm.nextRole },
        {
          onSuccess: () => {
            toast({ kind: 'success', message: `已把 @${confirm.member.handle} 改为 ${confirm.nextRole}` });
            setConfirm(null);
          },
          onError: (e) =>
            toast({ kind: 'error', message: e instanceof Error ? e.message : '操作失败' }),
        },
      );
    }
  };

  return (
    <Card pad={16}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Input
          placeholder="搜索 handle / 姓名"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitSearch();
          }}
          style={{ width: 240 }}
        />
        <Button variant="secondary" size="sm" onClick={submitSearch}>
          <I.search size={13} /> 搜索
        </Button>
        <Select
          value={role}
          onChange={(e) => {
            setPage(1);
            setRole(e.target.value as typeof role);
          }}
          style={{ width: 'auto', height: 34, padding: '0 30px 0 10px', fontSize: 13 }}
          options={[
            { value: '', label: '全部角色' },
            { value: 'OWNER', label: 'Owner' },
            { value: 'ADMIN', label: 'Admin' },
            { value: 'MEMBER', label: 'Member' },
          ]}
        />
        <div style={{ marginLeft: 'auto' }}>
          <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
            <I.plus size={12} /> 添加成员
          </Button>
        </div>
      </div>

      <DataTable containerStyle={{ marginTop: 16 }}>
        <DataTableHead>
          <DataTableRow style={{ borderTop: 'none' }}>
              <DataTableHeader>成员</DataTableHeader>
              <DataTableHeader>角色</DataTableHeader>
              <DataTableHeader>加入</DataTableHeader>
              <DataTableHeader>最近活动</DataTableHeader>
              <DataTableHeader align="right">操作</DataTableHeader>
            </DataTableRow>
        </DataTableHead>
        <DataTableBody>
            {listQuery.isLoading ? (
              <DataTableRow><DataTableCell colSpan={5} empty>加载中…</DataTableCell></DataTableRow>
            ) : items.length === 0 ? (
              <DataTableRow><DataTableCell colSpan={5} empty><EmptyState compact title="没有匹配的成员" /></DataTableCell></DataTableRow>
            ) : (
              items.map((m) => {
                const isOwner = m.role === 'OWNER';
                return (
                  <DataTableRow key={m.userId} style={{ borderTop: `1px solid ${TOKENS.borderSoft}` }}>
                    <DataTableCell>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={m.name} char={(m.name || m.handle || 'U').slice(0, 1)} url={m.avatarUrl} size={28} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{m.name || m.handle}</div>
                          <div style={{ fontSize: 11.5, color: TOKENS.text3 }}>@{m.handle}</div>
                        </div>
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <Badge tone={isOwner ? 'primary' : m.role === 'ADMIN' ? 'info' : 'neutral'} size="sm">
                        {m.role}
                      </Badge>
                    </DataTableCell>
                    <DataTableCell>{m.joined ?? '—'}</DataTableCell>
                    <DataTableCell>{m.lastActive ?? '—'}</DataTableCell>
                    <DataTableCell align="right">
                      <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                        <Select
                          value={m.role === 'ADMIN' ? 'ADMIN' : 'MEMBER'}
                          disabled={isOwner}
                          onChange={(e) => {
                            const next = e.target.value as 'ADMIN' | 'MEMBER';
                            if (next !== m.role) {
                              setConfirm({ kind: 'role', member: m, nextRole: next });
                            }
                          }}
                          style={{ width: 100, height: 30, padding: '0 26px 0 8px', fontSize: 12.5 }}
                          options={[
                            { value: 'ADMIN', label: 'Admin' },
                            { value: 'MEMBER', label: 'Member' },
                          ]}
                        />
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={isOwner}
                          title={isOwner ? '请先在团队侧转让 Owner' : undefined}
                          onClick={() => setConfirm({ kind: 'kick', member: m })}
                        >
                          踢出
                        </Button>
                      </div>
                    </DataTableCell>
                  </DataTableRow>
                );
              })
            )}
          </DataTableBody>
        </DataTable>

      <Pagination page={page} size={PAGE_SIZE} total={total} onChange={setPage} />

      <ConfirmDialog
        open={!!confirm}
        title={
          confirm?.kind === 'kick'
            ? `将 @${confirm.member.handle} 从 ${teamName} 移除？`
            : confirm?.kind === 'role'
              ? `把 @${confirm.member.handle} 改为 ${confirm.nextRole}？`
              : ''
        }
        description={
          confirm?.kind === 'kick'
            ? '此操作会立即生效。被移除成员的所有 PAT 不会自动吊销，团队管理员可后续清理。'
            : confirm?.kind === 'role'
              ? '角色变更后会通过站内信告知该成员。'
              : undefined
        }
        danger={confirm?.kind === 'kick'}
        loading={updateRole.isPending || removeMember.isPending}
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />

      <AddMemberDialog
        open={addOpen}
        teamId={teamId}
        teamName={teamName}
        onClose={() => setAddOpen(false)}
      />
    </Card>
  );
}
