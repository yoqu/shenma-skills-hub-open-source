import { useNavigate } from 'react-router-dom';
import { TOKENS } from '@/lib/tokens';
import { fmt } from '@/lib/utils';
import {
  Button,
  Card,
  SkillIcon,
  TeamAvatar,
} from '@/components/ui';

import { usePublicSkills, useTeam } from '@/api/data';
import type { Skill } from '@/mocks/skills';

export function DetailSidebar({ skill, version }: { skill: Skill; version: string }) {
  const nav = useNavigate();
  const { data: team } = useTeam(skill.team);
  const { data: related = [] } = usePublicSkills({ size: 4 });
  return (
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
          当前版本
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              fontSize: 12,
              fontFamily:
                'var(--font-mono), ui-monospace, "SF Mono", Menlo, monospace',
              borderRadius: 999,
              background: TOKENS.primarySoft,
              color: '#4338CA',
              fontWeight: 500,
            }}
          >
            v{version}
          </span>
          {version === skill.version && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 8px',
                fontSize: 11,
                borderRadius: 999,
                background: '#ECFDF5',
                color: '#047857',
                fontWeight: 500,
              }}
            >
              latest
            </span>
          )}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            fontSize: 12,
            color: TOKENS.text2,
          }}
        >
          {(
            [
              ['下载量', fmt(skill.installs)],
              ['评分', skill.score ? skill.score + ' ★' : '—'],
              ['评测', skill.evalScore ? `${skill.evalScore}/100` : '—'],
              ['文件数', typeof skill.filesCount === 'number' ? String(skill.filesCount) : '—'],
              ['许可', skill.license || '—'],
            ] as [string, string][]
          ).map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: 11, color: TOKENS.text3 }}>{k}</div>
              <div style={{ fontWeight: 500, marginTop: 1 }}>{v}</div>
            </div>
          ))}
        </div>
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
          标签
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[...skill.tags, ...skill.langs].map((t) => (
            <span
              key={t}
              style={{
                fontSize: 11.5,
                color: TOKENS.text2,
                padding: '3px 8px',
                background: TOKENS.bgGray,
                borderRadius: 4,
              }}
            >
              {t}
            </span>
          ))}
        </div>
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
          来自团队
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
          <TeamAvatar
            name={team?.name}
            avatar={team?.avatar}
            logoUrl={team?.logoUrl}
            color={team?.color}
            size={36}
            radius={8}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{team?.name ?? skill.team}</div>
            <div style={{ fontSize: 11, color: TOKENS.text3 }}>
              {team?.members ?? 0} 成员 · {team?.publicSkills ?? 0} 公开 Skill
            </div>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          full
          onClick={() => nav(`/teams/${team?.slug ?? skill.team}`)}
        >
          查看团队主页
        </Button>
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
          相关 Skills
        </div>
        {related.filter((s) => s.slug !== skill.slug && s.visibility === 'PUBLIC')
          .slice(0, 3)
          .map((s) => (
            <div
              key={s.slug}
              onClick={() => nav(`/skills/${s.slug}`)}
              style={{
                display: 'flex',
                gap: 10,
                padding: '8px 0',
                borderBottom: `1px solid ${TOKENS.borderSoft}`,
                cursor: 'pointer',
              }}
            >
              <SkillIcon ch={s.icon} size={28} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.name}
                </div>
                <div style={{ fontSize: 11, color: TOKENS.text3, marginTop: 1 }}>
                  {fmt(s.installs)} 安装
                </div>
              </div>
            </div>
          ))}
      </Card>
    </aside>
  );
}
