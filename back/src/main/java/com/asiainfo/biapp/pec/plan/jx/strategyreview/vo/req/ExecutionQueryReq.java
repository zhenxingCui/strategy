package com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

/**
 * 策略执行明细查询请求（策略信息/产能趋势/业务产能/日粒度明细/拒绝原因）
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ApiModel("策略执行明细查询请求")
public class ExecutionQueryReq extends BaseRegionReq {

    @ApiModelProperty(value = "策略类型：active/passive/control", required = true)
    @NotBlank(message = "策略类型tabType不能为空")
    private String tabType;

    @ApiModelProperty(value = "策略ID（t_sr_strategy.id）")
    private String strategyId;

    @ApiModelProperty(value = "账期月份，格式 yyyy-MM", example = "2026-08")
    private String statMonth;

    @ApiModelProperty(value = "产能趋势对比指标编码：originalCust/pushCount/usageCount/reachCount/targetConvNum/productConvNum/expectedIncome/actualIncome（active/passive），consultCount/retainCount/dispatchCount/successCount/income（control）")
    private String metricCode;

    @ApiModelProperty(value = "开始日期，格式 yyyy-MM-dd（仅日粒度明细使用）")
    private String startDate;

    @ApiModelProperty(value = "结束日期，格式 yyyy-MM-dd（仅日粒度明细使用）")
    private String endDate;

    @ApiModelProperty(value = "页码，从1开始", example = "1")
    private Integer pageNum = 1;

    @ApiModelProperty(value = "每页条数", example = "10")
    private Integer pageSize = 10;
}
