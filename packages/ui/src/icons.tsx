import type { CSSProperties, ReactNode } from 'react';

export interface IconProps {
  size?: number;
  stroke?: number;
  fill?: string;
  style?: CSSProperties;
  className?: string;
  onClick?: () => void;
}

interface InternalProps extends IconProps {
  d: ReactNode;
}

function Icon({ d, size = 16, stroke = 1.75, fill = 'none', style, className, onClick }: InternalProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      className={className}
      onClick={onClick}
    >
      {d}
    </svg>
  );
}

/**
 * 1:1 port of docs/design-ui/icons.jsx. Lucide-style inline SVGs sized to the
 * design's defaults (size=16, stroke=1.75). Keep additions sparse — prefer
 * reusing lucide-react for icons not in the prototype.
 */
export const I = {
  search: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </>
      }
    />
  ),
  sparkles: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
        </>
      }
    />
  ),
  bolt: (p: IconProps) => <Icon {...p} d={<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />} />,
  star: (p: IconProps) => (
    <Icon {...p} d={<path d="M12 2 15 9l7 .6-5.3 4.6L18.2 21 12 17l-6.2 4 1.5-6.8L2 9.6 9 9z" />} />
  ),
  starFill: (p: IconProps) => (
    <Icon
      {...p}
      fill="currentColor"
      d={<path d="M12 2 15 9l7 .6-5.3 4.6L18.2 21 12 17l-6.2 4 1.5-6.8L2 9.6 9 9z" />}
    />
  ),
  download: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <path d="M12 3v12" />
          <path d="m6 11 6 6 6-6" />
          <path d="M5 21h14" />
        </>
      }
    />
  ),
  check: (p: IconProps) => <Icon {...p} d={<path d="m5 12 5 5 9-11" />} />,
  x: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <path d="m6 6 12 12" />
          <path d="m18 6-12 12" />
        </>
      }
    />
  ),
  chev: (p: IconProps) => <Icon {...p} d={<path d="m6 9 6 6 6-6" />} />,
  chevR: (p: IconProps) => <Icon {...p} d={<path d="m9 6 6 6-6 6" />} />,
  plus: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </>
      }
    />
  ),
  more: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <circle cx="12" cy="5" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="12" cy="19" r="1" />
        </>
      }
    />
  ),
  grid: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <rect x="3" y="3" width="8" height="8" rx="1.5" />
          <rect x="13" y="3" width="8" height="8" rx="1.5" />
          <rect x="3" y="13" width="8" height="8" rx="1.5" />
          <rect x="13" y="13" width="8" height="8" rx="1.5" />
        </>
      }
    />
  ),
  list: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <path d="M8 6h13" />
          <path d="M8 12h13" />
          <path d="M8 18h13" />
          <circle cx="4" cy="6" r=".8" />
          <circle cx="4" cy="12" r=".8" />
          <circle cx="4" cy="18" r=".8" />
        </>
      }
    />
  ),
  shield: (p: IconProps) => <Icon {...p} d={<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3z" />} />,
  flask: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <path d="M10 3h4" />
          <path d="M11 3v6L5 19a2 2 0 0 0 1.7 3h10.6A2 2 0 0 0 19 19l-6-10V3" />
          <path d="M7 14h10" />
        </>
      }
    />
  ),
  user: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
        </>
      }
    />
  ),
  users: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2 20c1-3.5 3.5-5.5 7-5.5s6 2 7 5.5" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M22 18c-.5-2.4-2-3.8-4.5-4" />
        </>
      }
    />
  ),
  team: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <path d="M3 21V8l9-5 9 5v13" />
          <path d="M9 21v-6h6v6" />
        </>
      }
    />
  ),
  cube: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <path d="M12 2 3 7v10l9 5 9-5V7l-9-5z" />
          <path d="M3 7l9 5 9-5" />
          <path d="M12 22V12" />
        </>
      }
    />
  ),
  layers: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <path d="m12 3 9 5-9 5-9-5 9-5z" />
          <path d="m3 13 9 5 9-5" />
          <path d="m3 18 9 5 9-5" />
        </>
      }
    />
  ),
  cog: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.3l.1.1A1.7 1.7 0 0 0 9 4.7 1.7 1.7 0 0 0 10 3.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1A2 2 0 1 1 19.7 7l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </>
      }
    />
  ),
  inbox: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <path d="M22 12h-6l-2 3h-4l-2-3H2" />
          <path d="M5.5 5h13L22 12v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7l3.5-7z" />
        </>
      }
    />
  ),
  bell: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10 21a2 2 0 0 0 4 0" />
        </>
      }
    />
  ),
  bookmark: (p: IconProps) => (
    <Icon {...p} d={<path d="M19 21 12 16l-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />} />
  ),
  bookmarkFill: (p: IconProps) => (
    <Icon
      {...p}
      fill="currentColor"
      d={<path d="M19 21 12 16l-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />}
    />
  ),
  globe: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" />
        </>
      }
    />
  ),
  lock: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </>
      }
    />
  ),
  arrowUp: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <path d="M12 19V5" />
          <path d="m5 12 7-7 7 7" />
        </>
      }
    />
  ),
  arrowDn: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <path d="M12 5v14" />
          <path d="m19 12-7 7-7-7" />
        </>
      }
    />
  ),
  filter: (p: IconProps) => <Icon {...p} d={<path d="M3 5h18l-7 9v6l-4-2v-4z" />} />,
  drag: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <circle cx="9" cy="6" r="1" />
          <circle cx="9" cy="12" r="1" />
          <circle cx="9" cy="18" r="1" />
          <circle cx="15" cy="6" r="1" />
          <circle cx="15" cy="12" r="1" />
          <circle cx="15" cy="18" r="1" />
        </>
      }
    />
  ),
  trash: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <path d="M3 6h18" />
          <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
          <path d="m5 6 1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14" />
        </>
      }
    />
  ),
  copy: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <rect x="8" y="8" width="12" height="12" rx="2" />
          <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
        </>
      }
    />
  ),
  github: (p: IconProps) => (
    <Icon
      {...p}
      stroke={0}
      fill="currentColor"
      d={
        <path d="M12 2a10 10 0 0 0-3.16 19.5c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.1-1.47-1.1-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.95 0-1.1.39-2 1.03-2.7-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.7 0 3.85-2.34 4.7-4.57 4.95.36.31.68.92.68 1.86v2.76c0 .27.18.58.69.48A10 10 0 0 0 12 2z" />
      }
    />
  ),
  terminal: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="m7 9 3 3-3 3" />
          <path d="M13 15h4" />
        </>
      }
    />
  ),
  code: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <path d="m9 8-5 4 5 4" />
          <path d="m15 8 5 4-5 4" />
        </>
      }
    />
  ),
  send: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <path d="M22 2 11 13" />
          <path d="M22 2 15 22l-4-9-9-4 20-7z" />
        </>
      }
    />
  ),
  phone: (p: IconProps) => (
    <Icon
      {...p}
      d={<path d="M5 3h3l2 5-2 1a13 13 0 0 0 7 7l1-2 5 2v3a2 2 0 0 1-2 2A18 18 0 0 1 3 5a2 2 0 0 1 2-2z" />}
    />
  ),
  clock: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </>
      }
    />
  ),
  upload: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <path d="M12 21V9" />
          <path d="m6 13 6-6 6 6" />
          <path d="M5 3h14" />
        </>
      }
    />
  ),
  heart: (p: IconProps) => (
    <Icon
      {...p}
      d={<path d="M12 21s-7-4.5-9.5-9C.8 9 2.5 5 6 5c2 0 3.5 1.2 4.5 2.5C11.5 6.2 13 5 15 5c3.5 0 5.2 4 3.5 7-2.5 4.5-9.5 9-9.5 9z" />}
    />
  ),
  play: (p: IconProps) => <Icon {...p} d={<path d="M6 4v16l14-8z" />} />,
  signOut: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </>
      }
    />
  ),
} as const;

export type IconName = keyof typeof I;
