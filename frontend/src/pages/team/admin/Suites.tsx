import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, DashTopBar, EmptyState } from '@/components/ui';
import { I } from '@/components/icons';
import { useSuites } from '@/api/data';
import type { Suite } from '@/mocks/suites';
import { AdminShell } from './_shared/AdminShell';
import { SuiteList } from './Suites/SuiteList';
import { SuiteEditor } from './Suites/SuiteEditor';

export default function AdminSuites() {
  const nav = useNavigate();
  const suitesQuery = useSuites({ size: 20 });
  const suites = suitesQuery.data ?? [];
  const [selected, setSelected] = useState<Suite | null>(null);

  useEffect(() => {
    if (!selected && suites.length > 0) setSelected(suites[0]);
  }, [selected, suites]);

  return (
    <AdminShell active="suites">
      <DashTopBar
        title="套件"
        hint={`${suites.length} 个套件 · ${suites.filter((s) => s.visibility === 'PUBLIC').length} 个对外公开`}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<I.plus size={12} />}
            onClick={() => nav('/create/suite')}
          >
            新建套件
          </Button>
        }
      />
      {suitesQuery.isError ? (
        <div style={{ padding: 24 }}>
          <Card pad={24}>
            <EmptyState
              icon={<I.x size={20} />}
              title="套件加载失败"
              hint={suitesQuery.error instanceof Error ? suitesQuery.error.message : '请稍后重试'}
              action={
                <Button variant="secondary" size="sm" onClick={() => suitesQuery.refetch()}>
                  重试
                </Button>
              }
            />
          </Card>
        </div>
      ) : suitesQuery.isLoading ? (
        <div style={{ padding: 24 }}>
          <Card pad={24}>
            <EmptyState icon={<I.clock size={20} />} title="正在加载套件…" />
          </Card>
        </div>
      ) : suites.length === 0 ? (
        <div style={{ padding: 24 }}>
          <Card pad={24}>
            <EmptyState
              icon={<I.layers size={20} />}
              title="还没有套件"
              hint="把团队常用 Skill 打包成套件，方便其他成员一键安装"
              action={
                <Button variant="primary" size="sm" onClick={() => nav('/create/suite')}>
                  新建第一个套件
                </Button>
              }
            />
          </Card>
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: '300px 1fr',
            overflow: 'hidden',
          }}
        >
          <SuiteList suites={suites} selected={selected} setSelected={setSelected} />
          {selected && <SuiteEditor key={selected.id} suite={selected} />}
        </div>
      )}
    </AdminShell>
  );
}
