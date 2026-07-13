export function buildInviteUrl(code: string): string {
  return `${window.location.origin}/team/join?code=${encodeURIComponent(code)}`;
}

export function buildInviteMessage(teamName: string | undefined, code: string): string {
  const name = teamName?.trim() || '我们的团队';
  return `邀请你加入团队「${name}」，点此加入：\n${buildInviteUrl(code)}`;
}
