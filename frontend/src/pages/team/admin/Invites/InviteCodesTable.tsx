import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TOKENS } from '@/lib/tokens';
import { Badge, Button, Card, CopyButton, EmptyState, toast } from '@/components/ui';
import { I } from '@/components/icons';
import { useCurrentTeam, useMyTeams } from '@/api/data';
import { teamApi } from '@/api/endpoints';
import { buildInviteMessage } from '@/lib/invite';
import type { Invite } from '@/mocks';

const COLS = '2fr 100px 110px 110px 1fr 80px';

export function InviteCodesTable({ invites }: { invites: Array<Invite & { id?: number }> }) {
  const { teamId } = useCurrentTeam();
  const { data: myTeams } = useMyTeams();
  const teamName = myTeams?.find((t) => Number(t.id) === teamId)?.name;
  const queryClient = useQueryClient();
  const revoke = useMutation({
    mutationFn: (id: number) => teamApi.invites.deleteCode(teamId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites', teamId] });
      toast({ kind: 'success', message: '邀请码已撤销' });
    },
    onError: (err) => {
      toast({
        kind: 'error',
        message: err instanceof Error ? `撤销失败：${err.message}` : '撤销失败',
      });
    },
  });
  return (
    <Card pad={0}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: COLS,
          padding: '10px 16px',
          fontSize: 11,
          color: TOKENS.text3,
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          borderBottom: `1px solid ${TOKENS.borderSoft}`,
          background: TOKENS.bgAlt,
        }}
      >
        <span>邀请码</span>
        <span>角色</span>
        <span>已用 / 上限</span>
        <span>过期</span>
        <span>创建者</span>
        <span />
      </div>
      {invites.length === 0 && (
        <EmptyState
          icon={<I.send size={20} />}
          title="还没有邀请码"
          hint="在右侧创建邀请码后，可以分享给同事用于加入团队"
        />
      )}
      {invites.map((inv, i) => (
        <div
          key={inv.code}
          style={{
            display: 'grid',
            gridTemplateColumns: COLS,
            padding: '14px 16px',
            alignItems: 'center',
            fontSize: 12.5,
            borderBottom:
              i < invites.length - 1 ? `1px solid ${TOKENS.borderSoft}` : 'none',
            opacity: inv.status !== 'active' ? 0.55 : 1,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <code
              style={{
                fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                fontSize: 12.5,
                padding: '5px 10px',
                background: TOKENS.bgGray,
                borderRadius: 4,
                color: TOKENS.text,
                letterSpacing: 0.5,
              }}
            >
              {inv.code}
            </code>
            <CopyButton
              text={inv.code}
              label=""
              aria-label="复制邀请码"
              successMessage="已复制邀请码"
            />
            <CopyButton
              text={buildInviteMessage(teamName, inv.code)}
              label="链接"
              aria-label="复制邀请链接文案"
              title="复制带链接的邀请文案，可直接转发"
              successMessage="已复制邀请文案"
            />
          </div>
          <Badge tone={inv.role === 'Admin' ? 'info' : 'neutral'} size="sm">
            {inv.role}
          </Badge>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontWeight: 600, color: TOKENS.text }}>{inv.uses}</span>
              <span style={{ fontSize: 11, color: TOKENS.text3 }}>/ {inv.max}</span>
            </div>
            <div
              style={{
                marginTop: 4,
                height: 3,
                background: TOKENS.bgGray,
                borderRadius: 999,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${(inv.uses / inv.max) * 100}%`,
                  height: '100%',
                  background:
                    inv.status === 'active' ? TOKENS.primary : TOKENS.text3,
                }}
              />
            </div>
          </div>
          <span style={{ color: TOKENS.text2, fontSize: 12 }}>
            {inv.status === 'active' ? (
              inv.expiresIn
            ) : (
              <Badge tone="neutral" size="sm">
                {inv.expiresIn}
              </Badge>
            )}
          </span>
          <span style={{ color: TOKENS.text2, fontSize: 12 }}>
            {inv.createdBy} · {inv.createdAt.slice(5)}
          </span>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            {inv.status === 'active' && (
              <Button
                variant="ghost"
                size="sm"
                disabled={!inv.id || revoke.isPending}
                onClick={() => inv.id && revoke.mutate(inv.id)}
              >
                撤销
              </Button>
            )}
          </div>
        </div>
      ))}
    </Card>
  );
}
