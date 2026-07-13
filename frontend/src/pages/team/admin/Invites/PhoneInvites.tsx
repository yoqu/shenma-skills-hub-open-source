import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TOKENS } from '@/lib/tokens';
import { Badge, Button, Card, EmptyState, Input, Textarea, toast, type BadgeTone } from '@/components/ui';
import { I } from '@/components/icons';
import { useCurrentTeam } from '@/api/data';
import { teamApi } from '@/api/endpoints';
import type { PhoneInvite, PhoneInviteStatus } from '@/mocks/invites';

const STATUS_TONE: Record<PhoneInviteStatus, BadgeTone> = {
  pending: 'warning',
  accepted: 'success',
  declined: 'neutral',
  cancelled: 'neutral',
};
const STATUS_LABEL: Record<PhoneInviteStatus, string> = {
  pending: '待响应',
  accepted: '已加入',
  declined: '已拒绝',
  cancelled: '已撤销',
};

const COLS = '1.2fr 1fr 1.4fr 1fr 110px 100px';

export function PhoneInvitesTable({ invites }: { invites: Array<PhoneInvite & { id?: number }> }) {
  const { teamId } = useCurrentTeam();
  const queryClient = useQueryClient();
  const cancel = useMutation({
    mutationFn: (id: number) => teamApi.invites.cancelPhone(teamId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites', teamId] });
      toast({ kind: 'success', message: '已取消该手机号邀请' });
    },
    onError: (err) => {
      toast({
        kind: 'error',
        message: err instanceof Error ? `取消失败：${err.message}` : '取消失败',
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
        <span>手机号</span>
        <span>邀请时间</span>
        <span>备注</span>
        <span>邀请人</span>
        <span>状态</span>
        <span />
      </div>
      {invites.length === 0 && (
        <EmptyState
          icon={<I.phone size={20} />}
          title="还没有手机号邀请"
          hint="在右侧填写手机号，给特定同事发送加入邀请"
        />
      )}
      {invites.map((p, i) => (
        <div
          key={`${p.phone}-${i}`}
          style={{
            display: 'grid',
            gridTemplateColumns: COLS,
            padding: '14px 16px',
            alignItems: 'center',
            fontSize: 12.5,
            borderBottom:
              i < invites.length - 1 ? `1px solid ${TOKENS.borderSoft}` : 'none',
          }}
        >
          <span
            style={{
              fontFamily: 'monospace',
              color: TOKENS.text,
              fontWeight: 500,
            }}
          >
            <I.phone
              size={11}
              style={{ color: TOKENS.text3, marginRight: 6 }}
            />
            +86 {p.phone}
          </span>
          <span style={{ color: TOKENS.text2, fontSize: 12 }}>{p.at}</span>
          <span
            style={{
              color: p.note ? TOKENS.text2 : TOKENS.text3,
              fontSize: 12,
              fontStyle: p.note ? 'normal' : 'italic',
            }}
          >
            {p.note || '(无备注)'}
          </span>
          <span style={{ color: TOKENS.text2 }}>{p.invitedBy}</span>
          <Badge tone={STATUS_TONE[p.status]} size="sm">
            {STATUS_LABEL[p.status]}
          </Badge>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            {p.status === 'pending' && (
              <Button
                variant="ghost"
                size="sm"
                disabled={!p.id || cancel.isPending}
                onClick={() => p.id && cancel.mutate(p.id)}
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

export function PhoneInvitePanel() {
  const { teamId } = useCurrentTeam();
  const [phones, setPhones] = useState('138 4421 0098\n139 1098 4427\n');
  const [note, setNote] = useState('新入职 / 周五入组');
  const count = phones.split('\n').filter((l) => l.trim()).length;
  const queryClient = useQueryClient();
  const addPhone = useMutation({
    mutationFn: async () => {
      const rows = phones.split('\n').map((p) => p.trim()).filter(Boolean);
      for (const phone of rows) {
        await teamApi.invites.addPhone(teamId!, { phone, note });
      }
      return rows.length;
    },
    onSuccess: (n) => {
      queryClient.invalidateQueries({ queryKey: ['invites', teamId] });
      setPhones('');
      toast({ kind: 'success', message: `已发起 ${n} 个手机号邀请` });
    },
    onError: (err) => {
      toast({
        kind: 'error',
        message: err instanceof Error ? `邀请失败：${err.message}` : '邀请失败',
      });
    },
  });

  return (
    <Card pad={18} style={{ alignSelf: 'flex-start', position: 'sticky', top: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>定向邀请</div>
      <div
        style={{
          fontSize: 11.5,
          color: TOKENS.text3,
          marginBottom: 16,
          lineHeight: 1.5,
        }}
      >
        填入手机号,用户用匹配手机号登录后,会在 /dashboard 看到待处理邀请。第一版不发送短信。
      </div>

      <div
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: TOKENS.text2,
          marginBottom: 6,
        }}
      >
        手机号 <span style={{ color: TOKENS.text3 }}>· 每行一个</span>
      </div>
      <Textarea
        value={phones}
        onChange={(e) => setPhones(e.target.value)}
        placeholder={'138 0013 8000\n139 0013 8001'}
        style={{ minHeight: 110, fontSize: 13, fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}
      />
      <div
        style={{
          fontSize: 11,
          color: TOKENS.text3,
          marginTop: 4,
          marginBottom: 12,
        }}
      >
        已识别 <b style={{ color: TOKENS.primary }}>{count}</b> 个手机号
      </div>

      <div
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: TOKENS.text2,
          marginBottom: 6,
        }}
      >
        备注 <span style={{ color: TOKENS.text3 }}>· 可选</span>
      </div>
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="说明这次邀请的来源"
        style={{ fontSize: 13, marginBottom: 14 }}
      />

      <Button
        variant="primary"
        size="md"
        full
        icon={<I.send size={12} />}
        disabled={count === 0 || addPhone.isPending}
        onClick={() => addPhone.mutate()}
      >
        {addPhone.isPending ? '发送中…' : `发送 ${count} 个邀请`}
      </Button>

      <div
        style={{
          marginTop: 14,
          padding: 12,
          background: TOKENS.bgAlt,
          borderRadius: 8,
          fontSize: 11.5,
          color: TOKENS.text2,
          lineHeight: 1.6,
        }}
      >
        <b style={{ color: TOKENS.text }}>提示</b>
        :被邀请人需用相同手机号通过验证码登录后才能看到邀请。如果对方尚未注册,登录时会自动创建账号。
      </div>
    </Card>
  );
}
