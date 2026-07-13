import { describe, it, expect } from 'vitest';
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { Button } from '@skillstack/ui';

describe('Button ref forwarding', () => {
  // Radix `DropdownMenu.Trigger asChild` clones the child and assigns it a ref
  // (used as the popup's anchor). If Button does not forward that ref to the
  // underlying <button>, the ref is silently dropped and the dropdown never
  // gets an anchor to open against — which is exactly why the skill-row "⋮"
  // menus stopped popping up.
  it('forwards its ref to the underlying <button> element', () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <Button variant="ghost" ref={ref}>
        menu
      </Button>,
    );
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current?.tagName).toBe('BUTTON');
  });
});

describe('Button styling', () => {
  // Chrome is applied inline on purpose: it must beat Tailwind's unlayered
  // Preflight reset (`*{border-width:0}`, `button{background:transparent}`),
  // which only inline styles reliably do. The per-instance override channel is
  // the `style` prop, which is merged last.
  it('renders its variant chrome inline', () => {
    render(<Button variant="primary">x</Button>);
    const btn = screen.getByText('x') as HTMLButtonElement;
    expect(btn.style.border).not.toBe('');
    expect(btn.style.background).not.toBe('');
  });

  it('lets the style prop override default chrome', () => {
    render(
      <Button variant="ghost" style={{ border: '2px solid red' }}>
        x
      </Button>,
    );
    const btn = screen.getByText('x') as HTMLButtonElement;
    expect(btn.style.border).toBe('2px solid red');
  });
});
