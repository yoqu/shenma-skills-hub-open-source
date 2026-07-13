package com.skillstack.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CliWebInfoRes {
    /** Web 站点根 URL，例如 http://localhost:5173 */
    private String webBaseUrl;
    /** 用户复制 token 的页面相对路径 */
    private String tokenPagePath;
    /** Web 授权页面相对路径（带 code 查询参数） */
    private String verifyPagePath;
}
