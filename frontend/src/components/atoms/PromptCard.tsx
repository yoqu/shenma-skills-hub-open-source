import { TOKENS } from '@/lib/tokens';
import type { PromptCard as PromptCardData } from '@/api/data';
import { I } from '@/components/icons';

export interface PromptCardProps {
  prompt: PromptCardData;
  dense?: boolean;
  onClick?: () => void;
}

export function PromptCard({ prompt, dense, onClick }: PromptCardProps) {
  const privatePrompt = prompt.visibility === 'TEAM_PRIVATE';
  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff',
        border: `1px solid ${TOKENS.border}`,
        borderRadius: 8,
        padding: dense ? 14 : 16,
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minHeight: dense ? 0 : 172,
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {prompt.iconUrl ? (
          <img
            src={prompt.iconUrl}
            alt=""
            aria-hidden="true"
            width={dense ? 38 : 44}
            height={dense ? 38 : 44}
            style={{
              width: dense ? 38 : 44,
              height: dense ? 38 : 44,
              borderRadius: 8,
              objectFit: 'cover',
              display: 'block',
              flex: '0 0 auto',
              border: `1px solid ${TOKENS.borderSoft}`,
            }}
          />
        ) : (
          <div
            style={{
              width: dense ? 38 : 44,
              height: dense ? 38 : 44,
              borderRadius: 8,
              background: TOKENS.bgGray,
              color: TOKENS.primary,
              display: 'grid',
              placeItems: 'center',
              flex: '0 0 auto',
            }}
          >
            <I.code size={dense ? 17 : 19} />
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: TOKENS.text,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {prompt.name}
            </div>
            {privatePrompt && (
              <I.lock size={12} style={{ color: TOKENS.text3, flex: '0 0 auto' }} />
            )}
          </div>
          <div style={{ fontSize: 12, color: TOKENS.text3, marginTop: 2 }}>
            {prompt.teamSlug ? `${prompt.teamSlug} / ` : ''}{prompt.slug} · v{prompt.version}
          </div>
        </div>
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: TOKENS.text2,
          lineHeight: 1.55,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          minHeight: dense ? 0 : 38,
        }}
      >
        {prompt.shortDesc || '暂无描述'}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(prompt.tags ?? []).slice(0, 3).map((t) => (
          <span
            key={t}
            style={{
              fontSize: 11,
              color: TOKENS.text2,
              padding: '2px 7px',
              background: TOKENS.bgGray,
              borderRadius: 4,
            }}
          >
            {t}
          </span>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          fontSize: 12,
          color: TOKENS.text3,
          paddingTop: 8,
          borderTop: `1px solid ${TOKENS.borderSoft}`,
          marginTop: 'auto',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <I.download size={12} /> {prompt.exports ?? 0}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <I.starFill size={12} style={{ color: '#F59E0B' }} /> {prompt.score || '—'}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11 }}>{(prompt.updated || '').slice(5)}</span>
      </div>
    </div>
  );
}
