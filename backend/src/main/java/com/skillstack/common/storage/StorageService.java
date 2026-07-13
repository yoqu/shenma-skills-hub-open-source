package com.skillstack.common.storage;

import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.io.InputStream;

public interface StorageService {
    /**
     * 存储文件，返回存储 key（相对路径，如 "avatars/123/uuid.jpg"）。
     * @param file   上传的文件
     * @param prefix 路径前缀，如 "avatars/123"
     */
    String store(MultipartFile file, String prefix) throws IOException;

    /**
     * 直接把内存中的字节落盘,扩展名取 {@code fileName} 后缀。
     * 用于服务端合成 zip / md 等非 multipart 场景。
     */
    String store(byte[] bytes, String fileName, String prefix) throws IOException;

    /** 删除文件，key 不存在时静默忽略。 */
    void delete(String key);

    /** 将存储 key 转为可访问的 URL。 */
    String resolveUrl(String key);

    /** 打开已存储文件的读取流。调用方负责关闭。 */
    InputStream openStream(String key) throws IOException;

    /** 文件是否存在。 */
    boolean exists(String key);

    /** 文件字节数,缺失时返回 -1。 */
    long size(String key);
}
