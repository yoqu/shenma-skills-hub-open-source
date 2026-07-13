import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TOKENS } from '@/lib/tokens';
import { hashColor } from '@/lib/utils';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  SkillIcon,
  Textarea,
  toast,
} from '@/components/ui';
import { I } from '@/components/icons';
import { reviewApi, skillApi, type ReviewCommentItem } from '@/api/endpoints';
import type { Review } from '@/mocks/reviews';
import { ReviewFiles } from './ReviewFiles';

export type Decision = null | 'approve' | 'reject';

export interface ReviewPaneProps {
  review: Review;
  decision: Decision;
  setDecision: (d: Decision) => void;
  reason: string;
  setReason: (s: string) => void;
  onSubmit?: () => void;
  submitting?: boolean;
}

const PRESET_REASONS = [
  '安装命令缺少说明,请补充使用示例',
  '依赖体积过大,请说明必要性或拆分',
  '安全扫描未通过,请处理告警后重新提交',
  '与团队现有 Skill 功能重叠,建议合并',
];

export function ReviewPane({
  review,
  decision,
  setDecision,
  reason,
  setReason,
  onSubmit,
  submitting,
}: ReviewPaneProps) {
  const rowId = (review as Review & { rowId?: number }).rowId;
  const detailQuery = useQuery({
    queryKey: ['review-detail', rowId],
    queryFn: () => reviewApi.detail(rowId!),
    enabled: typeof rowId === 'number',
  });
  const detail = detailQuery.data as (Partial<Review> & { payloadJson?: string }) | undefined;
  const merged = { ...review, ...detail } as Review & { rowId?: number; payloadJson?: string };
  const isPrompt = merged.targetType === 'PROMPT';
  const promptPayload = isPrompt ? parsePromptPayload(merged.payloadJson) : null;

  return (
    <div style={{ overflow: 'auto', padding: '20px 28px 40px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 16,
          marginBottom: 20,
        }}
      >
        {isPrompt ? (
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 10,
              background: TOKENS.bgGray,
              color: TOKENS.primary,
              display: 'grid',
              placeItems: 'center',
              flex: '0 0 auto',
            }}
          >
            <I.code size={22} />
          </div>
        ) : (
          <SkillIcon ch={merged.name.slice(-1).toUpperCase()} size={52} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 4,
              flexWrap: 'wrap',
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{merged.name}</h2>
            <Badge tone={isPrompt ? 'primary' : 'neutral'} size="sm">
              {isPrompt ? 'Prompt' : 'Skill'}
            </Badge>
            <Badge tone={merged.visibility === 'PUBLIC' ? 'primary' : 'info'} size="sm">
              {merged.visibility === 'PUBLIC' ? '公开' : '团队私有'}
            </Badge>
            <Badge tone="warning" size="sm">
              PENDING_REVIEW
            </Badge>
            {merged.changelog && (
              <Badge tone="primary" size="sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <I.layers size={10} /> 新版本
              </Badge>
            )}
          </div>
          <div style={{ fontSize: 13, color: TOKENS.text2, lineHeight: 1.6 }}>
            {merged.short}
          </div>
          <div
            style={{
              display: 'flex',
              gap: 14,
              marginTop: 10,
              fontSize: 12,
              color: TOKENS.text3,
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Avatar
                name={merged.submittedBy.name}
                char={merged.submittedBy.avatar}
                url={merged.submittedBy.avatarUrl}
                size={18}
              />
              {merged.submittedBy.name}
            </span>
            <span>· 提交于 {merged.submittedAt}</span>
            <span>· 版本 v{merged.version}</span>
            <span>· {isPrompt ? `${extractRefs(promptPayload?.contentMd ?? '').length} 个引用` : `${merged.files} 个文件`}</span>
          </div>
        </div>
      </div>

      {merged.changelog && <ReviewChangelogCard changelog={merged.changelog} version={merged.version} />}
      {isPrompt ? (
        <PromptReviewPayload payload={promptPayload} loading={detailQuery.isLoading} />
      ) : (
        <>
          <ReviewSpecCheck review={merged} />
          <ReviewFiles reviewId={rowId} />
        </>
      )}
      <ReviewComments review={merged} />
      <ReviewDecision
        review={merged}
        decision={decision}
        setDecision={setDecision}
        reason={reason}
        setReason={setReason}
        onSubmit={onSubmit}
        submitting={submitting}
      />
    </div>
  );
}

function ReviewChangelogCard({ changelog, version }: { changelog: string; version: string }) {
  return (
    <Card
      pad={14}
      style={{
        marginBottom: 14,
        background: TOKENS.primarySoft,
        border: `1px solid ${TOKENS.primary}33`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: TOKENS.primary,
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            flex: '0 0 auto',
          }}
          aria-hidden
        >
          <I.layers size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: TOKENS.primaryDeep, marginBottom: 4 }}>
            本次变更 · v{version}
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: TOKENS.text2,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {changelog}
          </div>
        </div>
      </div>
    </Card>
  );
}

