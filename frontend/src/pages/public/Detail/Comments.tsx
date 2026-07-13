import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TOKENS } from '@/lib/tokens';
import { Avatar, Badge, Button, Card, SectionHeader, Select, Textarea } from '@/components/ui';
import { I } from '@/components/icons';
import { useMyTeams } from '@/api/data';
import { promptApi, skillApi } from '@/api/endpoints';
import type {
  SkillReviewItemRes,
  SkillReviewReplyRes,
  SkillReviewSummaryRes,
} from '@/api/endpoints';
import type { Skill } from '@/mocks/skills';
import type { SkillVersion } from './types';

interface CommentAsset {
  id?: number;
  slug?: string;
  teamSlug?: string;
  version?: string;
  author?: {
    handle?: string | null;
  };
}

interface CommentApi {
  reviews: (id: number) => Promise<SkillReviewSummaryRes>;
  submitReview: (
    id: number,
    body: { rating: number; body: string; version: string },
  ) => Promise<SkillReviewSummaryRes>;
  replyReview: (
    id: number,
    reviewId: number,
    body: { body: string },
  ) => Promise<SkillReviewReplyRes>;
}

function Stars({
  value = 0,
  onChange,
  size = 14,
}: {
  value?: number;
  onChange?: (n: number) => void;
  size?: number;
}) {
  const interactive = !!onChange;
  return (
    <div
      style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}
      role={interactive ? 'radiogroup' : undefined}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = value >= n;
        const Star = filled ? I.starFill : I.star;
        return (
          <span
            key={n}
            onClick={interactive ? () => onChange?.(n) : undefined}
            role={interactive ? 'radio' : undefined}
            aria-checked={interactive ? value === n : undefined}
            style={{
              color: filled ? '#F59E0B' : '#CBD5E1',
              display: 'inline-flex',
              cursor: interactive ? 'pointer' : 'default',
              transition: 'transform .12s ease',
            }}
          >
            <Star size={size} />
          </span>
        );
      })}
    </div>
  );
}

