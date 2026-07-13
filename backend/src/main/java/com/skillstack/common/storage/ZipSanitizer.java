package com.skillstack.common.storage;

import lombok.extern.slf4j.Slf4j;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

/**
 * 统一识别并剔除 macOS Finder 压缩时塞入的影子条目：
 * {@code __MACOSX/} 目录、{@code .DS_Store}、{@code ._foo} AppleDouble 资源副本。
 * 用于 skill zip 的上传入站清洗以及历史数据的下游兜底过滤，保证线上存储与下发产物干净。
 */
@Slf4j
public final class ZipSanitizer {

    private ZipSanitizer() {}

    /** 条目名是否属于 macOS 影子文件 / 资源副本，不应进入存储或下发。 */
    public static boolean isJunkEntry(String name) {
        if (name == null) return false;
        if (name.equals("__MACOSX") || name.startsWith("__MACOSX/") || name.contains("/__MACOSX/")) {
            return true;
        }
        String trimmed = name.replaceAll("/+$", "");
        int slash = trimmed.lastIndexOf('/');
        String base = slash >= 0 ? trimmed.substring(slash + 1) : trimmed;
        return base.equals(".DS_Store") || base.startsWith("._");
    }

    /**
     * 剔除 zip 中的 macOS 垃圾条目并返回干净字节。
     * 不含垃圾时原样返回，避免无意义重打包。读取异常时回退到原始字节，不阻断上传。
     */
    public static byte[] sanitize(byte[] raw) {
        if (raw == null || raw.length == 0) return raw;

        boolean hasJunk;
        try (ZipInputStream probe = new ZipInputStream(new ByteArrayInputStream(raw))) {
            hasJunk = false;
            ZipEntry e;
            while ((e = probe.getNextEntry()) != null) {
                if (isJunkEntry(e.getName())) { hasJunk = true; break; }
                probe.closeEntry();
            }
        } catch (IOException e) {
            log.warn("ZipSanitizer probe failed, returning original bytes: {}", e.getMessage());
            return raw;
        }
        if (!hasJunk) return raw;

        try (ByteArrayOutputStream out = new ByteArrayOutputStream(raw.length);
             ZipInputStream zis = new ZipInputStream(new ByteArrayInputStream(raw));
             ZipOutputStream zos = new ZipOutputStream(out)) {
            byte[] buf = new byte[8192];
            ZipEntry e;
            while ((e = zis.getNextEntry()) != null) {
                if (isJunkEntry(e.getName())) {
                    zis.closeEntry();
                    continue;
                }
                zos.putNextEntry(new ZipEntry(e.getName()));
                int n;
                while ((n = zis.read(buf)) > 0) zos.write(buf, 0, n);
                zos.closeEntry();
                zis.closeEntry();
            }
            zos.finish();
            return out.toByteArray();
        } catch (IOException e) {
            log.warn("ZipSanitizer repack failed, returning original bytes: {}", e.getMessage());
            return raw;
        }
    }
}
