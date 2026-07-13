package com.skillstack.skill.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CategoryItem {
    /** code: all / dev / data ... */
    private String id;
    private String name;
    private Integer count;
}