function RatingSummary({ summary }: { summary: SkillReviewSummaryRes }) {
  const total = summary.total;
  const avg = Number(summary.avg) || 0;
  const replyCount = summary.items.reduce(
    (s, i) => s + (i.replies?.length ? 1 : 0),
    0,
  );
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '180px 1fr',
        gap: 28,
        padding: '4px 4px 18px',
        borderBottom: `1px solid ${TOKENS.borderSoft}`,
      }}
    >
      <div style={{ borderRight: `1px solid ${TOKENS.borderSoft}`, paddingRight: 24 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <div
            style={{
              fontSize: 44,
              fontWeight: 700,
              color: TOKENS.text,
              lineHeight: 1,
              letterSpacing: -1,
            }}
          >
            {avg.toFixed(1)}
          </div>
          <div style={{ fontSize: 13, color: TOKENS.text3 }}>/ 5</div>
        </div>
        <div style={{ marginTop: 8 }}>
          <Stars value={Math.round(avg)} size={14} />
        </div>
        <div style={{ fontSize: 12, color: TOKENS.text3, marginTop: 6 }}>
          {total} 条评论 · 含 {replyCount} 条作者回复
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          justifyContent: 'center',
        }}
      >
        {summary.distribution.map((d) => {
          const pct = total ? Math.round((d.count / total) * 100) : 0;
          return (
            <div
              key={d.star}
              style={{
                display: 'grid',
                gridTemplateColumns: '38px 1fr 28px',
                gap: 12,
                alignItems: 'center',
                fontSize: 12,
                color: TOKENS.text3,
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <span style={{ color: TOKENS.text2, fontWeight: 500 }}>{d.star}</span>
                <I.starFill size={10} style={{ color: '#F59E0B' }} />
              </span>
              <div
                style={{
                  height: 6,
                  background: TOKENS.bgGray,
                  borderRadius: 999,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: pct + '%',
                    height: '100%',
                    background: '#F59E0B',
                    transition: 'width .35s ease',
                  }}
                />
              </div>
              <span
                style={{
                  textAlign: 'right',
                  fontFamily: 'var(--font-mono), ui-monospace, "SF Mono", Menlo, monospace',
                  color: TOKENS.text2,
                }}
              >
                {d.count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VersionPill({ version, isLatest }: { version: string; isLatest: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 7px',
        borderRadius: 4,
        fontSize: 10.5,
        fontFamily: 'var(--font-mono), ui-monospace, "SF Mono", Menlo, monospace',
        background: isLatest ? TOKENS.primarySoft : TOKENS.bgGray,
        color: isLatest ? TOKENS.primaryDeep : TOKENS.text2,
        border: `1px solid ${isLatest ? '#C7D2FE' : TOKENS.border}`,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
      }}
    >
      v{version}
      {isLatest && (
        <span
          style={{
            width: 4,
            height: 4,
            borderRadius: 999,
            background: TOKENS.primary,
          }}
        />
      )}
    </span>
  );
}

function Composer({
  versions,
  defaultVersion,
  onSubmit,
  submitting,
  existing,
  disabled,
  disabledHint,
}: {
  versions: SkillVersion[];
  defaultVersion: string;
  onSubmit: (p: { rating: number; text: string; version: string }) => void;
  submitting: boolean;
  existing: SkillReviewItemRes | null;
  disabled: boolean;
  disabledHint?: string;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [text, setText] = useState(existing?.body ?? '');
  const [version, setVersion] = useState(existing?.version ?? defaultVersion);
  const { me } = useMyTeams(true);
  useEffect(() => {
    if (existing) {
      setRating(existing.rating);
      setText(existing.body);
      setVersion(existing.version);
    } else {
      setVersion(defaultVersion);
    }
  }, [existing, defaultVersion]);
  const ready = !disabled && !submitting && rating > 0 && text.trim().length > 0;
  const isUpdate = Boolean(existing);
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: 16,
        border: `1px solid ${TOKENS.border}`,
        borderRadius: 10,
        background: TOKENS.bgAlt,
        marginTop: 20,
        opacity: disabled ? 0.7 : 1,
      }}
    >
      <Avatar
        name={me?.name || '我'}
        char={me?.avatar || me?.name?.slice(0, 1) || '我'}
        url={me?.avatarUrl}
        size={32}
        color={TOKENS.primary}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            disabled
              ? disabledHint || '登录后即可评分'
              : '写下你的使用体验、踩坑或建议 …… 评分会和所选版本一起公开展示'
          }
          disabled={disabled}
          style={{
            minHeight: 72,
            fontSize: 13.5,
            lineHeight: 1.65,
            color: TOKENS.text,
          }}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginTop: 10,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: TOKENS.text3 }}>评分</span>
            <Stars value={rating} onChange={disabled ? undefined : setRating} size={18} />
            {rating > 0 && (
              <span
                style={{
                  fontSize: 11.5,
                  color: TOKENS.text3,
                  fontFamily: 'var(--font-mono), ui-monospace, "SF Mono", Menlo, monospace',
                }}
              >
                {rating}.0
              </span>
            )}
          </div>
          <div style={{ width: 1, height: 18, background: TOKENS.border }} />
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: TOKENS.text3 }}>评价版本</span>
            <div style={{ width: 156 }}>
              <Select
                value={version}
                onValueChange={setVersion}
                disabled={disabled}
                options={versions.map((v) => ({
                  value: v.version,
                  label: `v${v.version}${v.latest ? ' · 当前最新' : ''}`,
                }))}
                style={{
                  padding: '5px 26px 5px 10px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontFamily: 'var(--font-mono), ui-monospace, "SF Mono", Menlo, monospace',
                }}
              />
            </div>
          </div>
          {isUpdate && (
            <span
              style={{
                fontSize: 11.5,
                padding: '2px 7px',
                borderRadius: 999,
                background: TOKENS.primarySoft,
                color: TOKENS.primaryDeep,
              }}
            >
              更新已有评分
            </span>
          )}
          <Button
            variant="primary"
            size="sm"
            icon={<I.send size={12} />}
            onClick={() => {
              if (ready) onSubmit({ rating, text, version });
            }}
            style={{
              marginLeft: 'auto',
              opacity: ready ? 1 : 0.45,
              pointerEvents: ready ? 'auto' : 'none',
            }}
          >
            {submitting ? '提交中…' : isUpdate ? '更新评分' : '发布评论'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function FilterPills({
  value,
  onChange,
  versions,
  items,
}: {
  value: string;
  onChange: (s: string) => void;
  versions: SkillVersion[];
  items: SkillReviewItemRes[];
}) {
  const opts = [
    { id: 'all', label: '全部', count: items.length, mono: false, latest: false },
  ].concat(
    versions.slice(0, 5).map((v) => ({
      id: v.version,
      label: 'v' + v.version,
      count: items.filter((c) => c.version === v.version).length,
      mono: true,
      latest: !!v.latest,
    })),
  );
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        margin: '22px 0 4px',
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontSize: 12, color: TOKENS.text3, marginRight: 2 }}>按版本筛选</span>
      {opts.map((opt) => {
        const active = value === opt.id;
        return (
          <Button variant="ghost"
            key={opt.id}
            onClick={() => onChange(opt.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              borderRadius: 999,
              fontSize: 11.5,
              fontFamily: opt.mono
                ? 'var(--font-mono), ui-monospace, "SF Mono", Menlo, monospace'
                : 'inherit',
              background: active ? TOKENS.primary : '#fff',
              color: active ? '#fff' : TOKENS.text2,
              border: `1px solid ${active ? TOKENS.primary : TOKENS.border}`,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {opt.label}
            {opt.latest && (
              <span
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 999,
                  background: active ? '#fff' : TOKENS.primary,
                }}
              />
            )}
            <span
              style={{
                fontFamily:
                  'var(--font-mono), ui-monospace, "SF Mono", Menlo, monospace',
                fontSize: 10.5,
                color: active ? 'rgba(255,255,255,.7)' : TOKENS.text3,
              }}
            >
              {opt.count}
            </span>
          </Button>
        );
      })}
    </div>
  );
}

