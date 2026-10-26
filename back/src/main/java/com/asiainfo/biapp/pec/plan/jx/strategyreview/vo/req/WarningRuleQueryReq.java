package com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;

import javax.validation.constraints.NotBlank;

/**
 * 历史预警规则查询请求（规则列表/命中策略列表）
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ApiModel("历史预警规则查询请求")
public class WarningRuleQueryReq extends BaseRegionReq {

    @ApiModelProperty(value = "策略类型：active/passive/control", required = true)
    @NotBlank(message = "策略类型tabType不能为空")
    private String tabType;

    @ApiModelProperty(value = "规则名称，模糊查询")
    private String ruleName;

    @ApiModelProperty(value = "规则状态：生效中/已过期/已停用")
    private String status;

    @ApiModelProperty(value = "规则ID（t_sr_warning_rule.id），命中策略列表使用")
    private Long ruleId;

    @ApiModelProperty(value = "预警策略收藏标识不为空则为收藏查询")
    private String favorite;

    @ApiModelProperty("触点渠道名称，空=全部渠道")
    private String channel;

    @ApiModelProperty("策略分类：升接/稳/降拆/离/重点客群，空=全部")
    private String strategyClass;

    @ApiModelProperty(value = "页面范围，例如 active:重点客群", required = true)
    @NotBlank(message = "页面范围pageScope不能为空")
    private String pageScope;

    @ApiModelProperty(value = "用户编码，按创建人过滤")
    private String userCode;

    @ApiModelProperty(value = "账期月份，格式 yyyy-MM，命中策略列表使用", example = "2026-08")
    private String statMonth;

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
    @ApiModelProperty("重点产品名称，匹配control事实表small_category；空=全部产品，仅control生效")
    private String productName;

    public String getProductName() {
        return "control".equals(tabType) && productName != null && !productName.trim().isEmpty()
                ? productName.trim() : null;
    }
}
