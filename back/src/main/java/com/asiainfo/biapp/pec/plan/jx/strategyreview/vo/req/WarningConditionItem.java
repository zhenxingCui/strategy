package com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.math.BigDecimal;

/**
 * 预警规则条件项
 */
@Data
@ApiModel("预警规则条件项")
public class WarningConditionItem {

    @ApiModelProperty(value = "指标编码（t_sr_dim_metric.metric_code）", required = true)
    @NotBlank(message = "指标编码metricCode不能为空")
    private String metricCode;

    @ApiModelProperty(value = "指标名称（冗余存储，用于展示）", required = true)
    @NotBlank(message = "指标名称metricName不能为空")
    private String metricName;

    @ApiModelProperty(value = "比较符：gte/lte/gt/lt/eq", required = true)
    @NotBlank(message = "比较符operator不能为空")
    private String operator;

    @ApiModelProperty(value = "阈值", required = true)
    @NotNull(message = "阈值threshold不能为空")
    private BigDecimal threshold;

    @ApiModelProperty(value = "单位（冗余存储）")
    private String unit;
}
