import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TOKENS } from '@/lib/tokens';
import { Button, Card, CopyButton, Divider, Slider, toast } from '@/components/ui';
import { I } from '@/components/icons';
import { useCurrentTeam, useMyTeams } from '@/api/data';
import { teamApi } from '@/api/endpoints';
import { buildInviteMessage } from '@/lib/invite';
import type { TeamRole } from '@/mocks/team';

type CodeRole = Extract<TeamRole, 'Member' | 'Admin'>;

export function CreateCodePanel() {
  const { teamId } = useCurrentTeam();
  const { data: myTeams } = useMyTeams();
  const teamName = myTeams?.find((t) => Number(t.id) === teamId)?.name;
  const [maxUses, setMaxUses] = useState(10);
  const [days, setDays] = useState(14);
  const [role, setRole] = useState<CodeRole>('Member');
  const [generated, setGenerated] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const createCode = useMutation({
    mutationFn: () =>
      teamApi.invites.createCode(teamId!, {
        max: maxUses,
        expiresInDays: days,
        role: role.toUpperCase(),
      }),
    onSuccess: (inv) => {
      setGenerated(inv.code);
      queryClient.invalidateQueries({ queryKey: ['invites', teamId] });
      toast({ kind: 'success', message: '邀请码已生成，可复制分享' });
    },
    onError: (err) => {
      toast({
        kind: 'error',
        message: err instanceof Error ? `生成失败：${err.message}` : '生成邀请码失败',
      });
    },
  });

  function gen() {
    createCode.mutate();
  }

  return (
    <Card pad={18} style={{ alignSelf: 'flex-start', position: 'sticky', top: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>创建邀请码</div>
      <div style={{ fontSize: 11.5, color: TOKENS.text3, marginBottom: 16 }}>
        生成后可复制分享。任何已登录用户输入后即可加入团队。
      </div>

      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: TOKENS.text2,
            marginBottom: 6,
          }}
        >
          角色
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['Member', 'Admin'] as const).map((r) => (
            <Button variant="ghost"
              key={r}
              type="button"
              onClick={() => setRole(r)}
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: 12.5,
                fontWeight: 500,
                background: role === r ? TOKENS.primarySoft : '#fff',
                color: role === r ? TOKENS.primaryDeep : TOKENS.text2,
                border: `1px solid ${role === r ? TOKENS.primary : TOKENS.border}`,
                borderRadius: 6,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {r}
            </Button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
            color: TOKENS.text2,
            marginBottom: 6,
          }}
        >
          <span style={{ fontWeight: 500 }}>最大使用次数</span>
          <span style={{ fontFamily: 'monospace', color: TOKENS.primary }}>
            {maxUses}
          </span>
        </div>
        <Slider
          min={1}
          max={50}
          value={maxUses}
          onChange={(e) => setMaxUses(+e.target.value)}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
            color: TOKENS.text2,
            marginBottom: 6,
          }}
        >
          <span style={{ fontWeight: 500 }}>有效期</span>
          <span style={{ fontFamily: 'monospace', color: TOKENS.primary }}>
            {days} 天
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[1, 7, 14, 30, 90].map((d) => (
            <Button variant="ghost"
              key={d}
              type="button"
              onClick={() => setDays(d)}
              style={{
                flex: 1,
                padding: '6px 0',
                fontSize: 11.5,
                background: days === d ? TOKENS.text : '#fff',
                color: days === d ? '#fff' : TOKENS.text2,
                border: `1px solid ${days === d ? TOKENS.text : TOKENS.border}`,
                borderRadius: 5,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {d}天
            </Button>
          ))}
        </div>
      </div>

      <Button
        variant="primary"
        size="md"
        full
        onClick={gen}
        disabled={createCode.isPending}
        icon={<I.plus size={12} />}
      >
        {createCode.isPending ? '生成中…' : '生成邀请码'}
      </Button>

      {generated && (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            background: TOKENS.primarySoft,
            borderRadius: 8,
            border: `1px dashed ${TOKENS.primary}55`,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: TOKENS.primaryDeep,
              marginBottom: 6,
              fontWeight: 500,
            }}
          >
            已生成 · {days} 天有效 · {role}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code
              style={{
                flex: 1,
                fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                fontSize: 14,
                padding: '8px 12px',
                background: '#fff',
                borderRadius: 6,
                color: TOKENS.text,
                fontWeight: 600,
                letterSpacing: 1,
              }}
            >
              {generated}
            </code>
            <CopyButton
              text={generated}
              variant="primary"
              successMessage="邀请码已复制"
            />
          </div>
          <CopyButton
            text={buildInviteMessage(teamName, generated)}
            label="复制邀请链接文案"
            variant="secondary"
            size="sm"
            style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}
            successMessage="已复制邀请文案"
          />
        </div>
      )}

      <Divider style={{ margin: '16px 0' }} />
      <div style={{ fontSize: 11.5, color: TOKENS.text3, lineHeight: 1.6 }}>
        💡 邀请码会被记录到团队审计日志,使用次数与剩余天数会实时更新。
      </div>
    </Card>
  );
}
