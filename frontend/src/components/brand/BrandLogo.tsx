import type { CSSProperties } from 'react';
import { BRAND_LOGO_ALT } from '@/lib/brand';
import { useBrandingStore } from '@/store/branding';

interface BrandLogoProps {
  iconSize?: number;
  labelSize?: number;
  gap?: number;
  showLabel?: boolean;
  style?: CSSProperties;
}

export function BrandLogo({
  iconSize = 36,
  labelSize = 16,
  gap = 8,
  showLabel = true,
  style,
}: BrandLogoProps) {
  const name = useBrandingStore((s) => s.name);
  const logoUrl = useBrandingStore((s) => s.logoUrl);
  const alt = showLabel ? '' : `${name || BRAND_LOGO_ALT} Logo`;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap,
        minWidth: 0,
        color: 'inherit',
        ...style,
      }}
    >
      <img
        src={logoUrl}
        alt={alt}
        aria-hidden={showLabel ? true : undefined}
        style={{
          width: iconSize,
          height: iconSize,
          objectFit: 'contain',
          display: 'block',
          flex: '0 0 auto',
        }}
      />
      {showLabel && (
        <span
          style={{
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: labelSize,
            fontWeight: 600,
            letterSpacing: 0,
            lineHeight: 1,
          }}
        >
          {name}
        </span>
      )}
    </span>
  );
}
