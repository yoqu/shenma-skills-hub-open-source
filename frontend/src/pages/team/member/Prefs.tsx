import { TeamPrefsBody } from '@/pages/team/_shared/TeamPrefsBody';
import { MemberShell } from './_shared/MemberShell';

/** 成员视角的"我的偏好"：暂不暴露危险操作，后续需要再迭代。 */
export default function Prefs() {
  return (
    <MemberShell active="prefs">
      <TeamPrefsBody />
    </MemberShell>
  );
}
