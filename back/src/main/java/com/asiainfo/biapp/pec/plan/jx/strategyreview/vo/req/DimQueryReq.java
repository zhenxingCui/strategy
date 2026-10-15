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

    @ApiModelProperty(value = "枚举类型：触点渠道/策略名称/预警指标/规则状态", required = true)
    @NotBlank(message = "枚举类型type不能为空")
    private String type;

    @ApiModelProperty(value = "策略类型：active/passive/control", required = true)
    @NotBlank(message = "策略类型tabType不能为空")
    private String tabType;

    @ApiModelProperty(value = "触点渠道编码（keyCode），type=策略名称时用于过滤")
    private String channel;

    @ApiModelProperty(value = "搜索关键字，模糊匹配名称")
    private String keyword;
}