interface PromptReviewPayloadData {
  kind?: string;
  slug?: string;
  name?: string;
  shortDesc?: string;
  cat?: string;
  visibility?: string;
  version?: string;
  tags?: string[];
  contentMd?: string;
  changelog?: string;
}

function PromptReviewPayload({
  payload,
  loading,
}: {
  payload: PromptReviewPayloadData | null;
  loading?: boolean;
}) {
  const refs = extractRefs(payload?.contentMd ?? '');
  return (
    <Card pad={16} style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Prompt 审核内容</div>
        {loading && <span style={{ fontSize: 11, color: TOKENS.text3 }}>同步详情中…</span>}
        <Badge tone="neutral" size="sm" style={{ marginLeft: 'auto' }}>
          {payload?.kind ?? 'CREATE'}
        </Badge>
      </div>
      {!payload ? (
        <EmptyState compact icon={<I.clock size={16} />} title="正在读取 Prompt payload…" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <div style={{ fontSize: 11.5, color: TOKENS.text3, marginBottom: 6 }}>原始 Markdown</div>
            <pre style={promptPreviewStyle}>{payload.contentMd}</pre>
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: TOKENS.text3, marginBottom: 6 }}>引用检查</div>
            {refs.length === 0 ? (
              <div style={{ fontSize: 12.5, color: TOKENS.text3 }}>没有引用其他 Prompt。</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {refs.map((ref, idx) => (
                  <div
                    key={`${ref.teamSlug}-${ref.slug}-${idx}`}
                    style={{
                      padding: '8px 10px',
                      border: `1px solid ${TOKENS.borderSoft}`,
                      borderRadius: 6,
                      background: TOKENS.bgAlt,
                      fontSize: 12,
                    }}
                  >
                    <b>{ref.label}</b>
                    <code style={{ marginLeft: 8, color: TOKENS.text3 }}>{ref.teamSlug}/{ref.slug}</code>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function ReviewComments({ review }: { review: Review }) {
  const queryClient = useQueryClient();
  const rowId = (review as Review & { rowId?: number }).rowId;
  const [draft, setDraft] = useState('');

  const commentsQuery = useQuery({
    queryKey: ['review-comments', rowId],
    queryFn: () => reviewApi.listComments(rowId!),
    enabled: typeof rowId === 'number',
  });
  const comments = commentsQuery.data ?? [];

  const postMutation = useMutation({
    mutationFn: (body: string) => reviewApi.postComment(rowId!, { body }),
    onSuccess: () => {
      setDraft('');
      queryClient.invalidateQueries({ queryKey: ['review-comments', rowId] });
      toast({ kind: 'success', message: '已发送回复' });
    },
    onError: (err) => {
      toast({
        kind: 'error',
        message: err instanceof Error ? `发送失败：${err.message}` : '发送失败',
      });
    },
  });

  const isLocked = review.status === 'APPROVED';
  const canSend = draft.trim().length > 0 && !!rowId && !isLocked && !postMutation.isPending;

  function handleSend() {
    if (!canSend) return;
    postMutation.mutate(draft.trim());
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <Card pad={16} style={{ marginBottom: 14 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600 }}>审核对话</div>
        <div style={{ fontSize: 11.5, color: TOKENS.text3 }}>
          · 与提交者沟通修改意见，所有评论会同步给作者
        </div>
        {commentsQuery.isFetching && comments.length > 0 && (
          <span style={{ fontSize: 11, color: TOKENS.text3, marginLeft: 'auto' }}>
            同步中…
          </span>
        )}
      </div>

      {commentsQuery.isError ? (
        <EmptyState
          compact
          icon={<I.x size={16} />}
          title="评论加载失败"
          hint={commentsQuery.error instanceof Error ? commentsQuery.error.message : '请稍后重试'}
          action={
            <Button variant="ghost" size="sm" onClick={() => commentsQuery.refetch()}>
              重试
            </Button>
          }
        />
      ) : commentsQuery.isLoading ? (
        <EmptyState compact icon={<I.clock size={16} />} title="正在加载评论…" />
      ) : comments.length === 0 ? (
        <EmptyState
          compact
          title="还没有讨论"
          hint={isLocked ? '该审核已结案' : '通过下方输入框开始与作者沟通'}
        />
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            marginBottom: isLocked ? 0 : 12,
          }}
        >
          {comments.map((c) => (
            <AdminCommentRow key={c.id} c={c} />
          ))}
        </div>
      )}

      {isLocked ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            background: '#ECFDF5',
            borderRadius: 6,
            fontSize: 12,
            color: '#065F46',
            marginTop: 12,
          }}
        >
          <I.check size={12} /> 已通过的审核不再接受评论
        </div>
      ) : (
        <div style={{ borderTop: `1px solid ${TOKENS.borderSoft}`, paddingTop: 12 }}>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="回复作者… (Cmd / Ctrl + Enter 发送)"
            disabled={postMutation.isPending || !rowId}
            style={{ minHeight: 64, fontSize: 12.5, lineHeight: 1.55 }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 8,
              marginTop: 8,
            }}
          >
            <span style={{ fontSize: 11, color: TOKENS.text3, marginRight: 'auto' }}>
              评论不会改变审核状态，需点击「通过 / 拒绝」决议
            </span>
            <Button
              variant="primary"
              size="sm"
              icon={<I.send size={11} />}
              onClick={handleSend}
              disabled={!canSend}
              title={!rowId ? '审核记录缺少 ID' : undefined}
            >
              {postMutation.isPending ? '发送中…' : '发送'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function AdminCommentRow({ c }: { c: ReviewCommentItem }) {
  const isReview = c.kind === 'review';
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <Avatar
        name={c.author?.name || '?'}
        char={c.author?.avatar || c.author?.name?.slice(0, 1) || '?'}
        url={c.author?.avatarUrl ?? undefined}
        size={28}
        color={hashColor(c.author?.handle || c.author?.name || 'x')}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 2,
            flexWrap: 'wrap',
          }}
        >
          <b style={{ fontSize: 12.5, color: TOKENS.text }}>{c.author?.name}</b>
          <Badge tone={isReview ? 'primary' : 'neutral'} size="sm" style={{ fontSize: 10 }}>
            {c.author?.role || (isReview ? '审核人' : '提交者')}
          </Badge>
          <span style={{ fontSize: 11, color: TOKENS.text3 }}>{c.ts}</span>
        </div>
        <div
          style={{
            padding: '8px 10px',
            background: isReview ? TOKENS.primarySoft : TOKENS.bgAlt,
            border: `1px solid ${isReview ? `${TOKENS.primary}22` : TOKENS.borderSoft}`,
            borderRadius: 6,
            fontSize: 12.5,
            color: TOKENS.text2,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {c.body}
        </div>
      </div>
    </div>
  );
}

function ReviewSpecCheck({ review }: { review: Review }) {
  const slug = (review as Review & { slug?: string }).slug;
  const onDownload = async () => {
    if (!slug) {
      toast({ kind: 'error', message: '该审核没有可下载的 Skill 包' });
      return;
    }
    try {
      const { blob, fileName } = await skillApi.download(slug, review.version);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({
        kind: 'error',
        message: err instanceof Error ? `下载失败：${err.message}` : '下载失败',
      });
    }
  };
  return (
    <Card pad={14} style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            background: '#ECFDF5',
            color: '#047857',
            display: 'grid',
            placeItems: 'center',
            flex: '0 0 auto',
          }}
        >
          <I.check size={20} stroke={2.5} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>提交包概况</span>
            <Badge tone={review.safety === 'pass' ? 'success' : 'warning'} size="sm">
              安全 {review.safety ?? 'pass'}
            </Badge>
          </div>
          <div style={{ fontSize: 11.5, color: TOKENS.text3, marginTop: 3 }}>
            zip 包含 <b style={{ color: TOKENS.text2 }}>{review.files ?? 0}</b> 个文件 · 评分{' '}
            <b style={{ color: TOKENS.text2 }}>{review.evalScore ?? '—'}</b> · 版本 v{review.version}
          </div>
        </div>
        <Button variant="ghost" size="sm" icon={<I.download size={12} />} onClick={onDownload}>
          下载 zip
        </Button>
      </div>
    </Card>
  );
}

function ReviewDecision({
  review,
  decision,
  setDecision,
  reason,
  setReason,
  onSubmit,
  submitting,
}: ReviewPaneProps) {
  const assetLabel = review.targetType === 'PROMPT' ? 'Prompt' : 'Skill';
  return (
    <Card pad={18}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>审核决定</div>
      <div style={{ fontSize: 11.5, color: TOKENS.text3, marginBottom: 14 }}>
        通过后将根据可见性进入对应列表;拒绝后,提交者可以修改后重新提交。
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button
          type="button"
          onClick={() => setDecision('approve')}
          style={{
            flex: 1,
            minWidth: 0,
            padding: 14,
            borderRadius: 10,
            cursor: 'pointer',
            background: decision === 'approve' ? '#ECFDF5' : '#fff',
            border: `1.5px solid ${decision === 'approve' ? TOKENS.success : TOKENS.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            textAlign: 'left',
            fontFamily: 'inherit',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              flexShrink: 0,
              borderRadius: 8,
              background: TOKENS.success,
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <I.check size={16} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: TOKENS.text }}>
              通过 (APPROVED)
            </div>
            <div style={{ fontSize: 11, color: TOKENS.text3, marginTop: 2, lineHeight: 1.4 }}>
              立即发布为 {review.visibility === 'PUBLIC' ? '公开' : '团队私有'} {assetLabel}
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setDecision('reject')}
          style={{
            flex: 1,
            minWidth: 0,
            padding: 14,
            borderRadius: 10,
            cursor: 'pointer',
            background: decision === 'reject' ? '#FEF2F2' : '#fff',
            border: `1.5px solid ${decision === 'reject' ? TOKENS.danger : TOKENS.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            textAlign: 'left',
            fontFamily: 'inherit',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              flexShrink: 0,
              borderRadius: 8,
              background: TOKENS.danger,
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <I.x size={16} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: TOKENS.text }}>
              拒绝 (REJECTED)
            </div>
            <div style={{ fontSize: 11, color: TOKENS.text3, marginTop: 2, lineHeight: 1.4 }}>
              提交者可看到拒绝原因并重新提交
            </div>
          </div>
        </button>
      </div>

      {decision === 'reject' && (
        <>
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: TOKENS.text2,
              marginBottom: 6,
            }}
          >
            拒绝原因 <span style={{ color: TOKENS.danger }}>*</span>
          </div>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="向提交者说明问题与修改建议…"
            style={{ minHeight: 88, fontSize: 13, lineHeight: 1.55 }}
          />
          <div
            style={{
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
              margin: '10px 0 4px',
            }}
          >
            <span style={{ fontSize: 11, color: TOKENS.text3, padding: '4px 0' }}>
              常用原因:
            </span>
            {PRESET_REASONS.map((p) => (
              <Button variant="ghost"
                key={p}
                type="button"
                onClick={() => setReason(p)}
                style={{
                  fontSize: 11.5,
                  padding: '4px 10px',
                  background: TOKENS.bgGray,
                  border: 'none',
                  borderRadius: 999,
                  cursor: 'pointer',
                  color: TOKENS.text2,
                  fontFamily: 'inherit',
                }}
              >
                {p}
              </Button>
            ))}
          </div>
        </>
      )}

      {decision === 'approve' && (
        <div
          style={{
            padding: 12,
            background: '#ECFDF5',
            borderRadius: 8,
            fontSize: 12.5,
            color: '#065F46',
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
          }}
        >
          <I.check size={14} style={{ marginTop: 2, flex: '0 0 auto' }} />
          <div>
            通过后,<b>{review.name}</b> 将立即对
            {review.visibility === 'PUBLIC' ? '所有人' : '团队成员'}可见。提交者会收到通知。
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <Button
          variant="ghost"
          size="md"
          onClick={() => {
            const el = document.getElementById('review-files');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        >
          {review.targetType === 'PROMPT' ? '查看 Prompt 内容' : '查看完整文件 →'}
        </Button>
        <span style={{ flex: 1 }} />
        <Button
          variant={decision === 'reject' ? 'danger' : 'primary'}
          size="md"
          icon={decision === 'reject' ? <I.x size={12} /> : <I.check size={12} />}
          disabled={!decision || submitting || (decision === 'reject' && !reason.trim())}
          onClick={onSubmit}
        >
          {submitting
            ? '提交中…'
            : decision === 'reject'
            ? '提交拒绝'
            : decision === 'approve'
              ? '确认通过'
              : '请先选择'}
        </Button>
      </div>
    </Card>
  );
}

function parsePromptPayload(json?: string): PromptReviewPayloadData | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as PromptReviewPayloadData;
  } catch {
    return null;
  }
}

function extractRefs(markdown: string) {
  const refs: Array<{ label: string; teamSlug: string; slug: string }> = [];
  const re = /@\[([^\]]+)]\(skillstack:\/\/prompt\/([a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9-]*)\)/g;
  for (const match of markdown.matchAll(re)) {
    refs.push({ label: match[1], teamSlug: match[2], slug: match[3] });
  }
  return refs;
}

const promptPreviewStyle: React.CSSProperties = {
  margin: 0,
  padding: 12,
  minHeight: 220,
  maxHeight: 420,
  overflow: 'auto',
  borderRadius: 8,
  border: `1px solid ${TOKENS.borderSoft}`,
  background: TOKENS.bgAlt,
  color: TOKENS.text2,
  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
  fontSize: 12,
  lineHeight: 1.65,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};
