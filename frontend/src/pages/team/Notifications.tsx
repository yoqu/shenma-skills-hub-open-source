import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationApi, type NotificationItem } from '@/api/endpoints';
import { TOKENS } from '@/lib/tokens';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Card, DashTopBar, toast } from '@/components/ui';
import { I } from '@/components/icons';
import { useCurrentTeam } from '@/hooks/useCurrentTeam';

type Tab = 'all' | 'unread';
type Scope = 'team' | 'all';

const ICON_BY_CATEGORY: Record<NotificationItem['category'], keyof typeof I> = {
  review: 'check',
  invite: 'send',
  suite: 'layers',
  team: 'users',
  system: 'bell',
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export default function NotificationsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { teamId } = useCurrentTeam(true);
  const currentTeamId = teamId ? Number(teamId) : undefined;
  const [tab, setTab] = useState<Tab>('all');
  const [scope, setScope] = useState<Scope>('team');

  const status: Tab = tab;
  const teamFilter = scope === 'team' ? currentTeamId : undefined;

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', { teamFilter, status }] as const,
    queryFn: () =>
      notificationApi.list({ teamId: teamFilter, status, page: 1, size: 50 }),
  });

  const { data: unreadResp } = useQuery({
    queryKey: ['notif-unread', teamFilter] as const,
    queryFn: () => notificationApi.unreadCount(teamFilter),
  });
  const unread = unreadResp?.unread ?? 0;

  const markRead = useMutation({
    mutationFn: (id: number) => notificationApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notif-unread'] });
    },
    onError: (e: any) => toast({ kind: 'error', message: e?.response?.data?.message ?? '标记已读失败' }),
  });

  const markAll = useMutation({
    mutationFn: () => notificationApi.markAllRead(teamFilter),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notif-unread'] });
      toast({ kind: 'success', message: res.updated > 0 ? `已标记 ${res.updated} 条通知` : '没有未读通知' });
    },
    onError: (e: any) => toast({ kind: 'error', message: e?.response?.data?.message ?? '全部标记已读失败' }),
  });

  async function handleItemClick(it: NotificationItem) {
    if (!it.read) await markRead.mutateAsync(it.id);
    if (it.targetUrl) navigate(it.targetUrl);
  }

  function handleMarkAll() {
    if (unread === 0 || markAll.isPending) return;
    markAll.mutate();
  }

  const scopeLabel = scope === 'team' ? '当前团队' : '全部团队';

  return (
    <div>
      <DashTopBar
        title="通知中心"
        hint="来自所有团队协作事件的站内消息"
        actions={
          <Button
            variant="ghost"
            size="sm"
            icon={<I.check size={14} />}
            disabled={unread === 0 || markAll.isPending}
            onClick={handleMarkAll}
          >
            {markAll.isPending ? '处理中' : `全部设为已读 (${unread})`}
          </Button>
        }
      />

      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '12px 32px',
          alignItems: 'center',
        }}
      >
        <Button variant={tab === 'all' ? 'primary' : 'ghost'} size="sm" onClick={() => setTab('all')}>
          全部
        </Button>
        <Button variant={tab === 'unread' ? 'primary' : 'ghost'} size="sm" onClick={() => setTab('unread')}>
          未读
        </Button>
        <div style={{ width: 1, height: 18, background: TOKENS.borderSoft, margin: '0 6px' }} />
        <Button variant={scope === 'team' ? 'primary' : 'ghost'} size="sm" onClick={() => setScope('team')}>
          当前团队
        </Button>
        <Button variant={scope === 'all' ? 'primary' : 'ghost'} size="sm" onClick={() => setScope('all')}>
          全部团队
        </Button>
        <span style={{ color: TOKENS.text3, fontSize: 12, marginLeft: 4 }}>
          {scopeLabel}未读 {unread} 条
        </span>
      </div>

      <div style={{ padding: '0 32px 24px' }}>
        {isLoading && (
          <div style={{ color: TOKENS.text3, fontSize: 12, padding: 12 }}>加载中…</div>
        )}
        {!isLoading && data && data.items.length === 0 && (
          <Card pad={32}>
            <div style={{ textAlign: 'center', color: TOKENS.text3, fontSize: 13 }}>
              {tab === 'unread' ? '没有未读通知' : '还没有通知'}
            </div>
          </Card>
        )}
        {!isLoading && data && data.items.length > 0 && (
          <Card pad={0}>
            {data.items.map((it) => (
              <NotificationRow
                key={it.id}
                item={it}
                onClick={() => handleItemClick(it)}
                onMarkRead={() => markRead.mutate(it.id)}
              />
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}

function NotificationRow({
  item,
  onClick,
  onMarkRead,
}: {
  item: NotificationItem;
  onClick: () => void;
  onMarkRead: () => void;
}) {
  const iconKey = ICON_BY_CATEGORY[item.category] ?? 'bell';
  const IconComp = I[iconKey];
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick();
      }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '14px 16px',
        width: '100%',
        background: 'transparent',
        border: 'none',
        borderBottom: `1px solid ${TOKENS.borderSoft}`,
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          display: 'grid',
          placeItems: 'center',
          background: TOKENS.bgGray,
          color: TOKENS.text2,
          flexShrink: 0,
        }}
      >
        <IconComp size={14} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: TOKENS.text }}>{item.title}</div>
          {!item.read && (
            <Badge tone="primary" size="sm">
              未读
            </Badge>
          )}
        </div>
        {item.body && (
          <div style={{ fontSize: 12, color: TOKENS.text2, marginTop: 4, lineHeight: 1.4 }}>
            {item.body}
          </div>
        )}
        <div
          style={{
            fontSize: 11.5,
            color: TOKENS.text3,
            marginTop: 6,
            display: 'flex',
            gap: 10,
          }}
        >
          {item.teamName && <span>{item.teamName}</span>}
          {item.actorName && <span>{item.actorName}</span>}
          <span>{formatTime(item.createdAt)}</span>
        </div>
      </div>
      {!item.read && (
        <Button variant="ghost"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMarkRead();
          }}
          style={{
            flex: '0 0 auto',
            border: `1px solid ${TOKENS.borderSoft}`,
            background: '#fff',
            borderRadius: 6,
            height: 28,
            padding: '0 8px',
            fontSize: 11.5,
            color: TOKENS.text2,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          标为已读
        </Button>
      )}
    </div>
  );
}
