import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Spinner } from '@skillstack/ui';

describe('Spinner', () => {
  it('renders an element with role="status"', () => {
    const { container } = render(<Spinner />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute('role')).toBe('status');
  });

  it('has aria-label equal to the provided label prop', () => {
    const { container } = render(<Spinner label="请稍候" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute('aria-label')).toBe('请稍候');
  });

  it('uses the default aria-label "加载中" when no label is given', () => {
    const { container } = render(<Spinner />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute('aria-label')).toBe('加载中');
  });
});
