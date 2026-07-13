package com.skillstack.skill.service;

import com.skillstack.common.storage.StorageService;
import com.skillstack.skill.dto.SkillMdContent;
import com.skillstack.skill.entity.SkillVersion;
import com.skillstack.skill.mapper.SkillVersionFileMapper;
import com.skillstack.skill.mapper.SkillVersionMapper;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SkillVersionFileServiceTest {

    @Test
    void readSkillMdReturnsTextFromZip() throws Exception {
        StorageService storage = mock(StorageService.class);
        SkillVersionFileService service = new SkillVersionFileService(
                mock(SkillVersionFileMapper.class),
                mock(SkillVersionMapper.class),
                storage);
        SkillVersion version = new SkillVersion();
        version.setId(7L);
        version.setZipUrl("skills/demo.zip");
        byte[] zip = zipWith("demo-1.0.0/SKILL.md", "# Demo\n\n设计说明");

        when(storage.exists("skills/demo.zip")).thenReturn(true);
        when(storage.openStream("skills/demo.zip")).thenReturn(new ByteArrayInputStream(zip));

        SkillMdContent content = service.readSkillMd(version);

        assertEquals("demo-1.0.0/SKILL.md", content.getPath());
        assertEquals("# Demo\n\n设计说明", content.getContent());
        assertEquals(20L, content.getSize());
        assertFalse(content.getTruncated());
    }

    private static byte[] zipWith(String path, String content) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(out)) {
            zip.putNextEntry(new ZipEntry(path));
            zip.write(content.getBytes(StandardCharsets.UTF_8));
            zip.closeEntry();
        }
        return out.toByteArray();
    }
}
