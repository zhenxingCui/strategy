package com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

/**
 * 预警规则简单操作请求（删除/详情/状态变更）
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ApiModel("预警规则简单操作请求")
public class WarningRuleOpReq extends BaseRegionReq {

    @ApiModelProperty(value = "规则ID（t_sr_warning_rule.id）", required = true)
    @NotNull(message = "规则ID id 不能为空")
    private Long id;

    @ApiModelProperty(value = "目标状态：生效中/已停用（仅状态变更接口使用）")
    private String status;

    @ApiModelProperty(value = "页面范围，例如 active:重点客群", required = true)
    @NotBlank(message = "页面范围pageScope不能为空")
    private String pageScope;
}
