package com.skillstack.skill.controller;

import com.skillstack.common.web.ApiResponse;
import com.skillstack.skill.dto.CategoryItem;
import com.skillstack.skill.service.CategoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/categories")
@RequiredArgsConstructor
public class CategoryController {

    private final CategoryService categoryService;

    @GetMapping
    public ApiResponse<List<CategoryItem>> list() {
        return ApiResponse.ok(categoryService.listAll());
    }
}
