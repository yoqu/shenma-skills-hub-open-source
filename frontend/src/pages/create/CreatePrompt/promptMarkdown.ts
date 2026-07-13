import type { JSONContent } from '@tiptap/react';

export interface PromptRef {
  label: string;
  teamSlug: string;
  slug: string;
}

export interface PromptMentionAttrs {
  label: string;
  teamSlug: string;
  promptSlug: string;
}

export const PROMPT_LINK_RE =
  /@\[([^\]]+)]\(skillstack:\/\/prompt\/([a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9-]*)\)/g;

export function createPromptMentionNode(attrs: PromptMentionAttrs): JSONContent {
  return {
    type: 'promptMention',
    attrs,
  };
}

export function extractPromptRefs(markdown: string): PromptRef[] {
  const refs: PromptRef[] = [];
  for (const match of markdown.matchAll(PROMPT_LINK_RE)) {
    refs.push({ label: match[1], teamSlug: match[2], slug: match[3] });
  }
  return refs;
}

export function promptMarkdownToDoc(markdown: string): JSONContent {
  const blocks = markdown.replace(/\r\n/g, '\n').split(/\n{2,}/);
  return {
    type: 'doc',
    content: blocks.map(parseBlock),
  };
}

export function promptDocToMarkdown(doc: JSONContent): string {
  const blocks = doc.content ?? [];
  return blocks.map(serializeBlock).join('\n\n').trimEnd();
}

const TASK_LINE_RE = /^-\s+\[( |x|X)]\s+/;
const BULLET_LINE_RE = /^-\s+/;
const ORDERED_LINE_RE = /^\d+\.\s+/;
const IMAGE_BLOCK_RE = /^!\[([^\]]*)]\(([^)\s]+)\)$/;

