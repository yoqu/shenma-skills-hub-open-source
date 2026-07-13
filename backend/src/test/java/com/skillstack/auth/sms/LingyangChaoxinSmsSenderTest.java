package com.skillstack.auth.sms;

import com.skillstack.auth.sms.entity.SmsProviderConfig;
import com.skillstack.common.exception.BusinessException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class LingyangChaoxinSmsSenderTest {

    @Test
    void generateSignatureUsesSortedMd5Parameters() {
        String signature = LingyangChaoxinSignatureUtil.generateSignature(
                "app",
                "ak",
                "secret",
                1710000000000L,
                null
        );

        assertThat(signature).isEqualTo(md5("accessKey=ak&accessSecret=secret&appId=app&timestamp=1710000000000"));
    }

    @Test
    void sendBuildsLingyangRequestAndParsesSuccessResponse() {
        RestTemplate restTemplate = new RestTemplate();
        MockRestServiceServer server = MockRestServiceServer.createServer(restTemplate);
        LingyangChaoxinSmsSender sender = new LingyangChaoxinSmsSender(restTemplate);
        SmsProviderConfig config = config();

        server.expect(requestTo(org.hamcrest.Matchers.containsString(
                        "https://lingyang.example.test/openapi/cloud/userMarketing/sendSms?appId=app&accessKey=ak&timestamp="
                )))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", org.hamcrest.Matchers.not(org.hamcrest.Matchers.blankOrNullString())))
                .andExpect(content().json("""
                        {
                          "phoneNumbers": ["13900001111"],
                          "signName": "SkillStack",
                          "templateCode": "TPL_001",
                          "templateParam": {
                            "code": "123456"
                          }
                        }
                        """))
                .andRespond(withSuccess(
                        "{\"data\":\"{\\\"code\\\":\\\"OK\\\",\\\"message\\\":\\\"发送成功\\\"}\"}",
                        MediaType.APPLICATION_JSON
                ));

        sender.send(config, "13900001111", "123456", "login", 300);

        server.verify();
    }

    @Test
    void sendAcceptsObjectDataSuccessResponse() {
        RestTemplate restTemplate = new RestTemplate();
        MockRestServiceServer server = MockRestServiceServer.createServer(restTemplate);
        LingyangChaoxinSmsSender sender = new LingyangChaoxinSmsSender(restTemplate);
        SmsProviderConfig config = config();

        server.expect(requestTo(org.hamcrest.Matchers.containsString(
                        "https://lingyang.example.test/openapi/cloud/userMarketing/sendSms?appId=app&accessKey=ak&timestamp="
                )))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(
                        "{\"data\":{\"code\":\"OK\",\"message\":\"发送成功\"}}",
                        MediaType.APPLICATION_JSON
                ));

        sender.send(config, "13900001111", "123456", "login", 300);

        server.verify();
    }

    @Test
    void sendRejectsInnerResponseCodeThatIsNotOk() {
        RestTemplate restTemplate = new RestTemplate();
        MockRestServiceServer server = MockRestServiceServer.createServer(restTemplate);
        LingyangChaoxinSmsSender sender = new LingyangChaoxinSmsSender(restTemplate);
        SmsProviderConfig config = config();

        server.expect(requestTo(org.hamcrest.Matchers.containsString(
                        "https://lingyang.example.test/openapi/cloud/userMarketing/sendSms?appId=app&accessKey=ak&timestamp="
                )))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(
                        "{\"data\":\"{\\\"code\\\":\\\"ERROR\\\",\\\"message\\\":\\\"发送失败\\\"}\"}",
                        MediaType.APPLICATION_JSON
                ));

        assertThatThrownBy(() -> sender.send(config, "13900001111", "123456", "login", 300))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("短信发送失败");

        server.verify();
    }

    private SmsProviderConfig config() {
        SmsProviderConfig c = new SmsProviderConfig();
        c.setCode("sms_login");
        c.setEnabled(true);
        c.setProviderType("LINGYANG_CHAOXIN");
        c.setEndpointUrl("https://lingyang.example.test");
        c.setExtraJson("""
                {
                  "appId": "app",
                  "accessKey": "ak",
                  "signName": "SkillStack",
                  "templateCode": "TPL_001",
                  "templateParamKey": "code"
                }
                """);
        c.setSecretJson("{\"accessSecret\":\"secret\"}");
        return c;
    }

    private String md5(String value) {
        try {
            MessageDigest md5 = MessageDigest.getInstance("MD5");
            byte[] digest = md5.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : digest) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
