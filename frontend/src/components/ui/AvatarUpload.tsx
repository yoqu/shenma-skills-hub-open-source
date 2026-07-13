import { useRef, useState } from 'react';
import { TOKENS } from '@/lib/tokens';
import { accountApi } from '@/api/endpoints';
import { Avatar } from '@skillstack/ui';


export interface AvatarUploadProps {
  currentUrl?: string;
  currentChar?: string;
  name: string;
  onSuccess: (url: string) => void;
  disabled?: boolean;
}

export function AvatarUpload({ currentUrl, currentChar, name, onSuccess, disabled }: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [hovered, setHovered] = useState(false);

  const displayUrl = previewUrl || currentUrl;
  const avatarChar = currentChar || (name ? name.slice(0, 1) : '?');

  function handleClick() {
    if (disabled || uploading) return;
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be selected again
    e.target.value = '';

    // Validate type
    if (!file.type.startsWith('image/')) {
      setError('仅支持 JPG / PNG / GIF / WebP 格式的图片');
      return;
    }

    // Validate size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('图片大小不能超过 2MB');
      return;
    }

    setError('');

    // Immediately show local preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setUploading(true);

    try {
      const data = await accountApi.uploadAvatar(file);
      onSuccess(data.avatarUrl);
      // Keep preview until parent refreshes with real URL
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败，请重试');
      setPreviewUrl(null);
      URL.revokeObjectURL(objectUrl);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      {/* Avatar clickable area */}
      <div
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'relative',
          width: 80,
          height: 80,
          borderRadius: '50%',
          cursor: disabled || uploading ? 'default' : 'pointer',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {displayUrl ? (
          <img
            src={displayUrl}
            alt="头像"
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : (
          <Avatar
            name={name}
            char={avatarChar}
            size={80}
            color={TOKENS.primary}
          />
        )}

        {/* Hover / uploading overlay */}
        {(hovered || uploading) && !disabled && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 12,
              fontWeight: 500,
              transition: 'opacity 0.15s',
            }}
          >
            {uploading ? '上传中…' : '更换'}
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        disabled={disabled || uploading}
      />

      {/* Error message */}
      {error && (
        <div
          style={{
            marginTop: 6,
            fontSize: 12,
            color: TOKENS.danger,
            maxWidth: 80,
            lineHeight: 1.4,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
