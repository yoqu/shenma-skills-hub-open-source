import type { SkillParseResult, UserSkillImportReq } from '@/api/endpoints';

export function buildPersonalSkillImportReq(parseResult: SkillParseResult, fileName: string): UserSkillImportReq {
  const parsed = parseResult.parsed;
  const name = normalizeName(parsed?.name) || normalizeName(stripExtension(fileName));
  const slug = normalizeSlug(name);
  const version = normalizeVersion(parsed?.version);

  if (!name) {
    throw new Error('无法识别 Skill 名称');
  }
  if (!slug) {
    throw new Error('无法识别 Skill slug');
  }
  if (!version) {
    throw new Error('无法识别 Skill 版本');
  }
  if (!parseResult.zipUrl) {
    throw new Error('缺少上传后的 zipUrl');
  }

  return {
    name,
    slug,
    shortDesc: normalizeOptional(parsed?.description),
    catCode: normalizeOptional(parsed?.category),
    icon: name.slice(0, 1).toUpperCase(),
    version,
    zipUrl: parseResult.zipUrl,
    filesCount: parseResult.fileCount,
    langs: parsed?.langs?.filter((item): item is string => Boolean(item?.trim())).map((item) => item.trim()),
  };
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '');
}

function normalizeName(value?: string | null): string {
  return value?.trim() || '';
}

function normalizeOptional(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function normalizeVersion(value?: string | null): string {
  return value?.trim() || '';
}

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 95);
}
