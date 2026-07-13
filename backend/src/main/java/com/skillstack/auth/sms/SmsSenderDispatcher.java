package com.skillstack.auth.sms;

import com.skillstack.auth.sms.entity.SmsProviderConfig;
import com.skillstack.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class SmsSenderDispatcher {

    private final HttpSmsSender httpSmsSender;
    private final LingyangChaoxinSmsSender lingyangChaoxinSmsSender;


    public void send(SmsProviderConfig config, String phone, String code, String purpose, long ttlSeconds) {
        if (SmsProviderService.PROVIDER_HTTP.equalsIgnoreCase(config.getProviderType())) {
            httpSmsSender.send(config, phone, code, purpose, ttlSeconds);
            return;
        }
        if (SmsProviderService.PROVIDER_LINGYANG_CHAOXIN.equalsIgnoreCase(config.getProviderType())) {
            lingyangChaoxinSmsSender.send(config, phone, code, purpose, ttlSeconds);
            return;
        }
        throw new BusinessException(40040, "短信供应商配置不完整");
    }
}
