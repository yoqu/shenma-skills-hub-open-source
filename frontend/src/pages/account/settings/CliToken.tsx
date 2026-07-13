import { useState } from 'react';
import { TOKENS } from '@/lib/tokens';
import { Button, Card, SectionHeader } from '@/components/ui';
import { getToken } from '@/api/client';
import { I } from '@/components/icons';

export default function CliToken() {
  const token = getToken() ?? '';
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // fallback: select the textarea so user can copy manually
      const el = document.getElementById('cli-token-textarea') as HTMLTextAreaElement | null;
      el?.select();
    }
  }

  const masked = token ? token.slice(0, 12) + '••••' + token.slice(-6) : '(未登录)';

  return (
    <div>
      <SectionHeader title="CLI Token" hint="把当前 web 会话的 JWT 复制到 smskill 终端" />

      <Card style={{ padding: 20 }}>
        <div style={{ fontSize: 13, color: TOKENS.text2, lineHeight: 1.7, marginBottom: 12 }}>
          <p style={{ margin: '0 0 8px' }}>
            在终端运行 <code style={{ background: TOKENS.bgGray, padding: '2px 6px', borderRadius: 4 }}>smskill login</code>，选择「粘贴 token」选项，
            然后把这里的 token 粘回去即可。
          </p>
          <p style={{ margin: 0, color: TOKENS.text3 }}>
            注意：token 等价于你的账号会话；不要把它贴到任何第三方网站或工单系统。
          </p>
        </div>

        <div
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 13,
            padding: '10px 12px',
            borderRadius: 8,
            background: TOKENS.bgGray,
            border: `1px solid ${TOKENS.border}`,
            color: TOKENS.text,
            wordBreak: 'break-all',
            userSelect: 'all',
            marginBottom: 12,
          }}
        >
          {revealed ? token || '(未登录)' : masked}
        </div>

        {revealed && (
          <textarea
            id="cli-token-textarea"
            readOnly
            value={token}
            style={{
              position: 'absolute',
              left: -9999,
              width: 1,
              height: 1,
              opacity: 0,
            }}
          />
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="button" variant="ghost" onClick={() => setRevealed((v) => !v)}>
            <I.lock size={14} />
            {revealed ? '隐藏' : '显示完整 token'}
          </Button>
          <Button type="button" variant="primary" onClick={copy} disabled={!token}>
            <I.copy size={14} />
            {copied ? '已复制' : '复制 token'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
