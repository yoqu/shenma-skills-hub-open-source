import { TOKENS } from '@/lib/tokens';
import { Button } from '@/components/ui';

interface PaginationProps {
  page: number;
  size: number;
  total: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, size, total, onChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, size)));
  const canPrev = page > 1;
  const canNext = page < totalPages;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 4px 0',
        fontSize: 12,
        color: TOKENS.text3,
      }}
    >
      <span>
        共 {total} 条 · 第 {page} / {totalPages} 页
      </span>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
        <Button
          variant="secondary"
          size="sm"
          disabled={!canPrev}
          onClick={() => onChange(page - 1)}
        >
          上一页
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={!canNext}
          onClick={() => onChange(page + 1)}
        >
          下一页
        </Button>
      </div>
    </div>
  );
}
