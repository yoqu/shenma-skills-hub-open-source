import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TOKENS } from '@/lib/tokens';
import {
  Avatar,
  Badge,
  Button,
  Card,
  SectionHeader,
  SkillCard,
  TeamAvatar,
} from '@/components/ui';

import { TopBar } from '@/components/chrome';
import { I } from '@/components/icons';
import { mapMember, mapSkill, mapSuite, mapTeam, pageItems, useMyTeams } from '@/api/data';
import { skillApi, suiteApi, teamApi } from '@/api/endpoints';
import { getToken } from '@/api/client';
import { useCurrentTeamStore } from '@/store/currentTeam';
import type { BadgeTone } from '@/components/atoms';

export default function TeamPublic() {
  const { slug } = useParams();
  const nav = useNavigate();
  const authed = !!getToken();
  const setCurrentTeamId = useCurrentTeamStore((s) => s.setCurrentTeamId);

  // 当前登录用户在该团队的成员身份：决定能否看到非公开 / 未审核 Skill 与套件。
  // 必须先解析成员身份，再决定 team detail 走哪个接口 —— 因为公共接口
  // /api/teams/{slug} 会把 publicHome=false 的团队 404 掉，
  // 这种情况下成员/Owner 必须改走 /api/teams/{teamId}/detail 才看得到自己的团队。
  const { data: myTeams = [], isFetched: myTeamsFetched } = useMyTeams(authed);
  const membership = slug
    ? myTeams.find((t) => t.slug === slug)
    : undefined;
  const isMember = !!membership;
  const sessionReady = !authed || myTeamsFetched;

  const { data: team } = useQuery({
    queryKey: ['team-detail', slug, isMember ? `member:${membership!.id}` : 'public'],
    queryFn: async () => {
      if (isMember && membership) {
        return mapTeam(await teamApi.memberDetail(Number(membership.id)));
      }
      return mapTeam(await teamApi.detail(slug!));
    },
    enabled: !!slug && sessionReady,
    retry: false,
  });
  const teamId = team?.id;

  const { data: skills = [] } = useQuery({
    queryKey: ['team-skills', teamId, isMember],
    queryFn: async () =>
      pageItems(
        await skillApi.teamSkills(teamId!, {
          ...(isMember ? {} : { visibility: 'PUBLIC', status: 'APPROVED' }),
          size: 48,
        }),
      ).map(mapSkill),
    enabled: !!teamId,
  });
  const publicSkills = skills.filter(
    (s) => s.visibility === 'PUBLIC' && s.status === 'APPROVED',
  );
  const privateOrPendingSkills = skills.filter(
    (s) => s.visibility !== 'PUBLIC' || s.status !== 'APPROVED',
  );

  const { data: suites = [] } = useQuery({
    queryKey: ['team-suites', teamId, isMember],
    queryFn: async () =>
      pageItems(
        await suiteApi.list(teamId!, {
          ...(isMember ? {} : { visibility: 'PUBLIC' }),
          size: 12,
        }),
      ).map(mapSuite),
    enabled: !!teamId,
  });
  const { data: members = [] } = useQuery({
    queryKey: ['team-public-members', teamId],
    queryFn: async () =>
      pageItems(await teamApi.members(teamId!, { size: 8 })).map(mapMember),
    enabled: !!teamId,
  });
  const publicSuite = suites[0];

  // Aggregate real stats from skills/suites — no more hard-coded "18,420 / 4.7★".
  const visibleSkills = isMember ? skills : publicSkills;
  const visibleSuites = isMember ? suites : publicSuite ? [publicSuite] : [];
  const totalInstalls = visibleSkills.reduce((sum, s) => sum + (s.installs || 0), 0);
  const totalSuiteInstalls = visibleSuites.reduce((sum, s) => sum + (s.installs || 0), 0);
  const cumulativeInstalls = totalInstalls + totalSuiteInstalls;
  const scoredSkills = visibleSkills.filter((s) => (s.score || 0) > 0);
  const avgScore =
    scoredSkills.length === 0
      ? null
      : scoredSkills.reduce((sum, s) => sum + s.score, 0) / scoredSkills.length;
  const fmtNumber = (n: number) =>
    n >= 10000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString();
  const createdLabel = team?.createdAt ? team.createdAt.slice(0, 10) : '—';

  const enterWorkspace = () => {
    if (!team) return;
    setCurrentTeamId(String(team.id));
    nav('/team');
  };

  const memberTone = (role: string): BadgeTone =>
    role === 'Owner' ? 'primary' : role === 'Admin' ? 'info' : 'neutral';

  return (
    <div style={{ background: TOKENS.bgAlt, minHeight: '100%' }}>
      <TopBar active="home" authed={!!getToken()} />
      <div
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(55,48,163,.96) 0%, rgba(79,70,229,.88) 42%, rgba(79,70,229,.18) 100%), url('/team/team-public-banner-p0.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          color: '#fff',
          padding: '40px 32px',
        }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: '0 auto',
            display: 'flex',
            gap: 24,
            alignItems: 'flex-end',
          }}
        >
          <TeamAvatar
            name={team?.name}
            avatar={team?.avatar}
            logoUrl={team?.logoUrl}
            color="rgba(255,255,255,.18)"
            size={88}
            radius={16}
            style={{
              border: '1px solid rgba(255,255,255,.3)',
              backdropFilter: 'blur(8px)',
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 6,
              }}
            >
              <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>{team?.name ?? '团队'}</h1>
              <Badge
                tone="dark"
                size="sm"
                style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }}
              >
                @{team?.slug ?? slug}
              </Badge>
              {isMember ? (
                <Badge tone={memberTone(membership!.role)} size="sm">
                  {membership!.role}
                </Badge>
              ) : (
                <Badge tone="success" size="sm">
                  公开
                </Badge>
              )}
            </div>
            <div
              style={{
                fontSize: 14,
                opacity: 0.9,
                maxWidth: 720,
                lineHeight: 1.6,
              }}
            >
              {team?.desc}
            </div>
            <div
              style={{
                display: 'flex',
                gap: 18,
                marginTop: 14,
                fontSize: 13,
                opacity: 0.9,
              }}
            >
              <span>
                <b style={{ fontSize: 15 }}>{team?.publicSkills ?? publicSkills.length}</b> 公开 Skill
              </span>
              {isMember && (
                <span>
                  <b style={{ fontSize: 15 }}>{team?.privateSkills ?? privateOrPendingSkills.length}</b> 团队内部
                </span>
              )}
              <span>
                <b style={{ fontSize: 15 }}>{visibleSuites.length}</b>
                {isMember ? ' 套件' : ' 公开套件'}
              </span>
              <span>
                <b style={{ fontSize: 15 }}>{team?.members ?? 0}</b> 成员
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {isMember ? (
              <Button
                variant="secondary"
                size="md"
                style={{
                  background: '#fff',
                  color: TOKENS.primary,
                  borderColor: '#fff',
                }}
                onClick={enterWorkspace}
              >
                进入工作台
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="md"
                style={{
                  background: '#fff',
                  color: TOKENS.primary,
                  borderColor: '#fff',
                }}
                icon={<I.send size={13} />}
                onClick={() => nav('/team/join')}
              >
                输入邀请码加入
              </Button>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 32px 60px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 300px',
            gap: 24,
          }}
        >
          <main>
            <SectionHeader
              title={isMember ? '团队 Skills' : '公开 Skills'}
              hint={
                isMember
                  ? `${skills.length} 个 · ${publicSkills.length} 公开 / ${privateOrPendingSkills.length} 团队内部`
                  : `${publicSkills.length} 个 · 任何人可安装`
              }
              extra={
                <Button variant="ghost" size="sm" icon={<I.filter size={12} />}>
                  筛选
                </Button>
              }
            />
            {visibleSkills.length === 0 ? (
              <Card
                pad={24}
                style={{
                  marginBottom: 32,
                  textAlign: 'center',
                  color: TOKENS.text3,
                  fontSize: 13,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <I.cube size={28} style={{ color: TOKENS.text3 }} />
                <div style={{ fontSize: 14, color: TOKENS.text2, fontWeight: 500 }}>
                  {isMember ? '团队还没有 Skill' : '团队还没有公开 Skill'}
                </div>
                <div>
                  {isMember
                    ? '上传第一个 Skill,让队友也能复用你的工作。'
                    : '该团队目前没有对外公开的 Skill。'}
                </div>
                {isMember && (
                  <Button
                    size="sm"
                    variant="primary"
                    style={{ marginTop: 6 }}
                    onClick={() => nav('/create/skill')}
                  >
                    上传 Skill
                  </Button>
                )}
              </Card>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 12,
                  marginBottom: 32,
                }}
              >
                {visibleSkills.map((s) => (
                  <SkillCard
                    key={s.slug}
                    skill={s}
                    dense
                    onClick={() => nav(`/skills/${s.slug}`)}
                  />
                ))}
              </div>
            )}
            <SectionHeader
              title={isMember ? '团队套件' : '公开套件'}
              hint={
                visibleSuites.length === 0
                  ? '把多个 Skill 组合,一行命令安装'
                  : `${visibleSuites.length} 个 · 把多个 Skill 组合,一行命令安装`
              }
            />
            {visibleSuites.length === 0 ? (
              <Card pad={18} style={{ color: TOKENS.text3, fontSize: 13 }}>
                {isMember ? '团队还没有套件' : '团队还没有公开套件'}
              </Card>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {visibleSuites.map((suite) => (
                  <Card
                    key={suite.slug}
                    pad={18}
                    style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}
                  >
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 10,
                        background: `linear-gradient(135deg, ${TOKENS.primary}, #7C3AED)`,
                        color: '#fff',
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      <I.layers size={22} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          marginBottom: 4,
                        }}
                      >
                        <div style={{ fontSize: 15, fontWeight: 600 }}>{suite.name}</div>
                        {suite.visibility === 'TEAM_PRIVATE' && (
                          <I.lock size={12} style={{ color: TOKENS.text3 }} />
                        )}
                      </div>
                      <div
                        style={{ fontSize: 13, color: TOKENS.text2, lineHeight: 1.6 }}
                      >
                        {suite.desc}
                      </div>
                      <div
                        style={{
                          marginTop: 14,
                          padding: '10px 12px',
                          background: '#0F172A',
                          color: '#86EFAC',
                          borderRadius: 6,
                          fontFamily:
                            'var(--font-mono), ui-monospace, "SF Mono", Menlo, monospace',
                          fontSize: 12,
                          overflowX: 'auto',
                        }}
                      >
                        $ smskill suite install {team?.slug ?? '<team>'}/{suite.slug}
                      </div>
                    </div>
                    <Badge tone="primary" size="sm">
                      {suite.skills} Skill
                    </Badge>
                  </Card>
                ))}
              </div>
            )}
          </main>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Card pad={14}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: TOKENS.text2,
                  marginBottom: 10,
                }}
              >
                主要贡献者
              </div>
              {members.length === 0 ? (
                <div style={{ fontSize: 12, color: TOKENS.text3, padding: '6px 0' }}>
                  暂无成员
                </div>
              ) : (
                <>
                  {members.slice(0, 5).map((m) => (
                    <div
                      key={m.handle}
                      onClick={() => nav(`/u/${m.handle}`)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '7px 0',
                        cursor: 'pointer',
                      }}
                    >
                      <Avatar name={m.name} char={m.avatar} url={m.avatarUrl} size={28} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 500 }}>{m.name}</div>
                        <div style={{ fontSize: 11, color: TOKENS.text3 }}>
                          @{m.handle}
                        </div>
                      </div>
                      <Badge tone={memberTone(m.role)} size="sm">
                        {m.role}
                      </Badge>
                    </div>
                  ))}
                  {(team?.members ?? members.length) > 5 && (
                    <div
                      style={{
                        paddingTop: 8,
                        marginTop: 4,
                        borderTop: `1px solid ${TOKENS.borderSoft}`,
                        fontSize: 11,
                        color: TOKENS.text3,
                        textAlign: 'center',
                      }}
                    >
                      + {(team?.members ?? members.length) - 5} 位成员
                    </div>
                  )}
                </>
              )}
            </Card>
            <Card pad={14}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: TOKENS.text2,
                  marginBottom: 10,
                }}
              >
                团队信息
              </div>
              {(
                [
                  ['创建于', createdLabel],
                  ['成员', `${team?.members ?? 0} 人`],
                  [
                    isMember ? '累计 Skill' : '公开 Skill',
                    `${
                      isMember
                        ? (team?.publicSkills ?? 0) + (team?.privateSkills ?? 0)
                        : team?.publicSkills ?? publicSkills.length
                    } 个`,
                  ],
                  ['累计安装', cumulativeInstalls > 0 ? fmtNumber(cumulativeInstalls) : '—'],
                  ['平均评分', avgScore !== null ? `${avgScore.toFixed(1)} ★` : '—'],
                ] as [string, string][]
              ).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', fontSize: 12.5, padding: '5px 0' }}>
                  <span style={{ color: TOKENS.text3, width: 80 }}>{k}</span>
                  <span style={{ color: TOKENS.text2, fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}
