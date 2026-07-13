import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TOKENS } from '@/lib/tokens';
import { hashColor } from '@/lib/utils';
import {
  Avatar,
  Badge,
  SkillCard,
} from '@/components/ui';

import { TopBar, Tabs } from '@/components/chrome';
import { mapSkill, normRole, useUserProfile } from '@/api/data';
import { getToken } from '@/api/client';
import { EMPTY_STATE_IMAGE_SRC, type EmptyStateImageKey } from '@/lib/visualAssets';

export default function UserProfile() {
  const { handle } = useParams();
  const nav = useNavigate();
  const { data: profile } = useUserProfile(handle || '');
  const user = (profile || {}) as Record<string, any>;
  const team = user.team || {};
  const userSkills: Array<ReturnType<typeof mapSkill>> = Array.isArray(user.skills)
    ? user.skills.map(mapSkill)
    : [];

  const [tab, setTab] = useState('skills');

  const tabs = [
    { id: 'skills', label: '公开 Skill', count: userSkills.length },
    { id: 'stars', label: '收藏' },
    { id: 'teams', label: '团队', count: 1 },
    { id: 'contrib', label: '贡献历史' },
  ];

  const avatarColor = hashColor(user.name || handle || 'user');

  const stats = [
    { value: user.skillsCount ?? userSkills.length, label: '公开 Skill' },
    { value: user.installs ?? 0, label: '累计安装' },
    { value: user.followers ?? 0, label: '关注者' },
    { value: user.following ?? 0, label: '关注中' },
  ];

  return (
    <div style={{ background: TOKENS.bgAlt, minHeight: '100%' }}>
      <TopBar active="home" authed={!!getToken()} />

      {/* Profile header */}
      <div
        style={{
          background: `linear-gradient(160deg, ${TOKENS.primarySoft} 0%, #ffffff 52%)`,
          borderBottom: `1px solid ${TOKENS.border}`,
        }}
      >
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 32px 0' }}>

          {/* User info row */}
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', marginBottom: 32 }}>

            {/* Avatar with ring */}
            <div
              style={{
                borderRadius: '50%',
                padding: 3,
                background: '#fff',
                boxShadow: `0 0 0 2.5px ${avatarColor}`,
                flexShrink: 0,
              }}
            >
              <Avatar
                name={user.name || ''}
                char={user.avatar || user.name?.slice(0, 1) || ''}
                url={user.avatarUrl}
                size={92}
                color={avatarColor}
              />
            </div>

            {/* Name, handle, bio */}
            <div style={{ flex: 1, paddingTop: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: TOKENS.text }}>
                  {user.name || handle}
                </h1>
                <Badge tone="primary" size="sm">
                  {normRole(user.role)} · {team.name || '团队'}
                </Badge>
              </div>

              <div style={{ fontSize: 13, color: TOKENS.text3, marginBottom: 12 }}>
                @{user.handle || handle}
                {user.joined && <span> · 加入 {String(user.joined).slice(0, 10)}</span>}
              </div>

              {user.bio && (
                <p
                  style={{
                    fontSize: 14,
                    color: TOKENS.text2,
                    lineHeight: 1.65,
                    margin: 0,
                    maxWidth: 540,
                  }}
                >
                  {user.bio}
                </p>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div
            style={{
              display: 'flex',
              paddingBottom: 20,
              borderTop: `1px solid ${TOKENS.borderSoft}`,
              paddingTop: 16,
            }}
          >
            {stats.map((s, i) => (
              <div
                key={s.label}
                style={{
                  paddingRight: 28,
                  marginRight: 28,
                  borderRight: i < stats.length - 1 ? `1px solid ${TOKENS.border}` : 'none',
                }}
              >
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: TOKENS.text,
                    lineHeight: 1,
                  }}
                >
                  {Number(s.value).toLocaleString()}
                </div>
                <div style={{ fontSize: 12, color: TOKENS.text3, marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <Tabs tabs={tabs} active={tab} onChange={setTab} />
        </div>
      </div>

      {/* Tab content */}
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 32px 60px' }}>
        {tab === 'skills' &&
          (userSkills.length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 16,
              }}
            >
              {userSkills.map((s) => (
                <SkillCard
                  key={s.slug}
                  skill={s}
                  onClick={() => nav(`/skills/${s.slug}`)}
                />
              ))}
            </div>
          ) : (
            <EmptyState message="该用户暂无公开 Skill" image="submitSkill" />
          ))}
        {tab !== 'skills' && (
          <EmptyState
            message="该模块暂无内容"
            image={tab === 'stars' ? 'empty' : tab === 'teams' ? 'invite' : 'activity'}
          />
        )}
      </div>
    </div>
  );
}

function EmptyState({ message, image = 'empty' }: { message: string; image?: EmptyStateImageKey }) {
  return (
    <div
      style={{
        padding: '56px 12px 60px',
        textAlign: 'center',
        fontSize: 14,
        color: TOKENS.text3,
        background: '#fff',
        border: `1px solid ${TOKENS.border}`,
        borderRadius: 12,
      }}
    >
      <img
        src={EMPTY_STATE_IMAGE_SRC[image]}
        alt=""
        aria-hidden="true"
        width={96}
        height={96}
        style={{ width: 96, height: 96, objectFit: 'contain', display: 'block', margin: '0 auto 10px' }}
      />
      {message}
    </div>
  );
}
