import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DesktopLogin from '../../../src/pages/DesktopLogin';

beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  });
});

describe('DesktopLogin', () => {
  it('renders an API settings entry on the login page', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <DesktopLogin />
      </MemoryRouter>,
    );

    expect(html).toContain('aria-label="设置服务 API 地址"');
  });

  it('does not render login failure copy under the browser login button', () => {
    localStorage.setItem('skillstack.login.notice', '登录状态异常，请重新登录');

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <DesktopLogin />
      </MemoryRouter>,
    );

    expect(html).toContain('通过浏览器登录');
    expect(html).not.toContain('登录状态异常，请重新登录');
  });
});
