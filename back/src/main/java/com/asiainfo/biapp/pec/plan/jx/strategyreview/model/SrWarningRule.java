package com.asiainfo.biapp.pec.plan.jx.strategyreview.model;

import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

/**
 * 预警规则主表（按 API.md 5.x 扩展后的结构）
 * 对应表：t_sr_warning_rule（扩展 DDL 见 resources/sql/strategy_review_warning_ext.sql）
 */
@Data
public class SrWarningRule {

    /** 主键 */
    private Long id;

    /** 规则名称 */
    private String ruleName;

    /** 规则描述（desc 为数据库保留字，列名 rule_desc） */
    private String ruleDesc;

    /** 策略类型：active/passive/control */
    private String tabType;

    /** 状态：生效中/已过期/已停用 */
    private String status;

    /** 生效起始日 */
    private Date startDate;

    /** 生效结束日 */
    private Date endDate;

    /** 数据日期 */
    private Date dataStartDate;

    /** 数据日期 */
    private Date dataEndDate;

    /** 适用触点渠道，逗号分隔，空=全部 */
    private String channels;

    /** 适用策略ID，逗号分隔，空=全部 */
    private String strategies;

    /** 条件间逻辑关系：and/or */
    private String logic;

    /** 创建人账号 */
    private String createBy;

    /** 创建人姓名 */
    private String creator;

    /** 创建时间 */
    private Date createTime;

    /** 更新时间 */
    private Date updateTime;

    /** 更新人 */
    private String updateBy;

    /** 逻辑删除：0=未删 1=已删 */
    private Integer isDeleted;

    /** 上月命中策略数（写表方维护，当前月取 t_sr_warning_hit 实时统计） */
    private BigDecimal hitCount;
}
