import type { ReactNode } from 'react';

interface OptionGroupProps {
  children: ReactNode;
  direction?: 'vertical' | 'horizontal';
}

export function OptionGroup({ children, direction = 'vertical' }: OptionGroupProps) {
  return (
    <div
      role="radiogroup"
      style={{
        display: 'flex',
        flexDirection: direction === 'horizontal' ? 'row' : 'column',
        flexWrap: direction === 'horizontal' ? 'wrap' : undefined,
        gap: 8,
      }}
    >
      {children}
    </div>
  );
}
