import { describe, expect, it } from 'vitest';
import {
  createPromptMentionNode,
  extractPromptRefs,
  promptDocToMarkdown,
  promptMarkdownToDoc,
} from './promptMarkdown';

describe('promptMarkdown', () => {
  it('round-trips headings, marks, lists, blockquotes, links, and code blocks', () => {
    const markdown = [
      '# 代码评审上下文',
      '',
      '请输出 **重点风险** 和 [参考链接](https://example.com)。',
      '',
      '- 检查权限',
      '- 检查回归',
      '',
      '> 保持结论优先。',
      '',
      '```ts',
      'const ok = true;',
      '```',
    ].join('\n');

    expect(promptDocToMarkdown(promptMarkdownToDoc(markdown))).toBe(markdown);
  });

  it('round-trips italic, strike, inline code, ordered list, and task list', () => {
    const markdown = [
      '混合样式：*斜体*、~~删除~~、`inline`。',
      '',
      '1. 阅读上下文',
      '2. 给出修复方案',
      '',
      '- [ ] 编写单元测试',
      '- [x] 同步设计文档',
    ].join('\n');

    expect(promptDocToMarkdown(promptMarkdownToDoc(markdown))).toBe(markdown);
  });

  it('serializes prompt mention nodes as skillstack markdown links', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: '先加载 ' },
            createPromptMentionNode({
              label: '基础角色',
              teamSlug: 'ludou-fe',
              promptSlug: 'base-role',
            }),
            { type: 'text', text: ' 再输出建议。' },
          ],
        },
      ],
    };

    expect(promptDocToMarkdown(doc)).toBe(
      '先加载 @[基础角色](skillstack://prompt/ludou-fe/base-role) 再输出建议。',
    );
  });

  it('parses prompt markdown links into mention nodes and extracts refs in order', () => {
    const markdown = [
      '先应用 @[基础角色](skillstack://prompt/ludou-fe/base-role)。',
      '',
      '再合并 @[输出格式](skillstack://prompt/ludou-fe/output-format)。',
    ].join('\n');

    const doc = promptMarkdownToDoc(markdown);

    expect(promptDocToMarkdown(doc)).toBe(markdown);
    expect(extractPromptRefs(markdown)).toEqual([
      { label: '基础角色', teamSlug: 'ludou-fe', slug: 'base-role' },
      { label: '输出格式', teamSlug: 'ludou-fe', slug: 'output-format' },
    ]);
  });
});
