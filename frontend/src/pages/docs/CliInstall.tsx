import { useState, type CSSProperties, type ReactNode } from 'react';
import { TOKENS } from '@/lib/tokens';
import {
  Button,
  Card,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
  SectionHeader,
  toast,
} from '@/components/ui';
import { TopBar } from '@/components/chrome';
import { getToken } from '@/api/client';
import { I } from '@/components/icons';

const monoFont = 'var(--font-mono), ui-monospace, "SF Mono", Menlo, monospace';

const inlineCode: CSSProperties = {
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

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const { copied, copy } = useCopy();
  return (
    <div
      style={{
        position: 'relative',
        background: '#0F172A',
        color: '#E2E8F0',
        fontFamily: monoFont,
        fontSize: 12.5,
        lineHeight: 1.75,
        padding: label ? '24px 56px 14px 16px' : '14px 56px 14px 16px',
        borderRadius: 8,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}
    >
      {label && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 14,
            fontSize: 10,
            color: '#64748B',
            letterSpacing: 0.4,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </div>
      )}
      <Button
        variant={copied ? 'success' : 'dark'}
        size="sm"
        icon={copied ? <I.check size={10} /> : <I.copy size={10} />}
        onClick={() => copy(code)}
        style={{
          position: 'absolute',
          top: 8,
          right: 10,
          height: 24,
          padding: '0 8px',
          fontSize: 11,
          borderRadius: 4,
        }}
      >
        {copied ? '已复制' : '复制'}
      </Button>
      <div>{code}</div>
    </div>
  );
}

