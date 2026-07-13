package com.skillstack;

import com.skillstack.common.config.DotenvApplicationContextInitializer;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;

@SpringBootApplication
@MapperScan("com.skillstack.**.mapper")
public class SkillStackApplication {
    public static void main(String[] args) {
        new SpringApplicationBuilder(SkillStackApplication.class)
                .initializers(new DotenvApplicationContextInitializer())
                .run(args);
    }
}
