package com.skillstack.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CliDeviceLookupRes {
    private String userCode;
    private String status;
    private Long expiresIn;
    private String userAgent;
}
