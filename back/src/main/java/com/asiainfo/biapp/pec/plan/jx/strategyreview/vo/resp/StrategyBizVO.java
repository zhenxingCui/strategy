package com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 策略业务产能行（分页）
 */
@Data
@ApiModel("策略业务产能行")
public class StrategyBizVO {

    @ApiModelProperty("业务编码")
    private String bizCode;

    @ApiModelProperty("业务名称")
    private String bizName;

    @ApiModelProperty("办理量（产能）")
    private BigDecimal count;

    @ApiModelProperty("环比 %")
    private BigDecimal momRatio;

    @ApiModelProperty("同比 %")
    private BigDecimal yoyRatio;
}
