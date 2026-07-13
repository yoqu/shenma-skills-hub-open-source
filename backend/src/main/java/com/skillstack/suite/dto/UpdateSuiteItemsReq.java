package com.skillstack.suite.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

/** 更新套件内部 skill 列表(整体替换 + 排序)。 */
@Data
public class UpdateSuiteItemsReq {

    @NotNull
    @Valid
    private List<Item> items;

    @Data
    public static class Item {
        /** SKILL / PROMPT；为空按 SKILL 兼容。 */
        private String type;
        private Long skillId;
        private Long itemId;
        @NotNull
        private Integer position;
    }
}
