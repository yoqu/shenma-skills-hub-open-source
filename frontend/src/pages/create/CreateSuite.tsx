import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { TOKENS } from '@/lib/tokens';
import { slugError } from '@/lib/slug';
import { Button } from '@/components/ui';
import { TopBar, TeamSidebar } from '@/components/chrome';
import { I } from '@/components/icons';
import { useCurrentTeam, useTeamSkills } from '@/api/data';
import { suiteApi } from '@/api/endpoints';
import type { Skill, Visibility } from '@/mocks/skills';
import { DashTopBar } from '@/components/ui';
import { SuiteMeta } from './CreateSuite/Meta';
import { SuiteList } from './CreateSuite/SuiteList';
import { SuiteSidebar } from './CreateSuite/Sidebar';

export default function CreateSuite() {
  const nav = useNavigate();
  const { teamId, teamSlug } = useCurrentTeam();
  const [name, setName] = useState('前端日常开发');
  const [slug, setSlug] = useState(() => `daily-fe-plus-${Date.now().toString().slice(-5)}`);
  const [desc, setDesc] = useState('本地开发、调试、Mock、格式化、Lint 一键就绪。');
  const [vis, setVis] = useState<Visibility>('TEAM_PRIVATE');
  const { data: skills = [] } = useTeamSkills({ size: 50 });
  const [selected, setSelected] = useState<Array<Skill & { id?: number }>>([]);
  const slugIssue = slugError(slug);
  const queryClient = useQueryClient();
  const createSuite = useMutation({
    mutationFn: () =>
      suiteApi.create(teamId!, {
        name,
        slug,
        description: desc,
        visibility: vis,
        skillIds: selected.filter((s) => s.id).map((s) => s.id!),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suites', teamId] });
      nav('/team/suites');
    },
  });

  // 不再默认回填前 5 个 Skill：empty suite 是合法状态（SUITE-002）

  const available = useMemo(
    () => skills.filter((s) => !selected.find((x) => x.slug === s.slug)),
    [selected, skills],
  );

  const publish = () => {
    if (slugIssue) return;
    createSuite.mutate();
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        background: TOKENS.bgAlt,
      }}
    >
      <TopBar active="myteam" authed />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <TeamSidebar active="suites" />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <DashTopBar
            title="创建套件"
            hint="把多个 Skill 组合成可一行命令安装的整体"
            actions={
              <>
                <Button variant="ghost" size="sm" onClick={() => nav(-1)}>
                  取消
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<I.check size={12} />}
                  onClick={publish}
                  disabled={createSuite.isPending || !!slugIssue}
                >
                  {createSuite.isPending ? '发布中…' : '发布套件'}
                </Button>
              </>
            }
          />
          <div
            style={{
              padding: '24px 32px 40px',
              overflow: 'auto',
              display: 'grid',
              gridTemplateColumns: '1fr 360px',
              gap: 16,
            }}
          >
            <main style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
              <SuiteMeta
                name={name}
                setName={setName}
                slug={slug}
                setSlug={setSlug}
                desc={desc}
                setDesc={setDesc}
                vis={vis}
                setVis={setVis}
                teamSlug={teamSlug ?? ''}
                teamId={teamId ?? undefined}
              />
              <SuiteList selected={selected} setSelected={setSelected} />
            </main>
            <SuiteSidebar
              available={available}
              onAdd={(s) => setSelected([...selected, s])}
              count={selected.length}
              slug={slug}
              teamId={teamId ?? undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
