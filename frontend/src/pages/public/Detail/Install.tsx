import { useState, type CSSProperties, type ReactNode } from 'react';
import { Folder } from 'lucide-react';
import { TOKENS } from '@/lib/tokens';
import { Button, Card, SectionHeader, toast } from '@/components/ui';
import { I } from '@/components/icons';
import { skillApi } from '@/api/endpoints';
import type { Skill } from '@/mocks/skills';
import type { InstallTab } from './types';

const monoFont = 'var(--font-mono), ui-monospace, "SF Mono", Menlo, monospace';

const miCode: CSSProperties = {
  fontFamily: monoFont,
  fontSize: '0.9em',
  background: 'rgba(79,70,229,.10)',
  color: TOKENS.primaryDeep,
  padding: '1px 6px',
  borderRadius: 4,
};

function useCopy() {
  const [copied, setCopied] = useState(false);
  async function copy(text: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      toast({ kind: 'success', message: '已复制' });
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ kind: 'error', message: '复制失败，请手动选中' });
    }
  }
  return { copied, copy };
}

function CopyButton({ text, label = '复制' }: { text: string; label?: string }) {
  const { copied, copy } = useCopy();
  return (
    <Button variant="ghost"
      type="button"
      onClick={() => copy(text)}
      title={label}
      style={{
        position: 'absolute',
        top: 10,
        right: 10,
        width: 26,
        height: 26,
        background: 'transparent',
        border: 'none',
        color: copied ? TOKENS.success : TOKENS.text3,
        display: 'grid',
        placeItems: 'center',
        cursor: 'pointer',
        borderRadius: 5,
        fontFamily: 'inherit',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(15,23,42,.06)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      {copied ? <I.check size={13} /> : <I.copy size={13} />}
    </Button>
  );
}

function PillTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: InstallTab[];
  active: string;
  onChange: (id: InstallTab['id']) => void;
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        gap: 4,
        padding: 4,
        background: TOKENS.bgAlt,
        borderRadius: 10,
        border: `1px solid ${TOKENS.borderSoft}`,
      }}
    >
      {tabs.map((t) => {
        const Ico = t.icon;
        const on = active === t.id;
        return (
          <Button variant="ghost"
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              fontSize: 13,
              fontWeight: on ? 600 : 500,
              color: on ? TOKENS.text : TOKENS.text2,
              background: on ? '#fff' : 'transparent',
              border: 'none',
              borderRadius: 7,
              cursor: 'pointer',
              boxShadow: on ? '0 1px 2px rgba(15,23,42,.08)' : 'none',
              transition: 'all .15s',
              fontFamily: 'inherit',
            }}
          >
            <Ico size={13} />
            <span>{t.label}</span>
          </Button>
        );
      })}
    </div>
  );
}

function PromptBox({ text }: { text: ReactNode }) {
  const plain = typeof text === 'string' ? text : extractText(text);
  return (
    <div
      style={{
        position: 'relative',
        background: TOKENS.bgAlt,
        border: `1px solid ${TOKENS.borderSoft}`,
        borderRadius: 10,
        padding: '14px 44px 14px 16px',
        fontSize: 13,
        lineHeight: 1.75,
        color: TOKENS.text,
      }}
    >
      {text}
      <CopyButton text={plain} />
    </div>
  );
}

function extractText(node: ReactNode): string {
  if (node == null || node === false || node === true) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (typeof node === 'object' && 'props' in (node as { props?: unknown })) {
    const props = (node as { props: { children?: ReactNode } }).props;
    return extractText(props.children);
  }
  return '';
}

