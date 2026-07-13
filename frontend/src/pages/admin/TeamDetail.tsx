import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { TOKENS } from '@/lib/tokens';
import { Badge, Button, DashTopBar, EmptyState, toast } from '@/components/ui';
import { Tabs } from '@/components/chrome';
import { useAdminTeamDetail, useDisableTeam, useEnableTeam } from '@/api/admin';
import { AdminLayout } from './AdminLayout';
import { ConfirmDialog } from './_shared/ConfirmDialog';
import { OverviewTab } from './teamDetail/OverviewTab';
import { MembersTab } from './teamDetail/MembersTab';
import { SkillsTab } from './teamDetail/SkillsTab';
import { SuitesTab } from './teamDetail/SuitesTab';
import { SettingsTab } from './teamDetail/SettingsTab';

const TAB_KEYS = ['overview', 'members', 'skills', 'suites', 'settings'] as const;
type TabKey = (typeof TAB_KEYS)[number];

export default function AdminTeamDetailPage() {
  const { id: idParam } = useParams<{ id: string }>();
  const id = Number(idParam);
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const tab: TabKey = useMemo(() => {
    const t = sp.get('tab') as TabKey | null;
    return t && (TAB_KEYS as readonly string[]).includes(t) ? (t as TabKey) : 'overview';
  }, [sp]);

  const detailQuery = useAdminTeamDetail(Number.isFinite(id) ? id : undefined);
  const detail = detailQuery.data;
  const disableTeam = useDisableTeam();
  const enableTeam = useEnableTeam();
  const [confirmDisable, setConfirmDisable] = useState(false);

  if (!Number.isFinite(id)) {
    return (
      <AdminLayout active="teams">
        <DashTopBar title="团队不存在" />
        <div style={{ padding: 32 }}>
          <EmptyState
            title="无效的团队 id"
            action={
              <Button variant="secondary" size="sm" onClick={() => nav('/admin/teams')}>
                返回列表
              </Button>
            }
          />
        </div>
      </AdminLayout>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <AdminLayout active="teams">
        <DashTopBar title="加载中…" />
      </AdminLayout>
    );
  }

  if (detailQuery.isError || !detail) {
    return (
      <AdminLayout active="teams">
        <DashTopBar title="团队不存在" />
        <div style={{ padding: 32 }}>
          <EmptyState
            title="团队不存在或已删除"
            action={
              <Button variant="secondary" size="sm" onClick={() => nav('/admin/teams')}>
                返回列表
              </Button>
            }
          />
        </div>
      </AdminLayout>
    );
  }

  const isDisabled = detail.status === 'DISABLED';

  return (
    <AdminLayout active="teams">
      <DashTopBar
        title={detail.name}
        hint={`@${detail.slug} · Owner ${detail.ownerHandle ? '@' + detail.ownerHandle : '—'}`}
        actions={
          <>
            <Badge tone={isDisabled ? 'danger' : 'success'} size="sm">
              {isDisabled ? '已禁用' : '正常'}
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => nav('/admin/teams')}>返回列表</Button>
            <Button variant="ghost" size="sm" onClick={() => window.open(`/teams/${detail.slug}`, '_blank')}>
              公开页
            </Button>
            {isDisabled ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  enableTeam.mutate(id, {
                    onSuccess: () => toast({ kind: 'success', message: `已启用 ${detail.name}` }),
                    onError: (e) => toast({ kind: 'error', message: e instanceof Error ? e.message : '操作失败' }),
                  })
                }
              >
                启用
              </Button>
            ) : (
              <Button variant="danger" size="sm" onClick={() => setConfirmDisable(true)}>禁用</Button>
            )}
          </>
        }
      />
      <div style={{ background: '#fff', borderBottom: `1px solid ${TOKENS.border}`, padding: '0 32px' }}>
        <Tabs
          tabs={[
            { id: 'overview', label: '概览' },
            { id: 'members', label: '成员', count: detail.membersCount ?? 0 },
            { id: 'skills', label: 'Skill', count: detail.skillsCount ?? 0 },
            { id: 'suites', label: '套件', count: detail.suitesCount ?? 0 },
            { id: 'settings', label: '设置' },
          ]}
          active={tab}
          onChange={(t) => {
            sp.set('tab', t);
            setSp(sp, { replace: true });
          }}
        />
      </div>
      <div style={{ padding: '24px 32px 40px', overflow: 'auto' }}>
        {tab === 'overview' && <OverviewTab detail={detail} />}
        {tab === 'members' && <MembersTab teamId={id} teamName={detail.name} />}
        {tab === 'skills' && <SkillsTab teamId={id} teamSlug={detail.slug} />}
        {tab === 'suites' && <SuitesTab teamId={id} teamSlug={detail.slug} />}
        {tab === 'settings' && <SettingsTab detail={detail} />}
      </div>

      <ConfirmDialog
        open={confirmDisable}
        title={`禁用团队 ${detail.name}？`}
        description="禁用后团队成员仍可登录，但无法创建/编辑/发布 skill 与套件，公开广场也不再展示该团队内容。"
        danger
        loading={disableTeam.isPending}
        onConfirm={() => {
          disableTeam.mutate(id, {
            onSuccess: () => {
              toast({ kind: 'success', message: `已禁用 ${detail.name}` });
              setConfirmDisable(false);
            },
            onError: (e) => toast({ kind: 'error', message: e instanceof Error ? e.message : '操作失败' }),
          });
        }}
        onCancel={() => setConfirmDisable(false)}
      />
    </AdminLayout>
  );
}

