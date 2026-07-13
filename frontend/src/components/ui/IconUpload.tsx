import { useRef, useState, type ReactNode } from 'react';
import { TOKENS } from '@/lib/tokens';

export interface IconUploadProps {
  /** 已存在的图标完整 URL（编辑场景预填）。 */
  currentUrl?: string | null;
  /** 没有图标时展示的兜底内容（字母徽标 / 默认图标）。 */
  fallback: ReactNode;
  /** 实际上传实现，返回 storage key + 可访问 URL。 */
  upload: (file: File) => Promise<{ key: string; url: string }>;
  /** 上传成功回调 key（清除时为 null），url 用于预览。 */
  onChange: (key: string | null, url: string | null) => void;
  size?: number;
  disabled?: boolean;
}

const MAX_BYTES = 2 * 1024 * 1024;

/**
 * 方形圆角图标上传：用于 Skill / Prompt 创建与编辑。
 * 点击选图 → 本地即时预览 → 上传拿 key/url；右上角可移除回退到 fallback。
 */
export function IconUpload({ currentUrl, fallback, upload, onChange, size = 64, disabled }: IconUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [hovered, setHovered] = useState(false);
  const [cleared, setCleared] = useState(false);

  const displayUrl = previewUrl || (cleared ? null : currentUrl);
  const radius = Math.max(10, size * 0.24);

  function pick() {
    if (disabled || uploading) return;
    inputRef.current?.click();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!file.type.startsWith('image/')) {
      setError('仅支持图片文件');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('图标不能超过 2MB');
      return;
    }
    setError('');
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setCleared(false);
    setUploading(true);
    try {
      const data = await upload(file);
      onChange(data.key, data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败，请重试');
      setPreviewUrl(null);
      URL.revokeObjectURL(objectUrl);
    } finally {
      setUploading(false);
    }
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    if (disabled || uploading) return;
    setPreviewUrl(null);
    setCleared(true);
    setError('');
    onChange('', null);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div
        onClick={pick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'relative',
          width: size,
          height: size,
          borderRadius: radius,
          cursor: disabled || uploading ? 'default' : 'pointer',
          overflow: 'hidden',
          flex: '0 0 auto',
          border: `1px solid ${TOKENS.borderSoft}`,
        }}
      >
        {displayUrl ? (
          <img
            src={displayUrl}
            alt="图标"
            style={{ width: size, height: size, objectFit: 'cover', display: 'block' }}
          />
        ) : (
          fallback
        )}
        {(hovered || uploading) && !disabled && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: radius,
              background: 'rgba(0,0,0,0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 11.5,
              fontWeight: 500,
            }}
          >
            {uploading ? '上传中…' : displayUrl ? '更换' : '上传'}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: TOKENS.text3, lineHeight: 1.5 }}>
          点击{displayUrl ? '更换' : '上传'}自定义图标 · 图片 ≤ 2MB
        </div>
        {displayUrl && !uploading && (
          <button
            type="button"
            onClick={clear}
            disabled={disabled}
            style={{
              alignSelf: 'flex-start',
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: 12,
              color: TOKENS.danger,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            移除，使用默认
          </button>
        )}
        {error && <div style={{ fontSize: 11.5, color: TOKENS.danger, lineHeight: 1.4 }}>{error}</div>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
        style={{ display: 'none' }}
        onChange={onFile}
        disabled={disabled || uploading}
      />
    </div>
  );
}
