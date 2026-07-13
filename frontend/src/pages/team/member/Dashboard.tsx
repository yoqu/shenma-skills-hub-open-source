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
} from '@/components/ui';
import { I } from '@/components/icons';
import type { Activity, ActivityKind } from '@/mocks/activity';
import type { Review } from '@/mocks/reviews';
import type { Skill } from '@/mocks/skills';
import type { Suite } from '@/mocks/suites';
import {
  useActivity,
  useMyTeams,
  useReviews,
  useSuites,
  useTeam,
  useTeamSkills,
} from '@/api/data';
import { MEMBER_QUICK_ACTION_IMAGE_SRC, type MemberQuickActionImageKey } from '@/lib/visualAssets';
import { MemberShell } from './_shared/MemberShell';

const STATUS_MAP: Record<
  Review['status'],
  { label: string; tone: 'warning' | 'success' | 'danger' | 'neutral' }
> = {
  PENDING_REVIEW: { label: '审核中', tone: 'warning' },
  APPROVED: { label: '已通过', tone: 'success' },
  REJECTED: { label: '已拒绝', tone: 'danger' },
  CHANGES_REQUESTED: { label: '需改动', tone: 'danger' },
  WITHDRAWN: { label: '已撤回', tone: 'neutral' },
};

export default function Dashboard() {
  const nav = useNavigate();
  const { me } = useMyTeams(true);
  const teamQuery = useTeam();
  const skillsQuery = useTeamSkills({ size: 50 });
  const suitesQuery = useSuites({ size: 20 });
  const reviewsQuery = useReviews();
  const activityQuery = useActivity(8);

  const team = teamQuery.data;
  const skills = skillsQuery.data ?? [];
  const suites = suitesQuery.data ?? [];
  const reviews = reviewsQuery.data ?? [];
  const activity = activityQuery.data ?? [];
  const mine = reviews
    .filter((r) => r.submittedBy.handle && r.submittedBy.handle === me?.handle)
    .slice(0, 4);
  const pending = mine.filter((r) => r.status === 'PENDING_REVIEW').length;
  const approved = skills.filter((s) => s.status === 'APPROVED').length;
  const totalInstalls = skills.reduce((sum, s) => sum + s.installs, 0);

  const isInitialLoading =
    teamQuery.isLoading || reviewsQuery.isLoading || skillsQuery.isLoading;
  const hasFatalError = teamQuery.isError && !teamQuery.data;

  return (
    <MemberShell active="overview">
      <DashTopBar
        title="工作台"
        hint={`欢迎回来，${me?.name || '团队成员'} · 你已加入 ${team?.name || '当前团队'}`}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<I.plus size={12} />}
            onClick={() => nav('/create/skill')}
          >
            提交 Skill
          </Button>
        }
      />
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
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 14,
                marginBottom: 24,
              }}
            >
              <Stat
                label="我提交的"
                value={mine.length}
                delta="来自审核记录"
                icon={<I.upload size={14} />}
              />
              <Stat label="待审核中" value={pending} accent icon={<I.clock size={14} />} />
              <Stat
                label="本团队已通过"
                value={approved}
                delta={`共 ${fmt(totalInstalls)} 安装`}
                icon={<I.check size={14} />}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
              <DashLeft
                submissions={mine}
                skills={skills}
                suites={suites}
                reviewsState={{
                  isError: reviewsQuery.isError,
                  refetch: () => reviewsQuery.refetch(),
                }}
                skillsState={{
                  isError: skillsQuery.isError,
                  refetch: () => skillsQuery.refetch(),
                }}
                suitesState={{
                  isError: suitesQuery.isError,
                  refetch: () => suitesQuery.refetch(),
                }}
              />
              <DashRight
                activity={activity}
                reviewMode={team?.reviewMode}
                activityState={{
                  isError: activityQuery.isError,
                  refetch: () => activityQuery.refetch(),
                }}
              />
            </div>
          </>
        )}
      </div>
    </MemberShell>
  );
}

type QueryState = { isError: boolean; refetch: () => void };

