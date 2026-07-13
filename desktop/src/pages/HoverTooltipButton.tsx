import type { ButtonHTMLAttributes } from 'react';

export interface HoverTooltipButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tooltip?: string;
}

export function HoverTooltipButton({ className, tooltip, ...props }: HoverTooltipButtonProps) {
  const nextClassName = [className, tooltip ? 'desktop-hover-tooltip' : null]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      {...props}
      className={nextClassName || undefined}
      data-tooltip={tooltip}
    />
  );
}
