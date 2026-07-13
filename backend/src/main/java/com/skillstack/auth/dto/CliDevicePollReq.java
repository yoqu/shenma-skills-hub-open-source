package com.skillstack.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CliDevicePollReq {
    @NotBlank(message = "deviceCode 不能为空")
    @Size(max = 128, message = "deviceCode 过长")
    private String deviceCode;
}
