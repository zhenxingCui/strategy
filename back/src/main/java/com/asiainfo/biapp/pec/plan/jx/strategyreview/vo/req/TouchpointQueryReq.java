package com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;

import javax.validation.constraints.NotBlank;

/**
 * 策略触点执行情况查询请求（渠道汇总/策略列表/渠道产能趋势/渠道业务产能/策略分类汇总）
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ApiModel("策略触点执行情况查询请求")
public class TouchpointQueryReq extends BaseRegionReq {

    @ApiModelProperty(value = "策略类型：active/passive/control", required = true)
    @NotBlank(message = "策略类型tabType不能为空")
    private String tabType;

    @ApiModelProperty(value = "账期月份，格式 yyyy-MM", example = "2026-08")
    private String statMonth;

    @ApiModelProperty(value = "触点渠道名称（dim.keyName），空=全部渠道")
    private String channel;

    @ApiModelProperty("策略分类：升接/稳/降拆/离/重点客群，空=全部")
    private String strategyClass;

    @ApiModelProperty(value = "业务大类")
    private String bigCategory;

    @ApiModelProperty(value = "业务小类")
    private String smallCategory;

    @ApiModelProperty(value = "策略名称，模糊查询")
    private String strategyName;

    @ApiModelProperty(value = "页码，从1开始", example = "1")
    private Integer pageNum = 1;

    @ApiModelProperty(value = "每页条数", example = "10")
    private Integer pageSize = 10;

    @ApiModelProperty(value = "排序字段（响应字段名，驼峰）")
    private String sortField;

    @ApiModelProperty(value = "排序方向：asc/desc")
    private String sortDir;
    @ApiModelProperty("重点客群分类名称，空=全部客群；仅存量重点客群生效")
    private String customerGroup;

    public String getCustomerGroup() {
        return "active".equals(tabType) && "重点客群".equals(strategyClass)
                && customerGroup != null && !customerGroup.trim().isEmpty() ? customerGroup.trim() : null;
    }
    @ApiModelProperty("重点产品名称，匹配control事实表small_category；空=全部产品，仅control生效")
    private String productName;

    public String getProductName() {
        return "control".equals(tabType) && productName != null && !productName.trim().isEmpty()
                ? productName.trim() : null;
    }
}
