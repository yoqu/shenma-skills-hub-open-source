package com.skillstack.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CliDeviceInitRes {
    private String deviceCode;
    private String userCode;
    private String verificationUri;
    private Long expiresIn;
    private Integer interval;
}
