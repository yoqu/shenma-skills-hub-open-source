package com.skillstack.notification.service;

/**
 * Notification types and the pref-key + category they map to.
 *
 * <p>Order matches the design spec table. Keep in sync with {@link NotificationPrefService#INAPP_KEYS}.</p>
 */
public enum NotificationType {
    REVIEW_SUBMITTED("review_submitted", "review"),
    REVIEW_RESUBMITTED("review_submitted", "review"),
    REVIEW_APPROVED("review_result", "review"),
    REVIEW_REJECTED("review_result", "review"),
    REVIEW_CHANGES_REQUESTED("review_result", "review"),
    REVIEW_COMMENT("review_comment", "review"),
    PHONE_INVITE("phone_invite", "invite"),
    SUITE_PUBLISHED("suite_published", "suite"),
    SUITE_UPDATED("suite_published", "suite"),
    TEAM_ROLE_CHANGED("team_member_change", "team"),
    TEAM_JOINED("team_member_change", "team"),
    TEAM_REMOVED("team_member_change", "team");

    private final String prefKey;
    private final String category;

    NotificationType(String prefKey, String category) {
        this.prefKey = prefKey;
        this.category = category;
    }

    public String prefKey() { return prefKey; }
    public String category() { return category; }
}
