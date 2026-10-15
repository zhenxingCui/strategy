package com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.math.BigDecimal;

/**
 * KPI趋势查询行（t_sr_kpi_summary 长表单行，仅后端组装用）
 */
@Data
@ApiModel("KPI趋势查询行")
public class KpiTrendItemVO {

    @ApiModelProperty("账期月份 yyyyMM")
    private String month;

    @ApiModelProperty("月度值")
    private BigDecimal value;

    @ApiModelProperty("环比百分比")
    private BigDecimal qoq;

    @ApiModelProperty("单位")
    private String unit;
}
