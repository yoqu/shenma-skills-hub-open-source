import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DesktopLayout from '../../../src/pages/DesktopLayout';

const testState = vi.hoisted(() => ({
  me: {
    name: 'zhongzhiguo',
    handle: 'zhongzhiguo',
    avatar: 'Z',
    avatarUrl: 'https://cdn.test/avatar.png',
  } as {
    name?: string;
    handle?: string;
    avatar?: string;
    avatarUrl?: string;
  },
}));

vi.mock('@/api/client', () => ({
  getToken: () => 'token',
  setToken: vi.fn(),
  subscribeSession: () => vi.fn(),
}));

vi.mock('@/api/endpoints', () => ({
  authApi: {
    me: vi.fn(),
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: testState.me,
  }),
}));

describe('DesktopLayout', () => {
  beforeEach(() => {
    testState.me = {
      name: 'zhongzhiguo',
      handle: 'zhongzhiguo',
      avatar: 'Z',
      avatarUrl: 'https://cdn.test/avatar.png',
    };
  });

  it('renders the current user avatar image when avatarUrl is available', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <DesktopLayout />
      </MemoryRouter>,
    );

    expect(html).toContain('src="https://cdn.test/avatar.png"');
    expect(html).toContain('alt="zhongzhiguo"');
    expect(html).toContain('@zhongzhiguo');
  });

  it('uses the web fallback character logic when avatarUrl is absent', () => {
    testState.me = {
      name: 'zhongzhiguo',
      handle: 'zhongzhiguo',
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <DesktopLayout />
      </MemoryRouter>,
    );

    expect(html).toContain('background:#4F46E5');
    expect(html).toContain('>z</div>');
    expect(html).not.toContain('>Z</div>');
    expect(html).toContain('@zhongzhiguo');
  });

  it('keeps the account popover limited to the current project menu entries', () => {
    const source = readFileSync(new URL('../../../src/pages/DesktopLayout.tsx', import.meta.url), 'utf8');

    expect(source).toContain('设置');
    expect(source).toContain('关于');
    expect(source).toContain('退出登录');
    expect(source).not.toContain('免费版');
    expect(source).not.toContain('语言');
    expect(source).not.toContain('主题');
    expect(source).not.toContain('帮助中心');
  });
});
