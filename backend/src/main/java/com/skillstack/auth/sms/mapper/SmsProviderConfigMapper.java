package com.skillstack.auth.sms.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.skillstack.auth.sms.entity.SmsProviderConfig;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface SmsProviderConfigMapper extends BaseMapper<SmsProviderConfig> {
}
