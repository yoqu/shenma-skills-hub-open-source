import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TOKENS } from '@/lib/tokens';
import { Card, PromptCard, SearchInput, SegmentedControl, SkillCard } from '@/components/ui';
import { TopBar, Tabs } from '@/components/chrome';
import {
  type PromptCard as PromptCardData,
  useCategories,
  useMyTeams,
  usePublicPrompts,
  usePublicSkills,
  useTeamPrompts,
  useTeamSkills,
} from '@/api/data';
import { useCurrentTeam } from '@/hooks/useCurrentTeam';
import { getToken } from '@/api/client';
import type { Skill } from '@/mocks/skills';

function PlazaSearch({ q, setQ }: { q: string; setQ: (s: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
      <SearchInput
        width={480}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="按名称、描述、标签搜索..."
      />
    </div>
  );
}

function CategoryChips({
  categories,
  active,
  onSelect,
  counts,
  total,
}: {
  categories: { id: string; name: string }[];
  active: string;
  onSelect: (id: string) => void;
  // 当前加载集合内每个分类的真实条目数；'all' 用 total。计数来自实际数据，避免使用对不上的 seed 计数。
  counts: Record<string, number>;
  total: number;
}) {
  // /api/categories 已包含 id='all' 的「全部」项；仅当缺失时才补一个，避免重复。
  const items = categories.some((c) => c.id === 'all')
    ? categories
    : [{ id: 'all', name: '全部' }, ...categories];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
      {items.map((c) => {
        const isActive = active === c.id;
        const n = c.id === 'all' ? total : counts[c.id] ?? 0;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 30,
              padding: '0 12px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 500,
              lineHeight: 1,
              cursor: 'pointer',
              border: `1px solid ${isActive ? TOKENS.primary : TOKENS.border}`,
              background: isActive ? TOKENS.primarySoft : '#fff',
              color: isActive ? TOKENS.primary : TOKENS.text2,
            }}
          >
            {c.name}
            <span style={{ fontSize: 11, color: isActive ? TOKENS.primary : TOKENS.text3 }}>
              {n}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function matchesSearch(skill: Skill, q: string) {
  const keyword = q.trim().toLowerCase();
  if (!keyword) return true;
  return [
    skill.name,
    skill.slug,
    skill.short,
    skill.author.name,
    skill.team,
    ...skill.tags,
    ...skill.langs,
  ].some((text) => text.toLowerCase().includes(keyword));
}

function matchesPrompt(prompt: PromptCardData, q: string) {
  const keyword = q.trim().toLowerCase();
  if (!keyword) return true;
  return [
    prompt.name,
    prompt.slug,
    prompt.shortDesc ?? '',
    prompt.teamSlug ?? '',
    prompt.cat ?? '',
    ...(prompt.tags ?? []),
  ].some((text) => text.toLowerCase().includes(keyword));
}

type SourceTab = 'public' | 'team';
type AssetTab = 'skills' | 'prompts';

export default function Plaza() {
  const nav = useNavigate();
  const authed = !!getToken();
  const [source, setSource] = useState<SourceTab>('public');
  const [assetTab, setAssetTab] = useState<AssetTab>('skills');
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');

  const { data: myTeams = [] } = useMyTeams(authed);
  const { teamSlug } = useCurrentTeam(authed);
  const currentTeam = myTeams.find((t) => t.slug === teamSlug);
  const showTeamTab = authed && !!currentTeam;
  const effectiveSource: SourceTab = showTeamTab ? source : 'public';

  const catParam = cat === 'all' ? undefined : cat;
  const { data: categories = [] } = useCategories();
  const { data: publicSkills = [] } = usePublicSkills({ size: 48 });
  const { data: publicPrompts = [] } = usePublicPrompts({ size: 48 });
  const { data: teamSkills = [] } = useTeamSkills({});
  const { data: teamPrompts = [] } = useTeamPrompts({});

  const isSkills = assetTab === 'skills';
  const baseSkillsRaw = effectiveSource === 'team' ? teamSkills : publicSkills;
  const basePromptsRaw = effectiveSource === 'team' ? teamPrompts : publicPrompts;
  // 公共 /api/skills 与 prompt 列表都不支持服务端 cat（且公共端点硬编码 PUBLIC+APPROVED，
  // 不能改走 cat-aware 查询，否则会泄露非公开 skill），分类统一在已加载集合上客户端过滤。
  const baseSkills = catParam ? baseSkillsRaw.filter((s) => s.cat === catParam) : baseSkillsRaw;
  const visiblePrompts = catParam
    ? basePromptsRaw.filter((p) => (p.cat ?? '') === catParam)
    : basePromptsRaw;

  const skillResults = baseSkills.filter((s) => matchesSearch(s, q));
  const promptResults = visiblePrompts.filter((p) => matchesPrompt(p, q));

  const activeTotal = isSkills ? baseSkills.length : visiblePrompts.length;
  const activeFiltered = isSkills ? skillResults.length : promptResults.length;
  const assetLabel = isSkills ? ' Skill' : ' Prompt';

  // 分类计数按当前 source + 资产类型，从已加载集合实时统计，与点击后展示结果一致。
  const countSource: { cat?: string }[] = isSkills ? baseSkillsRaw : basePromptsRaw;
  const catCounts: Record<string, number> = {};
  for (const item of countSource) {
    const c = item.cat;
    if (c) catCounts[c] = (catCounts[c] ?? 0) + 1;
  }

  const changeSource = (id: string) => {
    setSource(id as SourceTab);
    setCat('all');
  };
  const changeAsset = (id: AssetTab) => {
    setAssetTab(id);
    setCat('all');
  };

  const subtitle =
    effectiveSource === 'team'
      ? `当前团队可复用的工程化能力与 Prompt · 共 ${activeTotal} 个${assetLabel}`
      : `发现来自社区与团队公开分享的工程化能力与 Prompt · 共 ${activeTotal} 个${assetLabel}`;

  return (
    <div style={{ background: TOKENS.bgAlt, minHeight: '100%' }}>
      <TopBar active="plaza" authed={authed} />
      <div
        style={{
          background: '#fff',
          borderBottom: `1px solid ${TOKENS.border}`,
          padding: '24px 32px 0',
        }}
      >
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>资产广场</h1>
          <p style={{ fontSize: 13, color: TOKENS.text3, margin: '0 0 16px' }}>{subtitle}</p>
          {showTeamTab && (
            <Tabs
              active={effectiveSource}
              onChange={changeSource}
              tabs={[
                { id: 'public', label: '公共广场' },
                { id: 'team', label: `当前团队 · ${currentTeam?.name}` },
              ]}
            />
          )}
          <SegmentedControl
            aria-label="广场资产类型"
            value={assetTab}
            onChange={changeAsset}
            options={[
              { value: 'skills', label: 'Skills' },
              { value: 'prompts', label: 'Prompts' },
            ]}
            style={{ margin: '14px 0' }}
          />
          <PlazaSearch q={q} setQ={setQ} />
          <CategoryChips
            categories={categories}
            active={cat}
            onSelect={setCat}
            counts={catCounts}
            total={countSource.length}
          />
        </div>
      </div>

      <div
        style={{
          maxWidth: 1180,
          margin: '0 auto',
          padding: '24px 32px 60px',
        }}
      >
        <main>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: 12,
              fontSize: 12,
              color: TOKENS.text3,
            }}
          >
            <span>
              找到 <b style={{ color: TOKENS.text2 }}>{activeFiltered}</b> 个{assetLabel}
            </span>
          </div>
          {isSkills && skillResults.length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 14,
              }}
            >
              {skillResults.map((s) => (
                <SkillCard key={s.slug} skill={s} onClick={() => nav(`/skills/${s.slug}`)} />
              ))}
            </div>
          ) : !isSkills && promptResults.length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 14,
              }}
            >
              {promptResults.map((p) => (
                <PromptCard
                  key={`${p.teamSlug ?? 'team'}-${p.slug}`}
                  prompt={p}
                  onClick={() => nav(`/prompts/${p.teamSlug}/${p.slug}`)}
                />
              ))}
            </div>
          ) : (
            <Card pad={28}>
              <div style={{ textAlign: 'center', color: TOKENS.text3, fontSize: 13 }}>
                {effectiveSource === 'team'
                  ? `当前团队还没有匹配的${assetLabel}`
                  : `没有匹配的${assetLabel}`}
              </div>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}
