export interface SkillRef {
  slug: string;
  version?: string;
}

export function parseSkillRef(input: string): SkillRef {
  const s = (input ?? '').trim();
  if (!s) throw new Error('skill ref cannot be empty');
  if (s.includes('/')) throw new Error('skill ref must not contain slash (no team prefix); use --team or set defaultTeamId for suites');
  const at = s.indexOf('@');
  if (at < 0) return { slug: s };
  const slug = s.slice(0, at);
  const version = s.slice(at + 1);
  if (!slug) throw new Error('skill ref missing slug');
  if (!version) throw new Error('skill ref version cannot be empty after @');
  return { slug, version };
}
