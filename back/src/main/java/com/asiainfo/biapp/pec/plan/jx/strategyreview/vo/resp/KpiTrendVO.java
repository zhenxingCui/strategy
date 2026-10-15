package com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

/**
 * 策略整体情况-KPI趋势（某指标近12个月的月度值与环比）
 * 用于柱+环比线双轴图，序列均为正序（1月→12月）
 */
@Data
@ApiModel("KPI趋势")
public class KpiTrendVO {

    @ApiModelProperty("月份标签，如 [\"1月\",\"2月\",...]")
    private List<String> months;

    @ApiModelProperty("近12个月月度值序列（正序，与 months 一一对应）")
    private List<BigDecimal> values;

    @ApiModelProperty("近12个月环比百分比序列（与 values 一一对应）")
    private List<BigDecimal> qoq;

    @ApiModelProperty("单位")
    private String unit;
}
