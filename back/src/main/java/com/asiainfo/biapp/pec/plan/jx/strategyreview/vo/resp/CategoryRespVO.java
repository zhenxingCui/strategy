package com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

/**
 * 策略分类汇总行（按策略大类+小类聚合，active/passive 与 control 共用）
 */
@Data
@ApiModel("策略分类汇总行")
public class CategoryRespVO {
    @ApiModelProperty("策略分类汇细行")

    private List<CategoryRowVO> list;
    @ApiModelProperty("策略分类合计行")
    private CategoryRowVO  calculate;

}
