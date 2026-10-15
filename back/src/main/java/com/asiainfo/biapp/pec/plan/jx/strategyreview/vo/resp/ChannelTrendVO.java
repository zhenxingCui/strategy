package com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 渠道产能趋势行（近6个月）
 */
@Data
@ApiModel("渠道产能趋势行")
public class ChannelTrendVO {

    @ApiModelProperty("账期月份 yyyy-MM")
    private String month;

    @ApiModelProperty("月度标签，如 8月")
    private String monthLabel;

    @ApiModelProperty("月产能（active/passive=全产品转化量，control=成功量）")
    private BigDecimal capacity;

    @ApiModelProperty("环比 %")
    private BigDecimal qoq;
}
