package com.skillstack.common.systemconfig;

import com.skillstack.common.systemconfig.mapper.SystemConfigMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.function.Supplier;

@Slf4j
@Service
@RequiredArgsConstructor
public class SystemConfigService {

    private final SystemConfigMapper mapper;

    public Optional<String> get(String key) {
        SystemConfig row = mapper.selectById(key);
        return Optional.ofNullable(row).map(SystemConfig::getConfigValue);
    }

    public void put(String key, String value) {
        SystemConfig existing = mapper.selectById(key);
        SystemConfig row = new SystemConfig();
        row.setConfigKey(key);
        row.setConfigValue(value);
        if (existing == null) {
            mapper.insert(row);
        } else {
            mapper.updateById(row);
        }
    }

    /**
     * 读取 key 的值；不存在时用 generator 生成并持久化后返回。
     * 并发首启时若发生唯一键冲突，回退为读取已落库的值，保证全局只有一份。
     */
    public synchronized String getOrInit(String key, Supplier<String> generator) {
        Optional<String> current = get(key);
        if (current.isPresent()) {
            return current.get();
        }
        String generated = generator.get();
        try {
            SystemConfig row = new SystemConfig();
            row.setConfigKey(key);
            row.setConfigValue(generated);
            mapper.insert(row);
            return generated;
        } catch (DuplicateKeyException e) {
            return get(key).orElse(generated);
        }
    }
}
