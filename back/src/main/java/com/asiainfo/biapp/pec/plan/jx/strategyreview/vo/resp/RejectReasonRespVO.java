package com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

/**
 * 拒绝原因响应（active 策略）
 */
@Data
@ApiModel("拒绝原因响应")
public class RejectReasonRespVO {

    @ApiModelProperty("整体拒绝率 %（环形图中心数值）")
    private BigDecimal rejectRate;

    @ApiModelProperty("拒绝率环比")
    private BigDecimal rejectRateQoQ;

    @ApiModelProperty("总拒绝量")
    private Long rejectCount;

    @ApiModelProperty("拒绝量环比")
    private BigDecimal rejectCountQoQ;

    @ApiModelProperty("拒绝原因分类列表")
    private List<RejectReasonItemVO> reasons;
}
