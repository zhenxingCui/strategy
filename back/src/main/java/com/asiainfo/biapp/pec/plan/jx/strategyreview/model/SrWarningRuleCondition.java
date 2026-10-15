package com.asiainfo.biapp.pec.plan.jx.strategyreview.model;

import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

/**
 * 预警规则条件子表（新增表）
 * 对应表：t_sr_warning_rule_condition
 */
@Data
public class SrWarningRuleCondition {

    /** 主键 */
    private Long id;

    /** 规则ID（t_sr_warning_rule.id） */
    private Long ruleId;

    /** 指标编码 */
    private String metricCode;

    /** 指标名称（冗余） */
    private String metricName;

    /** 比较符：gte/lte/gt/lt/eq */
    private String operator;

    /** 阈值 */
    private BigDecimal threshold;

    /** 单位（冗余） */
    private String unit;

    /** 展示顺序 */
    private Integer sortNo;

    /** 创建时间 */
    private Date createTime;

    /** 更新时间 */
    private Date updateTime;

    /** 逻辑删除：0=未删 1=已删 */
    private Integer isDeleted;
}
