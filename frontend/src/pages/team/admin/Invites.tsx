import { useState } from 'react';
import { TOKENS } from '@/lib/tokens';
import { Tabs } from '@/components/chrome';
import { useInvites } from '@/api/data';
import { AdminShell } from './_shared/AdminShell';
import { Button, Card, DashTopBar, EmptyState } from '@/components/ui';
import { I } from '@/components/icons';
import { InviteCodesTable } from './Invites/InviteCodesTable';
import { CreateCodePanel } from './Invites/CreateCodePanel';
import { PhoneInvitesTable, PhoneInvitePanel } from './Invites/PhoneInvites';

type TabId = 'codes' | 'phones';

export default function AdminInvites() {
  const [tab, setTab] = useState<TabId>('codes');
  const invitesQuery = useInvites();
  const codes = invitesQuery.data?.codes ?? [];
  const phones = invitesQuery.data?.phones ?? [];

  const tabs = [
    { id: 'codes', label: '邀请码', count: codes.length },
    { id: 'phones', label: '手机号定向邀请', count: phones.length },
  ];

  const activeCodes = codes.filter((i) => i.status === 'active').length;
  const pendingPhones = phones.filter((p) => p.status === 'pending').length;

  return (
    <AdminShell active="invites">
      <DashTopBar
        title="邀请"
        hint={`${activeCodes} 个有效邀请码 · ${pendingPhones} 个手机号邀请待响应`}
      />
      <div
        style={{
          background: '#fff',
          borderBottom: `1px solid ${TOKENS.border}`,
          padding: '0 32px',
        }}
      >
        <Tabs tabs={tabs} active={tab} onChange={(id) => setTab(id as TabId)} />
      </div>
      {invitesQuery.isError ? (
        <div style={{ padding: 24 }}>
          <Card pad={24}>
            <EmptyState
              icon={<I.x size={20} />}
              title="邀请数据加载失败"
              hint={invitesQuery.error instanceof Error ? invitesQuery.error.message : '请稍后重试'}
              action={
                <Button variant="secondary" size="sm" onClick={() => invitesQuery.refetch()}>
                  重试
                </Button>
              }
            />
          </Card>
        </div>
      ) : invitesQuery.isLoading ? (
        <div style={{ padding: 24 }}>
          <Card pad={24}>
            <EmptyState icon={<I.clock size={20} />} title="正在加载邀请数据…" />
          </Card>
        </div>
      ) : (
        <div
          style={{
            padding: '24px 32px 40px',
            overflow: 'auto',
            display: 'grid',
            gridTemplateColumns: '1fr 380px',
            gap: 16,
          }}
        >
          {tab === 'codes' ? (
            <>
              <InviteCodesTable invites={codes} />
              <CreateCodePanel />
            </>
          ) : (
            <>
              <PhoneInvitesTable invites={phones} />
              <PhoneInvitePanel />
            </>
          )}
        </div>
      )}
    </AdminShell>
  );
}
