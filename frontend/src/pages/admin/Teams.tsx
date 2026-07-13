import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TOKENS } from '@/lib/tokens';
import {
  Badge,
  Button,
  Card,
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
  useAdminTeams,
  useDisableTeam,
  useEnableTeam,
} from '@/api/admin';
import type {
  AdminTeamListItem,
  TeamAccountStatus,
} from '@/api/endpoints';
import { AdminLayout } from './AdminLayout';
import { ConfirmDialog } from './_shared/ConfirmDialog';
import { Pagination } from './_shared/Pagination';

const PAGE_SIZE = 20;

export default function AdminTeamsPage() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState<TeamAccountStatus | ''>('');
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<AdminTeamListItem | null>(null);

  const listQuery = useAdminTeams({
    q: q || undefined,
    status: status || undefined,
    page,
    size: PAGE_SIZE,
  });

  const items: AdminTeamListItem[] = useMemo(
    () => listQuery.data?.items ?? listQuery.data?.records ?? [],
    [listQuery.data],
  );
  const total = listQuery.data?.total ?? 0;

  const disableTeam = useDisableTeam();
  const enableTeam = useEnableTeam();

  return (
    <AdminLayout active="teams">
      <DashTopBar title="团队管理" hint="跨团队列表，可以禁用违规团队" />
      <div style={{ padding: '24px 32px 40px', overflow: 'auto' }}>
        <Card pad={16}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Input
              placeholder="搜索团队名 / slug"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(1);
                  setQ(searchInput.trim());
                }
              }}
              style={{ width: 260 }}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setPage(1);
                setQ(searchInput.trim());
              }}
            >
              <I.search size={13} /> 搜索
            </Button>
            <Select
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value as TeamAccountStatus | '');
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
                  <DataTableHeader>团队</DataTableHeader>
                  <DataTableHeader>Owner</DataTableHeader>
                  <DataTableHeader>成员</DataTableHeader>
                  <DataTableHeader>Skill</DataTableHeader>
                  <DataTableHeader>套件</DataTableHeader>
                  <DataTableHeader>状态</DataTableHeader>
                  <DataTableHeader align="right">操作</DataTableHeader>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {listQuery.isLoading ? (
                  <DataTableRow>
                    <DataTableCell colSpan={7} empty>
                      加载中…
                    </DataTableCell>
                  </DataTableRow>
                ) : items.length === 0 ? (
                  <DataTableRow>
                    <DataTableCell colSpan={7} empty>
                      <EmptyState compact title="没有匹配的团队" />
                    </DataTableCell>
                  </DataTableRow>
                ) : (
                  items.map((t) => {
                    const isDisabled = t.status === 'DISABLED';
                    return (
                      <DataTableRow key={t.id} style={{ borderTop: `1px solid ${TOKENS.borderSoft}` }}>
                        <DataTableCell>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</div>
                          <div style={{ fontSize: 11.5, color: TOKENS.text3 }}>/{t.slug}</div>
                        </DataTableCell>
                        <DataTableCell>
                          <div style={{ fontSize: 13 }}>{t.ownerName ?? '—'}</div>
                          <div style={{ fontSize: 11.5, color: TOKENS.text3 }}>
                            {t.ownerHandle ? `@${t.ownerHandle}` : ''}
                          </div>
                        </DataTableCell>
                        <DataTableCell>{t.membersCount}</DataTableCell>
                        <DataTableCell>{t.skillsCount}</DataTableCell>
                        <DataTableCell>{t.suitesCount}</DataTableCell>
                        <DataTableCell>
                          <Badge tone={isDisabled ? 'danger' : 'success'} size="sm">
                            {isDisabled ? '已禁用' : '正常'}
                          </Badge>
                        </DataTableCell>
                        <DataTableCell align="right">
                          <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => nav(`/admin/teams/${t.id}`)}
                            >
                              详情
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(`/teams/${t.slug}`, '_blank')}
                            >
                              公开页
                            </Button>
                            {isDisabled ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  enableTeam.mutate(t.id, {
                                    onSuccess: () => toast({ kind: 'success', message: `已启用 ${t.name}` }),
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
                                onClick={() => setConfirm(t)}
                              >
                                禁用
                              </Button>
                            )}
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
        title={confirm ? `禁用团队 ${confirm.name}？` : ''}
        description="禁用后团队成员仍可登录，但无法创建/编辑/发布 skill 与套件，公开广场也不再展示该团队内容。"
        danger
        loading={disableTeam.isPending}
        onConfirm={() => {
          if (!confirm) return;
          const t = confirm;
          disableTeam.mutate(t.id, {
            onSuccess: () => {
              toast({ kind: 'success', message: `已禁用 ${t.name}` });
              setConfirm(null);
            },
            onError: (err) =>
              toast({ kind: 'error', message: err instanceof Error ? err.message : '操作失败' }),
          });
        }}
        onCancel={() => setConfirm(null)}
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
