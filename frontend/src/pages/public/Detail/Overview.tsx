import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { skillApi } from '@/api/endpoints';
import { TOKENS } from '@/lib/tokens';
import { Card } from '@/components/ui';
import { I } from '@/components/icons';
import { MarkdownView } from '@/components/markdown/MarkdownView';
import type { Skill } from '@/mocks/skills';

function buildFallbackMd(skill: Skill): string {
  const lines: string[] = [];
  lines.push(`# ${skill.name}`);
  lines.push('');
  if (skill.short) {
    lines.push(`> ${skill.short}`);
    lines.push('');
  }
  if (skill.tags.length || skill.langs.length) {
    lines.push('## 基本信息');
    lines.push('');
    if (skill.langs.length) lines.push(`- 支持语言: ${skill.langs.join(' / ')}`);
    if (skill.tags.length) lines.push(`- 标签: ${skill.tags.join(' / ')}`);
    lines.push(`- 当前版本: \`${skill.version}\``);
    if (skill.updated) lines.push(`- 最后更新: ${skill.updated}`);
    if (skill.license) lines.push(`- 许可: ${skill.license}`);
    lines.push('');
  }
  lines.push('## 快速安装');
  lines.push('');
  lines.push('```bash');
  lines.push(`smskill install ${skill.slug}`);
  lines.push('```');
  lines.push('');
  lines.push('> 作者尚未上传扩展 README,以上信息由系统根据 Skill 元数据自动生成。');
  return lines.join('\n');
}

function inlineRender(s: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let rest = s;
  let k = 0;
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/;
  let m: RegExpMatchArray | null;
  while ((m = rest.match(re))) {
    if ((m.index ?? 0) > 0) parts.push(rest.slice(0, m.index));
    const t = m[0];
    if (t.startsWith('**')) {
      parts.push(<b key={'b' + k++}>{t.slice(2, -2)}</b>);
    } else {
      parts.push(
        <code
          key={'c' + k++}
          style={{
            fontFamily: 'var(--font-mono), ui-monospace, "SF Mono", Menlo, monospace',
            fontSize: '0.88em',
            background: TOKENS.bgGray,
            color: TOKENS.primaryDeep,
            padding: '1px 6px',
            borderRadius: 4,
          }}
        >
          {t.slice(1, -1)}
        </code>,
      );
    }
    rest = rest.slice((m.index ?? 0) + t.length);
  }
  if (rest) parts.push(rest);
  return parts;
}

