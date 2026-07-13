import { TOKENS } from '@/lib/tokens';

export function RegisterIllustration({ step }: { step: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        padding: 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          width: '78%',
          aspectRatio: '1.2',
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(79,70,229,.18), rgba(14,165,233,.08) 45%, transparent 72%)`,
          filter: 'blur(4px)',
          transform: 'translate(4%, -3%)',
        }}
      />

      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: '8% 9%',
          borderRadius: 32,
          border: `1px solid ${TOKENS.borderSoft}`,
          background: 'rgba(255,255,255,.36)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.75)',
        }}
      />

      <img
        src="/auth/register-illustration.png"
        alt={step === 4 ? '团队成员完成注册并进入 神马 skill hub' : '团队成员协作邀请新成员加入 神马 skill hub'}
        style={{
          position: 'relative',
          zIndex: 1,
          width: 'min(760px, 94%)',
          height: 'auto',
          objectFit: 'contain',
          filter: 'drop-shadow(0 30px 36px rgba(79,70,229,.18))',
        }}
      />
    </div>
  );
}