function ReplyBlock({ r }: { r: SkillReviewReplyRes }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        background: '#fff',
        border: `1px solid ${TOKENS.borderSoft}`,
        borderRadius: 8,
        marginBottom: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Avatar name={r.user.name} char={r.user.avatar} url={r.user.avatarUrl ?? undefined} size={20} color={r.user.color} />
        <span style={{ fontSize: 12.5, fontWeight: 500, color: TOKENS.text }}>{r.user.name}</span>
        {r.user.isAuthor && (
          <Badge tone="primary" size="sm">
            作者
          </Badge>
        )}
        <span style={{ fontSize: 11, color: TOKENS.text3, marginLeft: 'auto' }}>{r.date}</span>
      </div>
      <div style={{ marginTop: 6, fontSize: 13, color: TOKENS.text2, lineHeight: 1.65 }}>
        {r.body}
      </div>
    </div>
  );
}

interface ReplyState {
  id: number | null;
  text: string;
  submitting?: boolean;
}

function CommentRow({
  c,
  latestVersion,
  viewerIsAuthor,
  replyState,
  setReplyState,
  onSubmitReply,
}: {
  c: SkillReviewItemRes;
  latestVersion: string;
  viewerIsAuthor: boolean;
  replyState: ReplyState;
  setReplyState: (s: ReplyState) => void;
  onSubmitReply: (commentId: number, text: string) => void;
}) {
  const open = replyState.id === c.id;
  return (
    <div style={{ padding: '18px 0', borderTop: `1px solid ${TOKENS.borderSoft}` }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <Avatar name={c.user.name} char={c.user.avatar} url={c.user.avatarUrl ?? undefined} size={34} color={c.user.color} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 13.5, fontWeight: 600, color: TOKENS.text }}>
              {c.user.name}
            </span>
            {c.user.isAuthor && (
              <Badge tone="primary" size="sm">
                作者
              </Badge>
            )}
            {c.mine && (
              <Badge tone="neutral" size="sm">
                我的
              </Badge>
            )}
            <Stars value={c.rating} size={12} />
            <VersionPill version={c.version} isLatest={c.version === latestVersion} />
            <span
              style={{
                fontSize: 11.5,
                color: TOKENS.text3,
                marginLeft: 'auto',
                fontFamily: 'var(--font-mono), ui-monospace, "SF Mono", Menlo, monospace',
              }}
            >
              {c.date}
            </span>
          </div>
          <div style={{ marginTop: 8, fontSize: 13.5, color: TOKENS.text2, lineHeight: 1.7 }}>
            {c.body}
          </div>

          {c.replies && c.replies.length > 0 && (
            <div
              style={{
                marginTop: 12,
                paddingLeft: 12,
                borderLeft: `2px solid ${TOKENS.primarySoft}`,
              }}
            >
              {c.replies.map((r) => (
                <ReplyBlock key={r.id} r={r} />
              ))}
            </div>
          )}

          {viewerIsAuthor && (
            <div style={{ marginTop: 10 }}>
              {open ? (
                <div
                  style={{
                    padding: 10,
                    background: '#fff',
                    border: `1px solid ${TOKENS.border}`,
                    borderRadius: 8,
                  }}
                >
                  <Textarea
                    value={replyState.text}
                    onChange={(e) =>
                      setReplyState({ id: c.id, text: e.target.value })
                    }
                    placeholder={`以作者身份回复 ${c.user.name}……`}
                    style={{
                      minHeight: 56,
                      padding: 8,
                      borderRadius: 6,
                      fontSize: 13,
                      lineHeight: 1.6,
                      color: TOKENS.text,
                    }}
                  />
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginTop: 8,
                      justifyContent: 'flex-end',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: TOKENS.text3,
                        marginRight: 'auto',
                      }}
                    >
                      回复将带上「作者」标识,并保留与原评论同版本的关联
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setReplyState({ id: null, text: '' })}
                    >
                      取消
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<I.send size={11} />}
                      onClick={() => {
                        const text = replyState.text.trim();
                        if (!text || replyState.submitting) return;
                        onSubmitReply(c.id, text);
                      }}
                      style={
                        replyState.text.trim() && !replyState.submitting
                          ? undefined
                          : { opacity: 0.45, pointerEvents: 'none' }
                      }
                    >
                      {replyState.submitting ? '发布中…' : '发布回复'}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="ghost"
                  onClick={() => setReplyState({ id: c.id, text: '' })}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 12,
                    color: TOKENS.primary,
                    fontWeight: 500,
                    padding: '4px 8px',
                    borderRadius: 6,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <I.send size={11} /> 以作者身份回复
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const EMPTY_SUMMARY: SkillReviewSummaryRes = {
  avg: 0,
  total: 0,
  distribution: [5, 4, 3, 2, 1].map((s) => ({ star: s, count: 0 })),
  items: [],
  myReviewId: null,
};

function AssetCommentsModule({
  versions,
  asset,
  api,
  assetLabel,
  reviewQueryPrefix,
  detailQueryKey,
}: {
  versions: SkillVersion[];
  asset: CommentAsset;
  api: CommentApi;
  assetLabel: string;
  reviewQueryPrefix: string;
  detailQueryKey?: unknown[];
}) {
  const safeVersions =
    versions.length > 0
      ? versions
      : [{ version: asset.version || '0.0.0', date: '', note: '当前版本', author: '', installs: 0, latest: true }];
  const latest = (safeVersions.find((v) => v.latest) || safeVersions[0]).version;
  const [filterVersion, setFilterVersion] = useState('all');
  const [replyState, setReplyState] = useState<ReplyState>({ id: null, text: '' });
  const [error, setError] = useState<string | null>(null);

  const assetId = asset.id;
  const queryClient = useQueryClient();
  const { me } = useMyTeams(true);
  const isLoggedIn = Boolean(me?.handle);
  const viewerIsAuthor = Boolean(me?.handle && asset.author?.handle && me.handle === asset.author.handle);
  const reviewQueryKey = [reviewQueryPrefix, assetId, me?.handle ?? null];

  const summaryQuery = useQuery({
    queryKey: reviewQueryKey,
    queryFn: () => api.reviews(assetId as number),
    enabled: typeof assetId === 'number',
    staleTime: 30_000,
  });

  const summary = summaryQuery.data ?? EMPTY_SUMMARY;
  const items = summary.items;
  const existing = useMemo<SkillReviewItemRes | null>(() => {
    if (!summary.myReviewId) return null;
    return items.find((i) => i.id === summary.myReviewId) ?? null;
  }, [items, summary.myReviewId]);

  const submitMutation = useMutation({
    mutationFn: (p: { rating: number; text: string; version: string }) =>
      api.submitReview(assetId as number, {
        rating: p.rating,
        body: p.text.trim(),
        version: p.version,
      }),
    onSuccess: (next) => {
      setError(null);
      queryClient.setQueryData(reviewQueryKey, next);
      if (detailQueryKey) {
        queryClient.invalidateQueries({ queryKey: detailQueryKey });
      }
    },
    onError: (e: any) => {
      setError(e?.message || '提交失败,请稍后重试');
    },
  });

  const replyMutation = useMutation({
    mutationFn: ({ reviewId, text }: { reviewId: number; text: string }) =>
      api.replyReview(assetId as number, reviewId, { body: text.trim() }),
    onSuccess: (reply, vars) => {
      setError(null);
      queryClient.setQueryData<SkillReviewSummaryRes>(reviewQueryKey, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((it) =>
            it.id === vars.reviewId ? { ...it, replies: [...it.replies, reply] } : it,
          ),
        };
      });
      setReplyState({ id: null, text: '' });
    },
    onError: (e: any) => {
      setReplyState((s) => ({ ...s, submitting: false }));
      setError(e?.message || '回复失败,请稍后重试');
    },
  });

  function handleSubmitComment(p: { rating: number; text: string; version: string }) {
    if (typeof assetId !== 'number') return;
    if (!isLoggedIn) {
      setError('请先登录后再提交评分');
      return;
    }
    submitMutation.mutate(p);
  }

  function handleSubmitReply(commentId: number, text: string) {
    if (typeof assetId !== 'number') return;
    setReplyState((s) => ({ ...s, submitting: true }));
    replyMutation.mutate({ reviewId: commentId, text });
  }

  const filtered =
    filterVersion === 'all' ? items : items.filter((c) => c.version === filterVersion);

  const noAssetId = typeof assetId !== 'number';

  return (
    <Card pad={24} style={{ marginTop: 16 }}>
      <SectionHeader
        title="评论与评分"
        hint="评论默认绑定当前最新版本,并与版本一起公开 — 形成可追溯的版本反馈链"
        extra={
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 999,
              background: TOKENS.primarySoft,
              color: TOKENS.primaryDeep,
              fontSize: 11.5,
              fontWeight: 500,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: TOKENS.primary,
              }}
            />
            写评论将默认绑定 v{latest}
          </span>
        }
      />

      <RatingSummary summary={summary} />

      <Composer
        versions={safeVersions}
        defaultVersion={latest}
        onSubmit={handleSubmitComment}
        submitting={submitMutation.isPending}
        existing={existing}
        disabled={noAssetId || !isLoggedIn}
        disabledHint={
          noAssetId
            ? `当前 ${assetLabel} 未持久化到后端,暂不能评分`
            : !isLoggedIn
              ? '登录后即可评分'
              : undefined
        }
      />

      {error && (
        <div
          style={{
            marginTop: 12,
            fontSize: 12,
            color: '#B91C1C',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            padding: '8px 10px',
            borderRadius: 6,
          }}
        >
          {error}
        </div>
      )}

      <FilterPills
        value={filterVersion}
        onChange={setFilterVersion}
        versions={safeVersions}
        items={items}
      />

      <div>
        {summaryQuery.isLoading ? (
          <div
            style={{
              padding: '32px 12px',
              textAlign: 'center',
              fontSize: 13,
              color: TOKENS.text3,
              borderTop: `1px solid ${TOKENS.borderSoft}`,
              marginTop: 12,
            }}
          >
            正在加载评论…
          </div>
        ) : summaryQuery.isError ? (
          <div
            style={{
              padding: '32px 12px',
              textAlign: 'center',
              fontSize: 13,
              color: TOKENS.text3,
              borderTop: `1px solid ${TOKENS.borderSoft}`,
              marginTop: 12,
            }}
          >
            评论加载失败 ·{' '}
            <Button variant="ghost"
              onClick={() => summaryQuery.refetch()}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: TOKENS.primary,
                fontFamily: 'inherit',
              }}
            >
              重试
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              padding: '32px 12px',
              textAlign: 'center',
              fontSize: 13,
              color: TOKENS.text3,
              borderTop: `1px solid ${TOKENS.borderSoft}`,
              marginTop: 12,
            }}
          >
            {items.length === 0
              ? '还没有评论 — 在上方写下你的第一条评价吧'
              : '该版本暂无评论 — 切换到「全部」查看其它版本'}
          </div>
        ) : (
          filtered.map((c) => (
            <CommentRow
              key={c.id}
              c={c}
              latestVersion={latest}
              viewerIsAuthor={viewerIsAuthor}
              replyState={replyState}
              setReplyState={setReplyState}
              onSubmitReply={handleSubmitReply}
            />
          ))
        )}
      </div>
    </Card>
  );
}

export function CommentsModule({ versions, skill }: { versions: SkillVersion[]; skill: Skill }) {
  return (
    <AssetCommentsModule
      versions={versions}
      asset={skill}
      api={skillApi}
      assetLabel="Skill"
      reviewQueryPrefix="skill-reviews"
      detailQueryKey={skill.slug ? ['skill-detail', skill.slug] : undefined}
    />
  );
}

export function PromptCommentsModule({
  versions,
  prompt,
}: {
  versions: SkillVersion[];
  prompt: CommentAsset;
}) {
  return (
    <AssetCommentsModule
      versions={versions}
      asset={prompt}
      api={promptApi}
      assetLabel="Prompt"
      reviewQueryPrefix="prompt-reviews"
      detailQueryKey={
        prompt.teamSlug && prompt.slug
          ? ['prompt-detail', prompt.teamSlug, prompt.slug]
          : undefined
      }
    />
  );
}
