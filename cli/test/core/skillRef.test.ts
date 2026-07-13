import { describe, it, expect } from 'vitest';
import { parseSkillRef } from '../../src/core/skillRef';

describe('parseSkillRef', () => {
  it('parses bare slug', () => {
    expect(parseSkillRef('weather-helper')).toEqual({ slug: 'weather-helper', version: undefined });
  });
  it('parses slug with version', () => {
    expect(parseSkillRef('weather-helper@1.2.0')).toEqual({ slug: 'weather-helper', version: '1.2.0' });
  });
  it('rejects empty string', () => {
    expect(() => parseSkillRef('')).toThrow(/empty/i);
  });
  it('rejects @ without version', () => {
    expect(() => parseSkillRef('weather-helper@')).toThrow(/version/i);
  });
  it('rejects slug with slash', () => {
    expect(() => parseSkillRef('team/weather-helper')).toThrow(/slash/i);
  });
});
