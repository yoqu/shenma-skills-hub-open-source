package com.skillstack.auth.sms;

import com.skillstack.auth.sms.entity.SmsProviderConfig;
import com.skillstack.common.exception.BusinessException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class HttpSmsSenderTest {

    @Test
    void sendRendersHeaderListAndBodyTemplate() {
        RestTemplate restTemplate = new RestTemplate();
        MockRestServiceServer server = MockRestServiceServer.createServer(restTemplate);
        HttpSmsSender sender = new HttpSmsSender(restTemplate);
        SmsProviderConfig config = config();

        server.expect(requestTo("https://sms.example.test/send"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("X-App", "skillstack"))
                .andExpect(header("Authorization", "Bearer token"))
                .andExpect(content().json("""
                        {
                          "phone": "13900001111",
                          "code": "123456",
                          "purpose": "login",
                          "ttl": 300
                        }
                        """))
                .andRespond(withSuccess("{\"ok\":true}", MediaType.APPLICATION_JSON));

        sender.send(config, "13900001111", "123456", "login", 300);

        server.verify();
    }

    @Test
    void sendRejectsUnexpectedSuccessJsonValue() {
        RestTemplate restTemplate = new RestTemplate();
        MockRestServiceServer server = MockRestServiceServer.createServer(restTemplate);
        HttpSmsSender sender = new HttpSmsSender(restTemplate);
        SmsProviderConfig config = config();

        server.expect(requestTo("https://sms.example.test/send"))
                .andRespond(withSuccess("{\"ok\":false}", MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> sender.send(config, "13900001111", "123456", "login", 300))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("短信发送失败");

        server.verify();
    }

    private SmsProviderConfig config() {
        SmsProviderConfig c = new SmsProviderConfig();
        c.setCode("sms_login");
        c.setEnabled(true);
        c.setProviderType("HTTP");
        c.setEndpointUrl("https://sms.example.test/send");
        c.setMethod("POST");
        c.setHeadersJson("""
                [
                  {"name":"X-App","value":"skillstack","secret":false},
                  {"name":"Authorization","value":"Bearer token","secret":true}
                ]
                """);
        c.setBodyTemplate("""
                {
                  "phone": "${phone}",
                  "code": "${code}",
                  "purpose": "${purpose}",
                  "ttl": ${ttlSeconds}
                }
                """);
        c.setSuccessStatus(200);
        c.setSuccessJsonPath("ok");
        c.setSuccessExpectedValue("true");
        return c;
    }
}
