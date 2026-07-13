import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TOKENS } from '@/lib/tokens';
import { Avatar, Badge, Button, Card, DashTopBar, EmptyState, SkillIcon, toast } from '@/components/ui';
import { Tabs, type TabItem } from '@/components/chrome';
import { I } from '@/components/icons';
import { MemberShell } from '../_shared/MemberShell';
import { AdminShell } from '../../admin/_shared/AdminShell';
import { CommentsModal } from './CommentsModal';
import { NewVersionModal } from './NewVersionModal';
import { useCurrentTeam, useMyTeams, useReviews, useTeam } from '@/api/data';
import { reviewApi, skillApi } from '@/api/endpoints';
import { STATUS_MAP, type Submission, type SubmissionStatus } from './data';
import type { Review } from '@/mocks/reviews';

type Tab = 'all' | SubmissionStatus;
type TargetFilter = 'all' | 'SKILL' | 'PROMPT';

export default function MySubmissions() {
  const nav = useNavigate();
  const queryClient = useQueryClient();
  const { teamId, role } = useCurrentTeam();
  const isWriter = role === 'Admin' || role === 'Owner';
  const Shell = isWriter ? AdminShell : MemberShell;
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTarget: TargetFilter = (() => {
    const raw = searchParams.get('type');
    if (raw === 'prompt') return 'PROMPT';
    if (raw === 'skill') return 'SKILL';
    return 'all';
  })();
  const [targetFilter, setTargetFilter] = useState<TargetFilter>(initialTarget);
  const [tab, setTab] = useState<Tab>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [newVersionFor, setNewVersionFor] = useState<Submission | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const { me } = useMyTeams(true);
  const { data: team } = useTeam();
  const reviewsQuery = useReviews();
  const reviews = reviewsQuery.data ?? [];
  const mine = reviews.filter((r) => r.submittedBy.handle === me?.handle);
  const allSubmissions = mine.map(toSubmission);
  const submissions = allSubmissions.filter(
    (s) => targetFilter === 'all' || s.targetType === targetFilter,
  );

  function changeTargetFilter(next: TargetFilter) {
    setTargetFilter(next);
    setTab('all');
    const params = new URLSearchParams(searchParams);
    if (next === 'all') params.delete('type');
    else params.set('type', next === 'PROMPT' ? 'prompt' : 'skill');
    setSearchParams(params, { replace: true });
  }

  const refreshReviews = () => {
    queryClient.invalidateQueries({ queryKey: ['reviews', teamId] });
    queryClient.invalidateQueries({ queryKey: ['team-skills', teamId] });
  };

  const withdrawMutation = useMutation({
    mutationFn: (rowId: number) => reviewApi.withdraw(rowId),
    onSuccess: () => {
      refreshReviews();
      toast({ kind: 'success', message: '已撤回审核' });
    },
    onError: (err) => {
      toast({
        kind: 'error',
        message: err instanceof Error ? `撤回失败：${err.message}` : '撤回失败',
      });
    },
  });

  const resubmitMutation = useMutation({
    mutationFn: (rowId: number) => reviewApi.resubmit(rowId),
    onSuccess: () => {
      refreshReviews();
      toast({ kind: 'success', message: '已重新提交，等待团队审核' });
    },
    onError: (err) => {
      toast({
        kind: 'error',
        message: err instanceof Error ? `重新提交失败：${err.message}` : '重新提交失败',
      });
    },
  });

  const submitDraftMutation = useMutation({
    mutationFn: (rowId: number) => reviewApi.submit(rowId),
    onSuccess: () => {
      refreshReviews();
      toast({ kind: 'success', message: '已提交审核' });
    },
    onError: (err) => {
      toast({
        kind: 'error',
        message: err instanceof Error ? `提交失败：${err.message}` : '提交失败',
      });
    },
  });

  const deleteReviewMutation = useMutation({
    mutationFn: (rowId: number) => reviewApi.remove(rowId),
    onSuccess: () => {
      refreshReviews();
      toast({ kind: 'success', message: '已删除' });
    },
    onError: (err) => {
      toast({
        kind: 'error',
        message: err instanceof Error ? `删除失败：${err.message}` : '删除失败',
      });
    },
  });

  const submitVersionMutation = useMutation({
    mutationFn: ({ skillId, version, changelog, zipUrl }: {
      skillId: number;
      version: string;
      changelog: string;
      zipUrl: string;
    }) => skillApi.submitVersion(skillId, { version, changelog, zipUrl }),
    onSuccess: () => {
      refreshReviews();
      setNewVersionFor(null);
      toast({ kind: 'success', message: '新版本已提交，等待团队审核' });
    },
    onError: (err) => {
      toast({
        kind: 'error',
        message: err instanceof Error ? `发新版本失败：${err.message}` : '发新版本失败',
      });
    },
  });

  function onWithdraw(rowId?: number) {
    if (!rowId) {
      toast({ kind: 'error', message: '审核记录缺少 ID，无法撤回' });
      return;
    }
    if (window.confirm('确认撤回这次审核？Skill 会回到草稿状态。')) {
      withdrawMutation.mutate(rowId);
    }
  }

  function onResubmit(submission: Submission) {
    const rowId = submission.rowId;
    if (!rowId) {
      toast({ kind: 'error', message: '审核记录缺少 ID，无法重新提交' });
      return;
    }
    // Prompt：跳到 rework 编辑页，修改后再调 resubmit；Skill：保持原一键重提
    if (submission.targetType === 'PROMPT') {
      nav(`/team/prompts/rework/${rowId}`);
      return;
    }
    resubmitMutation.mutate(rowId);
  }

  function onSubmitDraft(rowId?: number) {
    if (!rowId) {
      toast({ kind: 'error', message: '审核记录缺少 ID，无法提交' });
      return;
    }
    submitDraftMutation.mutate(rowId);
  }

  function onDeleteReview(rowId?: number, name?: string) {
    if (!rowId) {
      toast({ kind: 'error', message: '审核记录缺少 ID，无法删除' });
      return;
    }
    if (window.confirm(`确认删除「${name ?? '该提交'}」？删除后不可恢复。`)) {
      deleteReviewMutation.mutate(rowId);
    }
  }

  function onOpenNewVersion(submission: Submission) {
    if (!submission.skillId) {
      toast({ kind: 'error', message: 'Skill 还未建档，无法发新版本' });
      return;
    }
    setNewVersionFor(submission);
  }

  const tabs: TabItem[] = [
    { id: 'all', label: '全部', count: submissions.length },
    {
      id: 'DRAFT',
      label: '草稿',
      count: submissions.filter((r) => r.status === 'DRAFT').length,
    },
    {
      id: 'PENDING_REVIEW',
      label: '审核中',
      count: submissions.filter((r) => r.status === 'PENDING_REVIEW').length,
    },
    {
      id: 'APPROVED',
      label: '已通过',
      count: submissions.filter((r) => r.status === 'APPROVED').length,
    },
    {
      id: 'CHANGES_REQUESTED',
      label: '需改动',
      count: submissions.filter((r) => r.status === 'CHANGES_REQUESTED').length,
    },
    {
      id: 'REJECTED',
      label: '已拒绝',
      count: submissions.filter((r) => r.status === 'REJECTED').length,
    },
    {
      id: 'WITHDRAWN',
      label: '已撤回',
      count: submissions.filter((r) => r.status === 'WITHDRAWN').length,
    },
  ];

  const list = submissions.filter((r) => tab === 'all' || r.status === tab);
  const opened = openId ? submissions.find((r) => r.id === openId) ?? null : null;
  const firstChangeRequest = submissions.find(
    (r) => r.status === 'CHANGES_REQUESTED',
  );
  const approvedRate = submissions.length
    ? Math.round((submissions.filter((r) => r.status === 'APPROVED').length / submissions.length) * 100)
    : 0;

  useEffect(() => {
    if (!opened) return;
    setReplyDraft('');
    const wrap = rootRef.current?.parentElement;
    const prevOverflow = wrap ? wrap.style.overflow : '';
    if (wrap) {
      wrap.scrollTop = 0;
      wrap.style.overflow = 'hidden';
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenId(null);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (wrap) wrap.style.overflow = prevOverflow || '';
    };
  }, [opened]);

  const openCommentsFor = (id: string) => setOpenId(id);

  return (
    <Shell
      active="mine"
      rootRef={rootRef}
      rootStyle={{ position: 'relative' }}
    >
      <DashTopBar
        title="我的提交"
        hint={`我在 ${team?.name || '当前团队'} 共发起过 ${submissions.length} 次审核 · 通过率 ${approvedRate}%`}
      />
      <div
        style={{
          background: '#fff',
          borderBottom: `1px solid ${TOKENS.border}`,
          padding: '0 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <Tabs tabs={tabs} active={tab} onChange={(id) => setTab(id as Tab)} />
        <TargetFilterSegment
          value={targetFilter}
          onChange={changeTargetFilter}
          counts={{
            all: allSubmissions.length,
            SKILL: allSubmissions.filter((s) => s.targetType === 'SKILL').length,
            PROMPT: allSubmissions.filter((s) => s.targetType === 'PROMPT').length,
          }}
        />
      </div>

      <div
        style={{
          padding: '20px 32px 40px',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {firstChangeRequest && tab === 'all' && (
          <Card pad={14} style={{ background: '#FFFBEB', border: `1px solid #FCD34D` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: TOKENS.warning,
                  color: '#fff',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <I.bell size={14} />
              </div>
              <div style={{ flex: 1 }}>
                <b style={{ fontSize: 13, color: TOKENS.text }}>
                  1 个 Skill 需要你修改后重新提交
                </b>
                <div style={{ fontSize: 11.5, color: TOKENS.text2, marginTop: 2 }}>
                  审核人 {firstChangeRequest.reviewer} 在 {firstChangeRequest.submittedAt}
                  留下了改动建议,请尽快处理后重新提交。
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => openCommentsFor(firstChangeRequest.id)}
              >
                立即查看
              </Button>
            </div>
          </Card>
        )}

        {reviewsQuery.isError ? (
          <Card pad={24}>
            <EmptyState
              icon={<I.x size={20} />}
              title="审核记录加载失败"
              hint={reviewsQuery.error instanceof Error ? reviewsQuery.error.message : '请稍后重试'}
              action={
                <Button variant="secondary" size="sm" onClick={() => reviewsQuery.refetch()}>
                  重试
                </Button>
              }
            />
          </Card>
        ) : reviewsQuery.isLoading ? (
          <Card pad={24}>
            <EmptyState icon={<I.clock size={20} />} title="正在加载提交记录…" />
          </Card>
        ) : list.length === 0 ? (
          <Card pad={24}>
            <EmptyState
              icon={<I.upload size={20} />}
              title={tab === 'all' ? '你还没有提交记录' : '当前筛选下没有提交'}
              hint={
                tab === 'all'
                  ? targetFilter === 'PROMPT'
                    ? '提交你的第一个 Prompt，让团队复用'
                    : '提交你的第一个 Skill，让团队用起来'
                  : '试试切换其他标签'
              }
              action={
                tab === 'all' ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => nav(targetFilter === 'PROMPT' ? '/create/prompt' : '/create/skill')}
                  >
                    {targetFilter === 'PROMPT' ? '提交 Prompt' : '提交 Skill'}
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          list.map((r) => (
            <SubmissionRow
              key={r.id}
              r={r}
              onOpenComments={openCommentsFor}
              onWithdraw={() => onWithdraw(r.rowId)}
              onResubmit={() => onResubmit(r)}
              onSubmitDraft={() => onSubmitDraft(r.rowId)}
              onDelete={() => onDeleteReview(r.rowId, r.name)}
              onNewVersion={() => onOpenNewVersion(r)}
              withdrawing={withdrawMutation.isPending && withdrawMutation.variables === r.rowId}
              resubmitting={resubmitMutation.isPending && resubmitMutation.variables === r.rowId}
              submittingDraft={submitDraftMutation.isPending && submitDraftMutation.variables === r.rowId}
              deleting={deleteReviewMutation.isPending && deleteReviewMutation.variables === r.rowId}
            />
          ))
        )}
      </div>

      {opened && (
        <CommentsModal
          submission={opened}
          statusMeta={STATUS_MAP[opened.status]}
          replyDraft={replyDraft}
          setReplyDraft={setReplyDraft}
          onClose={() => setOpenId(null)}
          me={me}
        />
      )}

      {newVersionFor && (
        <NewVersionModal
          currentVersion={newVersionFor.version}
          skillName={newVersionFor.name}
          submitting={submitVersionMutation.isPending}
          onClose={() => {
            if (!submitVersionMutation.isPending) setNewVersionFor(null);
          }}
          onSubmit={({ version, changelog, zipUrl }) => {
            if (!newVersionFor.skillId) return;
            submitVersionMutation.mutate({
              skillId: newVersionFor.skillId,
              version,
              changelog,
              zipUrl,
            });
          }}
        />
      )}
    </Shell>
  );
}

function toSubmission(r: Review & { rowId?: number }, index: number): Submission {
  // 区分 REJECTED / CHANGES_REQUESTED / WITHDRAWN — SUB-002 / REV-004 / REV-005
  let status: SubmissionStatus;
  if (r.status === 'APPROVED') status = 'APPROVED';
  else if (r.status === 'PENDING_REVIEW') status = 'PENDING_REVIEW';
  else if (r.status === 'CHANGES_REQUESTED') status = 'CHANGES_REQUESTED';
  else if (r.status === 'REJECTED') status = 'REJECTED';
  else if (r.status === 'WITHDRAWN') status = 'WITHDRAWN';
  else if ((r.status as string) === 'DRAFT') status = 'DRAFT';
  else status = 'CHANGES_REQUESTED';
  const comments: Submission['comments'] = [
    {
      id: `${r.id}-system`,
      kind: 'system' as const,
      ts: r.submittedAt,
      body: `${r.name} 提交进入审核流程 · 当前状态 ${r.status}`,
    },
  ];
  if (r.reason) {
    comments.push({
      id: `${r.id}-reason`,
      kind: 'change-request' as const,
      ts: r.submittedAt,
      body: r.reason,
    });
  }
  const targetType = (r.targetType === 'PROMPT' ? 'PROMPT' : 'SKILL') as 'SKILL' | 'PROMPT';
  const promptId = targetType === 'PROMPT' ? r.targetId : undefined;
  return {
    id: r.id,
    rowId: r.rowId,
    skillId: (r as Review & { skillId?: number }).skillId,
    promptId,
    targetType,
    name: r.name,
    version: r.version,
    submittedAt: r.submittedAt,
    visibility: r.visibility,
    short: r.short,
    files: r.files,
    safety: r.safety,
    evalScore: r.evalScore,
    status,
    reviewer: status === 'PENDING_REVIEW' ? '待分配' : '管理员',
    position: status === 'PENDING_REVIEW' ? index + 1 : undefined,
    approvedAt: status === 'APPROVED' ? r.submittedAt : undefined,
    feedback: r.reason,
    changelog: r.changelog,
    unread: r.reason ? 1 : 0,
    comments,
  };
}

function SubmissionRow({
  r,
  onOpenComments,
  onWithdraw,
  onResubmit,
  onSubmitDraft,
  onDelete,
  onNewVersion,
  withdrawing,
  resubmitting,
  submittingDraft,
  deleting,
}: {
  r: Submission;
  onOpenComments: (id: string) => void;
  onWithdraw: () => void;
  onResubmit: () => void;
  onSubmitDraft: () => void;
  onDelete: () => void;
  onNewVersion: () => void;
  withdrawing: boolean;
  resubmitting: boolean;
  submittingDraft: boolean;
  deleting: boolean;
}) {
  const s = STATUS_MAP[r.status];
  const Ico = s.ico;
  const total = r.comments.length;
  return (
    <Card pad={16}>
      <div style={{ display: 'flex', gap: 14 }}>
        {r.targetType === 'PROMPT' ? (
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: TOKENS.primarySoft,
              color: TOKENS.primaryDeep,
              display: 'grid',
              placeItems: 'center',
              flex: '0 0 auto',
            }}
          >
            <I.code size={20} />
          </div>
        ) : (
          <SkillIcon ch={r.name.slice(-1).toUpperCase()} size={44} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <Badge tone={r.targetType === 'PROMPT' ? 'info' : 'neutral'} size="sm">
              {r.targetType === 'PROMPT' ? 'Prompt' : 'Skill'}
            </Badge>
            <b style={{ fontSize: 14 }}>{r.name}</b>
            <span
              style={{ fontFamily: 'monospace', fontSize: 11.5, color: TOKENS.text3 }}
            >
              v{r.version}
            </span>
            <Badge tone={r.visibility === 'PUBLIC' ? 'primary' : 'info'} size="sm">
              {r.visibility === 'PUBLIC' ? (
                <>
                  <I.globe size={10} /> 公开
                </>
              ) : (
                <>
                  <I.lock size={10} /> 团队私有
                </>
              )}
            </Badge>
            <Badge tone={s.tone} size="sm">
              <Ico size={10} /> {s.label}
            </Badge>
            {r.changelog && (
              <Badge
                tone="primary"
                size="sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}
              >
                <I.layers size={10} /> 新版本
              </Badge>
            )}
          </div>
          <div style={{ fontSize: 12.5, color: TOKENS.text2, marginTop: 6 }}>
            {r.short}
          </div>
          {r.changelog && (
            <div
              style={{
                marginTop: 8,
                padding: '8px 10px',
                background: TOKENS.primarySoft,
                border: `1px solid ${TOKENS.primary}33`,
                borderRadius: 6,
                fontSize: 12,
                color: TOKENS.text2,
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              <b style={{ color: TOKENS.primaryDeep, fontSize: 11.5 }}>本次变更：</b>{' '}
              {r.changelog}
            </div>
          )}
          <div
            style={{
              display: 'flex',
              gap: 14,
              fontSize: 11.5,
              color: TOKENS.text3,
              marginTop: 8,
              flexWrap: 'wrap',
            }}
          >
            <span>提交于 {r.submittedAt}</span>
            {r.targetType !== 'PROMPT' && <span>{r.files} 个文件</span>}
            {r.targetType !== 'PROMPT' && <span>安全评估 {r.evalScore}</span>}
            <span>审核人 {r.reviewer}</span>
            {r.status === 'APPROVED' && (
              <span style={{ color: TOKENS.success }}>· 通过于 {r.approvedAt}</span>
            )}
            {r.status === 'PENDING_REVIEW' && (
              <span style={{ color: TOKENS.warning }}>· 队列第 {r.position} 位</span>
            )}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            alignItems: 'flex-end',
            flex: '0 0 auto',
          }}
        >
          <CommentEntryButton
            total={total}
            unread={r.unread}
            onClick={() => onOpenComments(r.id)}
          />
          {r.status === 'PENDING_REVIEW' && (
            <Button
              variant="ghost"
              size="sm"
              style={{ color: TOKENS.danger }}
              onClick={onWithdraw}
              disabled={withdrawing || !r.rowId}
              title={r.rowId ? '撤回这次审核' : '审核记录缺少 ID'}
            >
              {withdrawing ? '撤回中…' : '撤回'}
            </Button>
          )}
          {r.status === 'APPROVED' && r.targetType !== 'PROMPT' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onNewVersion}
              disabled={!r.skillId}
              title={r.skillId ? '提交一个新版本进入审核' : 'Skill 还未建档'}
            >
              发新版本
            </Button>
          )}
          {r.status === 'APPROVED' && r.targetType === 'PROMPT' && r.promptId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                window.location.assign(`/team/prompts/${r.promptId}/new-version`);
              }}
              title="提交一个新版本进入审核"
            >
              发新版本
            </Button>
          )}
          {r.status === 'CHANGES_REQUESTED' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onResubmit}
              disabled={resubmitting || !r.rowId}
              title={r.rowId ? '修改完成后重新提交审核' : '审核记录缺少 ID'}
            >
              {resubmitting && r.targetType !== 'PROMPT'
                ? '提交中…'
                : r.targetType === 'PROMPT'
                  ? '修改并重新提交'
                  : '重新提交'}
            </Button>
          )}
          {r.status === 'DRAFT' && (
            <Button
              variant="primary"
              size="sm"
              onClick={onSubmitDraft}
              disabled={submittingDraft || !r.rowId}
              title={r.rowId ? '提交草稿进入审核' : '审核记录缺少 ID'}
            >
              {submittingDraft ? '提交中…' : '提交审核'}
            </Button>
          )}
          {(r.status === 'REJECTED' || r.status === 'WITHDRAWN') && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onResubmit}
              disabled={resubmitting || !r.rowId}
              title={r.rowId ? '修改后重新提交审核' : '审核记录缺少 ID'}
            >
              {resubmitting && r.targetType !== 'PROMPT'
                ? '提交中…'
                : r.targetType === 'PROMPT'
                  ? '修改并重新提交'
                  : '重新提交'}
            </Button>
          )}
          {(r.status === 'DRAFT' || r.status === 'REJECTED' || r.status === 'WITHDRAWN') && (
            <Button
              variant="ghost"
              size="sm"
              style={{ color: TOKENS.danger }}
              onClick={onDelete}
              disabled={deleting || !r.rowId}
              title={r.rowId ? '删除该记录' : '审核记录缺少 ID'}
            >
              {deleting ? '删除中…' : '删除'}
            </Button>
          )}
        </div>
      </div>
      {r.status === 'CHANGES_REQUESTED' && (
        <Button variant="ghost"
          type="button"
          onClick={() => onOpenComments(r.id)}
          style={{
            marginTop: 12,
            width: '100%',
            textAlign: 'left',
            padding: 12,
            background: '#FEF2F2',
            border: `1px solid #FECACA`,
            borderRadius: 8,
            fontSize: 12.5,
            color: TOKENS.text2,
            lineHeight: 1.6,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 4,
            }}
          >
            <Avatar name={r.reviewer} char={r.reviewer.slice(0, 1)} size={20} />
            <b style={{ fontSize: 12, color: TOKENS.text }}>{r.reviewer} 的反馈</b>
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 11,
                color: TOKENS.danger,
                fontWeight: 600,
              }}
            >
              点击查看完整讨论 ({total}) →
            </span>
          </div>
          {r.feedback}
        </Button>
      )}
    </Card>
  );
}

