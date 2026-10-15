package com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

/**
 * 策略产能趋势（近6个月，柱+环比线双轴图）
 */
@Data
@ApiModel("策略产能趋势")
public class StrategyTrendVO {

    @ApiModelProperty("月份标签，如 [\"2月\",\"3月\",...\"7月\"]")
    private List<String> months;

    @ApiModelProperty("月度产能值（active/passive=全产品转化量，control=成功量）")
    private List<BigDecimal> capacity;

    @ApiModelProperty("月度环比 % 序列（与 months 一一对应）")
    private List<BigDecimal> qoq;

    @ApiModelProperty("当前展示指标名称（可选）")
    private String metric;

    @ApiModelProperty("单位（可选）")
    private String unit;
}
