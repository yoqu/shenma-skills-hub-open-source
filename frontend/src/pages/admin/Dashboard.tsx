import { TOKENS } from '@/lib/tokens';
import { Card, DashTopBar, EmptyState, Stat } from '@/components/ui';
import { I } from '@/components/icons';
import {
  useAdminSkills,
  useAdminSuites,
  useAdminTeams,
  useAdminUsers,
} from '@/api/admin';
import { AdminLayout } from './AdminLayout';

/**
 * 平台概览：四个总数统计 + 审计日志占位。
 *
 * 总数从对应列表端点 `total` 读取（size=1 让响应体最小）。
 */
export default function AdminDashboard() {
  const usersQuery = useAdminUsers({ page: 1, size: 1 });
  const teamsQuery = useAdminTeams({ page: 1, size: 1 });
  const skillsQuery = useAdminSkills({ page: 1, size: 1 });
  const suitesQuery = useAdminSuites({ page: 1, size: 1 });

  const userTotal = usersQuery.data?.total ?? 0;
  const teamTotal = teamsQuery.data?.total ?? 0;
  const skillTotal = skillsQuery.data?.total ?? 0;
  const suiteTotal = suitesQuery.data?.total ?? 0;

  return (
    <AdminLayout active="overview">
      <DashTopBar title="平台概览" hint="跨团队总览与最近活动" />
      <div style={{ padding: '24px 32px 40px', overflow: 'auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 14,
            marginBottom: 24,
          }}
        >
          <Stat label="平台用户" value={userTotal} icon={<I.users size={14} />} />
          <Stat label="团队" value={teamTotal} icon={<I.layers size={14} />} />
          <Stat label="Skill" value={skillTotal} icon={<I.cube size={14} />} />
          <Stat label="套件" value={suiteTotal} icon={<I.inbox size={14} />} />
        </div>

        <Card pad={18}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>最近审计</div>
          <EmptyState
            compact
            icon={<I.shield size={16} style={{ color: TOKENS.text3 }} />}
            title="敬请期待"
            hint="审计日志面板将在后续版本上线。当前所有破坏性操作已写入后端 admin_audit_log 表。"
          />
        </Card>
      </div>
    </AdminLayout>
  );
}
