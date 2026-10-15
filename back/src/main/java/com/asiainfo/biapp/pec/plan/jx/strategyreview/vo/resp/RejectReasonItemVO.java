package com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

/**
 * 拒绝原因项（active 策略）
 */
@Data
@ApiModel("拒绝原因项")
public class RejectReasonItemVO {

    @ApiModelProperty("拒绝原因编码")
    private String reasonCode;

    @ApiModelProperty("拒绝原因名称，如：客群重叠/规则冲突/资源不足/用户不感兴趣/其他原因")
    private String reasonName;

    @ApiModelProperty("该原因拒绝量")
    private Long rejectCount;

    @ApiModelProperty("占比 %（所有原因合计=100）")
    private java.math.BigDecimal ratio;

    @ApiModelProperty("展示颜色，如 #F56C6C")
    private String color;
}
