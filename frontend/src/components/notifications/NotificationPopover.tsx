import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Badge, Button } from '@/components/ui';
import { I } from '@/components/icons';
import { toast } from '@/components/ui';
import { notificationApi, type NotificationItem } from '@/api/endpoints';
import { TOKENS } from '@/lib/tokens';

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

export function NotificationPopover({ unread, onClose }: { unread: number; onClose: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['notifications', { preview: true }] as const,
    queryFn: () => notificationApi.list({ status: 'all', page: 1, size: 6 }),
  });

  const markRead = useMutation({
    mutationFn: (id: number) => notificationApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notif-unread'] });
    },
  });

  const markAll = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notif-unread'] });
      toast({ kind: 'success', message: res.updated > 0 ? `已标记 ${res.updated} 条通知` : '没有未读通知' });
    },
    onError: (e: any) => toast({ kind: 'error', message: e?.response?.data?.message ?? '全部标记已读失败' }),
  });

  async function openItem(item: NotificationItem) {
    if (!item.read) await markRead.mutateAsync(item.id);
    onClose();
    if (item.targetUrl) navigate(item.targetUrl);
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        width: 360,
        maxWidth: 'calc(100vw - 32px)',
        background: '#fff',
        border: `1px solid ${TOKENS.border}`,
        borderRadius: 10,
        boxShadow: '0 10px 30px rgba(15,23,42,.10)',
        zIndex: 20,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          borderBottom: `1px solid ${TOKENS.borderSoft}`,
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: TOKENS.text }}>通知</div>
          <div style={{ fontSize: 11.5, color: TOKENS.text3, marginTop: 2 }}>未读 {unread} 条</div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={unread === 0 || markAll.isPending}
          onClick={() => markAll.mutate()}
        >
          全部已读
        </Button>
      </div>

      <div style={{ maxHeight: 360, overflowY: 'auto' }}>
        {isLoading && <div style={{ padding: 16, color: TOKENS.text3, fontSize: 12 }}>加载中...</div>}
        {!isLoading && data?.items.length === 0 && (
          <div style={{ padding: 28, color: TOKENS.text3, fontSize: 13, textAlign: 'center' }}>
            还没有通知
          </div>
        )}
        {data?.items.map((item) => (
          <NotificationPreviewItem key={item.id} item={item} onClick={() => openItem(item)} />
        ))}
      </div>

      <Button variant="ghost"
        type="button"
        onClick={() => {
          onClose();
          navigate('/team/notifications');
        }}
        style={{
          width: '100%',
          padding: '10px 14px',
          border: 'none',
          borderTop: `1px solid ${TOKENS.borderSoft}`,
          background: TOKENS.bgAlt,
          color: TOKENS.text2,
          fontSize: 12.5,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        查看全部通知
      </Button>
    </div>
  );
}

function NotificationPreviewItem({ item, onClick }: { item: NotificationItem; onClick: () => void }) {
  const IconComp = I[ICON_BY_CATEGORY[item.category] ?? 'bell'];
  return (
    <Button variant="ghost"
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        width: '100%',
        height: 'auto',
        padding: '12px 14px',
        border: 'none',
        borderBottom: `1px solid ${TOKENS.borderSoft}`,
        background: item.read ? '#fff' : TOKENS.primarySoft,
        cursor: 'pointer',
        textAlign: 'left',
        whiteSpace: 'normal',
        fontFamily: 'inherit',
      }}
    >
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: 7,
          display: 'grid',
          placeItems: 'center',
          background: '#fff',
          color: item.read ? TOKENS.text3 : TOKENS.primary,
          flex: '0 0 auto',
        }}
      >
        <IconComp size={14} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: TOKENS.text }}>{item.title}</span>
          {!item.read && <Badge tone="primary" size="sm">未读</Badge>}
        </span>
        {item.body && (
          <span
            style={{
              display: 'block',
              marginTop: 4,
              color: TOKENS.text2,
              fontSize: 12,
              lineHeight: 1.45,
            }}
          >
            {item.body}
          </span>
        )}
        <span style={{ display: 'block', marginTop: 5, color: TOKENS.text3, fontSize: 11 }}>
          {item.teamName ? `${item.teamName} · ` : ''}{formatTime(item.createdAt)}
        </span>
      </span>
    </Button>
  );
}
