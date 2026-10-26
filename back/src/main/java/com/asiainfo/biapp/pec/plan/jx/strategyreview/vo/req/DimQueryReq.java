package com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;

import javax.validation.constraints.NotBlank;

/**
 * 通用枚举查询请求（策略复盘-通用枚举）
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ApiModel("通用枚举查询请求")
public class DimQueryReq extends BaseRegionReq {

    @ApiModelProperty(value = "枚举类型：触点渠道/策略名称/预警指标/规则状态/客群分类/产品名称", required = true)
    @NotBlank(message = "枚举类型type不能为空")
    private String type;

    @ApiModelProperty(value = "策略类型：active/passive/control", required = true)
    @NotBlank(message = "策略类型tabType不能为空")
    private String tabType;

    @ApiModelProperty(value = "触点渠道名称（keyName），type=策略名称时用于过滤")
    private String channel;

    @ApiModelProperty(value = "搜索关键字，模糊匹配名称")
    private String keyword;

    private String strategyClass;
    @ApiModelProperty("统计月份yyyy-MM；触点渠道按当前月份的实际策略数据筛选")
    private String statMonth;
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