function InstallChatMethod({ skill }: { skill: Skill }) {
  const origin = window.location.origin;
  const installDocsUrl = `${origin}/docs/cli-install`;

  const promptOne = (
    <>
      请先检查是否已安装 SkillStack CLI（<code style={miCode}>smskill</code>）。若未安装，请通过 npm 中央仓库安装：
      <code style={miCode}>npm install -g smskill</code>。安装说明参考{' '}
      <a
        href={installDocsUrl}
        target="_blank"
        rel="noreferrer"
        style={{ color: TOKENS.primary, textDecoration: 'underline' }}
      >
        {installDocsUrl}
      </a>{' '}
      。然后将 apiBaseUrl 设为 <code style={miCode}>{origin}</code>，并安装{' '}
      <code style={miCode}>{skill.slug}</code> skill。
    </>
  );

  const promptTwo = (
    <>
      请使用 npm 中央仓库安装 SkillStack CLI：
      <code style={miCode}>npm install -g smskill</code>。然后配置 SkillStack 地址为{' '}
      <code style={miCode}>{origin}</code>，并把{' '}
      <code style={miCode}>{skill.slug}</code> 安装到当前项目目录。完整说明参考{' '}
      <a
        href={installDocsUrl}
        target="_blank"
        rel="noreferrer"
        style={{ color: TOKENS.primary, textDecoration: 'underline' }}
      >
        {installDocsUrl}
      </a>
      。
    </>
  );

  return (
    <div>
      <div style={{ fontSize: 12.5, color: TOKENS.text3, marginBottom: 18, lineHeight: 1.6 }}>
        复制提示词，发送给任意 AI 助手即可安装 Skill，包括但不限于 Claude Code、Codex、Cursor、Kimi、Lighthouse 等。
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: TOKENS.text,
              marginBottom: 10,
            }}
          >
            方式一：安装 SkillStack CLI 和技能
          </div>
          <PromptBox text={promptOne} />
        </div>

        <div>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: TOKENS.text,
              marginBottom: 10,
            }}
          >
            方式二：安装到当前项目
          </div>
          <PromptBox text={promptTwo} />
        </div>
      </div>
    </div>
  );
}

function CodeBox({
  code,
  comment,
  innerTabs,
}: {
  code: string;
  comment?: string;
  innerTabs?: ReactNode;
}) {
  return (
    <div
      style={{
        position: 'relative',
        background: TOKENS.bgAlt,
        border: `1px solid ${TOKENS.borderSoft}`,
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      {innerTabs}
      <div style={{ position: 'relative', padding: '14px 44px 14px 16px' }}>
        {comment && (
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 12,
              color: TOKENS.text3,
              marginBottom: 6,
            }}
          >
            {comment}
          </div>
        )}
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 13,
            color: TOKENS.text,
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {code}
        </div>
        <CopyButton text={code} />
      </div>
    </div>
  );
}

