package com.skillstack.common.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;

/**
 * 轻量 .env 加载器：从 backend/.env 或仓库根 .env 读取本地密钥配置。
 */
@Slf4j
public class DotenvApplicationContextInitializer implements ApplicationContextInitializer<ConfigurableApplicationContext> {

    @Override
    public void initialize(ConfigurableApplicationContext applicationContext) {
        Path envFile = findEnvFile();
        if (envFile == null) {
            log.info("No .env file found, using system environment variables only");
            return;
        }

        Map<String, Object> values = parseEnvFile(envFile);
        if (values.isEmpty()) {
            return;
        }

        ConfigurableEnvironment environment = applicationContext.getEnvironment();
        environment.getPropertySources().addFirst(new MapPropertySource("dotenvProperties", values));
        log.info("Loaded {} environment variables from {}", values.size(), envFile);
    }

    private Path findEnvFile() {
        Path currentDir = Path.of(System.getProperty("user.dir")).toAbsolutePath();
        Path currentEnv = currentDir.resolve(".env");
        if (Files.exists(currentEnv)) {
            return currentEnv;
        }

        Path parent = currentDir.getParent();
        if (parent != null) {
            Path parentEnv = parent.resolve(".env");
            if (Files.exists(parentEnv)) {
                return parentEnv;
            }
        }
        return null;
    }

    private Map<String, Object> parseEnvFile(Path envFile) {
        Map<String, Object> values = new HashMap<>();
        try {
            for (String rawLine : Files.readAllLines(envFile, StandardCharsets.UTF_8)) {
                String line = rawLine.trim();
                if (line.isEmpty() || line.startsWith("#") || !line.contains("=")) {
                    continue;
                }
                String key = line.substring(0, line.indexOf('=')).trim();
                String value = unquote(line.substring(line.indexOf('=') + 1).trim());
                if (!key.isEmpty() && System.getenv(key) == null) {
                    values.put(key, value);
                }
            }
        } catch (IOException e) {
            log.warn("Failed to read .env file {}: {}", envFile, e.getMessage());
        }
        return values;
    }

    private String unquote(String value) {
        if (value.length() >= 2) {
            char first = value.charAt(0);
            char last = value.charAt(value.length() - 1);
            if ((first == '"' && last == '"') || (first == '\'' && last == '\'')) {
                return value.substring(1, value.length() - 1);
            }
        }
        return value;
    }
}
