package com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 策略执行明细-日粒度行（active/passive 与 control 共用，非本类型字段为空）
 */
@Data
@ApiModel("策略日粒度明细行")
public class StrategyDailyVO {

    @ApiModelProperty("统计日期 yyyy-MM-dd")
    private String date;

    @ApiModelProperty("策略大类（active/passive）/ 场景大类（control）")
    private String bigCategory;

    @ApiModelProperty("策略小类（active/passive）/ 场景小类（control）")
    private String smallCategory;

    @ApiModelProperty("策略名称（API响应字段，control 可为空）")
    private String name;

    @ApiModelProperty("策略名称（冗余，与 name 一致）")
    private String strategyName;

    @ApiModelProperty("策略分类：升接/稳/降拆/离/重点客群")
    private String strategyClass;

    // ============ active/passive 指标 ============
    @ApiModelProperty("原始客群")
    private Long originalCust;

    @ApiModelProperty("推送量")
    private Long pushCount;

    @ApiModelProperty("使用量")
    private Long usageCount;

    @ApiModelProperty("使用率 %")
    private BigDecimal usageRate;

    @ApiModelProperty("触达量")
    private Long reachCount;

    @ApiModelProperty("目标转化量")
    private Long targetConvNum;

    @ApiModelProperty("目标转化率 %")
    private BigDecimal targetConvRate;

    @ApiModelProperty("全产品转化量")
    private Long productConvNum;

    @ApiModelProperty("全产品转化率 %")
    private BigDecimal productConvRate;

    @ApiModelProperty("预期收入（元）")
    private BigDecimal expectedIncome;

    @ApiModelProperty("实际收入（元）")
    private BigDecimal actualIncome;

    @ApiModelProperty("拒绝量（active）")
    private Long rejectCount;

    @ApiModelProperty("拒绝率 %（active）")
    private BigDecimal rejectRate;

    // ============ control 指标 ============
    @ApiModelProperty("咨询量")
    private Long consultCount;

    @ApiModelProperty("挽留量")
    private Long retainCount;

    @ApiModelProperty("挽留率 %")
    private BigDecimal retainRate;

    @ApiModelProperty("派单量")
    private Long dispatchCount;

    @ApiModelProperty("成功量")
    private Long successCount;

    @ApiModelProperty("成功率 %")
    private BigDecimal successRate;
}
