package com.asiainfo.biapp.pec.plan.jx.strategyreview;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * 策略复盘与预警服务启动类
 */
@SpringBootApplication
@MapperScan("com.asiainfo.biapp.pec.plan.jx.strategyreview.mapper")
public class StrategyReviewApplication {

    public static void main(String[] args) {
        SpringApplication.run(StrategyReviewApplication.class, args);
    }
}