package com.skillstack.admin.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillstack.admin.entity.AdminAuditLog;
import com.skillstack.admin.mapper.AdminAuditLogMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AdminAuditLogMapper mapper;
    private static final ObjectMapper JSON = new ObjectMapper();

    public void record(Long actorId, String action, String targetType, Long targetId, Map<String, Object> payload) {
        try {
            AdminAuditLog row = new AdminAuditLog();
            row.setActorId(actorId);
            row.setAction(action);
            row.setTargetType(targetType);
            row.setTargetId(targetId);
            row.setPayloadJson(payload == null ? null : JSON.writeValueAsString(payload));
            mapper.insert(row);
        } catch (JsonProcessingException e) {
            log.warn("audit serialize failed: {}", e.getMessage());
        } catch (Exception e) {
            log.warn("audit insert failed: {}", e.getMessage());
        }
    }
}
