package com.skillstack.skill.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.skillstack.skill.dto.CategoryItem;
import com.skillstack.skill.entity.Category;
import com.skillstack.skill.mapper.CategoryMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CategoryService {

    private final CategoryMapper categoryMapper;

    public List<CategoryItem> listAll() {
        List<Category> rows = categoryMapper.selectList(
                Wrappers.<Category>lambdaQuery().orderByAsc(Category::getSort)
        );
        return rows.stream()
                .map(c -> CategoryItem.builder()
                        .id(c.getCode())
                        .name(c.getName())
                        .count(c.getCount())
                        .build())
                .toList();
    }

    public Category findByCode(String code) {
        return categoryMapper.selectOne(
                Wrappers.<Category>lambdaQuery().eq(Category::getCode, code)
        );
    }
}
