package com.skillstack.common.systemconfig;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("system_config")
public class SystemConfig {

    @TableId
    private String configKey;
    private String configValue;
    private LocalDateTime updatedAt;
}
