import { useMemo, useState } from 'react';
import { TOKENS } from '@/lib/tokens';
import {
  Badge,
  Card,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
  EmptyState,
} from '@/components/ui';
import { useAdminSkills } from '@/api/admin';
import type { AdminSkillListItem } from '@/api/endpoints';
import { Pagination } from '../_shared/Pagination';

const PAGE_SIZE = 20;

export function SkillsTab({ teamId, teamSlug }: { teamId: number; teamSlug: string }) {
  const [page, setPage] = useState(1);
  const query = useAdminSkills({ teamId, page, size: PAGE_SIZE });
  const items: AdminSkillListItem[] = useMemo(
    () => query.data?.items ?? query.data?.records ?? [],
    [query.data],
  );
  const total = query.data?.total ?? 0;

  return (
    <Card pad={16}>
      <DataTable containerStyle={{ marginTop: 4 }}>
        <DataTableHead>
          <DataTableRow style={{ borderTop: 'none' }}>
              <DataTableHeader>Skill</DataTableHeader>
              <DataTableHeader>可见性</DataTableHeader>
              <DataTableHeader>状态</DataTableHeader>
              <DataTableHeader>安装</DataTableHeader>
              <DataTableHeader>Star</DataTableHeader>
          </DataTableRow>
        </DataTableHead>
        <DataTableBody>
            {query.isLoading ? (
              <DataTableRow><DataTableCell colSpan={5} empty>加载中…</DataTableCell></DataTableRow>
            ) : items.length === 0 ? (
              <DataTableRow><DataTableCell colSpan={5} empty><EmptyState compact title="该团队没有 Skill" /></DataTableCell></DataTableRow>
            ) : (
              items.map((s) => (
                <DataTableRow key={s.id} style={{ borderTop: `1px solid ${TOKENS.borderSoft}` }}>
                  <DataTableCell>
                    <a
                      href={`/teams/${teamSlug}/skills/${s.slug ?? s.id}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 13, fontWeight: 600, color: TOKENS.text }}
                    >
                      {s.name}
                    </a>
                    <div style={{ fontSize: 11.5, color: TOKENS.text3 }}>{s.slug ?? ''}</div>
                  </DataTableCell>
                  <DataTableCell>
                    <Badge tone={s.visibility === 'PUBLIC' ? 'success' : 'neutral'} size="sm">
                      {s.visibility ?? '—'}
                    </Badge>
                  </DataTableCell>
                  <DataTableCell>{s.status ?? '—'}</DataTableCell>
                  <DataTableCell>{s.installs ?? 0}</DataTableCell>
                  <DataTableCell>{s.stars ?? 0}</DataTableCell>
                </DataTableRow>
              ))
            )}
        </DataTableBody>
      </DataTable>
      <Pagination page={page} size={PAGE_SIZE} total={total} onChange={setPage} />
    </Card>
  );
}
