import { hashColor } from '@/lib/utils';
import { CATEGORY_ICON_SRC } from '@/lib/visualAssets';

export interface SkillIconProps {
  ch: string;
  size?: number;
  hue?: string;
  cat?: string;
  /** 自定义上传图标完整 URL；优先于分类图与字母兜底。 */
  url?: string | null;
}

export function SkillIcon({ ch, size = 44, hue, cat, url }: SkillIconProps) {
  const image = cat ? CATEGORY_ICON_SRC[cat] : undefined;
  const c = hue || hashColor(ch + 'skill');

  if (url) {
    return (
      <img
        src={url}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          borderRadius: Math.max(10, size * 0.24),
          objectFit: 'cover',
          display: 'block',
          flex: '0 0 auto',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
        }}
      />
    );
  }

  if (image) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: Math.max(10, size * 0.24),
          background: '#fff',
          display: 'grid',
          placeItems: 'center',
          flex: '0 0 auto',
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          overflow: 'hidden',
        }}
      >
        <img
          src={image}
          alt=""
          aria-hidden="true"
          width={size}
          height={size}
          style={{
            display: 'block',
            width: size,
            height: size,
            objectFit: 'contain',
            transform: 'scale(1.18)',
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        background: `linear-gradient(135deg, ${c}, color-mix(in oklch, ${c} 60%, #000))`,
        color: '#fff',
        fontSize: size * 0.42,
        fontWeight: 700,
        display: 'grid',
        placeItems: 'center',
        flex: '0 0 auto',
        boxShadow: 'inset 0 -2px 0 rgba(0,0,0,.08)',
      }}
    >
      {ch}
    </div>
  );
}
