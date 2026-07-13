package com.skillstack.admin.dto;

import lombok.Data;

import java.util.Map;

@Data
public class UpdateSettingsReq {
    /** key → string value（任意类型客户端按 STRING 提交，服务端按白名单 + value_type 校验） */
    private Map<String, String> values;
}
