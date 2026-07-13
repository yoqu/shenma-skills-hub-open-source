package com.skillstack.common.web;

import com.skillstack.common.storage.StorageProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@RequiredArgsConstructor
@EnableConfigurationProperties(StorageProperties.class)
public class WebConfig implements WebMvcConfigurer {

    private final StorageProperties storageProperties;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String baseDir = storageProperties.getLocal().getBaseDir();
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations("file:" + baseDir + "/");
    }
}
