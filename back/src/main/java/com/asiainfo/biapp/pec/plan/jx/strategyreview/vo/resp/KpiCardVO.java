package com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 策略整体情况-KPI卡片（数组元素，对应 t_sr_kpi_summary 长表一行）
 * 数值与环比/同比均由写表方写入，后端不做计算
 */
@Data
@ApiModel("KPI卡片")
public class KpiCardVO {

    @ApiModelProperty("指标编码，如 strategy_count/push_count")
    private String metricCode;

    @ApiModelProperty("指标名称，如「策略数」「推送量」")
    private String label;

    @ApiModelProperty("当期值（前端按 unit 格式化）")
    private BigDecimal value;

    @ApiModelProperty("单位：个/%/元/万/万元")
    private String unit;

    @ApiModelProperty("环比百分比，正升负降；百分比类指标存 pp 差")
    private BigDecimal trendQoQ;

    @ApiModelProperty("同比百分比，正升负降；百分比类指标存 pp 差")
    private BigDecimal trendYoY;

    @ApiModelProperty("图标标识：grid/send/user-check/eye/trending/percent/dollar，control 补充：chat/star/document/check/coin")
    private String icon;

    @ApiModelProperty("排序号")
    private Integer sortNo;
}
