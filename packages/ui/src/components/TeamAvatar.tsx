import type { CSSProperties } from 'react';
import { TOKENS } from '../tokens';

export interface TeamAvatarProps {
  name?: string;
  avatar?: string;
  logoUrl?: string;
  color?: string;
  size?: number;
  radius?: number;
  style?: CSSProperties;
}

export function TeamAvatar({
  name = '团队',
  avatar,
  logoUrl,
  color = TOKENS.primary,
  size = 32,
  radius = 8,
  style,
}: TeamAvatarProps) {
  const fallback = avatar || name.slice(0, 1) || 'S';
  const baseStyle: CSSProperties = {
    width: size,
    height: size,
    borderRadius: radius,
    flex: '0 0 auto',
    ...style,
  };

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={`${name} Logo`}
        style={{
          ...baseStyle,
          display: 'block',
          objectFit: 'cover',
          background: TOKENS.bgAlt,
        }}
      />
    );
  }

  return (
    <div
      style={{
        ...baseStyle,
        background: color,
        color: '#fff',
        fontWeight: 700,
        fontSize: size * 0.4,
        display: 'grid',
        placeItems: 'center',
        letterSpacing: 0,
      }}
    >
      {fallback}
    </div>
  );
}
