import type { ReactNode } from 'react';
import { TOKENS } from '../tokens';
import { I } from '../icons';
import { EMPTY_STATE_IMAGE_SRC, type EmptyStateImageKey } from '../visualAssets';

export interface EmptyStateProps {
  title: string;
  hint?: ReactNode;
  icon?: ReactNode;
  image?: EmptyStateImageKey;
  action?: ReactNode;
  /** 紧凑型，适合表格中部小空态 */
  compact?: boolean;
}

function imageFromTitle(title: string): EmptyStateImageKey {
  if (title.includes('失败') || title.includes('错误')) return 'error';
  if (title.includes('搜索') || title.includes('匹配')) return 'noResults';
  if (title.includes('Token')) return 'token';
  if (title.includes('通知')) return 'notifications';
  if (title.includes('动态')) return 'activity';
  if (title.includes('套件')) return 'suite';
  if (title.includes('审核') || title.includes('提交')) return 'review';
  if (title.includes('成员') || title.includes('邀请')) return 'invite';
  return 'empty';
}

export function EmptyState({ title, hint, icon, image, action, compact }: EmptyStateProps) {
  const imageSrc = !icon ? EMPTY_STATE_IMAGE_SRC[image ?? imageFromTitle(title)] : undefined;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: compact ? '24px 16px' : '48px 24px',
        color: TOKENS.text3,
        textAlign: 'center',
      }}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt=""
          aria-hidden="true"
          width={compact ? 52 : 86}
          height={compact ? 52 : 86}
          style={{
            display: 'block',
            width: compact ? 52 : 86,
            height: compact ? 52 : 86,
            objectFit: 'contain',
            marginBottom: compact ? 0 : 2,
          }}
        />
      ) : (
        <div
          style={{
            width: compact ? 32 : 44,
            height: compact ? 32 : 44,
            borderRadius: 999,
            background: TOKENS.bgAlt,
            display: 'grid',
            placeItems: 'center',
            color: TOKENS.text3,
            marginBottom: 4,
          }}
        >
          {icon ?? <I.inbox size={compact ? 16 : 20} />}
        </div>
      )}
      <div style={{ fontSize: compact ? 12.5 : 13.5, fontWeight: 600, color: TOKENS.text2 }}>
        {title}
      </div>
      {hint && (
        <div style={{ fontSize: 11.5, color: TOKENS.text3, maxWidth: 320, lineHeight: 1.55 }}>
          {hint}
        </div>
      )}
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  );
}
