package com.skillstack.common.storage;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "skillstack.storage.type", havingValue = "local", matchIfMissing = true)
public class LocalStorageService implements StorageService {

    private final StorageProperties properties;

    @Override
    public String store(MultipartFile file, String prefix) throws IOException {
        return store(file.getInputStream(), file.getOriginalFilename(), prefix);
    }

    @Override
    public String store(byte[] bytes, String fileName, String prefix) throws IOException {
        try (InputStream in = new java.io.ByteArrayInputStream(bytes)) {
            return store(in, fileName, prefix);
        }
    }

    private String store(InputStream in, String originalFilename, String prefix) throws IOException {
        String ext = ".bin";
        if (originalFilename != null && originalFilename.contains(".")) {
            ext = originalFilename.substring(originalFilename.lastIndexOf('.'));
        }
        String key = prefix + "/" + UUID.randomUUID() + ext;
        Path targetPath = Paths.get(properties.getLocal().getBaseDir()).resolve(key);
        Files.createDirectories(targetPath.getParent());
        Files.copy(in, targetPath, StandardCopyOption.REPLACE_EXISTING);
        return key;
    }

    @Override
    public void delete(String key) {
        try {
            Files.deleteIfExists(Paths.get(properties.getLocal().getBaseDir()).resolve(key));
        } catch (IOException ignored) {
        }
    }

    @Override
    public String resolveUrl(String key) {
        return properties.getLocal().getBaseUrl() + "/" + key;
    }

    @Override
    public InputStream openStream(String key) throws IOException {
        return Files.newInputStream(resolvePath(key));
    }

    @Override
    public boolean exists(String key) {
        if (key == null || key.isBlank()) return false;
        return Files.isRegularFile(resolvePath(key));
    }

    @Override
    public long size(String key) {
        try {
            return exists(key) ? Files.size(resolvePath(key)) : -1L;
        } catch (IOException e) {
            return -1L;
        }
    }

    private Path resolvePath(String key) {
        // 防止 zip slip / 越权访问 baseDir 之外的路径
        if (key == null || key.contains("..")) {
            throw new IllegalArgumentException("invalid storage key: " + key);
        }
        return Paths.get(properties.getLocal().getBaseDir()).resolve(key).normalize();
    }
}
