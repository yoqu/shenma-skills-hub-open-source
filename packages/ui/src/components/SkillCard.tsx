import { TOKENS } from '../tokens';
import { fmt } from '../utils';
import { I } from '../icons';
import { SkillIcon } from './SkillIcon';

export interface SkillCardData {
  icon: string;
  seed?: string;
  cat: string;
  iconUrl?: string;
  name: string;
  visibility: 'PUBLIC' | 'TEAM_PRIVATE';
  version: string;
  author: { name: string };
  short: string;
  tags: string[];
  installs: number;
  score: number;
  updated: string;
}

export interface SkillCardProps {
  skill: SkillCardData;
  dense?: boolean;
  onClick?: () => void;
}

export function SkillCard({ skill, dense, onClick }: SkillCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff',
        border: `1px solid ${TOKENS.border}`,
        borderRadius: 12,
        padding: dense ? 14 : 16,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        transition: 'border-color .12s, box-shadow .12s',
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <SkillIcon
          ch={skill.icon}
          seed={skill.seed || skill.name}
          cat={skill.cat}
          url={skill.iconUrl}
          size={dense ? 38 : 44}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: TOKENS.text,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {skill.name}
            </div>
            {skill.visibility === 'TEAM_PRIVATE' && (
              <I.lock size={12} style={{ color: TOKENS.text3, flex: '0 0 auto' }} />
            )}
          </div>
          <div style={{ fontSize: 12, color: TOKENS.text3, marginTop: 2 }}>
            v{skill.version} · {skill.author.name}
          </div>
        </div>
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: TOKENS.text2,
          lineHeight: 1.55,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          minHeight: dense ? 0 : 38,
        }}
      >
        {skill.short}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {skill.tags.slice(0, 3).map((t) => (
          <span
            key={t}
            style={{
              fontSize: 11,
              color: TOKENS.text2,
              padding: '2px 7px',
              background: TOKENS.bgGray,
              borderRadius: 4,
            }}
          >
            {t}
          </span>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          fontSize: 12,
          color: TOKENS.text3,
          paddingTop: 8,
          borderTop: `1px solid ${TOKENS.borderSoft}`,
          marginTop: 'auto',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <I.download size={12} /> {fmt(skill.installs)}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <I.starFill size={12} style={{ color: '#F59E0B' }} /> {skill.score || '—'}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11 }}>{skill.updated.slice(5)}</span>
      </div>
    </div>
  );
}
