export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,94}$/;

export function slugify(input: string, maxLength = 95): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}

export function normalizeSlugInput(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-{2,}/g, '-');
}

export function slugError(slug: string): string | undefined {
  if (!slug.trim()) return '请输入英文 slug';
  if (!SLUG_RE.test(slug)) return '小写字母 / 数字 / 短横线，2-95 个字符';
  return undefined;
}
