import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { TOKENS } from '@/lib/tokens';
import { fmt } from '@/lib/utils';
import {
  Avatar,
  Badge,
  Button,
  SkillIcon,
} from '@/components/ui';

import { TopBar, Tabs } from '@/components/chrome';
import { I } from '@/components/icons';
import { mapSkill, useCategories } from '@/api/data';
import { getToken } from '@/api/client';
import { skillApi } from '@/api/endpoints';
import { DetailMain } from './Detail/Main';
import { DetailSidebar } from './Detail/Sidebar';
import type { InstallTab, SkillVersion } from './Detail/types';

export default function SkillDetail() {
  const { slug } = useParams();
  const nav = useNavigate();
  const { data: categories = [] } = useCategories();
  const { data: rawSkill, isError } = useQuery({
    queryKey: ['skill-detail', slug],
    queryFn: () => skillApi.detail(slug || ''),
    enabled: Boolean(slug),
  });
  const versionsQuery = useQuery({
    queryKey: ['skill-versions', slug],
    queryFn: () => skillApi.versions(slug || ''),
    enabled: Boolean(slug),
  });
  const rawVersions = versionsQuery.data ?? [];
  const skill = rawSkill ? mapSkill(rawSkill) : null;
  const skillTeam = (rawSkill as any)?.team || {};
  const versions: SkillVersion[] = rawVersions.map((v: any) => ({
    id: typeof v.id === 'number' ? v.id : undefined,
    version: v.version,
    date: v.date,
    note: v.note,
    changelog: typeof v.changelog === 'string' ? v.changelog : undefined,
    author: v.author,
    installs: v.installs,
    latest: v.latest,
    filesCount: typeof v.filesCount === 'number' ? v.filesCount : undefined,
    safety:
      v.safety === 'pass' || v.safety === 'warn' || v.safety === 'fail'
        ? v.safety
        : undefined,
    evalScore: typeof v.evalScore === 'number' ? v.evalScore : undefined,
  }));

  const installTabs: InstallTab[] = [
    { id: 'chat', label: '通过对话安装', icon: I.sparkles },
    { id: 'cli', label: '命令行安装', icon: I.terminal },
    { id: 'zip', label: 'Zip 包安装', icon: I.download },
  ];

  const [tab, setTab] = useState('overview');
  const [installTab, setInstallTab] = useState<InstallTab['id']>('chat');
  const [version, setVersion] = useState('');
  const [installs, setInstalls] = useState(0);

  useEffect(() => {
    if (skill?.version) setVersion(skill.version);
    setInstalls(skill?.installs ?? 0);
  }, [skill?.version, skill?.installs]);

  const filesCount = skill?.filesCount;
  const tabs = [
    { id: 'overview', label: '概述' },
    { id: 'install', label: '安装方式' },
    { id: 'files', label: '文件', count: filesCount ?? 0 },
    { id: 'history', label: '版本历史', count: versions.length },
  ];

  const cat = categories.find((c) => c.id === skill?.cat);

  if (isError) {
    return (
      <div style={{ background: TOKENS.bgAlt, minHeight: '100%' }}>
        <TopBar active="plaza" authed={!!getToken()} />
        <div style={{ maxWidth: 720, margin: '60px auto', padding: 32, textAlign: 'center' }}>
          <h2 style={{ fontSize: 22, color: TOKENS.text }}>未找到该 Skill</h2>
          <p style={{ color: TOKENS.text3, marginTop: 8 }}>
            <code style={{ fontFamily: 'var(--font-mono), monospace' }}>{slug}</code> 不存在。
          </p>
        </div>
      </div>
    );
  }

  if (!skill) {
    return (
      <div style={{ background: TOKENS.bgAlt, minHeight: '100%' }}>
        <TopBar active="plaza" authed={!!getToken()} />
        <div style={{ maxWidth: 720, margin: '60px auto', padding: 32, textAlign: 'center' }}>
          <h2 style={{ fontSize: 18, color: TOKENS.text }}>正在加载 Skill…</h2>
        </div>
      </div>
    );
  }

  function showInstallGuide() {
    setTab('install');
  }

  return (
    <div style={{ background: TOKENS.bgAlt, minHeight: '100%' }}>
      <TopBar active="plaza" authed={!!getToken()} />
      <div style={{ background: '#fff', borderBottom: `1px solid ${TOKENS.border}` }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 32px 0' }}>
          <div
            style={{
              fontSize: 12,
              color: TOKENS.text3,
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              minWidth: 0,
            }}
          >
            <span
              onClick={() => nav('/plaza')}
              style={{
                color: TOKENS.text3,
                textDecoration: 'none',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Skills 广场
            </span>
            <I.chevR size={11} style={{ flexShrink: 0 }} />
            <span style={{ color: TOKENS.text3, flexShrink: 0 }}>{cat?.name ?? skill.cat}</span>
            <I.chevR size={11} style={{ flexShrink: 0 }} />
            <span
              style={{
                color: TOKENS.text2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minWidth: 0,
              }}
            >
              {skill.name}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 18,
              alignItems: 'flex-start',
              marginBottom: 20,
            }}
          >
            <SkillIcon ch={skill.icon} cat={skill.cat} url={skill.iconUrl} size={64} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 6,
                }}
              >
                <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{skill.name}</h1>
                {skill.visibility === 'PUBLIC' ? (
                  <Badge tone="primary" size="sm">
                    <I.globe size={10} /> 公开
                  </Badge>
                ) : (
                  <Badge tone="neutral" size="sm">
                    <I.lock size={10} /> 团队私有
                  </Badge>
                )}
                <Badge tone="success" size="sm">
                  <I.check size={10} /> 已审核
                </Badge>
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: TOKENS.text2,
                  lineHeight: 1.6,
                  maxWidth: 720,
                }}
              >
                {skill.short}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  marginTop: 12,
                  fontSize: 12.5,
                  color: TOKENS.text3,
                }}
              >
                <span
                  onClick={() => nav(`/u/${skill.author.handle}`)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                  }}
                >
                  <Avatar
                    name={skill.author.name}
                    size={18}
                    char={skill.author.name.slice(0, 1)}
                    color={TOKENS.primary}
                  />
                  {skill.author.name}
                </span>
                <span>·</span>
                <span
                  onClick={() => nav(`/teams/${skillTeam.slug || skill.team}`)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 3,
                      background: skillTeam.color || TOKENS.primary,
                      color: '#fff',
                      fontSize: 9,
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    {skillTeam.avatar || skillTeam.name?.slice(0, 1) || 'S'}
                  </div>
                  {skillTeam.name || skill.team}
                </span>
                <span>·</span>
                <span>更新于 {skill.updated}</span>
                <span>·</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <I.download size={11} /> {fmt(installs)} 安装
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Button variant="primary" size="md" icon={<I.download size={13} />} onClick={showInstallGuide}>
                安装
              </Button>
            </div>
          </div>
          <Tabs tabs={tabs} active={tab} onChange={setTab} />
        </div>
      </div>

      <div
        style={{
          maxWidth: 1180,
          margin: '0 auto',
          padding: '24px 32px 60px',
          display: 'grid',
          gridTemplateColumns: '1fr 300px',
          gap: 24,
        }}
      >
        <DetailMain
          tab={tab}
          installTabs={installTabs}
          installTab={installTab}
          setInstallTab={setInstallTab}
          versions={versions}
          versionsLoading={versionsQuery.isLoading}
          versionsError={versionsQuery.isError}
          onVersionsRetry={() => versionsQuery.refetch()}
          version={version}
          setVersion={setVersion}
          skill={skill}
        />
          <DetailSidebar skill={skill} version={version} />
      </div>
    </div>
  );
}
