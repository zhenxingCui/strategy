package com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;

import javax.validation.constraints.NotBlank;

/**
 * 策略整体情况查询请求（KPI卡片/趋势）
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ApiModel("策略整体情况查询请求")
public class OverviewQueryReq extends BaseRegionReq {

    @ApiModelProperty(value = "策略类型：active/passive/control", required = true)
    @NotBlank(message = "策略类型tabType不能为空")
    private String tabType;

    @ApiModelProperty(value = "账期月份，格式 yyyy-MM，空则取最新有数据的账期", example = "2026-08")
    private String statMonth;

    @ApiModelProperty(value = "对比指标编码（t_sr_dim_metric.metric_code），仅 trend 接口使用")
    private String metricCode;

    @ApiModelProperty("触点渠道名称，空=全部渠道")
    private String channel;

    @ApiModelProperty("策略分类：升接/稳/降拆/离/重点客群，空=全部")
    private String strategyClass;
    @ApiModelProperty("重点客群分类名称，空=全部客群；仅存量重点客群生效")
    private String customerGroup;

    public String getCustomerGroup() {
        return "active".equals(tabType) && "重点客群".equals(strategyClass)
                && customerGroup != null && !customerGroup.trim().isEmpty() ? customerGroup.trim() : null;
    }
    @ApiModelProperty("重点产品名称，空=全部产品；仅control生效")
    private String productName;

    public String getProductName() {
        return "control".equals(tabType) && productName != null && !productName.trim().isEmpty()
                ? productName.trim() : null;
    }
}
