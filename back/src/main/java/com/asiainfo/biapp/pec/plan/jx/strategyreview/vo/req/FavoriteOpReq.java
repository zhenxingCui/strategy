package com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotEmpty;
import java.util.List;

/**
 * 收藏操作请求（批量收藏/批量取消/关注切换）
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ApiModel("收藏操作请求")
public class FavoriteOpReq extends BaseRegionReq {

    @ApiModelProperty(value = "策略类型：active/passive/control", required = true)
    @NotBlank(message = "策略类型tabType不能为空")
    private String tabType;

    @ApiModelProperty(value = "规则 id 预警规则收藏使用")
    private String ruleId;

    @ApiModelProperty(value = "策略ID集合", required = true)
    @NotEmpty(message = "策略ID集合strategyIds不能为空")
    private List<String> strategyIds;

    @ApiModelProperty(value = "是否关注：true=关注并加入收藏，false=取消关注并移出收藏（仅关注切换接口使用）")
    private Boolean followed;
}
