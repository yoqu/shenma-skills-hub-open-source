import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewApi } from '@/api/endpoints';
import type { Review } from '@/mocks/reviews';
import { AdminShell } from './_shared/AdminShell';
import { TOKENS } from '@/lib/tokens';
import { Tabs } from '@/components/chrome';
import { useCurrentTeam, useReviews } from '@/api/data';
import { Button, DashTopBar, toast } from '@/components/ui';
import { ReviewList } from './Reviews/ReviewList';
import { ReviewPane, type Decision } from './Reviews/ReviewPane';

export default function AdminReviews() {
  const { teamId } = useCurrentTeam();
  const [tab, setTab] = useState<'pending' | 'rejected' | 'approved'>('pending');
  const [targetType, setTargetType] = useState<'all' | 'SKILL' | 'PROMPT'>('all');
  const { data: reviews = [] } = useReviews();
  const [selected, setSelected] = useState<Review | null>(null);
  const [decision, setDecision] = useState<Decision>(null);
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();
  const decide = useMutation({
    mutationFn: async () => {
      const rowId = (selected as Review & { rowId?: number } | null)?.rowId;
      if (!rowId || !decision) return decision;
      if (decision === 'approve') await reviewApi.approve(rowId);
      else await reviewApi.reject(rowId, { reason });
      return decision;
    },
    onSuccess: (kind) => {
      queryClient.invalidateQueries({ queryKey: ['reviews', teamId] });
      // 审核结果会改变 skill / prompt 的状态与可见性，同步刷新团队列表与活动流
      queryClient.invalidateQueries({ queryKey: ['team-skills', teamId] });
      queryClient.invalidateQueries({ queryKey: ['team-prompts', teamId] });
      queryClient.invalidateQueries({ queryKey: ['activity', teamId] });
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      if (kind) {
        toast({
          kind: 'success',
          message: kind === 'approve' ? '已通过，Skill 即将上架' : '已拒绝并通知提交者',
        });
      }
      setDecision(null);
      setReason('');
      setSelected(null);
    },
    onError: (err) => {
      toast({
        kind: 'error',
        message: err instanceof Error ? `审核操作失败：${err.message}` : '审核操作失败，请稍后重试',
      });
    },
  });

  const pending = useMemo(
    () => reviews.filter((r) => r.status === 'PENDING_REVIEW'),
    [reviews],
  );
  const rejected = useMemo(
    () => reviews.filter((r) => r.status === 'REJECTED'),
    [reviews],
  );
  const approved = useMemo(
    () => reviews.filter((r) => r.status === 'APPROVED'),
    [reviews],
  );
  const statusList = tab === 'pending' ? pending : tab === 'rejected' ? rejected : approved;
  const list = targetType === 'all' ? statusList : statusList.filter((r) => r.targetType === targetType);

  useEffect(() => {
    if (list.length === 0) {
      if (selected) setSelected(null);
      return;
    }
    if (!selected || !list.some((r) => r.id === selected.id)) setSelected(list[0]);
  }, [list, selected]);

  const tabs = [
    { id: 'pending', label: '待审核', count: pending.length },
    { id: 'rejected', label: '已拒绝', count: rejected.length },
    { id: 'approved', label: '已通过', count: approved.length },
  ];

  return (
    <AdminShell active="reviews">
      <DashTopBar
        title="审核队列"
        hint={`${pending.length} 个待处理 · 平均处理时长 4.2 小时`}
      />
      <div
        style={{
          background: '#fff',
          borderBottom: `1px solid ${TOKENS.border}`,
          padding: '0 32px',
        }}
      >
        <Tabs
          tabs={tabs}
          active={tab}
          onChange={(id) => setTab(id as 'pending' | 'rejected' | 'approved')}
        />
        <div style={{ display: 'flex', gap: 8, padding: '12px 0 14px' }}>
          {([
            ['all', '全部类型'],
            ['SKILL', 'Skill'],
            ['PROMPT', 'Prompt'],
          ] as const).map(([id, label]) => (
            <Button variant="ghost"
              key={id}
              type="button"
              onClick={() => setTargetType(id)}
              style={{
                height: 28,
                padding: '0 10px',
                border: `1px solid ${targetType === id ? TOKENS.primary : TOKENS.border}`,
                borderRadius: 6,
                background: targetType === id ? TOKENS.primarySoft : '#fff',
                color: targetType === id ? TOKENS.primaryDeep : TOKENS.text2,
                fontSize: 12,
                fontWeight: targetType === id ? 600 : 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '380px 1fr',
          overflow: 'hidden',
        }}
      >
        <ReviewList
          list={list}
          selected={selected}
          setSelected={(s) => {
            setSelected(s);
            setDecision(null);
            setReason('');
          }}
        />
        {selected && (
          <ReviewPane
            review={selected}
            decision={decision}
            setDecision={setDecision}
            reason={reason}
            setReason={setReason}
            onSubmit={() => decide.mutate()}
            submitting={decide.isPending}
          />
        )}
      </div>
    </AdminShell>
  );
}
