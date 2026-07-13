package com.skillstack.admin.service;

import com.skillstack.admin.dto.AdminTeamDetailVO;
import com.skillstack.common.exception.BusinessException;
import com.skillstack.team.entity.Team;
import com.skillstack.team.mapper.TeamMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 覆盖 {@link AdminTeamService#updateBasic(Long, String, String)}：
 * 只改 name 时 slug 不变；slug 命中其他团队时抛业务异常。
 *
 * <p>使用动态创建的两条 team 数据，避免依赖 seed 中的固定 id（提高与并行/seed 变更的鲁棒性）。</p>
 */
@SpringBootTest
@Transactional
class AdminTeamServicePatchTest {

    @Autowired AdminTeamService svc;
    @Autowired TeamMapper teamMapper;

    private Long teamId;
    private Long otherTeamId;
    private String otherSlug;

    @BeforeEach
    void setup() {
        Team a = new Team();
        long n = System.nanoTime();
        a.setSlug("patch-a-" + n);
        a.setName("Patch A");
        a.setMembersCount(0);
        teamMapper.insert(a);
        teamId = a.getId();

        Team b = new Team();
        b.setSlug("patch-b-" + (n + 1));
        b.setName("Patch B");
        b.setMembersCount(0);
        teamMapper.insert(b);
        otherTeamId = b.getId();
        otherSlug = b.getSlug();
    }

    @Test
    void update_basic_name_only() {
        AdminTeamDetailVO before = svc.detail(teamId);
        svc.updateBasic(teamId, "Renamed Team", null);
        AdminTeamDetailVO after = svc.detail(teamId);
        assertEquals("Renamed Team", after.getName());
        assertEquals(before.getSlug(), after.getSlug()); // slug 不变
    }

    @Test
    void update_basic_slug_conflict() {
        BusinessException ex = assertThrows(BusinessException.class,
                () -> svc.updateBasic(teamId, null, otherSlug));
        assertEquals(40901, ex.getCode());
    }
}
