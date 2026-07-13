package com.skillstack.auth.oauth.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.skillstack.auth.oauth.entity.UserOAuthIdentity;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface UserOAuthIdentityMapper extends BaseMapper<UserOAuthIdentity> {
}
