import { useState } from 'react';
import { TOKENS } from '@/lib/tokens';
import { Card, SectionHeader } from '@/components/ui';
import type { Skill } from '@/mocks/skills';
import { SuiteRow } from './SuiteRow';

export interface SuiteListProps {
  selected: Skill[];
  setSelected: (next: Skill[]) => void;
}

export function SuiteList({ selected, setSelected }: SuiteListProps) {
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);

  const move = (from: number, to: number) => {
    const next = [...selected];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    setSelected(next);
  };

  return (
    <Card pad={20}>
      <SectionHeader
        title="套件中的 Skill"
        hint={`${selected.length} 个 · 顺序即安装顺序 · 从右侧添加 / 拖动重排`}
      />
      {selected.length === 0 ? (
        <div
          style={{
            padding: '40px 0',
            textAlign: 'center',
            color: TOKENS.text3,
            fontSize: 13,
            background: TOKENS.bgAlt,
            borderRadius: 10,
          }}
        >
          还没有添加 Skill · 从右侧选择
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {selected.map((s, idx) => (
            <SuiteRow
              key={s.slug}
              skill={s}
              idx={idx}
              dragging={draggingIdx === idx}
              onDragStart={() => setDraggingIdx(idx)}
              onDragEnd={() => setDraggingIdx(null)}
              onDragOver={(e) => {
                e.preventDefault();
                if (draggingIdx !== null && draggingIdx !== idx) {
                  move(draggingIdx, idx);
                  setDraggingIdx(idx);
                }
              }}
              onRemove={() => setSelected(selected.filter((x) => x.slug !== s.slug))}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