function parseBlock(rawBlock: string): JSONContent {
  const block = rawBlock.replace(/\n+$/, '');
  if (block.startsWith('```')) {
    const lines = block.split('\n');
    const language = lines[0].slice(3).trim() || null;
    const closing = lines.length > 1 && lines[lines.length - 1].startsWith('```') ? 1 : 0;
    const code = lines.slice(1, lines.length - closing).join('\n');
    return {
      type: 'codeBlock',
      attrs: { language },
      content: code ? [{ type: 'text', text: code }] : undefined,
    };
  }

  const image = IMAGE_BLOCK_RE.exec(block);
  if (image) {
    return { type: 'image', attrs: { src: image[2], alt: image[1] || null } };
  }

  const heading = /^(#{1,6})\s+(.+)$/.exec(block);
  if (heading) {
    return {
      type: 'heading',
      attrs: { level: heading[1].length },
      content: parseInline(heading[2]),
    };
  }

  const lines = block.split('\n');

  if (lines.every((line) => TASK_LINE_RE.test(line))) {
    return {
      type: 'taskList',
      content: lines.map((line) => {
        const match = TASK_LINE_RE.exec(line)!;
        const checked = match[1].toLowerCase() === 'x';
        return {
          type: 'taskItem',
          attrs: { checked },
          content: [
            {
              type: 'paragraph',
              content: parseInline(line.replace(TASK_LINE_RE, '')),
            },
          ],
        };
      }),
    };
  }

  if (lines.every((line) => BULLET_LINE_RE.test(line))) {
    return {
      type: 'bulletList',
      content: lines.map((line) => ({
        type: 'listItem',
        content: [
          {
            type: 'paragraph',
            content: parseInline(line.replace(BULLET_LINE_RE, '')),
          },
        ],
      })),
    };
  }

  if (lines.every((line) => ORDERED_LINE_RE.test(line))) {
    const firstStart = Number(/^(\d+)\./.exec(lines[0])?.[1] ?? 1);
    return {
      type: 'orderedList',
      attrs: firstStart !== 1 ? { start: firstStart } : undefined,
      content: lines.map((line) => ({
        type: 'listItem',
        content: [
          {
            type: 'paragraph',
            content: parseInline(line.replace(ORDERED_LINE_RE, '')),
          },
        ],
      })),
    };
  }

  if (lines.every((line) => /^>\s?/.test(line))) {
    return {
      type: 'blockquote',
      content: [
        {
          type: 'paragraph',
          content: parseInline(lines.map((line) => line.replace(/^>\s?/, '')).join('\n')),
        },
      ],
    };
  }

  if (/^---+$/.test(block.trim())) {
    return { type: 'horizontalRule' };
  }

  return {
    type: 'paragraph',
    content: parseInline(block),
  };
}

function parseInline(text: string): JSONContent[] {
  const nodes: JSONContent[] = [];
  let index = 0;
  const tokenRe =
    /@\[([^\]]+)]\(skillstack:\/\/prompt\/([a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9-]*)\)|\*\*([^*\n]+)\*\*|~~([^~\n]+)~~|`([^`\n]+)`|\*([^*\n]+)\*|\[([^\]]+)]\((https?:\/\/[^)\s]+)\)/g;
  for (const match of text.matchAll(tokenRe)) {
    const start = match.index ?? 0;
    if (start > index) nodes.push({ type: 'text', text: text.slice(index, start) });

    if (match[1]) {
      nodes.push(createPromptMentionNode({ label: match[1], teamSlug: match[2], promptSlug: match[3] }));
    } else if (match[4]) {
      nodes.push({ type: 'text', text: match[4], marks: [{ type: 'bold' }] });
    } else if (match[5]) {
      nodes.push({ type: 'text', text: match[5], marks: [{ type: 'strike' }] });
    } else if (match[6]) {
      nodes.push({ type: 'text', text: match[6], marks: [{ type: 'code' }] });
    } else if (match[7]) {
      nodes.push({ type: 'text', text: match[7], marks: [{ type: 'italic' }] });
    } else if (match[8]) {
      nodes.push({ type: 'text', text: match[8], marks: [{ type: 'link', attrs: { href: match[9] } }] });
    }
    index = start + match[0].length;
  }
  if (index < text.length) nodes.push({ type: 'text', text: text.slice(index) });
  // 不能返回空 text 节点（ProseMirror 报 "Empty text nodes are not allowed"）；空内容返回空数组。
  return nodes;
}

function serializeBlock(node: JSONContent): string {
  switch (node.type) {
    case 'heading':
      return `${'#'.repeat(Number(node.attrs?.level ?? 1))} ${serializeInline(node.content)}`;
    case 'paragraph':
      return serializeInline(node.content);
    case 'bulletList':
      return (node.content ?? []).map((item) => `- ${serializeInline(item.content?.[0]?.content)}`).join('\n');
    case 'orderedList': {
      const start = Number(node.attrs?.start ?? 1);
      return (node.content ?? [])
        .map((item, idx) => `${start + idx}. ${serializeInline(item.content?.[0]?.content)}`)
        .join('\n');
    }
    case 'taskList':
      return (node.content ?? [])
        .map((item) => {
          const checked = Boolean(item.attrs?.checked);
          return `- [${checked ? 'x' : ' '}] ${serializeInline(item.content?.[0]?.content)}`;
        })
        .join('\n');
    case 'blockquote':
      return serializeInline(node.content?.[0]?.content).split('\n').map((line) => `> ${line}`).join('\n');
    case 'codeBlock': {
      const language = node.attrs?.language ? String(node.attrs.language) : '';
      return `\`\`\`${language}\n${serializeInline(node.content, { plain: true })}\n\`\`\``;
    }
    case 'image': {
      const src = node.attrs?.src ? String(node.attrs.src) : '';
      const alt = node.attrs?.alt ? String(node.attrs.alt) : '';
      return `![${alt}](${src})`;
    }
    case 'horizontalRule':
      return '---';
    default:
      return serializeInline(node.content);
  }
}

function serializeInline(nodes: JSONContent[] | undefined, options: { plain?: boolean } = {}): string {
  return (nodes ?? [])
    .map((node) => {
      if (node.type === 'hardBreak') return '\n';
      if (node.type === 'promptMention') {
        const attrs = node.attrs as Partial<PromptMentionAttrs> | undefined;
        return `@[${attrs?.label ?? ''}](skillstack://prompt/${attrs?.teamSlug ?? ''}/${attrs?.promptSlug ?? ''})`;
      }
      let text = node.text ?? serializeInline(node.content, options);
      if (!options.plain) {
        for (const mark of node.marks ?? []) {
          if (mark.type === 'code') text = `\`${text}\``;
          if (mark.type === 'bold') text = `**${text}**`;
          if (mark.type === 'italic') text = `*${text}*`;
          if (mark.type === 'strike') text = `~~${text}~~`;
          if (mark.type === 'link') text = `[${text}](${mark.attrs?.href ?? ''})`;
        }
      }
      return text;
    })
    .join('');
}
