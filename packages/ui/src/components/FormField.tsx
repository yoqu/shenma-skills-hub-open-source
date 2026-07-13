import type { ReactNode } from 'react';
import { TOKENS } from '../tokens';
import { FormError } from './FormError';


interface FormFieldProps {
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
}

export function FormField({ label, required, hint, error, children }: FormFieldProps) {
  return (
    <label style={{ display: 'block' }}>
      <span
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: TOKENS.text2,
          display: 'block',
          marginBottom: 6,
        }}
      >
        {label}
        {required && (
          <span style={{ color: TOKENS.danger, marginLeft: 2 }}>*</span>
        )}
      </span>
      {children}
      <FormError message={error ?? hint} type={error ? 'error' : 'hint'} />
    </label>
  );
}
