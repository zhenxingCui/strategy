package com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.util.List;

/**
 * 渠道执行汇总响应（列表 + 合计行）
 */
@Data
@ApiModel("渠道执行汇总响应")
public class ChannelSummaryRespVO {

    @ApiModelProperty("渠道明细行")
    private List<ChannelSummaryRowVO> list;

    @ApiModelProperty("合计行（channel/channelName 为空）")
    private ChannelSummaryRowVO calculate;
}
