import { useNavigate } from 'react-router-dom';
import { TOKENS } from '@/lib/tokens';
import { fmt } from '@/lib/utils';
import {
  Avatar,
  Badge,
  Button,
  Card,
  DashTopBar,
  EmptyState,
  SectionHeader,
  SkillIcon,
  Stat,
  type BadgeTone,
} from '@/components/ui';
import { I } from '@/components/icons';
import { useActivity, useReviews, useTeam, useTeamSkills } from '@/api/data';
import type { ActivityKind } from '@/mocks/activity';
import { AdminShell } from './_shared/AdminShell';

const KIND_TONE: Record<ActivityKind, BadgeTone> = {
  approve: 'success',
  submit: 'primary',
  invite: 'info',
  release: 'warning',
  unlist: 'neutral',
  join: 'success',
  suite: 'primary',
  reject: 'danger',
};

const QUICK_ACTIONS: Array<{
  label: string;
  image: string;
  tint: string;
  to: string;
}> = [
  {
    label: '创建 Skill',
    image: '/team/quick-actions/create-skill.png',
    tint: 'rgba(79, 70, 229, 0.12)',
    to: '/create/skill',
  },
  {
    label: '创建套件',
    image: '/team/quick-actions/create-suite.png',
    tint: 'rgba(14, 165, 233, 0.12)',
    to: '/create/suite',
  },
  {
    label: '邀请成员',
    image: '/team/quick-actions/invite-member.png',
    tint: 'rgba(16, 185, 129, 0.12)',
    to: '/team/invites',
  },
  {
    label: '审核设置',
    image: '/team/quick-actions/review-settings.png',
    tint: 'rgba(245, 158, 11, 0.14)',
    to: '/team/settings',
  },
];

