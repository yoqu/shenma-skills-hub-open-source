package com.skillstack.common.web;

import lombok.Data;

@Data
public class PageQuery {
    private long page = 1;
    private long size = 20;

    public long getOffset() {
        return Math.max(0, (page - 1) * size);
    }
}
