import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserSkillItemRes } from '@/api/endpoints';
import PlazaPage, { PlazaSkillDetailDialog, subscribeAndInstallPlazaSkill } from '../../../src/pages/PlazaPage';

const testState = vi.hoisted(() => ({
  toast: vi.fn(),
  mutate: vi.fn(),
  mutationOptions: undefined as { onError?: (error: unknown) => void; onSuccess?: () => void } | undefined,
  localSkillsQueryOptions: undefined as { placeholderData?: (previousData: unknown) => unknown } | undefined,
}));

vi.mock('@skillstack/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@skillstack/ui')>();
  return {
    ...actual,
    toast: testState.toast,
  };
});

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
  useQuery: (options: { queryKey: string[]; placeholderData?: (previousData: unknown) => unknown }) => {
    const { queryKey } = options;
    if (queryKey[0] === 'desktop-plaza') {
      return {
        isLoading: false,
        data: {
          items: [
            {
              id: 1,
              slug: 'lark-task',
              name: 'lark-task',
              shortDesc: '飞书任务：管理任务、清单和任务智能体。',
              cat: 'dev',
              icon: 'L',
              version: '1.0.2',
              installs: 12480,
              score: 4.8,
              updated: '2026-05-28',
              tags: ['CLI', 'task'],
              author: { name: 'Root Admin' },
            },
            {
              id: 2,
              slug: 'installed-skill',
              name: 'installed-skill',
              shortDesc: '已添加的 Skill。',
              cat: 'data',
              icon: 'I',
              version: '1.0.0',
              installs: 10,
              score: 5,
              updated: '2026-05-20',
              tags: ['data'],
              author: { name: 'Root Admin' },
            },
            {
              id: 3,
              slug: 'subscribed-not-installed',
              name: 'subscribed-not-installed',
              shortDesc: '已添加但本地安装失败的 Skill。',
              cat: 'doc',
              icon: 'S',
              version: '1.0.0',
              installs: 12,
              score: 4.2,
              updated: '2026-05-21',
              tags: ['docs'],
              author: { name: 'Root Admin' },
            },
          ],
        },
      };
    }

    if (queryKey[0] === 'desktop-user-skills') {
      return {
        data: [
          {
            id: 20,
            source: 'PUBLIC',
            skillId: 2,
          },
          {
            id: 21,
            source: 'PUBLIC',
            skillId: 3,
          },
        ],
      };
    }

    if (queryKey[0] === 'desktop-local-skills') {
      testState.localSkillsQueryOptions = options;
      return {
        data: [
          {
            userSkillId: 20,
            source: 'PUBLIC',
            skillId: 2,
            slug: 'installed-skill',
            name: 'installed-skill',
            version: '1.0.0',
            installPath: '/tmp/installed-skill',
            updatedAt: '2026-06-01T00:00:00.000Z',
          },
        ],
      };
    }

    if (queryKey[0] === 'desktop-skill-detail') {
      return {
        isLoading: false,
        data: {
          id: 1,
          slug: 'lark-task',
          name: 'lark-task',
          shortDesc: '飞书任务：管理任务、清单和任务智能体。',
          descriptionMd: '## 详情介绍\n\n用于管理飞书任务。',
          cat: 'dev',
          catName: '开发工具',
          icon: 'L',
          version: '1.0.2',
          installs: 12480,
          score: 4.8,
          updated: '2026-05-28',
          tags: ['CLI', 'task'],
          langs: ['TypeScript'],
          filesCount: 6,
          safety: 'pass',
          author: { name: 'Root Admin' },
        },
      };
    }

    if (queryKey[0] === 'desktop-skill-md') {
      return {
        isLoading: false,
        data: {
          path: 'SKILL.md',
          content: '# lark-task\n\n完整技能内容。',
          size: 28,
          truncated: false,
        },
      };
    }

    return {
      data: [],
    };
  },
  useMutation: (options: { onError?: (error: unknown) => void; onSuccess?: () => void }) => {
    testState.mutationOptions = options;
    return {
      isPending: false,
      mutate: testState.mutate,
    };
  },
}));

