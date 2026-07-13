package com.skillstack.common.storage;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "skillstack.storage")
public class StorageProperties {
    private String type = "local";
    private Local local = new Local();

    @Data
    public static class Local {
        private String baseDir;
        private String baseUrl = "/uploads";
    }
}
