package com.skillstack.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CliDevicePollRes {
    /** pending / approved */
    private String status;
    private String token;
    private MeRes user;
}
