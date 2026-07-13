import type { SkillParseResult } from '@/api/endpoints';

/** 简单的版本号 bump 提示：1.2.3 → 1.2.4；非 semver 时给个安全默认。 */
export function bumpHint(current: string): string {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(current);
  if (m) {
    const [, a, b, c] = m;
    return `${a}.${b}.${Number(c) + 1}`;
  }
  return '1.0.1';
}

/** 解析三段纯数字 semver；非法返回 null。 */
export function parseSemver(v: string): [number, number, number] | null {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v.trim());
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** 比较两个三段纯数字 semver，返回 -1 / 0 / 1；不合法时按 0 处理（调用方需先校验合法性）。 */
export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

export interface VersionBumpInput {
  hasUpload: boolean;
  version: string;
  currentVersion: string;
  changelog: string;
  /** 管理员直发等场景要求必须填写变更说明；成员提交审核则选填。 */
  requireChangelog?: boolean;
}

/** 发新版本表单校验，成员 / 管理员两个弹窗共用，返回错误文案或 null。 */
export function validateVersionBump({
  hasUpload,
  version,
  currentVersion,
  changelog,
  requireChangelog = false,
}: VersionBumpInput): string | null {
  if (!hasUpload) return '请上传新版本的源文件';
  const v = version.trim();
  if (!v) return '请输入新版本号';
  if (v.length > 32) return '版本号过长';
  if (v === currentVersion) return '新版本号不能与当前版本相同';
  if (parseSemver(v) && parseSemver(currentVersion) && compareSemver(v, currentVersion) < 0) {
    return `新版本号必须高于当前版本 v${currentVersion}`;
  }
  if (requireChangelog && !changelog.trim()) return '请填写变更说明';
  if (changelog.length > 1024) return '变更说明过长（上限 1024 字）';
  return null;
}

/** 收集解析警告（非阻断）。 */
export function collectParseWarning(res: SkillParseResult): string | null {
  const bad = res.checks.filter((c) => c.status === 'warn' || c.status === 'fail');
  if (bad.length === 0 && res.ok) return null;
  const details = bad.map((c) => c.detail || c.name).filter(Boolean);
  if (details.length > 0) {
    return `源文件校验提示：${details.join('；')}。可继续提交，审核环节会兜底处理。`;
  }
  if (!res.ok) {
    return '源文件未完全通过解析校验，可继续提交，审核环节会兜底处理。';
  }
  return null;
}
