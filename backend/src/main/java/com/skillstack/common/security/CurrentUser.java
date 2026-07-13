package com.skillstack.common.security;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CurrentUser {
    private Long id;
    private String handle;
    /** 是否来自 Personal Access Token；PAT 凭据禁止享有平台超管 bypass。 */
    private boolean pat;

    public CurrentUser(Long id, String handle) {
        this(id, handle, false);
    }
}
