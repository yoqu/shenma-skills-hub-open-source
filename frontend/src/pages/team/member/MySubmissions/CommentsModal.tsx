import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TOKENS } from '@/lib/tokens';
import { hashColor } from '@/lib/utils';
import { Avatar, Badge, Button, EmptyState, SkillIcon, Textarea, toast } from '@/components/ui';
import { I } from '@/components/icons';
import { reviewApi, type ReviewCommentItem } from '@/api/endpoints';
import type {
  StatusMeta,
  Submission,
  SubmissionComment,
} from './data';

export interface CommentsModalProps {
  submission: Submission;
  statusMeta: StatusMeta;
  replyDraft: string;
  setReplyDraft: (v: string) => void;
  onClose: () => void;
  me?: { name: string; avatar: string; handle: string; avatarUrl?: string };
}

export function CommentsModal({
  submission: r,
  statusMeta: s,
  replyDraft,
  setReplyDraft,
  onClose,
  me,
}: CommentsModalProps) {
  const Ico = s.ico;
  const queryClient = useQueryClient();
  const isLocked = r.status === 'APPROVED';

  const commentsQuery = useQuery({
    queryKey: ['review-comments', r.rowId],
    queryFn: () => reviewApi.listComments(r.rowId!),
    enabled: typeof r.rowId === 'number',
  });
  const remoteComments = commentsQuery.data ?? [];

  // 把"系统/审核人初始反馈"（从 review 自带的 reason 等派生）和远程评论合并成一条时间线。
  // r.comments 来自 toSubmission：包含 'system' + 可选 'change-request'（即 reason）。
  const merged: SubmissionComment[] = [
    ...r.comments,
    ...remoteComments.map(remoteToLocal),
  ];
  const total = merged.length;

  const postMutation = useMutation({
    mutationFn: (body: string) => reviewApi.postComment(r.rowId!, { body }),
    onSuccess: () => {
      setReplyDraft('');
      queryClient.invalidateQueries({ queryKey: ['review-comments', r.rowId] });
      toast({ kind: 'success', message: '已发送回复' });
    },
    onError: (err) => {
      toast({
        kind: 'error',
        message: err instanceof Error ? `发送失败：${err.message}` : '发送失败',
      });
    },
  });

  function handleSend() {
    const body = replyDraft.trim();
    if (!body) return;
    if (!r.rowId) {
      toast({ kind: 'error', message: '审核记录缺少 ID，无法发送' });
      return;
    }
    postMutation.mutate(body);
  }

  function onTextareaKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 'min(900px, 100vh)',
        zIndex: 100,
        background: 'rgba(15, 23, 42, .55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(780px, 100%)',
          maxHeight: 'calc(100% - 16px)',
          background: '#fff',
          borderRadius: 14,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 50px rgba(15,23,42,.35)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 18px 12px',
            borderBottom: `1px solid ${TOKENS.border}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <SkillIcon ch={r.name.slice(-1).toUpperCase()} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <b style={{ fontSize: 14 }}>{r.name}</b>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 11.5,
                    color: TOKENS.text3,
                  }}
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
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: TOKENS.text3,
                  marginTop: 4,
                  display: 'flex',
                  gap: 10,
                  flexWrap: 'wrap',
                }}
              >
                <span>
                  审核人 <b style={{ color: TOKENS.text2 }}>{r.reviewer}</b>
                </span>
                <span>提交于 {r.submittedAt}</span>
                <span>
                  {total} 条讨论
                  {commentsQuery.isFetching && (
                    <span style={{ color: TOKENS.text3 }}> · 同步中…</span>
                  )}
                </span>
              </div>
            </div>
            <Button variant="ghost"
              type="button"
              onClick={onClose}
              aria-label="关闭"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: TOKENS.text3,
                padding: 6,
                borderRadius: 6,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <I.x size={18} />
            </Button>
          </div>
        </div>

        {/* Timeline */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '16px 18px 12px',
            background: TOKENS.bgAlt,
          }}
        >
          {commentsQuery.isError ? (
            <EmptyState
              icon={<I.x size={20} />}
              title="评论加载失败"
              hint={
                commentsQuery.error instanceof Error
                  ? commentsQuery.error.message
                  : '请稍后重试'
              }
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => commentsQuery.refetch()}
                >
                  重试
                </Button>
              }
            />
          ) : commentsQuery.isLoading && r.comments.length === 0 ? (
            <EmptyState icon={<I.clock size={20} />} title="正在加载评论…" />
          ) : (
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  left: 13,
                  top: 8,
                  bottom: 8,
                  width: 2,
                  background: TOKENS.borderSoft,
                  borderRadius: 1,
                }}
              />
              {merged.map((c) => (
                <CommentNode key={c.id} c={c} />
              ))}
            </div>
          )}
        </div>

        {/* Reply */}
        <div
          style={{
            padding: '12px 18px 14px',
            borderTop: `1px solid ${TOKENS.border}`,
            background: '#fff',
          }}
        >
          {isLocked ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                background: '#ECFDF5',
                borderRadius: 8,
                fontSize: 12.5,
                color: '#065F46',
              }}
            >
              <I.check size={14} />
              <div style={{ flex: 1 }}>
                已通过的提交不能继续回复 — 如需补充内容,请发新版本。
              </div>
              <Button variant="success" size="sm" icon={<I.upload size={12} />}>
                发新版本
              </Button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Avatar
                name={me?.name ?? ''}
                char={me?.avatar ?? '?'}
                url={me?.avatarUrl}
                size={28}
                color={hashColor(me?.handle ?? '')}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Textarea
                  value={replyDraft}
                  onChange={(e) => setReplyDraft(e.target.value)}
                  onKeyDown={onTextareaKey}
                  placeholder={`回复 ${r.reviewer}… (Cmd / Ctrl + Enter 发送)`}
                  disabled={postMutation.isPending}
                  style={{ minHeight: 60, fontSize: 13, lineHeight: 1.55 }}
                />
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 8,
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <ToolChip ico={<I.code size={11} />} disabled>
                      引用文件
                    </ToolChip>
                    <ToolChip ico={<I.user size={11} />} disabled>
                      @提及
                    </ToolChip>
                    <ToolChip ico={<I.bookmark size={11} />} disabled>
                      插入版本号
                    </ToolChip>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button variant="ghost" size="sm" onClick={onClose}>
                      取消
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<I.send size={11} />}
                      onClick={handleSend}
                      disabled={!replyDraft.trim() || postMutation.isPending || !r.rowId}
                      title={!r.rowId ? '审核记录缺少 ID' : undefined}
                    >
                      {postMutation.isPending ? '发送中…' : '发布回复'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ToolChip({
  ico,
  children,
  disabled,
}: {
  ico: ReactNode;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Button variant="ghost"
      type="button"
      disabled={disabled}
      title={disabled ? '即将开放' : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 9px',
        fontSize: 11,
        color: TOKENS.text2,
        background: TOKENS.bgGray,
        border: 'none',
        borderRadius: 999,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        fontFamily: 'inherit',
      }}
    >
      {ico}
      {children}
    </Button>
  );
}

/** 后端 ReviewCommentItem → 前端时间线节点。 */
function remoteToLocal(c: ReviewCommentItem): SubmissionComment {
  return {
    id: `remote-${c.id}`,
    kind: c.kind === 'review' ? 'review' : 'mine',
    ts: c.ts,
    body: c.body,
    author: c.author
      ? {
          name: c.author.name,
          role: c.author.role || (c.kind === 'review' ? '审核人' : '提交者'),
          avatar: c.author.avatar || c.author.name.slice(0, 1),
          avatarUrl: c.author.avatarUrl ?? undefined,
        }
      : undefined,
  };
}

function CommentNode({ c }: { c: SubmissionComment }) {
  if (c.kind === 'system') {
    return (
      <div style={{ position: 'relative', paddingLeft: 38, marginBottom: 14 }}>
        <div
          style={{
            position: 'absolute',
            left: 6,
            top: 2,
            width: 16,
            height: 16,
            borderRadius: 999,
            background: '#fff',
            border: `2px solid ${TOKENS.border}`,
            display: 'grid',
            placeItems: 'center',
            color: TOKENS.text3,
          }}
        >
          <I.clock size={9} />
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: TOKENS.text3,
            lineHeight: 1.6,
            padding: '2px 0',
            background: c.unread ? '#FEF2F2' : 'transparent',
            borderRadius: 6,
            paddingInline: c.unread ? 8 : 0,
          }}
        >
          <span style={{ color: TOKENS.text2 }}>{c.body}</span>
          <span style={{ marginLeft: 8 }}>· {c.ts}</span>
        </div>
      </div>
    );
  }

  const isMine = c.kind === 'mine';
  const isApproval = c.kind === 'approval';
  const isChangeReq = c.kind === 'change-request';
  const author = c.author;

  let bubbleBg = '#fff';
  let bubbleBorder = TOKENS.border as string;
  let dotIcon: ReactNode = <I.user size={9} />;

  if (isMine) {
    bubbleBg = TOKENS.primarySoft;
    bubbleBorder = '#C7D2FE';
    dotIcon = <I.user size={9} />;
  } else if (isApproval) {
    bubbleBg = '#ECFDF5';
    bubbleBorder = '#A7F3D0';
    dotIcon = <I.check size={10} />;
  } else if (isChangeReq) {
    bubbleBg = '#FEF2F2';
    bubbleBorder = '#FECACA';
    dotIcon = <I.bell size={9} />;
  }

  const badgeTone: 'primary' | 'success' | 'danger' | 'neutral' = isMine
    ? 'primary'
    : isApproval
    ? 'success'
    : isChangeReq
    ? 'danger'
    : 'neutral';

  return (
    <div style={{ position: 'relative', paddingLeft: 38, marginBottom: 14 }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 4,
          width: 28,
          height: 28,
          borderRadius: 999,
          background: '#fff',
          border: `2px solid ${TOKENS.bgAlt}`,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <Avatar
          name={author?.name}
          char={author?.avatar}
          url={author?.avatarUrl}
          size={28}
          color={hashColor(author?.name || 'x')}
        />
      </div>
      <div
        style={{
          background: bubbleBg,
          border: `1px solid ${bubbleBorder}`,
          borderRadius: 10,
          padding: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: 8,
          }}
        >
          <b style={{ fontSize: 12.5, color: TOKENS.text }}>{author?.name}</b>
          <Badge tone={badgeTone} size="sm">
            {dotIcon}
            {isMine
              ? '提交人'
              : isApproval
              ? '通过'
              : isChangeReq
              ? '需改动'
              : author?.role || '审核人'}
          </Badge>
          <span style={{ fontSize: 11, color: TOKENS.text3, marginLeft: 'auto' }}>
            {c.ts}
          </span>
          {c.unread && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#fff',
                background: TOKENS.danger,
                padding: '1px 7px',
                borderRadius: 999,
              }}
            >
              未读
            </span>
          )}
        </div>

        {c.fileRef && (
          <div
            style={{
              marginBottom: 8,
              padding: '8px 10px',
              background: '#0F172A',
              color: '#E2E8F0',
              borderRadius: 8,
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                color: '#94A3B8',
                marginBottom: 4,
              }}
            >
              <I.code size={11} />
              <span style={{ fontFamily: 'monospace' }}>{c.fileRef.path}</span>
              <span style={{ color: '#64748B' }}>:{c.fileRef.line}</span>
            </div>
            <code
              style={{
                fontFamily: 'monospace',
                fontSize: 12,
                color: '#FCD34D',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {c.fileRef.snippet}
            </code>
          </div>
        )}

        <div
          style={{
            fontSize: 13,
            color: TOKENS.text2,
            lineHeight: 1.65,
            whiteSpace: 'pre-wrap',
          }}
        >
          {c.body}
        </div>
      </div>
    </div>
  );
}