function InstallCliMethod({ skill }: { skill: Skill }) {
  const origin = window.location.origin;
  const installCliCmd = 'npm install -g smskill\nsmskill --version';
  const configCmd = `smskill config set apiBaseUrl ${origin}\nsmskill config set token lst_xxxxxxxx\nsmskill config check`;
  const installCmd = `smskill install ${skill.slug}`;

  return (
    <div>
      <div style={{ fontSize: 13, color: TOKENS.text, marginBottom: 12, lineHeight: 1.7 }}>
        <span style={{ fontWeight: 600 }}>01、</span>
        通过 npm 中央仓库安装 SkillStack CLI
      </div>

      <CodeBox
        comment="// 复制命令到终端执行"
        code={installCliCmd}
      />

      <div
        style={{
          fontSize: 13,
          color: TOKENS.text,
          marginTop: 22,
          marginBottom: 12,
          lineHeight: 1.7,
        }}
      >
        <span style={{ fontWeight: 600 }}>02、</span>
        首次使用先配置平台地址和 token
      </div>

      <CodeBox code={configCmd} />

      <div
        style={{
          fontSize: 13,
          color: TOKENS.text,
          marginTop: 22,
          marginBottom: 12,
          lineHeight: 1.7,
        }}
      >
        <span style={{ fontWeight: 600 }}>03、</span>
        安装 skill
      </div>

      <CodeBox code={installCmd} />

      <div
        style={{
          marginTop: 14,
          fontSize: 11.5,
          color: TOKENS.text3,
          display: 'flex',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <span>需要 Node ≥ 20</span>
        <span>·</span>
        <span>支持 macOS / Linux / Windows</span>
        <span>·</span>
        <span>
          首次使用先 <code style={miCode}>smskill config set apiBaseUrl</code> /{' '}
          <code style={miCode}>token</code>
        </span>
      </div>
    </div>
  );
}

function DirTree({ slug }: { slug: string }) {
  const folderColor = '#F59E0B';
  const fileColor = TOKENS.text3;
  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${TOKENS.border}`,
        borderRadius: 10,
        padding: 16,
        fontFamily: monoFont,
        fontSize: 12.5,
        color: TOKENS.text,
        minWidth: 220,
      }}
    >
      <div
        style={{
          fontFamily: 'inherit',
          fontSize: 13,
          fontWeight: 600,
          color: TOKENS.text,
          marginBottom: 12,
          paddingBottom: 8,
          borderBottom: `1px solid ${TOKENS.borderSoft}`,
        }}
      >
        目录树
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Folder size={14} style={{ color: folderColor, flexShrink: 0 }} />
          <span>{slug}/</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 22 }}>
          <I.code size={13} style={{ color: fileColor, flexShrink: 0 }} />
          <span>_meta.json</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 22 }}>
          <I.code size={13} style={{ color: fileColor, flexShrink: 0 }} />
          <span>SKILL.md</span>
        </div>
      </div>
    </div>
  );
}

function StepRow({
  num,
  title,
  children,
}: {
  num: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', gap: 14 }}>
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: TOKENS.bgAlt,
          border: `1px solid ${TOKENS.borderSoft}`,
          color: TOKENS.text2,
          fontSize: 12,
          fontWeight: 600,
          display: 'grid',
          placeItems: 'center',
          flex: '0 0 auto',
        }}
      >
        {num}
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text, marginBottom: 8 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: TOKENS.text2, lineHeight: 1.7 }}>{children}</div>
      </div>
    </div>
  );
}

function InstallZipMethod({ version, skill }: { version: string; skill: Skill }) {
  const fileName = `${skill.slug}-${version}.zip`;
  const [downloading, setDownloading] = useState(false);
  const [hint, setHint] = useState('');

  async function startDownload() {
    if (downloading) return;
    setDownloading(true);
    setHint('正在下载…');
    try {
      const { blob, fileName: name } = await skillApi.download(skill.slug, version);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name || fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setHint('已开始下载，如未弹出请检查浏览器拦截设置。');
    } catch (e) {
      setHint(e instanceof Error ? e.message : '下载失败');
    } finally {
      setDownloading(false);
      window.setTimeout(() => setHint(''), 4000);
    }
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: 24,
        alignItems: 'start',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <StepRow num={1} title="下载">
          <div style={{ marginBottom: 12 }}>从 SkillStack 仓库获取最新的源码包。</div>
          <Button
            variant="primary"
            size="md"
            icon={<I.download size={13} />}
            onClick={startDownload}
            disabled={downloading}
          >
            {downloading ? '下载中…' : '下载 Zip 安装包'}
          </Button>
          {hint && (
            <div style={{ marginTop: 8, fontSize: 11.5, color: TOKENS.text3 }}>{hint}</div>
          )}
        </StepRow>

        <StepRow num={2} title="解压">
          将 <code style={miCode}>{skill.slug}/</code> 目录解压到您首选的开发文件夹。请保持内部目录结构，您可参考右侧目录树进行解压。
        </StepRow>

        <StepRow num={3} title="运行">
          把 <code style={miCode}>{skill.slug}/</code> 目录放到对应 agent 的 skill 目录下，例如{' '}
          <code style={miCode}>~/.claude/skills/{skill.slug}/</code>、{' '}
          <code style={miCode}>~/.codex/skills/{skill.slug}/</code>。
        </StepRow>
      </div>

      <DirTree slug={skill.slug} />
    </div>
  );
}

export function InstallTabPanel({
  installTabs,
  installTab,
  setInstallTab,
  version,
  skill,
}: {
  installTabs: InstallTab[];
  installTab: InstallTab['id'];
  setInstallTab: (id: InstallTab['id']) => void;
  version: string;
  skill: Skill;
}) {
  return (
    <Card pad={20}>
      <SectionHeader
        title="安装方式"
        hint={
          <>
            当前版本 <code style={{ color: TOKENS.primary }}>{version}</code> · 选择适合你的方式
          </>
        }
      />
      <div style={{ marginBottom: 22 }}>
        <PillTabs tabs={installTabs} active={installTab} onChange={setInstallTab} />
      </div>
      {installTab === 'chat' && <InstallChatMethod skill={skill} />}
      {installTab === 'cli' && <InstallCliMethod skill={skill} />}
      {installTab === 'zip' && <InstallZipMethod version={version} skill={skill} />}
    </Card>
  );
}
