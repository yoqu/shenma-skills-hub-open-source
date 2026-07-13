import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const DESKTOP_AVATAR_COLORS = [
  '#4F46E5',
  '#0EA5E9',
  '#2563EB',
  '#0891B2',
  '#0F766E',
  '#059669',
  '#7C3AED',
  '#9333EA',
  '#DB2777',
  '#D97706',
] as const;

/** Stable pseudo-random color from a string, constrained to the desktop avatar palette. */
export function hashColor(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return DESKTOP_AVATAR_COLORS[h % DESKTOP_AVATAR_COLORS.length];
}

/** Compact CJK-friendly number formatter. 10000 → 1.0w, 1000 → 1.0k. */
export function fmt(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}
