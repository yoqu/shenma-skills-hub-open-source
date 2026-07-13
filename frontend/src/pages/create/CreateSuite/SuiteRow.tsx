import type { DragEvent } from 'react';
import { TOKENS } from '@/lib/tokens';
import { Badge, Button, SkillIcon } from '@/components/ui';
import { I } from '@/components/icons';
import type { Skill } from '@/mocks/skills';

export interface SuiteRowProps {
  skill: Skill;
  idx: number;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onRemove: () => void;
}

export function SuiteRow({
  skill,
  idx,
  dragging,
  onDragStart,
  onDragEnd,
  onDragOver,
  onRemove,
}: SuiteRowProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        border: `1px solid ${dragging ? TOKENS.primary : TOKENS.border}`,
        background: dragging ? TOKENS.primarySoft : '#fff',
        borderRadius: 8,
        cursor: dragging ? 'grabbing' : 'default',
        opacity: dragging ? 0.6 : 1,
        transition: 'background .12s',
      }}
    >
      <div style={{ cursor: 'grab', color: TOKENS.text3, padding: 2 }}>
        <I.drag size={14} />
      </div>
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: 4,
          background: TOKENS.bgGray,
          color: TOKENS.text2,
          fontSize: 11,
          fontWeight: 600,
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
        }}
      >
        {idx + 1}
      </div>
      <SkillIcon ch={skill.icon} cat={skill.cat} url={skill.iconUrl} size={28} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {skill.name}
        </div>
        {skill.short && (
          <div
            style={{
              fontSize: 11,
              color: TOKENS.text2,
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {skill.short}
          </div>
        )}
        <div style={{ fontSize: 11, color: TOKENS.text3, marginTop: 2 }}>
          v{skill.version} · {skill.author.name}
        </div>
      </div>
      <Badge tone="neutral" size="sm" style={{ fontSize: 10 }}>
        {skill.cat}
      </Badge>
      <Button variant="ghost"
        type="button"
        onClick={onRemove}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: TOKENS.text3,
          padding: 4,
        }}
      >
        <I.x size={14} />
      </Button>
    </div>
  );
}
