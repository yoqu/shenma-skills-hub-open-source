package com.skillstack.skill.service;

import com.skillstack.common.exception.BusinessException;
import com.skillstack.common.storage.StorageService;
import com.skillstack.skill.dto.SkillParseResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SkillParseServiceTest {

    private StorageService storage;
    private SkillParseService service;

    @BeforeEach
    void setUp() {
        storage = mock(StorageService.class);
        service = new SkillParseService(storage);
    }

    @Test
    void parse_validZipWithFrontmatter_extractsMeta() throws Exception {
        Map<String, byte[]> entries = Map.of(
                "SKILL.md", ("---\n" +
                        "name: graphql-codegen\n" +
                        "version: 0.2.1\n" +
                        "description: codegen for graphql\n" +
                        "category: dev\n" +
                        "tags: [graphql, codegen]\n" +
                        "---\n# README\n").getBytes(),
                "src/main.ts", "console.log('hi');".getBytes(),
                "src/styles.css", "body{}".getBytes()
        );
        byte[] zip = makeZip(entries);
        wire("k", zip);

        SkillParseResult r = service.parse("k");
        assertTrue(r.isOk());
        assertTrue(r.isHasSkillMd());
        assertTrue(r.isHasFrontmatter());
        assertEquals("graphql-codegen", r.getParsed().getName());
        assertEquals("0.2.1", r.getParsed().getVersion());
        assertEquals("codegen for graphql", r.getParsed().getDescription());
        assertEquals("dev", r.getParsed().getCategory());
        assertEquals(2, r.getParsed().getTags().size());
        assertTrue(r.getParsed().getLangs().contains("TS"));
        assertTrue(r.getParsed().getLangs().contains("CSS"));
        assertEquals(3, r.getFileCount());
        assertNotNull(r.getSha256());
        assertEquals(64, r.getSha256().length());
    }

    @Test
    void parse_missingSkillMd_returnsFailCheck() throws Exception {
        byte[] zip = makeZip(Map.of("README.md", "hi".getBytes()));
        wire("k", zip);

        SkillParseResult r = service.parse("k");
        assertFalse(r.isOk());
        assertFalse(r.isHasSkillMd());
        assertTrue(r.getChecks().stream()
                .anyMatch(c -> "fail".equals(c.getStatus()) && c.getName().contains("SKILL.md")));
    }

    @Test
    void parse_malformedFrontmatter_marksFail() throws Exception {
        byte[] zip = makeZip(Map.of("SKILL.md", "---\nname: x\n# no closing fence\n".getBytes()));
        wire("k", zip);

        SkillParseResult r = service.parse("k");
        assertFalse(r.isOk());
        assertTrue(r.getChecks().stream()
                .anyMatch(c -> "fail".equals(c.getStatus()) && c.getName().contains("frontmatter")));
    }

    @Test
    void parse_invalidSemver_marksFail() throws Exception {
        byte[] zip = makeZip(Map.of("SKILL.md",
                ("---\nname: foo\nversion: notSemver\ndescription: d\n---\n").getBytes()));
        wire("k", zip);

        SkillParseResult r = service.parse("k");
        assertFalse(r.isOk());
        assertTrue(r.getChecks().stream()
                .anyMatch(c -> "fail".equals(c.getStatus()) && c.getName().contains("version")));
    }

    @Test
    void parse_missingVersion_defaultsToInitialVersion() throws Exception {
        byte[] zip = makeZip(Map.of("SKILL.md",
                ("---\nname: foo\ndescription: d\n---\n").getBytes()));
        wire("k", zip);

        SkillParseResult r = service.parse("k");

        assertTrue(r.isOk());
        assertEquals("0.1.0", r.getParsed().getVersion());
        assertTrue(r.getChecks().stream()
                .anyMatch(c -> "warn".equals(c.getStatus()) && c.getName().contains("version")));
    }

    @Test
    void parse_emptyKey_throws() {
        assertThrows(BusinessException.class, () -> service.parse(""));
    }

    @Test
    void parse_missingFile_throws() {
        when(storage.exists("missing")).thenReturn(false);
        assertThrows(BusinessException.class, () -> service.parse("missing"));
    }

    // ---------- helpers ----------

    private void wire(String key, byte[] data) throws IOException {
        when(storage.exists(key)).thenReturn(true);
        when(storage.size(key)).thenReturn((long) data.length);
        when(storage.openStream(key))
                .thenAnswer(inv -> new ByteArrayInputStream(data))
                .thenAnswer(inv -> new ByteArrayInputStream(data));
    }

    private static byte[] makeZip(Map<String, byte[]> files) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(baos)) {
            for (Map.Entry<String, byte[]> e : files.entrySet()) {
                ZipEntry ze = new ZipEntry(e.getKey());
                zos.putNextEntry(ze);
                zos.write(e.getValue());
                zos.closeEntry();
            }
        }
        return baos.toByteArray();
    }
}
