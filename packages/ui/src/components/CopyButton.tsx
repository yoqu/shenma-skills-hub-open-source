import { useState, type CSSProperties } from 'react';
import { I } from '../icons';
import { Button, type ButtonSize, type ButtonVariant } from './Button';
import { toast } from './Toast';

export interface CopyButtonProps {
  text: string;
  label?: string;
  successMessage?: string;
  errorMessage?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  style?: CSSProperties;
  'aria-label'?: string;
  title?: string;
}

export function CopyButton({
  text,
  label = '复制',
  successMessage = '已复制',
  errorMessage = '复制失败，请手动选中',
  variant = 'ghost',
  size = 'sm',
  style,
  'aria-label': ariaLabel,
  title,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      toast({ kind: 'success', message: successMessage });
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ kind: 'error', message: errorMessage });
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      icon={copied ? <I.check size={12} /> : <I.copy size={12} />}
      aria-label={ariaLabel}
      title={title}
      onClick={handleCopy}
      style={style}
    >
      {label ? (copied ? '已复制' : label) : undefined}
    </Button>
  );
}
