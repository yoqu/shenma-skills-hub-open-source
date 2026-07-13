export type ActivityKind =
  | 'approve'
  | 'submit'
  | 'invite'
  | 'release'
  | 'unlist'
  | 'join'
  | 'suite'
  | 'reject';

export interface Activity {
  who: string;
  what: string;
  target: string;
  when: string;
  kind: ActivityKind;
  /** Optional secondary descriptor (e.g. "设为下架"). */
  extra?: string;
  /** 字符占位（首字符），用于头像图片缺失或加载失败时兜底。 */
  whoAvatar?: string;
  /** actor 头像图片 URL（已由后端解析，可直接给 Avatar 组件）。 */
  whoAvatarUrl?: string;
}

export const ACTIVITY: Activity[] = [
  { who: '林子睿', what: '通过了', target: 'lint-bundle', when: '12 分钟前', kind: 'approve' },
  { who: '陈奕笑', what: '提交了', target: 'graphql-codegen', when: '32 分钟前', kind: 'submit' },
  { who: '赵一辰', what: '邀请了 3 位手机号成员', target: '', when: '1 小时前', kind: 'invite' },
  { who: '吴嘉禾', what: '发布了新版本', target: 'ludou-release@4.6.2', when: '今天 09:00', kind: 'release' },
  { who: '林子睿', what: '把', target: 'qa-snap', when: '昨天 17:21', kind: 'unlist', extra: '设为下架' },
  { who: '黄  桃', what: '加入了团队', target: '', when: '昨天 14:02', kind: 'join' },
  { who: '赵一辰', what: '更新了套件', target: '前端日常开发', when: '2 天前', kind: 'suite' },
];
