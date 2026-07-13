import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DesktopConfirmDialog } from '../../../src/pages/DesktopConfirmDialog';

describe('DesktopConfirmDialog', () => {
  it('renders a reusable destructive desktop confirmation dialog', () => {
    const html = renderToStaticMarkup(
      <DesktopConfirmDialog
        open
        danger
        title="退出登录"
        description="确定要退出登录吗？"
        confirmLabel="退出登录"
        confirmAriaLabel="确认退出登录"
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('退出登录');
    expect(html).toContain('确定要退出登录吗？');
    expect(html).toContain('取消');
    expect(html).toContain('确认退出登录');
  });

  it('does not render when closed', () => {
    const html = renderToStaticMarkup(
      <DesktopConfirmDialog
        open={false}
        title="退出登录"
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    );

    expect(html).toBe('');
  });
});
