import { TeamPrefsBody } from '@/pages/team/_shared/TeamPrefsBody';
import { AdminShell } from './_shared/AdminShell';

/**
 * 管理员视角的"我的偏好"：保留通知偏好 / 我的资料 / 我的 Token。
 * 不暴露"离开团队"——Admin / Owner 不应该通过个人偏好直接离队。
 */
export default function AdminPrefs() {
  return (
    <AdminShell active="prefs">
      <TeamPrefsBody />
    </AdminShell>
  );
}
