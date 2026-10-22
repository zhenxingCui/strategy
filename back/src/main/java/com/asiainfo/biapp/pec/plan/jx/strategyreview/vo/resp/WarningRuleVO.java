package com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

/**
 * 预警规则（列表行/详情共用）
 */
@Data
@ApiModel("预警规则")
public class WarningRuleVO {

    @ApiModelProperty("规则ID")
    private Long id;

    @ApiModelProperty("规则名称")
    private String ruleName;

    @ApiModelProperty("规则描述")
    private String desc;

    @ApiModelProperty("规则状态：生效中/已过期/已停用")
    private String status;

    @ApiModelProperty("状态徽标类型：success=生效中，gray=已过期/已停用")
    private String statusType;

    @ApiModelProperty("生效日期区间，如 2026-08-01 ~ 2026-08-31")
    private String dateRange;

    @ApiModelProperty("生效起始日 yyyy-MM-dd")
    private String startDate;

    @ApiModelProperty("生效结束日 yyyy-MM-dd")
    private String endDate;

    @ApiModelProperty("数据日期 yyyy-MM-dd")
    private String dataStartDate;

    @ApiModelProperty("数据日期 yyyy-MM-dd")
    private String dataEndDate;

    @ApiModelProperty("创建人展示，如 08-15 创建")
    private String creator;

    @ApiModelProperty("创建人账号")
    private String createBy;

    @ApiModelProperty("创建时间 yyyy-MM-dd HH:mm:ss")
    private String createTime;

    @ApiModelProperty("当期命中策略数（仅生效中规则统计）")
    private Long hitCount;

    @ApiModelProperty("适用触点渠道编码集合，空=全部渠道")
    private List<String> channels;

    @ApiModelProperty("适用触点渠道名称集合")
    private List<String> channelNames;

    @ApiModelProperty("适用策略ID集合，空=全部策略")
    private List<String> strategies;

    @ApiModelProperty("条件间逻辑关系：and/or")
    private String logic;

    @ApiModelProperty("预警条件列表")
    private List<WarningRuleConditionVO> conditions;

    /** 适用渠道原始串（逗号分隔，数据库存储值，仅后端转换用） */
    @com.fasterxml.jackson.annotation.JsonIgnore
    private String channelsStr;

    /** 适用策略原始串（逗号分隔，数据库存储值，仅后端转换用） */
    @com.fasterxml.jackson.annotation.JsonIgnore
    private String strategiesStr;

    /**
     * 预警条件项
     */
    @Data
    @ApiModel("预警条件项")
    public static class WarningRuleConditionVO {

        @ApiModelProperty("指标编码")
        private String metricCode;

        @ApiModelProperty("指标名称")
        private String metricName;

        @ApiModelProperty("比较符：gte/lte/gt/lt/eq")
        private String operator;

        @ApiModelProperty("阈值")
        private BigDecimal threshold;

        @ApiModelProperty("单位")
        private String unit;

        @ApiModelProperty("展示顺序")
        private Integer sortNo;
    }
}
