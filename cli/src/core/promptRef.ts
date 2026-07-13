export interface ParsedPromptRef {
  team?: string;
  slug: string;
}

export function parsePromptRef(input: string, defaultTeam?: number | string): ParsedPromptRef {
  const raw = input.trim();
  const parts = raw.split('/').filter(Boolean);
  if (parts.length === 2) return { team: parts[0], slug: parts[1] };
  if (parts.length === 1) {
    if (!defaultTeam) throw new Error('team required: use <team>/<prompt> or set defaultTeamId');
    return { team: String(defaultTeam), slug: parts[0] };
  }
  throw new Error('invalid prompt ref, expected <team>/<prompt> or <prompt>');
}
