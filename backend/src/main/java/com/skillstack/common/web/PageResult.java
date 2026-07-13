package com.skillstack.common.web;

import com.baomidou.mybatisplus.core.metadata.IPage;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PageResult<T> {
    private List<T> items;
    private long total;
    private long page;
    private long size;

    public static <T> PageResult<T> of(IPage<T> p) {
        return new PageResult<>(p.getRecords(), p.getTotal(), p.getCurrent(), p.getSize());
    }

    public static <T> PageResult<T> of(List<T> items, long total, long page, long size) {
        return new PageResult<>(items, total, page, size);
    }
}
