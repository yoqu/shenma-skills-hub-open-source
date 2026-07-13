package com.skillstack.token.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.skillstack.token.entity.PersonalAccessToken;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface PersonalAccessTokenMapper extends BaseMapper<PersonalAccessToken> {
}
