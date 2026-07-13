import { TOKENS } from '../tokens';
import { forwardRef } from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  state?: 'default' | 'success' | 'error';
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { state = 'default', style, ...props },
  ref,
) {
  const borderColor =
    state === 'success' ? TOKENS.success : state === 'error' ? TOKENS.danger : TOKENS.border;
  return (
    <textarea
      ref={ref}
      style={{
        width: '100%',
        padding: '10px 12px',
        fontSize: 14,
        border: `1px solid ${borderColor}`,
        borderRadius: 8,
        outline: 'none',
        background: '#fff',
        fontFamily: 'inherit',
        boxSizing: 'border-box',
        resize: 'vertical',
        minHeight: 64,
        ...style,
      }}
      {...props}
    />
  );
});
