package com.skillstack.auth.sms.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("sms_provider_config")
public class SmsProviderConfig {

    @TableId
    private String code;
    private String displayName;
    private Boolean enabled;
    private String providerType;
    private String endpointUrl;
    private String method;
    private String headersJson;
    private String bodyTemplate;
    private Integer successStatus;
    private String successJsonPath;
    private String successExpectedValue;
    private String extraJson;
    private String secretJson;
    private Long updatedBy;
    private LocalDateTime updatedAt;
}