describe('PlazaPage', () => {
  beforeEach(() => {
    testState.toast.mockReset();
    testState.mutate.mockReset();
    testState.mutationOptions = undefined;
    testState.localSkillsQueryOptions = undefined;
  });

  it('subscribes then installs the plaza skill locally', async () => {
    const cloud = {
      id: 20,
      source: 'PUBLIC',
      skillId: 1,
      reviewId: 0,
      slug: 'lark-task',
      name: 'lark-task',
      shortDesc: '',
      catCode: 'dev',
      icon: 'L',
      version: '1.0.2',
      zipUrl: '',
      filesCount: 1,
      safety: 'pass',
      evalScore: 0,
      langs: '[]',
      publicVersion: '1.0.2',
    } satisfies UserSkillItemRes;
    const subscribe = vi.fn().mockResolvedValue(cloud);
    const install = vi.fn().mockResolvedValue(undefined);
    const remove = vi.fn().mockResolvedValue(undefined);
    const uninstall = vi.fn().mockResolvedValue(undefined);
    const invalidate = vi.fn().mockResolvedValue(undefined);

    await subscribeAndInstallPlazaSkill(1, { subscribe, install, remove, uninstall, invalidate });

    expect(subscribe).toHaveBeenCalledWith(1);
    expect(install).toHaveBeenCalledWith(cloud);
    expect(remove).not.toHaveBeenCalled();
    expect(uninstall).not.toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(invalidate).toHaveBeenCalledWith(['desktop-user-skills']);
    expect(invalidate).toHaveBeenCalledWith(['desktop-local-skills']);
  });

  it('rolls back subscribed cloud data when plaza local install fails', async () => {
    const cloud = {
      id: 20,
      source: 'PUBLIC',
      skillId: 1,
      reviewId: 0,
      slug: 'lark-task',
      name: 'lark-task',
      shortDesc: '',
      catCode: 'dev',
      icon: 'L',
      version: '1.0.2',
      zipUrl: '',
      filesCount: 1,
      safety: 'pass',
      evalScore: 0,
      langs: '[]',
      publicVersion: '1.0.2',
    } satisfies UserSkillItemRes;
    const subscribe = vi.fn().mockResolvedValue(cloud);
    const install = vi.fn().mockRejectedValue(new Error('Failed to download skill package.'));
    const remove = vi.fn().mockResolvedValue(undefined);
    const uninstall = vi.fn().mockResolvedValue(undefined);
    const invalidate = vi.fn().mockResolvedValue(undefined);

    await expect(subscribeAndInstallPlazaSkill(1, { subscribe, install, remove, uninstall, invalidate }))
      .rejects.toThrow('Failed to download skill package.');

    expect(uninstall).toHaveBeenCalledWith('lark-task', 20);
    expect(remove).toHaveBeenCalledWith(20);
    expect(invalidate).toHaveBeenCalledWith(['desktop-user-skills']);
    expect(invalidate).toHaveBeenCalledWith(['desktop-local-skills']);
  });

  it('shows specific install failures in the top-right toast', () => {
    renderToStaticMarkup(<PlazaPage />);

    testState.mutationOptions?.onError?.(new Error('Failed to install skill package.'));

    expect(testState.toast).toHaveBeenCalledWith({
      kind: 'error',
      message: 'Failed to install skill package.',
    });
  });

  it('shows install success in the top-right toast', () => {
    renderToStaticMarkup(<PlazaPage />);

    testState.mutationOptions?.onSuccess?.();

    expect(testState.toast).toHaveBeenCalledWith({
      kind: 'success',
      message: '已添加并安装 Skill',
    });
  });

  it('keeps previous local install data while cloud skill membership refreshes', () => {
    renderToStaticMarkup(<PlazaPage />);

    const previousLocalSkills = [
      {
        userSkillId: 20,
        source: 'PUBLIC',
        skillId: 2,
        slug: 'installed-skill',
      },
    ];

    expect(testState.localSkillsQueryOptions?.placeholderData?.(previousLocalSkills)).toBe(previousLocalSkills);
  });

  it('renders always-visible plus and check actions with border hover only', () => {
    const html = renderToStaticMarkup(<PlazaPage />);
    const css = readFileSync(new URL('../../../src/styles.css', import.meta.url), 'utf8');
    const installButtonCss = css.match(/\.desktop-plaza-install-button \{[\s\S]*?\n\}/)?.[0] || '';
    const installTooltipCss = css.match(/\.desktop-hover-tooltip\[data-tooltip\]:hover::before,[\s\S]*?\n\}/)?.[0] || '';
    const plazaCardCss = css.match(/\.desktop-plaza-card \{[\s\S]*?\n\}/)?.[0] || '';
    const plazaCardChildCss = css.match(/\.desktop-plaza-card > div \{[\s\S]*?\n\}/)?.[0] || '';

    expect(html).toContain('class="desktop-plaza-install-button desktop-hover-tooltip"');
    expect(html).toContain('role="button"');
    expect(html).toContain('aria-label="查看 lark-task 详情"');
    expect(html).toContain('class="desktop-skill-search-input"');
    expect(html).toContain('aria-label="添加 lark-task 到我的 Skills"');
    expect(html).toContain('data-tooltip="安装"');
    expect(html).not.toContain('title="安装"');
    expect(html).toContain('aria-label="installed-skill 已添加"');
    expect(html).toContain('aria-label="subscribed-not-installed 已添加"');
    expect(html).toContain('>+</button>');
    expect(html).toContain('>✓</button>');
    expect(html).not.toContain('&gt;添加&lt;');
    expect(css).toContain('opacity: 1;');
    expect(css).toContain('top: 14px;');
    expect(css).toContain('right: 14px;');
    expect(installButtonCss).toContain('display: inline-flex;');
    expect(installButtonCss).toContain('align-items: center;');
    expect(installButtonCss).toContain('justify-content: center;');
    expect(installButtonCss).toContain('border-radius: 10px;');
    expect(css).toContain('background: transparent;');
    expect(css).toContain('color: #9a9a9a;');
    expect(css).toContain('content: attr(data-tooltip);');
    expect(installTooltipCss).toContain('bottom: calc(100% + 6px);');
    expect(installTooltipCss).toContain('transform: translateX(-50%);');
    expect(installTooltipCss).toContain('font-size: 12px;');
    expect(installTooltipCss).toContain('box-shadow: 0 6px 14px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(226, 232, 240, 0.94);');
    expect(css).toContain('background: #f7f7f8;');
    expect(css).toContain('border-color: #e2e5ea;');
    expect(plazaCardCss).toContain('display: flex;');
    expect(plazaCardCss).toContain('height: 100%;');
    expect(plazaCardChildCss).toContain('flex: 1;');
    expect(plazaCardChildCss).toContain('height: 100%;');
    expect(installButtonCss).not.toContain('border-radius: 999px;');
    expect(css).not.toContain('top: 50%;');
    expect(css).toContain('.desktop-plaza-card:hover > div {');
    expect(css).toContain('border-color: #c7d2fe !important;');
    expect(css).toContain('.desktop-skill-search-input {');
    expect(css).toContain('border-color: #E2E8F0 !important;');
    expect(css).toContain('.desktop-skill-search-input:focus {');
    expect(css).not.toContain('box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08)');
    expect(css).not.toContain('.desktop-plaza-card:hover .desktop-plaza-install-button');
  });

  it('renders plaza skill detail dialog with skill md content', () => {
    const css = readFileSync(new URL('../../../src/styles.css', import.meta.url), 'utf8');
    const dialogCss = css.match(/\.desktop-skill-dialog \{[\s\S]*?\n\}/)?.[0] || '';
    const dialogTitleCss = css.match(/\.desktop-skill-dialog-title-row h2 \{[\s\S]*?\n\}/)?.[0] || '';
    const dialogTitleSuffixCss = css.match(/\.desktop-skill-dialog-title-row span \{[\s\S]*?\n\}/)?.[0] || '';
    const dialogDescCss = css.match(/\.desktop-skill-dialog-title-block p \{[\s\S]*?\n\}/)?.[0] || '';
    const dialogMetaCss = css.match(/\.desktop-skill-dialog-meta span \{[\s\S]*?\n\}/)?.[0] || '';
    const dialogTagCss = css.match(/\.desktop-skill-dialog-tags span \{[\s\S]*?\n\}/)?.[0] || '';
    const dialogStatValueCss = css.match(/\.desktop-skill-dialog-stats strong \{[\s\S]*?\n\}/)?.[0] || '';
    const contentPreCss = css.match(/\.desktop-skill-dialog-content pre \{[\s\S]*?\n\}/)?.[0] || '';
    const html = renderToStaticMarkup(
      <PlazaSkillDetailDialog
        skill={{
          id: 1,
          slug: 'lark-task',
          name: 'lark-task',
          shortDesc: '飞书任务：管理任务、清单和任务智能体。',
          cat: 'dev',
          icon: 'L',
          version: '1.0.2',
          installs: 12480,
          score: 4.8,
          updated: '2026-05-28',
          tags: ['CLI', 'task'],
          author: { name: 'Root Admin' },
        }}
        installed={false}
        adding={false}
        onAdd={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('id="desktop-skill-dialog-title"');
    expect(html).toContain('lark-task');
    expect(html).toContain('Skill');
    expect(html).toContain('开发工具');
    expect(html).toContain('完整技能内容。');
    expect(html).toContain('添加并安装');
    expect(html).toContain('aria-label="关闭技能详情"');
    expect(dialogCss).toContain('width: min(656px, calc(100vw - 48px));');
    expect(dialogCss).toContain('max-height: min(576px, calc(100vh - 48px));');
    expect(dialogCss).toContain('gap: 11px;');
    expect(dialogCss).toContain('padding: 22px 24px 19px;');
    expect(dialogTitleCss).toContain('font-size: 14px;');
    expect(dialogTitleSuffixCss).toContain('font-size: 14px;');
    expect(dialogDescCss).toContain('font-size: 12.5px;');
    expect(dialogDescCss).toContain('line-height: 1.55;');
    expect(dialogMetaCss).toContain('font-size: 12px;');
    expect(dialogTagCss).toContain('font-size: 11px;');
    expect(dialogStatValueCss).toContain('font-size: 12px;');
    expect(contentPreCss).toContain('min-height: 168px;');
    expect(contentPreCss).toContain('font-size: 12.5px;');
    expect(contentPreCss).toContain('line-height: 1.55;');
  });

  it('renders subscribed but locally disabled plaza skill as added in detail', () => {
    const html = renderToStaticMarkup(
      <PlazaSkillDetailDialog
        skill={{
          id: 3,
          slug: 'subscribed-not-installed',
          name: 'subscribed-not-installed',
          shortDesc: '已添加但本地安装失败的 Skill。',
          cat: 'doc',
          icon: 'S',
          version: '1.0.0',
          installs: 12,
          score: 4.2,
          updated: '2026-05-21',
          tags: ['docs'],
          author: { name: 'Root Admin' },
        }}
        added
        installed={false}
        adding={false}
        onAdd={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain('已添加');
    expect(html).not.toContain('添加并安装');
  });

  it('matches the web SkillCard visual structure', () => {
    const html = renderToStaticMarkup(<PlazaPage />);

    expect(html).toContain('border-radius:12px');
    expect(html).toContain('font-weight:600');
    expect(html).toContain('color:#0F172A');
    expect(html).toContain('src="/categories/dev.png"');
    expect(html).toContain('transform:scale(1.18)');
    expect(html).toContain('background:#F1F5F9');
    expect(html).toContain('CLI');
    expect(html).toContain('display:inline-flex;align-items:center;gap:4px');
    expect(html).toContain('1.2w');
    expect(html).toContain('4.8');
    expect(html).toContain('05-28');
  });
});