function CommentEntryButton({
  total,
  unread,
  onClick,
}: {
  total: number;
  unread: number;
  onClick: () => void;
}) {
  return (
    <Button variant="ghost"
      type="button"
      onClick={onClick}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 10px',
        height: 28,
        fontSize: 12,
        fontWeight: 500,
        background: unread > 0 ? TOKENS.primarySoft : '#fff',
        color: unread > 0 ? TOKENS.primaryDeep : TOKENS.text,
        border: `1px solid ${unread > 0 ? TOKENS.primary : TOKENS.border}`,
        borderRadius: 8,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        fontFamily: 'inherit',
      }}
    >
      <I.inbox size={12} />
      查看评论
      <span
        style={{
          fontSize: 11,
          fontVariantNumeric: 'tabular-nums',
          color: unread > 0 ? TOKENS.primary : TOKENS.text3,
        }}
      >
        {total}
      </span>
      {unread > 0 && (
        <span
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: 16,
            height: 16,
            padding: '0 4px',
            background: TOKENS.danger,
            color: '#fff',
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid #fff',
          }}
        >
          {unread}
        </span>
      )}
    </Button>
  );
}

function TargetFilterSegment({
  value,
  onChange,
  counts,
}: {
  value: TargetFilter;
  onChange: (next: TargetFilter) => void;
  counts: { all: number; SKILL: number; PROMPT: number };
}) {
  const opts: { id: TargetFilter; label: string; count: number }[] = [
    { id: 'all', label: '全部', count: counts.all },
    { id: 'SKILL', label: 'Skill', count: counts.SKILL },
    { id: 'PROMPT', label: 'Prompt', count: counts.PROMPT },
  ];
  return (
    <div
      style={{
        display: 'inline-flex',
        background: TOKENS.bgAlt,
        border: `1px solid ${TOKENS.border}`,
        borderRadius: 8,
        padding: 2,
        flex: '0 0 auto',
      }}
    >
      {opts.map((o) => {
        const active = o.id === value;
        return (
          <Button variant="ghost"
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 500,
              border: 'none',
              background: active ? '#fff' : 'transparent',
              color: active ? TOKENS.text : TOKENS.text2,
              borderRadius: 6,
              cursor: 'pointer',
              boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              fontFamily: 'inherit',
            }}
          >
            {o.label}
            <span style={{ marginLeft: 4, color: TOKENS.text3, fontSize: 11 }}>{o.count}</span>
          </Button>
        );
      })}
    </div>
  );
}
