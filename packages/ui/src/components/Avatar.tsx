import { useEffect, useState, type CSSProperties } from 'react';
import { hashColor } from '../utils';

export interface AvatarProps {
  name?: string;
  /** Display character. Defaults to the last character of `name`. */
  char?: string;
  /** Optional image URL. When loaded successfully, shown instead of the colored character. */
  url?: string | null;
  size?: number;
  color?: string;
  style?: CSSProperties;
}

export function Avatar({ name, size = 28, color, char, url, style }: AvatarProps) {
  const c = color || hashColor(name || 'x');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  const showImage = !!url && !failed;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: showImage ? 'transparent' : c,
        color: '#fff',
        fontSize: size * 0.42,
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: '0 0 auto',
        letterSpacing: 0,
        overflow: 'hidden',
        ...style,
      }}
    >
      {showImage ? (
        <img
          src={url!}
          alt={name || 'avatar'}
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        char || (name || '?').slice(-1)
      )}
    </div>
  );
}
