import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIES, TOKENS } from '@/lib/tokens';
import {
  Badge,
  Button,
  Card,
  PromptCard,
  SectionHeader,
  SegmentedControl,
  SkillCard,
  TeamAvatar,
} from '@/components/ui';
import { TopBar } from '@/components/chrome';
import { getToken } from '@/api/client';
import { I } from '@/components/icons';
import { usePublicPrompts, usePublicSkills, usePublicTeams } from '@/api/data';
import { CATEGORY_ICON_SRC } from '@/lib/visualAssets';

export default function Home() {
  const nav = useNavigate();
  const [assetTab, setAssetTab] = useState<'skills' | 'prompts'>('skills');
  const { data: featured = [] } = usePublicSkills({ size: 6 });
  const { data: featuredPrompts = [] } = usePublicPrompts({ size: 6 });
  const { data: teams = [] } = usePublicTeams();

  return (
    <div style={{ background: TOKENS.bg, minHeight: '100%' }}>
      <TopBar active="home" authed={!!getToken()} />

      {/* Hero */}
      <section
        style={{
          background: 'linear-gradient(180deg, #F5F3FF 0%, #FFFFFF 70%)',
          padding: '64px 32px 56px',
          borderBottom: `1px solid ${TOKENS.borderSoft}`,
        }}
      >
        <div
          style={{
            maxWidth: 1080,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr',
            gap: 48,
          }}
        >
          <div>
            <Badge tone="primary" size="md" style={{ marginBottom: 16 }}>
              <I.sparkles size={11} /> 团队 Skill 平台 · v1 公测
            </Badge>
            <h1
              style={{
                fontSize: 44,
                lineHeight: 1.2,
                fontWeight: 700,
                letterSpacing: -0.8,
                color: TOKENS.text,
                margin: '0 0 16px',
              }}
            >
              把团队的工程化能力,
              <br />
              沉淀成可被一行命令安装的 Skill。
            </h1>
            <p
              style={{
                fontSize: 15,
                lineHeight: 1.7,
                color: TOKENS.text2,
                margin: '0 0 24px',
                maxWidth: 520,
              }}
            >
              神马 skill hub 让每个团队都能像维护开源仓库一样, 管理自己的工具集、套件与审核流程。公开分发面向社区,
              私有 Skill 仅团队成员可见。
            </p>
            <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
              <Button variant="primary" size="lg" onClick={() => nav('/register')}>
                创建团队
              </Button>
              <Button
                variant="secondary"
                size="lg"
                icon={<I.search size={14} />}
                onClick={() => nav('/plaza')}
              >
                浏览 Skills 广场
              </Button>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                background: '#0F172A',
                borderRadius: 8,
                color: '#E2E8F0',
                fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                fontSize: 13,
                maxWidth: 440,
              }}
            >
              <span style={{ color: '#A78BFA' }}>$</span>
              <span>smskill suite install </span>
              <span style={{ color: '#86EFAC' }}>1/daily-fe</span>
              <span style={{ marginLeft: 'auto', color: '#64748B', fontSize: 11 }}>
                套件 · 8 个 Skill
              </span>
            </div>
          </div>
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 380,
            }}
          >
            <img
              src="/marketing/home-hero-p0.png"
              alt="神马 skill hub 平台插画"
              style={{
                width: '100%',
                maxWidth: 500,
                height: 'auto',
                display: 'block',
                filter:
                  'drop-shadow(0 30px 60px rgba(79,70,229,.18)) drop-shadow(0 8px 16px rgba(79,70,229,.10))',
                userSelect: 'none',
                pointerEvents: 'none',
              }}
              draggable={false}
            />
          </div>
        </div>
      </section>

      {/* 分类入口 */}
      <section style={{ padding: '32px 32px 8px', maxWidth: 1080, margin: '0 auto' }}>
        <SectionHeader title="按场景沉淀团队能力" hint="从工具、数据、设计、文档到 DevOps 和 AI 增强" />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 12,
          }}
        >
          {CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
            <div
              key={c.id}
              onClick={() => nav('/plaza')}
              style={{
                background: '#fff',
                border: `1px solid ${TOKENS.border}`,
                borderRadius: 12,
                padding: 14,
                minHeight: 132,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: 'pointer',
              }}
            >
              <img
                src={CATEGORY_ICON_SRC[c.id]}
                alt=""
                aria-hidden="true"
                width={58}
                height={58}
                style={{ display: 'block', width: 58, height: 58, objectFit: 'contain' }}
              />
              <div style={{ fontSize: 13, fontWeight: 600, color: TOKENS.text }}>{c.name}</div>
              <div style={{ fontSize: 11.5, color: TOKENS.text3 }}>{c.count} 个 Skill</div>
            </div>
          ))}
        </div>
      </section>

      {/* 精选资产 */}
      <section style={{ padding: '40px 32px', maxWidth: 1080, margin: '0 auto' }}>
        <SectionHeader
          title={assetTab === 'skills' ? '精选 Skills' : '精选 Prompts'}
          hint={assetTab === 'skills' ? '本周下载量、收藏与综合评分最高的 6 个' : '可复用上下文、角色设定与工作流提示词'}
          extra={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SegmentedControl
                aria-label="精选资产类型"
                value={assetTab}
                onChange={setAssetTab}
                options={[
                  { value: 'skills', label: 'Skills' },
                  { value: 'prompts', label: 'Prompts' },
                ]}
              />
              <Button
                variant="ghost"
                size="sm"
                icon={<I.chevR size={13} />}
                onClick={() => nav('/plaza')}
              >
                查看全部
              </Button>
            </div>
          }
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {assetTab === 'skills'
            ? featured.map((s) => (
                <SkillCard key={s.slug} skill={s} onClick={() => nav(`/skills/${s.slug}`)} />
              ))
            : featuredPrompts.map((p) => (
                <PromptCard
                  key={`${p.teamSlug ?? 'team'}-${p.slug}`}
                  prompt={p}
                  onClick={() => nav(`/prompts/${p.teamSlug}/${p.slug}`)}
                />
              ))}
        </div>
      </section>

      {/* 活跃团队 */}
      <section style={{ padding: '20px 32px 60px', maxWidth: 1080, margin: '0 auto' }}>
        <SectionHeader title="活跃团队" hint="正在公开分享 Skill 的团队" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {teams.slice(0, 3).map((t, i) => (
            <Card
              key={i}
              pad={16}
              style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <TeamAvatar
                  name={t.name}
                  avatar={t.avatar}
                  logoUrl={t.logoUrl}
                  color={t.color}
                  size={36}
                  radius={8}
                />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{t.name}</div>
                  <div style={{ fontSize: 11.5, color: TOKENS.text3 }}>
                    {t.members} 位成员 · {t.publicSkills} 个公开 Skill
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 12.5, color: TOKENS.text2, lineHeight: 1.55 }}>
                {t.desc}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => nav(`/teams/${t.slug}`)}
              >
                查看团队
              </Button>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
