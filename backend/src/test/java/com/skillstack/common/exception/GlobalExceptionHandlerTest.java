package com.skillstack.common.exception;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class GlobalExceptionHandlerTest {

    @Test
    void businessMapsCommonCodesToHttpStatus() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler();

        assertThat(handler.business(new BusinessException(40100, "未登录")).getStatusCode().value()).isEqualTo(401);
        assertThat(handler.business(new BusinessException(40300, "无权限")).getStatusCode().value()).isEqualTo(403);
        assertThat(handler.business(new BusinessException(40400, "不存在")).getStatusCode().value()).isEqualTo(404);
        assertThat(handler.business(new BusinessException(40900, "冲突")).getStatusCode().value()).isEqualTo(409);
        assertThat(handler.business(new BusinessException(40000, "错误")).getStatusCode().value()).isEqualTo(400);
    }

    @Test
    void fallbackDoesNotExposeInternalExceptionMessage() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler();

        var response = handler.fallback(new IllegalStateException("jdbc:mysql://secret-db/internal failed"));

        assertThat(response.getStatusCode().value()).isEqualTo(500);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getMessage()).isEqualTo("服务器内部错误，请稍后重试");
        assertThat(response.getBody().getMessage()).doesNotContain("secret-db");
    }
}