export default function AdminDashboard() {
  const nav = useNavigate();
  const teamQuery = useTeam();
  const skillsQuery = useTeamSkills({ size: 8 });
  const reviewsQuery = useReviews();
  const activityQuery = useActivity(8);

  const team = teamQuery.data;
  const skills = skillsQuery.data ?? [];
  const reviews = reviewsQuery.data ?? [];
  const activity = activityQuery.data ?? [];
  const pending = reviews.filter((r) => r.status === 'PENDING_REVIEW');

  const isInitialLoading =
    teamQuery.isLoading || reviewsQuery.isLoading || skillsQuery.isLoading;
  const hasFatalError =
    teamQuery.isError && !teamQuery.data; // team 是工作台主数据，拿不到就不渲染主要内容

  const today = new Intl.DateTimeFormat('zh-CN', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  return (
    <AdminShell active="overview">
      <DashTopBar title="工作台" hint={`${team?.name ?? '团队'} · 今天 ${today}`} />
      <div style={{ padding: '24px 32px 40px', overflow: 'auto' }}>
        {hasFatalError ? (
          <Card pad={24}>
            <EmptyState
              icon={<I.x size={20} />}
              title="工作台数据加载失败"
              hint={teamQuery.error instanceof Error ? teamQuery.error.message : '请检查网络或稍后重试'}
              action={
                <Button variant="secondary" size="sm" onClick={() => teamQuery.refetch()}>
                  重试
                </Button>
              }
            />
          </Card>
        ) : isInitialLoading ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* Stats row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 14,
                marginBottom: 24,
              }}
            >
              <Stat label="公开 Skill" value={team?.publicSkills ?? 0} icon={<I.globe size={14} />} />
              <Stat label="私有 Skill" value={team?.privateSkills ?? 0} icon={<I.lock size={14} />} />
              <Stat label="待审核" value={pending.length} accent icon={<I.inbox size={14} />} />
              <Stat label="团队成员" value={team?.members ?? 0} icon={<I.users size={14} />} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
              {/* Left column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Pending reviews */}
                <Card pad={18}>
                  <SectionHeader
                    title="待审核"
                    hint={`${pending.length} 个 Skill 等待处理`}
                    extra={
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<I.chevR size={12} />}
                        onClick={() => nav('/team/reviews')}
                      >
                        查看队列
                      </Button>
                    }
                  />
                  {reviewsQuery.isError ? (
                    <EmptyState
                      compact
                      icon={<I.x size={16} />}
                      title="审核数据加载失败"
                      action={
                        <Button variant="ghost" size="sm" onClick={() => reviewsQuery.refetch()}>
                          重试
                        </Button>
                      }
                    />
                  ) : pending.length === 0 ? (
                    <EmptyState compact title="暂无待审核 Skill" hint="所有提交都已处理完毕" />
                  ) : (
                    pending.map((r) => (
                      <div
                        key={r.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '12px 0',
                          borderTop: `1px solid ${TOKENS.borderSoft}`,
                        }}
                      >
                        <SkillIcon ch={r.name.slice(-1).toUpperCase()} size={32} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{r.name}</div>
                          <div style={{ fontSize: 11.5, color: TOKENS.text3, marginTop: 2 }}>
                            {r.submittedBy.name} · {r.submittedAt} ·{' '}
                            {r.visibility === 'PUBLIC' ? '公开' : '团队私有'}
                          </div>
                        </div>
                        <Badge
                          tone={
                            r.safety === 'pass'
                              ? 'success'
                              : r.safety === 'warn'
                                ? 'warning'
                                : 'danger'
                          }
                          size="sm"
                        >
                          安全 {r.evalScore}
                        </Badge>
                        <Button variant="primary" size="sm" onClick={() => nav('/team/reviews')}>
                          审核
                        </Button>
                      </div>
                    ))
                  )}
                </Card>

                {/* Active skills */}
                <Card pad={18}>
                  <SectionHeader title="本周活跃 Skill" hint="按团队内安装、引用、构建调用次数排序" />
                  {skillsQuery.isError ? (
                    <EmptyState
                      compact
                      icon={<I.x size={16} />}
                      title="Skill 数据加载失败"
                      action={
                        <Button variant="ghost" size="sm" onClick={() => skillsQuery.refetch()}>
                          重试
                        </Button>
                      }
                    />
                  ) : skills.length === 0 ? (
                    <EmptyState
                      compact
                      title="还没有 Skill"
                      hint="团队成员提交并通过审核后，会出现在这里"
                      action={
                        <Button variant="primary" size="sm" onClick={() => nav('/create/skill')}>
                          创建第一个 Skill
                        </Button>
                      }
                    />
                  ) : (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: 10,
                      }}
                    >
                      {skills.slice(0, 4).map((s) => (
                        <div
                          key={s.slug}
                          style={{
                            display: 'flex',
                            gap: 10,
                            padding: 12,
                            background: TOKENS.bgAlt,
                            borderRadius: 8,
                          }}
                        >
                          <SkillIcon ch={s.icon} size={32} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 12.5,
                                fontWeight: 600,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {s.name}
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                gap: 10,
                                fontSize: 11,
                                color: TOKENS.text3,
                                marginTop: 4,
                              }}
                            >
                              <span>{fmt(s.installs)} 安装</span>
                              <span>v{s.version}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              {/* Right column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Card pad={16}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>快捷操作</div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: 8,
                    }}
                  >
                    {QUICK_ACTIONS.map(({ label, image, tint, to }) => (
                      <Button variant="ghost"
                        key={label}
                        type="button"
                        onClick={() => nav(to)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          minHeight: 104,
                          padding: '12px 10px 10px',
                          background: `linear-gradient(180deg, #fff 0%, ${TOKENS.bgAlt} 100%)`,
                          border: `1px solid ${TOKENS.borderSoft}`,
                          borderRadius: 8,
                          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
                          cursor: 'pointer',
                          textAlign: 'center',
                          fontFamily: 'inherit',
                          transition: 'transform 120ms ease, box-shadow 120ms ease',
                        }}
                      >
                        <div
                          style={{
                            width: 62,
                            height: 62,
                            borderRadius: 14,
                            background: `radial-gradient(circle at 50% 48%, ${tint} 0%, rgba(255,255,255,0) 70%)`,
                            display: 'grid',
                            placeItems: 'center',
                          }}
                        >
                          <img
                            src={image}
                            alt=""
                            aria-hidden="true"
                            width={56}
                            height={56}
                            style={{
                              display: 'block',
                              width: 56,
                              height: 56,
                              objectFit: 'contain',
                            }}
                          />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 500 }}>{label}</span>
                      </Button>
                    ))}
                  </div>
                </Card>

                <Card pad={16}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      marginBottom: 12,
                      display: 'flex',
                    }}
                  >
                    团队动态
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: 11,
                        color: TOKENS.text3,
                        fontWeight: 400,
                      }}
                    >
                      最近
                    </span>
                  </div>
                  {activityQuery.isError ? (
                    <EmptyState
                      compact
                      icon={<I.x size={16} />}
                      title="动态加载失败"
                      action={
                        <Button variant="ghost" size="sm" onClick={() => activityQuery.refetch()}>
                          重试
                        </Button>
                      }
                    />
                  ) : activity.length === 0 ? (
                    <EmptyState compact title="暂无团队动态" hint="提交、审核、邀请等事件会出现在这里" />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {activity.map((a, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            gap: 10,
                            paddingTop: i === 0 ? 0 : 12,
                            paddingBottom: 12,
                            borderBottom:
                              i < activity.length - 1
                                ? `1px solid ${TOKENS.borderSoft}`
                                : 'none',
                          }}
                        >
                          <Avatar name={a.who} char={a.whoAvatar || a.who.slice(-1)} url={a.whoAvatarUrl} size={26} />
                          <div
                            style={{
                              flex: 1,
                              minWidth: 0,
                              fontSize: 12.5,
                              color: TOKENS.text2,
                              lineHeight: 1.5,
                            }}
                          >
                            <b style={{ color: TOKENS.text, fontWeight: 600 }}>{a.who}</b> {a.what}
                            {a.target && (
                              <code
                                style={{
                                  color: TOKENS.primary,
                                  padding: '0 4px',
                                  background: TOKENS.primarySoft,
                                  borderRadius: 3,
                                  margin: '0 2px',
                                  fontSize: 11.5,
                                }}
                              >
                                {a.target}
                              </code>
                            )}
                            {a.extra}
                            <div
                              style={{
                                fontSize: 11,
                                color: TOKENS.text3,
                                marginTop: 2,
                              }}
                            >
                              {a.when}
                            </div>
                          </div>
                          <Badge
                            tone={KIND_TONE[a.kind]}
                            size="sm"
                            style={{ alignSelf: 'flex-start', fontSize: 10 }}
                          >
                            {a.kind}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card pad={16}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                    当前审核模式
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: TOKENS.text3,
                      marginBottom: 12,
                    }}
                  >
                    影响成员提交 Skill 后的去向
                  </div>
                  <div
                    style={{
                      padding: 12,
                      background: TOKENS.primarySoft,
                      border: `1px solid ${TOKENS.primary}33`,
                      borderRadius: 8,
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
                      <I.shield size={14} style={{ color: TOKENS.primary }} />
                      <b style={{ fontSize: 13, color: TOKENS.primaryDeep }}>
                        {team?.reviewMode === 'DIRECT_PUBLISH'
                          ? '直接发布 (DIRECT_PUBLISH)'
                          : '需要审核 (REVIEW_REQUIRED)'}
                      </b>
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: TOKENS.text2,
                        lineHeight: 1.55,
                      }}
                    >
                      {team?.reviewMode === 'DIRECT_PUBLISH'
                        ? '成员提交即立即生效，无需 Owner/Admin 审核。'
                        : 'Member 提交后进入待审核；Owner/Admin 可直接发布。'}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    style={{ marginTop: 10 }}
                    onClick={() => nav('/team/settings')}
                  >
                    修改审核模式 →
                  </Button>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}

function DashboardSkeleton() {
  const block = (h: number) => (
    <div
      style={{
        height: h,
        borderRadius: 8,
        background: `linear-gradient(90deg, ${TOKENS.bgAlt} 0%, ${TOKENS.bgGray} 50%, ${TOKENS.bgAlt} 100%)`,
        backgroundSize: '200% 100%',
        animation: 'skill-shimmer 1.4s linear infinite',
      }}
    />
  );
  return (
    <>
      <style>{`@keyframes skill-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 14,
          marginBottom: 24,
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div key={i}>{block(76)}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {block(220)}
          {block(180)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {block(120)}
          {block(260)}
        </div>
      </div>
    </>
  );
}
