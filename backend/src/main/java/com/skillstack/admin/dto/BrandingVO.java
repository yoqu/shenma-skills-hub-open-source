package com.skillstack.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BrandingVO {
    private String name;
    private String tagline;
    private String logoUrl;
    private String footer;
}
