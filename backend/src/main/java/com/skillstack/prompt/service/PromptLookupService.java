package com.skillstack.prompt.service;

import com.skillstack.common.exception.BusinessException;
import com.skillstack.prompt.entity.Prompt;
import com.skillstack.prompt.entity.PromptVersion;
import com.skillstack.prompt.mapper.PromptMapper;
import com.skillstack.prompt.mapper.PromptVersionMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class PromptLookupService implements PromptResolveService.PromptLookup {

    private final PromptMapper promptMapper;
    private final PromptVersionMapper versionMapper;

    @Override
    public PromptResolveService.PromptSnapshot latestApproved(String teamSlug, String promptSlug) {
        Prompt prompt = promptMapper.selectByTeamSlugAndSlug(teamSlug, promptSlug);
        if (prompt == null || !"APPROVED".equals(prompt.getStatus())) {
            throw new BusinessException(40400, "Prompt 不存在或尚无审核版本: " + teamSlug + "/" + promptSlug);
        }
        PromptVersion version = prompt.getCurrentVersionId() == null
                ? null
                : versionMapper.selectById(prompt.getCurrentVersionId());
        if (version == null) {
            throw new BusinessException(40400, "Prompt 尚无审核版本: " + teamSlug + "/" + promptSlug);
        }
        return new PromptResolveService.PromptSnapshot(teamSlug, prompt, version);
    }
}
