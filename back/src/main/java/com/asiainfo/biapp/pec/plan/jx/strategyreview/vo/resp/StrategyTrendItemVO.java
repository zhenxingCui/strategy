package com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 策略产能趋势查询行（t_sr_strategy_period_summary_* 单行，仅后端组装用）
 */
@Data
@ApiModel("策略产能趋势查询行")
public class StrategyTrendItemVO {

    @ApiModelProperty("账期月份 yyyy-MM")
    private String month;

    @ApiModelProperty("月度产能（active 升接/稳及 control=成功量，其余 active/passive=产品转化数）")
    private BigDecimal capacity;

    @ApiModelProperty("环比 %")
    private BigDecimal qoq;

    @ApiModelProperty("对比指标值（metricCode 对应）")
    private BigDecimal metricValue;
}