function Section({
  id,
  title,
  desc,
  children,
}: {
  id?: string;
  title: string;
  desc?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} style={{ marginBottom: 36 }}>
      <h2
        style={{
          fontSize: 19,
          fontWeight: 700,
          color: TOKENS.text,
          margin: '0 0 6px',
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h2>
      {desc && (
        <div style={{ fontSize: 13, color: TOKENS.text3, marginBottom: 16, lineHeight: 1.7 }}>
          {desc}
        </div>
      )}
      {children}
    </section>
  );
}

function StepHeading({ num, children }: { num: number; children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        margin: '20px 0 10px',
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: TOKENS.bgAlt,
          border: `1px solid ${TOKENS.borderSoft}`,
          color: TOKENS.text2,
          fontSize: 11,
          fontWeight: 600,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        {num}
      </span>
      <span style={{ fontSize: 14, fontWeight: 600, color: TOKENS.text }}>{children}</span>
    </div>
  );
}

export default function CliInstall() {
  const origin = window.location.origin;

  const apiBaseDefault = origin;

  return (
    <div style={{ background: TOKENS.bg, minHeight: '100%' }}>
      <TopBar active="docs" authed={!!getToken()} />

      <div
        style={{
          maxWidth: 920,
          margin: '0 auto',
          padding: '40px 32px 80px',
        }}
      >
        <div style={{ marginBottom: 8, fontSize: 12, color: TOKENS.text3 }}>
          文档 / smskill CLI
        </div>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: TOKENS.text,
            margin: '0 0 12px',
            letterSpacing: '-0.02em',
          }}
        >
          安装 SkillStack CLI
        </h1>
        <div style={{ fontSize: 14, color: TOKENS.text2, lineHeight: 1.7, marginBottom: 28 }}>
          <code style={inlineCode}>smskill</code> 是 SkillStack 的终端客户端，用于搜索、安装、卸载 skill 与 suite。安装后既能在终端里直接用，也能在 Claude Code / Codex 等 agent 里被{' '}
          <code style={inlineCode}>skillstack-installer</code> chat skill 一句话调用。
        </div>

        <Card pad={28} style={{ marginBottom: 28 }}>
          <SectionHeader
            title="环境要求"
            hint="安装前请先确认本机环境"
          />
          <ul
            style={{
              margin: '8px 0 0',
              paddingLeft: 20,
              fontSize: 13.5,
              color: TOKENS.text2,
              lineHeight: 1.9,
            }}
          >
            <li>Node.js ≥ 20，自带 npm</li>
            <li>macOS / Linux / Windows (WSL) 均可</li>
            <li>
              SkillStack 站点地址（当前页面：<code style={inlineCode}>{origin}</code>）—— 后续配置{' '}
              <code style={inlineCode}>apiBaseUrl</code> 时使用
            </li>
          </ul>
        </Card>

        <Card pad={28} style={{ marginBottom: 28 }}>
          <Section
            id="install"
            title="一、安装 smskill CLI"
            desc={
              <>
                推荐直接从 npm 中央仓库安装 <code style={inlineCode}>smskill</code>，
                无需准备仓库代码或执行本地构建脚本。
              </>
            }
          >
            <StepHeading num={1}>全局安装</StepHeading>
            <div style={{ fontSize: 13, color: TOKENS.text2, lineHeight: 1.7, marginBottom: 10 }}>
              方式 A：安装为全局命令，适合日常使用
            </div>
            <CodeBlock
              label="bash"
              code={`npm install -g smskill\nsmskill --version`}
            />

            <div
              style={{
                fontSize: 13,
                color: TOKENS.text2,
                lineHeight: 1.7,
                marginTop: 14,
                marginBottom: 10,
              }}
            >
              方式 B：不全局安装，临时运行
            </div>
            <CodeBlock label="bash" code={`npx smskill@latest --version`} />

            <div
              style={{
                fontSize: 12.5,
                color: TOKENS.text3,
                lineHeight: 1.7,
                marginTop: 12,
                padding: '10px 14px',
                background: TOKENS.bgAlt,
                borderRadius: 8,
                border: `1px solid ${TOKENS.borderSoft}`,
              }}
            >
              <strong style={{ color: TOKENS.text2 }}>发布源：</strong>{' '}
              npm 官方 registry 包名为 <code style={inlineCode}>smskill</code>，
              当前 <code style={inlineCode}>latest</code> 版本会随中央仓库自动解析。
            </div>

            <StepHeading num={2}>验证安装</StepHeading>
            <CodeBlock label="bash" code={`smskill --version\nsmskill --help`} />
          </Section>
        </Card>

        <Card pad={28} style={{ marginBottom: 28 }}>
          <Section
            id="configure"
            title="二、配置 smskill"
            desc={
              <>
                CLI 需要知道 SkillStack 站点地址、个人令牌和默认团队。本站点的 API 地址默认就是当前域名{' '}
                <code style={inlineCode}>{apiBaseDefault}</code>。
              </>
            }
          >
            <StepHeading num={1}>设置站点 API 地址</StepHeading>
            <CodeBlock label="bash" code={`smskill config set apiBaseUrl ${apiBaseDefault}`} />

            <StepHeading num={2}>设置个人令牌</StepHeading>
            <div style={{ fontSize: 13, color: TOKENS.text2, lineHeight: 1.7, marginBottom: 10 }}>
              登录站点 → 个人设置 → <code style={inlineCode}>CLI 令牌</code> 生成一个 token，复制后执行：
            </div>
            <CodeBlock label="bash" code={`smskill config set token lst_xxxxxxxx`} />

            <StepHeading num={3}>（可选）设置默认团队</StepHeading>
            <CodeBlock label="bash" code={`smskill config set defaultTeamId 1\nsmskill config check`} />

            <div
              style={{
                fontSize: 12.5,
                color: TOKENS.text3,
                lineHeight: 1.7,
                marginTop: 14,
                padding: '10px 14px',
                background: TOKENS.bgAlt,
                borderRadius: 8,
                border: `1px solid ${TOKENS.borderSoft}`,
              }}
            >
              <strong style={{ color: TOKENS.text2 }}>CI 场景：</strong> 也可以走环境变量{' '}
              <code style={inlineCode}>SMSKILL_API_BASE_URL</code>、
              <code style={inlineCode}>SMSKILL_TOKEN</code>、
              <code style={inlineCode}>SMSKILL_TEAM_ID</code>，免去本地配置文件。
            </div>
          </Section>
        </Card>

        <Card pad={28} style={{ marginBottom: 28 }}>
          <Section
            id="usage"
            title="三、安装一个 skill"
            desc="配置完成后，就可以直接装 skill 到本地 agent 目录。"
          >
            <CodeBlock
              label="bash"
              code={`# 装到默认 agent (claude) 的用户目录: ~/.claude/skills/<slug>/
smskill install <slug>

# 装到当前项目: ./.claude/skills/<slug>/
smskill install <slug> --scope project

# 装到 codex / openclaw
smskill install <slug> --agent codex
smskill install <slug> --agent openclaw --scope project`}
            />

            <DataTable
              containerStyle={{ marginTop: 16 }}
              style={{ fontSize: 12.5, color: TOKENS.text2 }}
            >
              <DataTableHead>
                <DataTableRow style={{ borderTop: 'none', background: TOKENS.bgAlt }}>
                  <DataTableHeader style={{ padding: '8px 12px', color: TOKENS.text }}>
                      agent
                  </DataTableHeader>
                  <DataTableHeader style={{ padding: '8px 12px', color: TOKENS.text }}>
                      scope=user
                  </DataTableHeader>
                  <DataTableHeader style={{ padding: '8px 12px', color: TOKENS.text }}>
                      scope=project
                  </DataTableHeader>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody style={{ fontFamily: monoFont, fontSize: 12 }}>
                {[
                  ['claude', '~/.claude/skills/<slug>/', '<cwd>/.claude/skills/<slug>/'],
                  ['codex', '~/.codex/skills/<slug>/', '<cwd>/.codex/skills/<slug>/'],
                  ['openclaw', '~/.openclaw/skills/<slug>/', '<cwd>/skills/<slug>/'],
                  ['generic', '~/.smskill/skills/<slug>/', '<cwd>/skills/<slug>/'],
                ].map(([a, u, p]) => (
                  <DataTableRow key={a}>
                    <DataTableCell style={{ padding: '8px 12px', color: TOKENS.text }}>
                        {a}
                    </DataTableCell>
                    <DataTableCell style={{ padding: '8px 12px' }}>
                        {u}
                    </DataTableCell>
                    <DataTableCell style={{ padding: '8px 12px' }}>
                        {p}
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </Section>
        </Card>

        <Card pad={28} style={{ marginBottom: 28 }}>
          <Section
            id="chat-install"
            title="四、在 Claude Code / Codex 里对话安装"
            desc={
              <>
                安装 CLI 后，Claude Code / Codex 可以直接调用{' '}
                <code style={inlineCode}>smskill install</code> 完成安装。若你的 agent 支持自定义 skill，
                可把本页命令作为标准安装流程交给它执行。
              </>
            }
          >
            <CodeBlock
              code={`你：帮我装一下 weather-helper 这个 skill,优先装到当前项目\nClaude：好的,正在调用 smskill install weather-helper --scope project ...`}
            />
          </Section>
        </Card>

        <Card pad={28}>
          <Section
            id="troubleshoot"
            title="五、常见问题"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FaqItem
                q="smskill: command not found"
                a={
                  <>
                    先重跑 <code style={inlineCode}>npm install -g smskill</code>。如果仍不可用，检查{' '}
                    <code style={inlineCode}>npm prefix -g</code> 对应的 <code style={inlineCode}>bin</code>{' '}
                    目录是否在 <code style={inlineCode}>$PATH</code> 里。
                  </>
                }
              />
              <FaqItem
                q="401 unauthorized / token 无效"
                a={
                  <>
                    重新到 <code style={inlineCode}>{origin}/profile/cli-token</code> 生成新的 token，
                    然后 <code style={inlineCode}>smskill config set token lst_...</code>。
                  </>
                }
              />
              <FaqItem
                q="apiBaseUrl 写错了想重置"
                a={
                  <>
                    <code style={inlineCode}>smskill config set apiBaseUrl {origin}</code>，或直接编辑{' '}
                    <code style={inlineCode}>~/.smskill/config.json</code>。
                  </>
                }
              />
              <FaqItem
                q="想看已安装的 skill"
                a={
                  <>
                    <code style={inlineCode}>smskill list</code>；卸载用{' '}
                    <code style={inlineCode}>smskill remove &lt;slug&gt;</code>。
                  </>
                }
              />
            </div>
          </Section>
        </Card>
      </div>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: ReactNode }) {
  return (
    <div
      style={{
        padding: '14px 16px',
        background: TOKENS.bgAlt,
        borderRadius: 8,
        border: `1px solid ${TOKENS.borderSoft}`,
      }}
    >
      <div style={{ fontSize: 13.5, fontWeight: 600, color: TOKENS.text, marginBottom: 6 }}>
        {q}
      </div>
      <div style={{ fontSize: 13, color: TOKENS.text2, lineHeight: 1.7 }}>{a}</div>
    </div>
  );
}
