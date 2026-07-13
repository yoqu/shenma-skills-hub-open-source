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
  Select,
  toast,
} from '@/components/ui';
import { I } from '@/components/icons';
import {
  useAdminSkills,
  useUnpublishSkill,
} from '@/api/admin';
import type { AdminSkillListItem } from '@/api/endpoints';
import { AdminLayout } from './AdminLayout';
import { ConfirmDialog } from './_shared/ConfirmDialog';
import { Pagination } from './_shared/Pagination';

const PAGE_SIZE = 20;

export default function AdminSkillsPage() {
  const [q, setQ] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState('');
  const [visibility, setVisibility] = useState('');
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<AdminSkillListItem | null>(null);

  const listQuery = useAdminSkills({
    q: q || undefined,
    status: status || undefined,
    visibility: visibility || undefined,
    page,
    size: PAGE_SIZE,
  });

  const items: AdminSkillListItem[] = useMemo(
    () => listQuery.data?.items ?? listQuery.data?.records ?? [],
    [listQuery.data],
  );
  const total = listQuery.data?.total ?? 0;
  const unpublish = useUnpublishSkill();

  return (
    <AdminLayout active="skills">
      <DashTopBar title="Skill 管理" hint="跨团队的 skill 列表，可强制下架违规内容" />
      <div style={{ padding: '24px 32px 40px', overflow: 'auto' }}>
        <Card pad={16}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Input
              placeholder="搜索 skill 名 / slug"
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
                setStatus(e.target.value);
              }}
              style={selectStyle}
              options={[
                { value: '', label: '全部状态' },
                { value: 'DRAFT', label: '草稿' },
                { value: 'PENDING_REVIEW', label: '待审核' },
                { value: 'APPROVED', label: '已发布' },
                { value: 'REJECTED', label: '已拒绝' },
                { value: 'UNLISTED', label: '已下架' },
                { value: 'ARCHIVED', label: '已归档' },
              ]}
            />
            <Select
              value={visibility}
              onChange={(e) => {
                setPage(1);
                setVisibility(e.target.value);
              }}
              style={selectStyle}
              options={[
                { value: '', label: '全部可见性' },
                { value: 'PUBLIC', label: '公开' },
                { value: 'TEAM_PRIVATE', label: '团队私有' },
                { value: 'PRIVATE', label: '私有' },
              ]}
            />
          </div>

          <DataTable containerStyle={{ marginTop: 16 }}>
              <DataTableHead>
                <DataTableRow style={{ borderTop: 'none' }}>
                  <DataTableHeader>Skill</DataTableHeader>
                  <DataTableHeader>团队</DataTableHeader>
                  <DataTableHeader>作者</DataTableHeader>
                  <DataTableHeader>状态</DataTableHeader>
                  <DataTableHeader>可见性</DataTableHeader>
                  <DataTableHeader>安装</DataTableHeader>
                  <DataTableHeader>Star</DataTableHeader>
                  <DataTableHeader align="right">操作</DataTableHeader>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {listQuery.isLoading ? (
                  <DataTableRow>
                    <DataTableCell colSpan={8} empty>
                      加载中…
                    </DataTableCell>
                  </DataTableRow>
                ) : items.length === 0 ? (
                  <DataTableRow>
                    <DataTableCell colSpan={8} empty>
                      <EmptyState compact title="没有匹配的 skill" />
                    </DataTableCell>
                  </DataTableRow>
                ) : (
                  items.map((s) => {
                    const downed = s.status === 'ARCHIVED' || s.status === 'UNLISTED';
                    return (
                      <DataTableRow key={s.id} style={{ borderTop: `1px solid ${TOKENS.borderSoft}` }}>
                        <DataTableCell>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                          <div style={{ fontSize: 11.5, color: TOKENS.text3 }}>/{s.slug}</div>
                        </DataTableCell>
                        <DataTableCell>{s.teamName}</DataTableCell>
                        <DataTableCell>
                          {s.authorHandle ? `@${s.authorHandle}` : '—'}
                        </DataTableCell>
                        <DataTableCell>
                          <Badge
                            tone={downed ? 'neutral' : s.status === 'APPROVED' ? 'success' : 'warning'}
                            size="sm"
                          >
                            {s.status}
                          </Badge>
                        </DataTableCell>
                        <DataTableCell>
                          <Badge tone={s.visibility === 'PUBLIC' ? 'primary' : 'neutral'} size="sm">
                            {s.visibility}
                          </Badge>
                        </DataTableCell>
                        <DataTableCell>{s.installs}</DataTableCell>
                        <DataTableCell>{s.stars}</DataTableCell>
                        <DataTableCell align="right">
                          <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(`/skills/${s.slug}`, '_blank')}
                            >
                              查看
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              disabled={downed}
                              onClick={() => setConfirm(s)}
                            >
                              强制下架
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
        title={confirm ? `强制下架 ${confirm.name}？` : ''}
        description="该 skill 会被置为 ARCHIVED / PRIVATE，立刻从公共广场消失，所属团队成员仍可在团队工作台看到。"
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


const selectStyle: React.CSSProperties = {
  width: 'auto',
  height: 34,
  padding: '0 30px 0 10px',
  fontSize: 13,
};
