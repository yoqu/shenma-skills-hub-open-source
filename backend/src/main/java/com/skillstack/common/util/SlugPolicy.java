package com.skillstack.common.util;

import com.skillstack.common.exception.BusinessException;

public final class SlugPolicy {
    public static final String PATTERN = "^[a-z0-9][a-z0-9-]{1,94}$";

    private SlugPolicy() {
    }

    public static String normalize(String input) {
        if (input == null) return "";
        return input.toLowerCase()
                .replaceAll("[^a-z0-9\\s-]", "")
                .trim()
                .replaceAll("\\s+", "-")
                .replaceAll("-{2,}", "-")
                .replaceAll("^-+|-+$", "");
    }

    public static String normalizeManual(String input, String label) {
        String slug = input == null ? "" : input.trim().toLowerCase();
        if (!slug.matches(PATTERN)) {
            throw new BusinessException(40000, label + "必须为英文小写字母、数字或短横线，且长度 2-95");
        }
        return slug;
    }
}
