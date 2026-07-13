import { useMemo, useState } from 'react';
import { TOKENS } from '@/lib/tokens';
import {
  Card,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
  EmptyState,
} from '@/components/ui';
import { useAdminSuites } from '@/api/admin';
import type { AdminSuiteListItem } from '@/api/endpoints';
import { Pagination } from '../_shared/Pagination';

const PAGE_SIZE = 20;

export function SuitesTab({ teamId, teamSlug }: { teamId: number; teamSlug: string }) {
  const [page, setPage] = useState(1);
  const query = useAdminSuites({ teamId, page, size: PAGE_SIZE });
  const items: AdminSuiteListItem[] = useMemo(
    () => query.data?.items ?? query.data?.records ?? [],
    [query.data],
  );
  const total = query.data?.total ?? 0;

  return (
    <Card pad={16}>
      <DataTable>
        <DataTableHead>
          <DataTableRow style={{ borderTop: 'none' }}>
              <DataTableHeader>套件</DataTableHeader>
              <DataTableHeader>包含 Skill</DataTableHeader>
              <DataTableHeader>安装</DataTableHeader>
          </DataTableRow>
        </DataTableHead>
        <DataTableBody>
            {query.isLoading ? (
              <DataTableRow><DataTableCell colSpan={3} empty>加载中…</DataTableCell></DataTableRow>
            ) : items.length === 0 ? (
              <DataTableRow><DataTableCell colSpan={3} empty><EmptyState compact title="该团队没有套件" /></DataTableCell></DataTableRow>
            ) : (
              items.map((s) => (
                <DataTableRow key={s.id} style={{ borderTop: `1px solid ${TOKENS.borderSoft}` }}>
                  <DataTableCell>
                    <a
                      href={`/teams/${teamSlug}/suites/${s.slug ?? s.id}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 13, fontWeight: 600, color: TOKENS.text }}
                    >
                      {s.name}
                    </a>
                    <div style={{ fontSize: 11.5, color: TOKENS.text3 }}>{s.slug ?? ''}</div>
                  </DataTableCell>
                  <DataTableCell>{s.skillsCount ?? 0}</DataTableCell>
                  <DataTableCell>{s.installs ?? 0}</DataTableCell>
                </DataTableRow>
              ))
            )}
        </DataTableBody>
      </DataTable>
      <Pagination page={page} size={PAGE_SIZE} total={total} onChange={setPage} />
    </Card>
  );
}
