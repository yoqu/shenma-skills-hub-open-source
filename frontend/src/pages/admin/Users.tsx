import { useMemo, useState } from 'react';
import { TOKENS } from '@/lib/tokens';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CopyButton,
  DashTopBar,
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
  useAdminUsers,
  useDemoteUser,
  useDisableUser,
  useEnableUser,
  usePromoteUser,
  useResetUserPassword,
} from '@/api/admin';
import { useMyTeams } from '@/api/data';
import type {
  AdminUserListItem,
  PlatformRole,
  UserAccountStatus,
} from '@/api/endpoints';
import { AdminLayout } from './AdminLayout';
import { ConfirmDialog } from './_shared/ConfirmDialog';
import { Pagination } from './_shared/Pagination';

type ConfirmKind =
  | { kind: 'disable'; user: AdminUserListItem }
  | { kind: 'demote'; user: AdminUserListItem }
  | { kind: 'reset'; user: AdminUserListItem };

const PAGE_SIZE = 20;

export default function AdminUsersPage() {
  const [q, setQ] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [role, setRole] = useState<PlatformRole | ''>('');
  const [status, setStatus] = useState<UserAccountStatus | ''>('');
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null);
  const [resetResult, setResetResult] = useState<{ name: string; tempPassword: string } | null>(null);

  const { me } = useMyTeams(true);
  const myId = (me as { id?: number } | undefined)?.id ?? null;

  const listQuery = useAdminUsers({
    q: q || undefined,
    platformRole: role || undefined,
    status: status || undefined,
    page,
    size: PAGE_SIZE,
  });

  const items: AdminUserListItem[] = useMemo(
    () => listQuery.data?.items ?? listQuery.data?.records ?? [],
    [listQuery.data],
  );
  const total = listQuery.data?.total ?? 0;

  const disableUser = useDisableUser();
  const enableUser = useEnableUser();
  const promoteUser = usePromoteUser();
  const demoteUser = useDemoteUser();
  const resetPw = useResetUserPassword();

  const submitSearch = () => {
    setPage(1);
    setQ(searchInput.trim());
  };

  const runConfirm = () => {
    if (!confirm) return;
    if (confirm.kind === 'disable') {
      disableUser.mutate(confirm.user.id, {
        onSuccess: () => {
          toast({ kind: 'success', message: `已禁用 @${confirm.user.handle}` });
          setConfirm(null);
        },
        onError: (err) =>
          toast({ kind: 'error', message: err instanceof Error ? err.message : '操作失败' }),
      });
    } else if (confirm.kind === 'demote') {
      demoteUser.mutate(confirm.user.id, {
        onSuccess: () => {
          toast({ kind: 'success', message: `已降级 @${confirm.user.handle}` });
          setConfirm(null);
        },
        onError: (err) =>
          toast({ kind: 'error', message: err instanceof Error ? err.message : '操作失败' }),
      });
    } else if (confirm.kind === 'reset') {
      resetPw.mutate(confirm.user.id, {
        onSuccess: (data) => {
          setConfirm(null);
          setResetResult({ name: confirm.user.name, tempPassword: data.tempPassword });
        },
        onError: (err) =>
          toast({ kind: 'error', message: err instanceof Error ? err.message : '操作失败' }),
      });
    }
  };

  return (
    <AdminLayout active="users">
      <DashTopBar title="用户管理" hint="跨团队的平台账号、平台角色与状态管理" />
      <div style={{ padding: '24px 32px 40px', overflow: 'auto' }}>
        <Card pad={16}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Input
              placeholder="搜索 handle / 姓名 / 邮箱 / 手机号"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitSearch();
              }}
              style={{ width: 280 }}
            />
            <Button variant="secondary" size="sm" onClick={submitSearch}>
              <I.search size={13} /> 搜索
            </Button>
            <Select
              value={role}
              onChange={(e) => {
                setPage(1);
                setRole(e.target.value as PlatformRole | '');
              }}
              style={selectStyle}
              options={[
                { value: '', label: '全部角色' },
                { value: 'USER', label: '普通用户' },
                { value: 'SUPER_ADMIN', label: '超级管理员' },
              ]}
            />
            <Select
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value as UserAccountStatus | '');
              }}
              style={selectStyle}
              options={[
                { value: '', label: '全部状态' },
                { value: 'ACTIVE', label: '正常' },
                { value: 'DISABLED', label: '已禁用' },
              ]}
            />
          </div>

          <DataTable containerStyle={{ marginTop: 16 }}>
              <DataTableHead>
                <DataTableRow style={{ borderTop: 'none' }}>
                  <DataTableHeader>用户</DataTableHeader>
                  <DataTableHeader>角色</DataTableHeader>
                  <DataTableHeader>状态</DataTableHeader>
                  <DataTableHeader>团队</DataTableHeader>
                  <DataTableHeader>最近登录</DataTableHeader>
                  <DataTableHeader align="right">操作</DataTableHeader>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {listQuery.isLoading ? (
                  <DataTableRow>
                    <DataTableCell colSpan={6} empty>
                      加载中…
                    </DataTableCell>
                  </DataTableRow>
                ) : items.length === 0 ? (
                  <DataTableRow>
                    <DataTableCell colSpan={6} empty>
                      <EmptyState compact title="没有匹配的用户" />
                    </DataTableCell>
                  </DataTableRow>
                ) : (
                  items.map((u) => {
                    const isSelf = myId !== null && u.id === myId;
                    const isSuper = u.platformRole === 'SUPER_ADMIN';
                    const isDisabled = u.status === 'DISABLED';
                    return (
                      <DataTableRow key={u.id} style={{ borderTop: `1px solid ${TOKENS.borderSoft}` }}>
                        <DataTableCell>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Avatar
                              name={u.name}
                              char={u.name?.slice(0, 1) || u.handle?.slice(0, 1) || 'U'}
                              url={u.avatarUrl}
                              size={28}
                            />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: TOKENS.text }}>
                                {u.name || u.handle}
                              </div>
                              <div style={{ fontSize: 11.5, color: TOKENS.text3 }}>
                                @{u.handle} · {u.email || '—'}
                              </div>
                            </div>
                          </div>
                        </DataTableCell>
                        <DataTableCell>
                          <Badge tone={isSuper ? 'primary' : 'neutral'} size="sm">
                            {isSuper ? '超级管理员' : '普通用户'}
                          </Badge>
                        </DataTableCell>
                        <DataTableCell>
                          <Badge tone={isDisabled ? 'danger' : 'success'} size="sm">
                            {isDisabled ? '已禁用' : '正常'}
                          </Badge>
                        </DataTableCell>
                        <DataTableCell>{u.teamsCount}</DataTableCell>
                        <DataTableCell>
                          <span style={{ fontSize: 12, color: TOKENS.text3 }}>
                            {u.lastLogin || '—'}
                          </span>
                        </DataTableCell>
                        <DataTableCell align="right">
                          <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {isDisabled ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  enableUser.mutate(u.id, {
                                    onSuccess: () => toast({ kind: 'success', message: `已启用 @${u.handle}` }),
                                    onError: (err) =>
                                      toast({ kind: 'error', message: err instanceof Error ? err.message : '操作失败' }),
                                  })
                                }
                              >
                                启用
                              </Button>
                            ) : (
                              <Button
                                variant="danger"
                                size="sm"
                                disabled={isSelf}
                                title={isSelf ? '不能禁用自己' : undefined}
                                onClick={() => setConfirm({ kind: 'disable', user: u })}
                              >
                                禁用
                              </Button>
                            )}

                            {isSuper ? (
                              <Button
                                variant="danger"
                                size="sm"
                                disabled={isSelf}
                                title={isSelf ? '不能降级自己' : undefined}
                                onClick={() => setConfirm({ kind: 'demote', user: u })}
                              >
                                降级
                              </Button>
                            ) : (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  promoteUser.mutate(u.id, {
                                    onSuccess: () => toast({ kind: 'success', message: `已提升 @${u.handle}` }),
                                    onError: (err) =>
                                      toast({ kind: 'error', message: err instanceof Error ? err.message : '操作失败' }),
                                  })
                                }
                              >
                                提升
                              </Button>
                            )}

                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => setConfirm({ kind: 'reset', user: u })}
                            >
                              重置密码
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
        </Card>
      </div>

      <ConfirmDialog
        open={!!confirm}
        title={
          confirm?.kind === 'disable'
            ? `禁用用户 @${confirm.user.handle}？`
            : confirm?.kind === 'demote'
              ? `把 @${confirm?.user.handle} 降级为普通用户？`
              : confirm?.kind === 'reset'
                ? `为 @${confirm?.user.handle} 重置密码？`
                : ''
        }
        description={
          confirm?.kind === 'disable'
            ? '用户将无法登录，已有 token 立即失效。所有写操作返回 403。'
            : confirm?.kind === 'demote'
              ? '降级后该用户不再能进入 /admin 控制台。如果是最后一个在线超管，操作会被后端拒绝。'
              : confirm?.kind === 'reset'
                ? '会生成一次性临时密码并仅在响应中返回一次，请妥善复制后交给用户。'
                : undefined
        }
        confirmLabel={
          confirm?.kind === 'reset' ? '生成临时密码' : '确认'
        }
        danger
        loading={disableUser.isPending || demoteUser.isPending || resetPw.isPending}
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />

      <ConfirmDialog
        open={!!resetResult}
        title="临时密码已生成"
        description={
          resetResult ? (
            <div>
              <div style={{ marginBottom: 10 }}>
                为 <b>{resetResult.name}</b> 生成的一次性临时密码：
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 12px',
                  background: TOKENS.bgAlt,
                  border: `1px solid ${TOKENS.border}`,
                  borderRadius: 8,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: 14,
                  color: TOKENS.text,
                  wordBreak: 'break-all',
                }}
              >
                <span style={{ flex: 1 }}>{resetResult.tempPassword}</span>
                <CopyButton text={resetResult.tempPassword} />
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: TOKENS.text3 }}>
                此密码只显示一次，请立刻保存并告知用户。
              </div>
            </div>
          ) : null
        }
        confirmLabel="我已记下"
        cancelLabel="关闭"
        onConfirm={() => setResetResult(null)}
        onCancel={() => setResetResult(null)}
      />
    </AdminLayout>
  );
}


const selectStyle: React.CSSProperties = {
  width: 'auto',
  height: 34,
  padding: '0 30px 0 10px',
  fontSize: 13,
};
