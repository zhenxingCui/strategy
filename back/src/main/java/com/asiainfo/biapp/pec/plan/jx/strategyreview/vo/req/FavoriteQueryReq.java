package com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;

import javax.validation.constraints.NotBlank;

/**
 * 收藏列表查询请求
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ApiModel("收藏列表查询请求")
public class FavoriteQueryReq extends BaseRegionReq {

    @ApiModelProperty(value = "策略类型：active/passive/control", required = true)
    @NotBlank(message = "策略类型tabType不能为空")
    private String tabType;

    @ApiModelProperty(value = "账期月份，格式 yyyy-MM", example = "2026-08")
    private String statMonth;

    @ApiModelProperty("仅查询手动收藏（含同时规则关注的策略），默认false")
    private Boolean manualOnly = false;

    @ApiModelProperty("触点渠道名称，空=全部")
    private String channel;

    @ApiModelProperty("策略名称，模糊查询")
    private String strategyName;

    @ApiModelProperty("策略分类，空=全部")
    private String strategyClass;

    @ApiModelProperty(value = "页码，从1开始", example = "1")
    private Integer pageNum = 1;

    @ApiModelProperty(value = "每页条数", example = "10")
    private Integer pageSize = 10;
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
