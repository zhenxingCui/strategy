package com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;

import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotEmpty;
import java.util.List;

/**
 * 预警规则新增/编辑请求
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ApiModel("预警规则新增/编辑请求")
public class WarningRuleSaveReq extends BaseRegionReq {

    @ApiModelProperty(value = "规则ID，编辑时必传，新增不传")
    private Long id;

    @ApiModelProperty(value = "策略类型：active/passive/control", required = true)
    @NotBlank(message = "策略类型tabType不能为空")
    private String tabType;

    @ApiModelProperty(value = "规则名称", required = true)
    @NotBlank(message = "规则名称ruleName不能为空")
    private String ruleName;

    @ApiModelProperty(value = "规则描述，空则后端按条件自动拼接")
    private String desc;

    @ApiModelProperty(value = "生效起始日，格式 yyyy-MM-dd", required = true)
    @NotBlank(message = "生效起始日startDate不能为空")
    private String startDate;

    @ApiModelProperty(value = "生效结束日，格式 yyyy-MM-dd", required = true)
    @NotBlank(message = "生效结束日endDate不能为空")
    private String endDate;

    @ApiModelProperty(value = "数据日期，格式 yyyy-MM-dd，一般为每月一日", required = true)
    @NotBlank(message = "数据日期dataDate不能为空")
    private String dataStartDate;

    @ApiModelProperty(value = "数据日期，格式 yyyy-MM-dd，一般为每月一日", required = true)
    @NotBlank(message = "数据日期dataDate不能为空")
    private String dataEndDate;

    @ApiModelProperty(value = "适用触点渠道，dim.keyCode数组，空=全部渠道")
    private List<String> channels;

    @ApiModelProperty(value = "适用策略ID数组，空=全部策略")
    private List<Long> strategies;

    @ApiModelProperty(value = "条件间逻辑关系：and/or，默认and")
    private String logic = "and";

    @ApiModelProperty(value = "预警条件列表", required = true)
    @NotEmpty(message = "预警条件conditions不能为空")
    @Valid
    private List<WarningConditionItem> conditions;

    @ApiModelProperty(value = "规则状态：生效中/已停用，默认生效中（编辑时原值返回什么就保存什么）")
    private String status;
}