function DashLeft({
  submissions,
  skills,
  suites,
  reviewsState,
  skillsState,
  suitesState,
}: {
  submissions: Review[];
  skills: Skill[];
  suites: Suite[];
  reviewsState: QueryState;
  skillsState: QueryState;
  suitesState: QueryState;
}) {
  const nav = useNavigate();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card pad={18}>
        <SectionHeader
          title="我的提交进度"
          hint={`你在本团队的 ${submissions.length} 次审核`}
          extra={
            <Button
              variant="ghost"
              size="sm"
              icon={<I.chevR size={12} />}
              onClick={() => nav('/team/mine')}
            >
              查看全部
            </Button>
          }
        />
        {reviewsState.isError ? (
          <EmptyState
            compact
            icon={<I.x size={16} />}
            title="审核记录加载失败"
            action={
              <Button variant="ghost" size="sm" onClick={reviewsState.refetch}>
                重试
              </Button>
            }
          />
        ) : submissions.length === 0 ? (
          <EmptyState
            compact
            title="还没有提交记录"
            hint="把你写的 Skill 提交给团队审核，能让大家直接安装使用"
            action={
              <Button variant="primary" size="sm" onClick={() => nav('/create/skill')}>
                提交第一个 Skill
              </Button>
            }
          />
        ) : (
          submissions.map((r) => {
            const s = STATUS_MAP[r.status];
            return (
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
                <SkillIcon ch={r.name.slice(0, 1).toUpperCase()} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>Skill · {r.name}</div>
                  <div style={{ fontSize: 11.5, color: TOKENS.text3, marginTop: 2 }}>
                    提交者 {r.submittedBy.name || r.submittedBy.handle || '成员'} · {r.submittedAt}
                  </div>
                </div>
                <Badge tone={s.tone} size="sm">
                  {s.label}
                </Badge>
                <Button variant="ghost" size="sm" onClick={() => nav('/team/mine')}>
                  查看
                </Button>
              </div>
            );
          })
        )}
      </Card>

      <Card pad={18}>
        <SectionHeader title="团队 Skill 库" hint="点击进入详情或安装到本机" />
        {skillsState.isError ? (
          <EmptyState
            compact
            icon={<I.x size={16} />}
            title="Skill 数据加载失败"
            action={
              <Button variant="ghost" size="sm" onClick={skillsState.refetch}>
                重试
              </Button>
            }
          />
        ) : skills.length === 0 ? (
          <EmptyState
            compact
            title="团队里还没有可用 Skill"
            hint="第一个提交并通过审核的就是它了"
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
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
                <Button
                  variant="secondary"
                  size="sm"
                  style={{ alignSelf: 'center', height: 26, fontSize: 11 }}
                  onClick={() => nav('/team/skills')}
                >
                  查看
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card pad={18}>
        <SectionHeader title="推荐套件" hint="管理员推荐给团队成员开箱使用" />
        {suitesState.isError ? (
          <EmptyState
            compact
            icon={<I.x size={16} />}
            title="套件加载失败"
            action={
              <Button variant="ghost" size="sm" onClick={suitesState.refetch}>
                重试
              </Button>
            }
          />
        ) : suites.length === 0 ? (
          <EmptyState compact title="还没有团队套件" hint="管理员可以把常用 Skill 打包成套件方便分享" />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {suites.slice(0, 2).map((s) => (
              <div
                key={s.id}
                style={{
                  padding: 14,
                  background: TOKENS.bgAlt,
                  borderRadius: 10,
                  border: `1px solid ${TOKENS.borderSoft}`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <I.layers size={14} style={{ color: TOKENS.info }} />
                  <b style={{ fontSize: 13 }}>{s.name}</b>
                  <Badge
                    tone={s.visibility === 'PUBLIC' ? 'success' : 'neutral'}
                    size="sm"
                    style={{ marginLeft: 'auto', fontSize: 10 }}
                  >
                    {s.visibility === 'PUBLIC' ? '公开' : '团队私有'}
                  </Badge>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: TOKENS.text2,
                    lineHeight: 1.55,
                    minHeight: 36,
                  }}
                >
                  {s.desc}
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginTop: 8,
                    fontSize: 11.5,
                    color: TOKENS.text3,
                  }}
                >
                  <span>{s.skills} 个 Skill</span>
                  <span>{fmt(s.installs)} 安装</span>
                  <Button
                    variant="primary"
                    size="sm"
                    style={{ marginLeft: 'auto', height: 26, fontSize: 11 }}
                    onClick={() => nav('/team/suites')}
                  >
                    查看
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

const KIND_TONE: Record<
  ActivityKind,
  'success' | 'primary' | 'info' | 'warning' | 'neutral' | 'danger'
> = {
  approve: 'success',
  submit: 'primary',
  invite: 'info',
  release: 'warning',
  unlist: 'neutral',
  join: 'success',
  suite: 'primary',
  reject: 'danger',
};

const QUICK: ReadonlyArray<[string, MemberQuickActionImageKey, string]> = [
  ['提交 Skill', 'submitSkill', '/create/skill'],
  ['浏览套件', 'browseSuites', '/team/suites'],
  ['我的提交', 'mySubmissions', '/team/mine'],
  ['通知偏好', 'notificationPrefs', '/team/prefs'],
];

function DashRight({
  activity,
  reviewMode,
  activityState,
}: {
  activity: Activity[];
  reviewMode?: string;
  activityState: QueryState;
}) {
  const nav = useNavigate();
  const visible = activity.filter((a) => !['unlist', 'invite'].includes(a.kind));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card pad={16}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>快捷操作</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {QUICK.map(([n, image, to]) => (
            <Button variant="ghost"
              key={n}
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
              }}
            >
              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 14,
                  background: TOKENS.bgAlt,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <img
                  src={MEMBER_QUICK_ACTION_IMAGE_SRC[image]}
                  alt=""
                  aria-hidden="true"
                  width={52}
                  height={52}
                  style={{ display: 'block', width: 52, height: 52, objectFit: 'contain' }}
                />
              </div>
              <span style={{ fontSize: 12, fontWeight: 500 }}>{n}</span>
            </Button>
          ))}
        </div>
      </Card>

      <Card pad={16}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, display: 'flex' }}>
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
        {activityState.isError ? (
          <EmptyState
            compact
            icon={<I.x size={16} />}
            title="动态加载失败"
            action={
              <Button variant="ghost" size="sm" onClick={activityState.refetch}>
                重试
              </Button>
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState compact title="暂无团队动态" hint="提交、审核、套件发布会出现在这里" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {visible.map((a, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 10,
                  paddingTop: i === 0 ? 0 : 12,
                  paddingBottom: 12,
                  borderBottom:
                    i < visible.length - 1 ? `1px solid ${TOKENS.borderSoft}` : 'none',
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
                  <div style={{ fontSize: 11, color: TOKENS.text3, marginTop: 2 }}>{a.when}</div>
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
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>团队审核模式</div>
        <div style={{ fontSize: 11.5, color: TOKENS.text3, marginBottom: 12 }}>
          由管理员配置，影响你提交 Skill 后的去向
        </div>
        <div
          style={{
            padding: 12,
            background: TOKENS.bgGray,
            border: `1px solid ${TOKENS.borderSoft}`,
            borderRadius: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <I.shield size={14} style={{ color: TOKENS.text2 }} />
            <b style={{ fontSize: 13, color: TOKENS.text }}>
              {reviewMode === 'DIRECT_PUBLISH' ? '直接发布' : '需要审核'}
            </b>
          </div>
          <div style={{ fontSize: 11.5, color: TOKENS.text2, lineHeight: 1.55 }}>
            {reviewMode === 'DIRECT_PUBLISH'
              ? '你提交的 Skill 会立即生效，无需 Owner/Admin 审核。'
              : '你提交的 Skill 会先进入审核队列，通过后才会出现在团队 / 公开广场。'}
          </div>
        </div>
      </Card>
    </div>
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
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 14,
          marginBottom: 24,
        }}
      >
        {[0, 1, 2].map((i) => (
          <div key={i}>{block(76)}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {block(200)}
          {block(180)}
          {block(160)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {block(120)}
          {block(220)}
          {block(120)}
        </div>
      </div>
    </>
  );
}
