import { useMemo, useState } from 'react';
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
  toast,
} from '@/components/ui';
import { I } from '@/components/icons';
import {
  useAdminSuites,
  useUnpublishSuite,
} from '@/api/admin';
import type { AdminSuiteListItem } from '@/api/endpoints';
import { AdminLayout } from './AdminLayout';
import { ConfirmDialog } from './_shared/ConfirmDialog';
import { Pagination } from './_shared/Pagination';

const PAGE_SIZE = 20;

export default function AdminSuitesPage() {
  const [q, setQ] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<AdminSuiteListItem | null>(null);

  const listQuery = useAdminSuites({
    q: q || undefined,
    page,
    size: PAGE_SIZE,
  });

  const items: AdminSuiteListItem[] = useMemo(
    () => listQuery.data?.items ?? listQuery.data?.records ?? [],
    [listQuery.data],
  );
  const total = listQuery.data?.total ?? 0;
  const unpublish = useUnpublishSuite();

  return (
    <AdminLayout active="suites">
      <DashTopBar title="套件管理" hint="跨团队的 suite 列表，可强制下架" />
      <div style={{ padding: '24px 32px 40px', overflow: 'auto' }}>
        <Card pad={16}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Input
              placeholder="搜索套件名 / slug"
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
          </div>

          <DataTable containerStyle={{ marginTop: 16 }}>
              <DataTableHead>
                <DataTableRow style={{ borderTop: 'none' }}>
                  <DataTableHeader>套件</DataTableHeader>
                  <DataTableHeader>团队</DataTableHeader>
                  <DataTableHeader>可见性</DataTableHeader>
                  <DataTableHeader>Skill 数</DataTableHeader>
                  <DataTableHeader>安装</DataTableHeader>
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
                      <EmptyState compact title="没有匹配的套件" />
                    </DataTableCell>
                  </DataTableRow>
                ) : (
                  items.map((s) => (
                    <DataTableRow key={s.id} style={{ borderTop: `1px solid ${TOKENS.borderSoft}` }}>
                      <DataTableCell>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                        <div style={{ fontSize: 11.5, color: TOKENS.text3 }}>/{s.slug}</div>
                      </DataTableCell>
                      <DataTableCell>{s.teamName}</DataTableCell>
                      <DataTableCell>
                        <Badge tone={s.visibility === 'PUBLIC' ? 'primary' : 'neutral'} size="sm">
                          {s.visibility}
                        </Badge>
                      </DataTableCell>
                      <DataTableCell>{s.skillsCount}</DataTableCell>
                      <DataTableCell>{s.installs}</DataTableCell>
                      <DataTableCell align="right">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setConfirm(s)}
                        >
                          强制下架
                        </Button>
                      </DataTableCell>
                    </DataTableRow>
                  ))
                )}
              </DataTableBody>
            </DataTable>

          <Pagination page={page} size={PAGE_SIZE} total={total} onChange={setPage} />
        </Card>
      </div>

      <ConfirmDialog
        open={!!confirm}
        title={confirm ? `强制下架套件 ${confirm.name}？` : ''}
        description="套件会被置为私有，立刻从公开广场和检索结果消失。"
        confirmLabel="确认下架"
        danger
        loading={unpublish.isPending}
        onConfirm={() => {
          if (!confirm) return;
          const s = confirm;
          unpublish.mutate(s.id, {
            onSuccess: () => {
              toast({ kind: 'success', message: `已下架 ${s.name}` });
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