function renderMD(src: string): ReactNode[] {
  const lines = src.split('\n');
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const ln = lines[i];
    if (ln.startsWith('```')) {
      const lang = ln.slice(3).trim();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        buf.push(lines[i]);
        i++;
      }
      i++;
      out.push(
        <div
          key={key++}
          style={{
            margin: '12px 0',
            background: '#0F172A',
            color: '#E2E8F0',
            fontFamily: 'var(--font-mono), ui-monospace, "SF Mono", Menlo, monospace',
            fontSize: 12.5,
            lineHeight: 1.7,
            padding: '12px 16px',
            borderRadius: 8,
            position: 'relative',
            whiteSpace: 'pre',
            overflowX: 'auto',
          }}
        >
          {lang && (
            <div
              style={{
                position: 'absolute',
                top: 8,
                right: 12,
                fontSize: 10,
                color: '#64748B',
                letterSpacing: 0.4,
                textTransform: 'uppercase',
              }}
            >
              {lang}
            </div>
          )}
          {buf.join('\n')}
        </div>,
      );
      continue;
    }
    if (ln.startsWith('# ')) {
      out.push(
        <h2
          key={key++}
          style={{
            fontSize: 20,
            fontWeight: 700,
            margin: '0 0 6px',
            color: TOKENS.text,
          }}
        >
          {inlineRender(ln.slice(2))}
        </h2>,
      );
      i++;
      continue;
    }
    if (ln.startsWith('## ')) {
      out.push(
        <h3
          key={key++}
          style={{
            fontSize: 15,
            fontWeight: 600,
            margin: '20px 0 8px',
            color: TOKENS.text,
          }}
        >
          {inlineRender(ln.slice(3))}
        </h3>,
      );
      i++;
      continue;
    }
    if (ln.startsWith('> ')) {
      out.push(
        <blockquote
          key={key++}
          style={{
            margin: '10px 0',
            padding: '8px 14px',
            borderLeft: `3px solid ${TOKENS.primary}`,
            background: TOKENS.primarySoft,
            color: TOKENS.text2,
            fontSize: 13.5,
            lineHeight: 1.6,
            borderRadius: '0 6px 6px 0',
          }}
        >
          {inlineRender(ln.slice(2))}
        </blockquote>,
      );
      i++;
      continue;
    }
    if (ln.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(lines[i].slice(2));
        i++;
      }
      out.push(
        <ul
          key={key++}
          style={{
            margin: '8px 0',
            paddingLeft: 22,
            color: TOKENS.text2,
            fontSize: 13.5,
            lineHeight: 1.85,
          }}
        >
          {items.map((it, idx) => (
            <li key={idx}>{inlineRender(it)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    if (ln.trim() === '') {
      i++;
      continue;
    }
    out.push(
      <p
        key={key++}
        style={{
          margin: '8px 0',
          fontSize: 13.5,
          lineHeight: 1.75,
          color: TOKENS.text2,
        }}
      >
        {inlineRender(ln)}
      </p>,
    );
    i++;
  }
  return out;
}

function MetaItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div
      style={{
        minWidth: 0,
        padding: '10px 12px',
        background: TOKENS.bgAlt,
        border: `1px solid ${TOKENS.borderSoft}`,
        borderRadius: 6,
      }}
    >
      <div style={{ fontSize: 11.5, color: TOKENS.text3, marginBottom: 4 }}>{label}</div>
      <div
        style={{
          fontSize: 13,
          color: TOKENS.text,
          fontWeight: 600,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function PillList({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) {
    return <span style={{ color: TOKENS.text3, fontWeight: 400 }}>{empty}</span>;
  }
  return (
    <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {items.map((item) => (
        <span
          key={item}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            maxWidth: '100%',
            padding: '2px 7px',
            borderRadius: 4,
            background: '#fff',
            border: `1px solid ${TOKENS.borderSoft}`,
            color: TOKENS.text2,
            fontSize: 12,
            fontWeight: 500,
            lineHeight: 1.4,
          }}
        >
          {item}
        </span>
      ))}
    </span>
  );
}

export function OverviewTab({ skill, version }: { skill: Skill; version: string }) {
  const [mdOpen, setMdOpen] = useState(false);
  const query = useQuery({
    queryKey: ['skill-md', skill.slug, version],
    queryFn: () => skillApi.skillMd(skill.slug, version),
    enabled: Boolean(skill.slug) && Boolean(version),
    staleTime: 60_000,
  });
  const fallbackMd = skill.readme && skill.readme.trim() ? skill.readme : buildFallbackMd(skill);
  const md = query.data?.content?.trim() ? query.data.content : fallbackMd;
  const bytes = query.data?.size ?? new Blob([md]).size;
  const sizeLabel = bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;
  const descriptionMd = skill.descriptionMd?.trim();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card pad={20}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: TOKENS.primarySoft,
              color: TOKENS.primary,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <I.layers size={17} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: TOKENS.text }}>概述</div>
            <p style={{ margin: '4px 0 0', fontSize: 13.5, lineHeight: 1.65, color: TOKENS.text2 }}>
              {skill.short}
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 10,
            marginBottom: 12,
          }}
        >
          <MetaItem label="当前版本" value={`v${version || skill.version}`} />
          <MetaItem label="分类" value={skill.cat} />
          <MetaItem label="许可证" value={skill.license || '未声明'} />
          <MetaItem label="最后更新" value={skill.updated || '未知'} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <MetaItem label="支持语言" value={<PillList items={skill.langs} empty="未声明" />} />
          <MetaItem label="标签" value={<PillList items={skill.tags} empty="暂无标签" />} />
        </div>

        {descriptionMd && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${TOKENS.borderSoft}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <I.list size={15} style={{ color: TOKENS.primary }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: TOKENS.text }}>介绍</div>
            </div>
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <MarkdownView markdown={descriptionMd} />
            </div>
          </div>
        )}
      </Card>

      <Card pad={24}>
        <button
          type="button"
          onClick={() => setMdOpen((v) => !v)}
          style={{
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: mdOpen ? 12 : 0,
            fontSize: 11.5,
            color: TOKENS.text3,
            fontFamily: 'var(--font-mono), ui-monospace, "SF Mono", Menlo, monospace',
            paddingBottom: mdOpen ? 12 : 0,
            borderBottom: mdOpen ? `1px solid ${TOKENS.borderSoft}` : 'none',
            width: '100%',
            background: 'transparent',
            border: 0,
            padding: 0,
            textAlign: 'left',
          }}
          aria-expanded={mdOpen}
        >
          <I.chevR
            size={12}
            style={{
              transition: 'transform 0.15s',
              transform: mdOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          />
          <I.code size={11} />
          SKILL.md
          <span
            style={{
              marginLeft: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
            }}
          >
            <span>{sizeLabel}</span>
            {query.isLoading && <span>· 正在读取文件</span>}
            {query.isError && <span>· 使用元数据摘要</span>}
            {query.data?.truncated && <span>· 已截断预览</span>}
            {query.data?.path && <span>· {query.data.path}</span>}
            <span style={{ color: TOKENS.primary }}>{mdOpen ? '收起' : '展开'}</span>
          </span>
        </button>
        {mdOpen && <div>{renderMD(md)}</div>}
      </Card>
    </div>
  );
}
