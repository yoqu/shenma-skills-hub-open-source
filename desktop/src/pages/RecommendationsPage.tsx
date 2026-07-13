import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  EmptyState,
  SectionHeader,
  SkillCard,
  type SkillCardData,
  Skeleton,
  Stat,
  TOKENS,
  toast,
} from '@skillstack/ui';
import { authApi, skillApi, userSkillApi } from '@/api/endpoints';
import { buildTeamRecommendationParams, getPrimaryTeamId } from './recommendations';
import { desktopEdgeScrollAreaStyle, desktopPageFrameStyle, useTransientScrollbar } from './transientScrollbar';
import type { SkillCardRes } from '@/api/endpoints';

export default function RecommendationsPage() {
  const qc = useQueryClient();
  const scrollbar = useTransientScrollbar();
  const me = useQuery({ queryKey: ['desktop-me'], queryFn: authApi.me });
  const teamId = getPrimaryTeamId(me.data);
  const recommendParams = buildTeamRecommendationParams();
  const skills = useQuery({
    queryKey: ['desktop-recommendations', teamId, recommendParams],
    queryFn: () => skillApi.teamSkills(teamId!, recommendParams),
    enabled: Boolean(teamId),
  });
  const mine = useQuery({ queryKey: ['desktop-user-skills'], queryFn: userSkillApi.mine });
  const subscribe = useMutation({
    mutationFn: userSkillApi.subscribe,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['desktop-user-skills'] });
      toast({ kind: 'success', message: '已添加到我的 Skills' });
    },
    onError: (error) => toastError(error, '添加失败'),
  });

  const recommended = skills.data?.items || [];
  const added = new Set((mine.data || []).filter((item) => item.source === 'TEAM' || item.source === 'PUBLIC').map((item) => item.skillId));
  const mineCount = mine.data?.length || 0;
  const notAddedCount = recommended.filter((item) => !item.id || !added.has(Number(item.id))).length;

  useEffect(() => {
    if (me.isError) {
      toastError(me.error, '账号信息读取失败');
    }
  }, [me.isError, me.error]);

  useEffect(() => {
    if (!me.isLoading && !me.isError && !teamId) {
      toast({ kind: 'warning', message: '当前账号暂无团队推荐 Skill' });
    }
  }, [me.isLoading, me.isError, teamId]);

  useEffect(() => {
    if (skills.isError) {
      toastError(skills.error, '团队推荐加载失败');
    }
  }, [skills.isError, skills.error]);

  useEffect(() => {
    if (mine.isError) {
      toastError(mine.error, '我的 Skills 加载失败');
    }
  }, [mine.isError, mine.error]);

  return (
    <div style={pageStyle}>
      <SectionHeader
        title="团队推荐"
        hint="团队维护的推荐清单，适合新设备初始化或统一工作流。"
      />

      <div style={statsStyle}>
        <Stat label="推荐总数" value={recommended.length} />
        <Stat label="未添加" value={notAddedCount} />
        <Stat label="我的 Skills" value={mineCount} />
      </div>

      {me.isLoading || skills.isLoading ? (
        <div style={skeletonGridStyle}>
          {Array.from({ length: 6 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
            <div key={i} style={skeletonCardStyle}>
              <Skeleton height={44} width={44} radius={10} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Skeleton height={14} width="60%" />
                <Skeleton height={12} width="40%" />
              </div>
              <Skeleton height={12} width="100%" />
              <Skeleton height={12} width="80%" />
            </div>
          ))}
        </div>
      ) : !teamId ? (
        <EmptyState title="当前账号暂无团队推荐 Skill" compact />
      ) : skills.isError ? (
        <EmptyState title="团队推荐加载失败" hint="请刷新重试" compact />
      ) : recommended.length === 0 ? (
        <EmptyState title="暂无团队推荐 Skill" compact />
      ) : (
        <>
          <div
            ref={scrollbar.scrollAreaRef}
            className="desktop-edge-scroll"
            onScroll={scrollbar.onScroll}
            style={{ ...desktopEdgeScrollAreaStyle, ...gridStyle }}
          >
            {recommended.map((item) => {
              const itemAdded = Boolean(item.id && added.has(Number(item.id)));
              return (
                <RecommendationCard
                  key={item.id || item.slug}
                  skill={item}
                  added={itemAdded}
                  adding={subscribe.isPending}
                  onAdd={() => item.id && subscribe.mutate(Number(item.id))}
                />
              );
            })}
          </div>
          <div className="desktop-edge-scroll-thumb" style={scrollbar.thumbStyle} />
        </>
      )}
    </div>
  );
}

function toSkillCardData(skill: SkillCardRes): SkillCardData {
  return {
    icon: (skill.icon || skill.name || 'S').slice(0, 1).toUpperCase(),
    cat: skill.cat || '',
    iconUrl: skill.iconUrl ?? undefined,
    name: skill.name,
    visibility: skill.visibility === 'TEAM_PRIVATE' ? 'TEAM_PRIVATE' : 'PUBLIC',
    version: skill.version || '0.0.0',
    author: { name: skill.author?.name || 'Root Admin' },
    short: skill.shortDesc || skill.short || '',
    tags: skill.tags || [],
    installs: skill.installs ?? 0,
    score: typeof skill.score === 'number' ? skill.score : Number(skill.score ?? 0),
    updated: skill.updated || '',
  };
}

function RecommendationCard({
  skill,
  added,
  adding,
  onAdd,
}: {
  skill: SkillCardRes;
  added: boolean;
  adding: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="desktop-plaza-card">
      {added ? (
        <button
          type="button"
          className="desktop-plaza-install-button"
          disabled
          aria-label={`${skill.name} 已在我的 Skills`}
          title="已在我的 Skills"
        >
          ✓
        </button>
      ) : (
        <button
          type="button"
          className="desktop-plaza-install-button"
          disabled={adding || !skill.id}
          onClick={onAdd}
          aria-label={`添加 ${skill.name} 到我的 Skills`}
          title="添加"
        >
          +
        </button>
      )}
      <SkillCard skill={toSkillCardData(skill)} />
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  ...desktopPageFrameStyle,
};

const statsStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 12,
  marginBottom: 18,
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
  gap: 14,
};

const skeletonGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
  gap: 14,
};

const skeletonCardStyle: React.CSSProperties = {
  background: TOKENS.bg,
  border: `1px solid ${TOKENS.border}`,
  borderRadius: 12,
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message || fallback : fallback;
}

function toastError(error: unknown, fallback: string) {
  toast({ kind: 'error', message: errorMessage(error, fallback) });
}
