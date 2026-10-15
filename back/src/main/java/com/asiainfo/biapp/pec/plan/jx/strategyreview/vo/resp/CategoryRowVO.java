package com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 策略分类汇总行（按策略大类+小类聚合，active/passive 与 control 共用）
 */
@Data
@ApiModel("策略分类汇总行")
public class CategoryRowVO {

    @ApiModelProperty("策略大类（active/passive）/ 场景大类（control）")
    private String bigCategory;

    @ApiModelProperty("策略小类（active/passive）/ 场景小类（control）")
    private String smallCategory;

    @ApiModelProperty("策略量")
    private Long strategyCount;

    @ApiModelProperty("策略量环比 %（聚合行不计算，可为空）")
    private BigDecimal strategyCountQoQ;

    // ============ active/passive 指标 ============
    @ApiModelProperty("原始客群")
    private Long originalCust;

    @ApiModelProperty("原始客群环比 %")
    private BigDecimal originalCustQoQ;

    @ApiModelProperty("推送量")
    private Long pushCount;

    @ApiModelProperty("推送量环比 %")
    private BigDecimal pushCountQoQ;

    @ApiModelProperty("使用量")
    private Long usageCount;

    @ApiModelProperty("使用量环比 %")
    private BigDecimal usageCountQoQ;

    @ApiModelProperty("使用率 %")
    private BigDecimal usageRate;

    @ApiModelProperty("使用率环比 pp")
    private BigDecimal usageRateQoQ;

    @ApiModelProperty("触达量")
    private Long reachCount;

    @ApiModelProperty("触达量环比 %")
    private BigDecimal reachCountQoQ;

    @ApiModelProperty("目标转化量")
    private Long targetConvNum;

    @ApiModelProperty("目标转化量环比 %")
    private BigDecimal targetConvNumQoQ;

    @ApiModelProperty("目标转化率 %")
    private BigDecimal targetConvRate;

    @ApiModelProperty("目标转化率环比 pp")
    private BigDecimal targetConvRateQoQ;

    @ApiModelProperty("全产品转化量")
    private Long productConvNum;

    @ApiModelProperty("全产品转化量环比 %")
    private BigDecimal productConvNumQoQ;

    @ApiModelProperty("全产品转化率 %")
    private BigDecimal productConvRate;

    @ApiModelProperty("全产品转化率环比 pp")
    private BigDecimal productConvRateQoQ;

    @ApiModelProperty("预期收入（元）")
    private BigDecimal expectedIncome;

    @ApiModelProperty("预期收入环比 %")
    private BigDecimal expectedIncomeQoQ;

    @ApiModelProperty("实际收入（元）")
    private BigDecimal actualIncome;

    @ApiModelProperty("实际收入环比 %")
    private BigDecimal actualIncomeQoQ;

    @ApiModelProperty("拒绝率 %（active）")
    private BigDecimal rejectRate;

    @ApiModelProperty("拒绝量（active）")
    private Long rejectCount;

    // ============ control 指标 ============
    @ApiModelProperty("咨询量")
    private Long consultCount;

    @ApiModelProperty("咨询量环比 %")
    private BigDecimal consultCountQoQ;

    @ApiModelProperty("挽留量")
    private Long retainCount;

    @ApiModelProperty("挽留量环比 %")
    private BigDecimal retainCountQoQ;

    @ApiModelProperty("挽留率 %")
    private BigDecimal retainRate;

    @ApiModelProperty("挽留率环比 pp")
    private BigDecimal retainRateQoQ;

    @ApiModelProperty("派单量")
    private Long dispatchCount;

    @ApiModelProperty("派单量环比 %")
    private BigDecimal dispatchCountQoQ;

    @ApiModelProperty("成功量")
    private Long successCount;

    @ApiModelProperty("成功量环比 %")
    private BigDecimal successCountQoQ;

    @ApiModelProperty("成功率 %")
    private BigDecimal successRate;

    @ApiModelProperty("成功率环比 pp")
    private BigDecimal successRateQoQ;

    @ApiModelProperty("收入（元）")
    private BigDecimal income;

    @ApiModelProperty("收入环比 %")
    private BigDecimal incomeQoQ;
}
