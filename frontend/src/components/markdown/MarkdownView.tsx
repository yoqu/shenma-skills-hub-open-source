import { type ReactNode } from 'react';
import type { JSONContent } from '@tiptap/react';
import { promptMarkdownToDoc } from '@/pages/create/CreatePrompt/promptMarkdown';
import { TOKENS } from '@/lib/tokens';
import { Checkbox } from '@/components/ui';

/**
 * 只读渲染由 PromptEditor 产出的 Markdown（含图片）。
 * 复用 promptMarkdownToDoc 解析，保证编辑与展示一致。
 */
export function MarkdownView({ markdown }: { markdown: string }) {
  const doc = promptMarkdownToDoc(markdown);
  const blocks = doc.content ?? [];
  return <div style={{ minWidth: 0 }}>{blocks.map((node, i) => renderBlock(node, i))}</div>;
}

function renderBlock(node: JSONContent, key: number): ReactNode {
  switch (node.type) {
    case 'heading': {
      const level = Math.min(Math.max(Number(node.attrs?.level ?? 1), 1), 6);
      const sizes: Record<number, number> = { 1: 22, 2: 18, 3: 16, 4: 14.5, 5: 13.5, 6: 13 };
      const Tag = (`h${Math.min(level + 1, 6)}`) as keyof JSX.IntrinsicElements;
      return (
        <Tag
          key={key}
          style={{ fontSize: sizes[level], fontWeight: 700, margin: '18px 0 8px', color: TOKENS.text, lineHeight: 1.3 }}
        >
          {renderInline(node.content)}
        </Tag>
      );
    }
    case 'paragraph':
      if (!node.content || node.content.length === 0) return <div key={key} style={{ height: 8 }} />;
      return (
        <p key={key} style={{ margin: '8px 0', fontSize: 13.5, lineHeight: 1.75, color: TOKENS.text2 }}>
          {renderInline(node.content)}
        </p>
      );
    case 'bulletList':
      return (
        <ul key={key} style={{ margin: '8px 0', paddingLeft: 22, color: TOKENS.text2, fontSize: 13.5, lineHeight: 1.85 }}>
          {(node.content ?? []).map((li, i) => (
            <li key={i}>{renderInline(li.content?.[0]?.content)}</li>
          ))}
        </ul>
      );
    case 'orderedList':
      return (
        <ol
          key={key}
          start={Number(node.attrs?.start ?? 1)}
          style={{ margin: '8px 0', paddingLeft: 22, color: TOKENS.text2, fontSize: 13.5, lineHeight: 1.85 }}
        >
          {(node.content ?? []).map((li, i) => (
            <li key={i}>{renderInline(li.content?.[0]?.content)}</li>
          ))}
        </ol>
      );
    case 'taskList':
      return (
        <ul key={key} style={{ margin: '8px 0', paddingLeft: 4, listStyle: 'none', color: TOKENS.text2, fontSize: 13.5, lineHeight: 1.85 }}>
          {(node.content ?? []).map((item, i) => {
            const checked = Boolean(item.attrs?.checked);
            return (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <Checkbox checked={checked} readOnly style={{ marginTop: 5 }} />
                <span style={{ textDecoration: checked ? 'line-through' : 'none', color: checked ? TOKENS.text3 : TOKENS.text2 }}>
                  {renderInline(item.content?.[0]?.content)}
                </span>
              </li>
            );
          })}
        </ul>
      );
    case 'blockquote':
      return (
        <blockquote
          key={key}
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
          {(node.content ?? []).map((p, i) => (
            <div key={i}>{renderInline(p.content)}</div>
          ))}
        </blockquote>
      );
    case 'codeBlock': {
      const lang = node.attrs?.language ? String(node.attrs.language) : '';
      const code = (node.content ?? []).map((t) => t.text ?? '').join('');
      return (
        <pre
          key={key}
          style={{
            margin: '12px 0',
            padding: '12px 16px',
            background: '#0F172A',
            color: '#E2E8F0',
            borderRadius: 8,
            fontFamily: 'var(--font-mono), ui-monospace, "SF Mono", Menlo, monospace',
            fontSize: 12.5,
            lineHeight: 1.7,
            overflowX: 'auto',
            position: 'relative',
          }}
        >
          {lang && (
            <span style={{ position: 'absolute', top: 8, right: 12, fontSize: 10, color: '#64748B', textTransform: 'uppercase' }}>
              {lang}
            </span>
          )}
          <code>{code}</code>
        </pre>
      );
    }
    case 'image':
      return (
        <div key={key} style={{ maxWidth: '100%', overflow: 'hidden', margin: '8px 0' }}>
          <img
            src={String(node.attrs?.src ?? '')}
            alt={node.attrs?.alt ? String(node.attrs.alt) : ''}
            style={{
              display: 'block',
              width: '100%',
              maxWidth: 520,
              maxHeight: 360,
              height: 'auto',
              objectFit: 'contain',
              borderRadius: 8,
              border: `1px solid ${TOKENS.borderSoft}`,
            }}
          />
        </div>
      );
    case 'horizontalRule':
      return <hr key={key} style={{ border: 0, borderTop: `1px solid ${TOKENS.borderSoft}`, margin: '16px 0' }} />;
    default:
      return node.content ? <div key={key}>{renderInline(node.content)}</div> : null;
  }
}

function renderInline(nodes: JSONContent[] | undefined): ReactNode[] {
  return (nodes ?? []).map((node, i) => {
    if (node.type === 'hardBreak') return <br key={i} />;
    if (node.type === 'promptMention') {
      const label = (node.attrs?.label as string) || (node.attrs?.promptSlug as string) || '';
      return <span key={i}>@{label}</span>;
    }
    let el: ReactNode = node.text ?? '';
    for (const mark of node.marks ?? []) {
      if (mark.type === 'code') {
        el = (
          <code
            key={i}
            style={{
              fontFamily: 'var(--font-mono), ui-monospace, "SF Mono", Menlo, monospace',
              fontSize: '0.88em',
              background: TOKENS.bgGray,
              color: TOKENS.primaryDeep,
              padding: '1px 6px',
              borderRadius: 4,
            }}
          >
            {el}
          </code>
        );
      } else if (mark.type === 'bold') {
        el = <b key={i}>{el}</b>;
      } else if (mark.type === 'italic') {
        el = <i key={i}>{el}</i>;
      } else if (mark.type === 'strike') {
        el = <s key={i}>{el}</s>;
      } else if (mark.type === 'link') {
        el = (
          <a key={i} href={String(mark.attrs?.href ?? '')} target="_blank" rel="noreferrer" style={{ color: TOKENS.primary }}>
            {el}
          </a>
        );
      }
    }
    return <span key={i}>{el}</span>;
  });
}
