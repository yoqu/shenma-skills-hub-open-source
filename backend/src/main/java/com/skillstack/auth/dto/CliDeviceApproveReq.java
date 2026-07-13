package com.skillstack.auth.dto;

import lombok.Data;

@Data
public class CliDeviceApproveReq {
    /** 是否签发 7 天长 token，默认 false。 */
    private Boolean remember;
}
