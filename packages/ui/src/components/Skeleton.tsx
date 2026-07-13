import type { CSSProperties } from 'react';
import { TOKENS } from '../tokens';

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: CSSProperties;
}

export function Skeleton({ width = '100%', height = 14, radius = 6, style }: SkeletonProps) {
  return (
    <span
      style={{
        display: 'block',
        width,
        height,
        borderRadius: radius,
        background: TOKENS.bgGray,
        animation: 'sk-pulse 1.2s ease-in-out infinite',
        ...style,
      }}
    />
  );
}
