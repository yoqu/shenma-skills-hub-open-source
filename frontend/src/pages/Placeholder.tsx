import { useParams } from 'react-router-dom';
import { TOKENS } from '@/lib/tokens';
import { EMPTY_STATE_IMAGE_SRC } from '@/lib/visualAssets';

export interface PlaceholderProps {
  name: string;
  /** "public" / "auth" / "team-admin" / "team-member" / "create" */
  owner?: string;
  hint?: string;
}

/**
 * Phase 0b placeholder. Real screens are implemented by the page agents under
 * src/pages/{public,auth,team/admin,team/member,create}.
 */
export function Placeholder({ name, owner, hint }: PlaceholderProps) {
  const params = useParams();
  const paramStr = Object.keys(params).length ? JSON.stringify(params) : null;
  return (
    <div
      style={{
        minHeight: '100%',
        display: 'grid',
        placeItems: 'center',
        padding: 32,
        background: TOKENS.bgAlt,
      }}
    >
      <div
        style={{
          background: '#fff',
          border: `1px solid ${TOKENS.border}`,
          borderRadius: 14,
          padding: 32,
          maxWidth: 560,
          textAlign: 'center',
          boxShadow: '0 4px 16px rgba(15,17,22,.04)',
        }}
      >
        <div style={{ fontSize: 12, color: TOKENS.text3, letterSpacing: 0.4 }}>PLACEHOLDER</div>
        <img
          src={EMPTY_STATE_IMAGE_SRC.notFound}
          alt=""
          aria-hidden="true"
          width={112}
          height={112}
          style={{ width: 112, height: 112, objectFit: 'contain', display: 'block', margin: '6px auto 0' }}
        />
        <div style={{ fontSize: 22, fontWeight: 600, marginTop: 8 }}>{name}</div>
        {owner && (
          <div style={{ fontSize: 12, color: TOKENS.text3, marginTop: 6 }}>由 {owner} agent 负责实现</div>
        )}
        {paramStr && (
          <div
            style={{
              marginTop: 14,
              padding: '8px 12px',
              background: TOKENS.bgGray,
              borderRadius: 8,
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: TOKENS.text2,
            }}
          >
            params: {paramStr}
          </div>
        )}
        {hint && (
          <div style={{ fontSize: 12.5, color: TOKENS.text2, marginTop: 12, lineHeight: 1.6 }}>{hint}</div>
        )}
      </div>
    </div>
  );
}
