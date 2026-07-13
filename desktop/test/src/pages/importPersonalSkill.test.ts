import { describe, expect, it } from 'vitest';
import type { SkillParseResult } from '@/api/endpoints';
import { buildPersonalSkillImportReq } from '../../../src/pages/importPersonalSkill';

function parseResult(overrides: Partial<SkillParseResult> = {}): SkillParseResult {
  return {
    zipUrl: 'skill-versions/1/demo.zip',
    size: 1200,
    sha256: 'abc',
    entryCount: 3,
    fileCount: 2,
    skillMdPath: 'SKILL.md',
    hasSkillMd: true,
    hasFrontmatter: true,
    parsed: {
      name: 'Demo Skill',
      version: '0.9.0',
      description: 'Demo description',
      category: 'dev',
      tags: ['demo'],
      langs: ['TypeScript'],
    },
    checks: [],
    ok: true,
    ...overrides,
  };
}

describe('buildPersonalSkillImportReq', () => {
  it('maps parsed skill metadata to personal import request', () => {
    const req = buildPersonalSkillImportReq(parseResult(), 'demo.zip');

    expect(req).toEqual({
      name: 'Demo Skill',
      slug: 'demo-skill',
      shortDesc: 'Demo description',
      catCode: 'dev',
      icon: 'D',
      version: '0.9.0',
      zipUrl: 'skill-versions/1/demo.zip',
      filesCount: 2,
      langs: ['TypeScript'],
    });
  });

  it('falls back to uploaded file name when parsed name is missing', () => {
    const req = buildPersonalSkillImportReq(
      parseResult({ parsed: { version: '1.0.0' } }),
      'weather-helper.zip',
    );

    expect(req.name).toBe('weather-helper');
    expect(req.slug).toBe('weather-helper');
    expect(req.icon).toBe('W');
  });
});
