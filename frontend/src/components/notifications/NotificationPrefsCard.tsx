import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TOKENS } from '@/lib/tokens';
import { teamApi } from '@/api/endpoints';
import { Button, Card, SectionHeader, toast } from '@/components/ui';

type PrefsPayload = { prefs: Record<string, Record<string, boolean>> };

export interface NotificationPrefsCardProps {
  teamId: number;
}

/**
 * 团队范围内的"我的通知偏好"卡片（仅站内）。
 * 用于团队工作台 `/team/prefs` 的通知偏好 tab。
 * 注：Web 系统暂未对接邮箱服务，邮件通知偏好暂不在 UI 中展示。
 */
export function NotificationPrefsCard({ teamId }: NotificationPrefsCardProps) {
  const qc = useQueryClient();
  const queryKey = ['notify-prefs', teamId] as const;

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => teamApi.notificationPrefs(teamId),
    enabled: !!teamId,
  });

  const set = useMutation({
    mutationFn: (entry: { key: string; channel: string; enabled: boolean }) =>
      teamApi.updateNotificationPrefs(teamId, [entry]),
    onMutate: async (entry) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<PrefsPayload>(queryKey);
      qc.setQueryData<PrefsPayload>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          prefs: {
            ...old.prefs,
            [entry.key]: { ...old.prefs[entry.key], [entry.channel]: entry.enabled },
          },
        };
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev);
      toast({ kind: 'error', message: '保存失败' });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  if (isLoading || !data) {
    return (
      <Card pad={20}>
        <div style={{ color: TOKENS.text3, fontSize: 12, padding: '8px 0' }}>加载中…</div>
      </Card>
    );
  }

  const v = (k: string, ch: string) => !!data.prefs?.[k]?.[ch];
  const flip = (k: string, ch: string) => set.mutate({ key: k, channel: ch, enabled: !v(k, ch) });

  return (
    <Card pad={20}>
      <SectionHeader title="站内通知" hint="影响通知中心和右上角铃铛未读" />
      <PrefRow title="新审核提交" hint="团队中有新的审核请求或重新提交时">
        <Switch on={v('review_submitted', 'inapp')} onChange={() => flip('review_submitted', 'inapp')} />
      </PrefRow>
      <PrefRow title="审核结果" hint="我提交的 Skill 被通过、驳回或请求修改时">
        <Switch on={v('review_result', 'inapp')} onChange={() => flip('review_result', 'inapp')} />
      </PrefRow>
      <PrefRow title="审核评论" hint="审核对话有新评论时">
        <Switch on={v('review_comment', 'inapp')} onChange={() => flip('review_comment', 'inapp')} />
      </PrefRow>
      <PrefRow title="手机号邀请" hint="有团队向我的手机号发送邀请时">
        <Switch on={v('phone_invite', 'inapp')} onChange={() => flip('phone_invite', 'inapp')} />
      </PrefRow>
      <PrefRow title="套件发布 / 更新" hint="团队套件被发布或内容变更时">
        <Switch on={v('suite_published', 'inapp')} onChange={() => flip('suite_published', 'inapp')} />
      </PrefRow>
      <PrefRow title="团队成员变化" hint="我被加入、移除或角色被调整时">
        <Switch on={v('team_member_change', 'inapp')} onChange={() => flip('team_member_change', 'inapp')} />
      </PrefRow>
      <PrefRow title="每周个人摘要" hint="每周一上午发我的 Skill 表现">
        <Switch on={v('weekly_digest', 'inapp')} onChange={() => flip('weekly_digest', 'inapp')} />
      </PrefRow>
    </Card>
  );
}

function PrefRow({
  title,
  hint,
  children,
}: {
  title: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '14px 0',
        borderBottom: `1px solid ${TOKENS.borderSoft}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: TOKENS.text }}>{title}</div>
        {hint && (
          <div style={{ fontSize: 11.5, color: TOKENS.text3, marginTop: 2 }}>{hint}</div>
        )}
      </div>
      <div style={{ flex: '0 0 auto' }}>{children}</div>
    </div>
  );
}

function Switch({ on, onChange }: { on: boolean; onChange?: (v: boolean) => void }) {
  return (
    <Button variant="ghost"
      type="button"
      onClick={() => onChange?.(!on)}
      style={{
        width: 36,
        height: 20,
        borderRadius: 999,
        border: 'none',
        cursor: 'pointer',
        background: on ? TOKENS.primary : TOKENS.bgGray,
        position: 'relative',
        transition: 'background .15s',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: 999,
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,.15)',
          transition: 'left .15s',
        }}
      />
    </Button>
  );
}
