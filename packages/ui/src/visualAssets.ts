export const CATEGORY_ICON_SRC: Record<string, string> = {
  dev: '/categories/dev.png',
  data: '/categories/data.png',
  design: '/categories/design.png',
  doc: '/categories/doc.png',
  devops: '/categories/devops.png',
  ai: '/categories/ai.png',
};

export const CREATE_SKILL_STEP_IMAGE_SRC: Record<number, string> = {
  1: '/create-skill/steps/upload.png',
  2: '/create-skill/steps/validate.png',
  3: '/create-skill/steps/metadata.png',
  4: '/create-skill/steps/submit.png',
};

export type EmptyStateImageKey =
  | 'empty'
  | 'noResults'
  | 'error'
  | 'submitSkill'
  | 'suite'
  | 'review'
  | 'invite'
  | 'token'
  | 'notFound'
  | 'notifications'
  | 'profile'
  | 'activity';

export const EMPTY_STATE_IMAGE_SRC: Record<EmptyStateImageKey, string> = {
  empty: '/empty-states/empty-inbox.png',
  noResults: '/empty-states/no-results.png',
  error: '/empty-states/load-error.png',
  submitSkill: '/empty-states/submit-skill.png',
  suite: '/empty-states/suite-library.png',
  review: '/empty-states/review-queue.png',
  invite: '/empty-states/invite-member.png',
  token: '/empty-states/api-token.png',
  notFound: '/empty-states/not-found.png',
  notifications: '/empty-states/notifications.png',
  profile: '/empty-states/profile.png',
  activity: '/empty-states/activity.png',
};

export type MemberQuickActionImageKey =
  | 'submitSkill'
  | 'browseSuites'
  | 'mySubmissions'
  | 'notificationPrefs';

export const MEMBER_QUICK_ACTION_IMAGE_SRC: Record<MemberQuickActionImageKey, string> = {
  submitSkill: '/member/quick-actions/submit-skill.png',
  browseSuites: '/member/quick-actions/browse-suites.png',
  mySubmissions: '/member/quick-actions/my-submissions.png',
  notificationPrefs: '/member/quick-actions/notification-prefs.png',
};
