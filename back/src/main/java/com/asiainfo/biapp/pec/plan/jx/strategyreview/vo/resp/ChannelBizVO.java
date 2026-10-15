package com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 渠道业务产能行
 */
@Data
@ApiModel("渠道业务产能行")
public class ChannelBizVO {

    @ApiModelProperty("业务大类")
    private String bigCategory;

    @ApiModelProperty("业务小类")
    private String smallCategory;

    @ApiModelProperty("业务名称（如靓号推荐、家庭融合、宽带新装等）")
    private String bizName;

    @ApiModelProperty("周期内产能（active/passive=全产品转化量，control=成功量）")
    private BigDecimal capacity;

    @ApiModelProperty("环比 %")
    private BigDecimal qoq;
}
