package com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

/**
 * 策略基本信息
 */
@Data
@ApiModel("策略基本信息")
public class StrategyInfoVO {

    @ApiModelProperty("策略ID")
    private String strategyId;

    @ApiModelProperty("策略编码")
    private String strategyCode;

    @ApiModelProperty("策略名称（API响应字段，control 可为空）")
    private String name;

    @ApiModelProperty("策略名称（冗余，与 name 一致）")
    private String strategyName;

    @ApiModelProperty("策略级别：省级/市级/网格级")
    private String level;

    @ApiModelProperty("客群口径描述")
    private String caliber;

    @ApiModelProperty("迭代次数")
    private Integer iteration;

    @ApiModelProperty("创建时间 yyyy-MM-dd")
    private String createTime;

    @ApiModelProperty("责任人")
    private String owner;

    @ApiModelProperty("策略状态：进行中/已暂停/已结束")
    private String status;

    @ApiModelProperty("生效起始日 yyyy-MM-dd")
    private String startDate;

    @ApiModelProperty("生效结束日 yyyy-MM-dd")
    private String endDate;

    @ApiModelProperty("触点渠道编码")
    private String channel;

    @ApiModelProperty("触点渠道名称")
    private String channelName;

    @ApiModelProperty("业务大类")
    private String bigCategory;

    @ApiModelProperty("业务小类")
    private String smallCategory;
}
