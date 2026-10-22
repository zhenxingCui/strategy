package com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

/**
 * 策略行（复用于：3.2 策略列表 / 5.7 命中策略列表 / 6.3 收藏列表）
 * 说明：active/passive 与 control 共用，非本类型指标字段返回空；
 *      id 在命中列表场景=命中记录ID，在收藏列表场景=收藏记录ID，策略列表场景为空。
 */
@Data
@ApiModel("策略行")
public class StrategyRowVO {

    @ApiModelProperty("记录ID（命中列表=命中记录ID，收藏列表=收藏记录ID）")
    private Long id;

    @ApiModelProperty("策略ID")
    private String strategyId;

    @ApiModelProperty("策略编码（control 场景）")
    private String strategyCode;

    @ApiModelProperty("策略名称（control 不返回）")
    private String strategyName;

    @ApiModelProperty("策略分类：UPSELL/STABLE/DOWNGRADE/CHURN")
    private String strategyClass;

    @ApiModelProperty("触点渠道编码")
    private String channel;

    @ApiModelProperty("触点渠道名称")
    private String channelName;

    @ApiModelProperty("业务大类")
    private String bigCategory;

    @ApiModelProperty("业务小类")
    private String smallCategory;

    // ============ active/passive 指标 ============
    @ApiModelProperty("覆盖客户数")
    private Long originalCust;

    @ApiModelProperty("覆盖客户数环比 %")
    private BigDecimal originalCustQoQ;

    @ApiModelProperty("推送量")
    private Long pushCount;

    @ApiModelProperty("推送量环比 %")
    private BigDecimal pushCountQoQ;

    @ApiModelProperty("触达量")
    private Long usageCount;

    @ApiModelProperty("触达量环比 %")
    private BigDecimal usageCountQoQ;

    @ApiModelProperty("触达率 %")
    private BigDecimal usageRate;

    @ApiModelProperty("触达率环比 pp")
    private BigDecimal usageRateQoQ;

    @ApiModelProperty("转化客户数")
    private Long reachCount;

    @ApiModelProperty("转化客户数环比 %")
    private BigDecimal reachCountQoQ;

    @ApiModelProperty("目标转化数")
    private Long targetConvNum;

    @ApiModelProperty("目标转化数环比 %")
    private BigDecimal targetConvNumQoQ;

    @ApiModelProperty("目标转化率 %")
    private BigDecimal targetConvRate;

    @ApiModelProperty("目标转化率环比 pp")
    private BigDecimal targetConvRateQoQ;

    @ApiModelProperty("产品转化数")
    private Long productConvNum;

    @ApiModelProperty("产品转化数环比 %")
    private BigDecimal productConvNumQoQ;

    @ApiModelProperty("产品转化率 %")
    private BigDecimal productConvRate;

    @ApiModelProperty("产品转化率环比 pp")
    private BigDecimal productConvRateQoQ;

    @ApiModelProperty("预计收益")
    private BigDecimal expectedIncome;

    @ApiModelProperty("预计收益环比 %")
    private BigDecimal expectedIncomeQoQ;

    @ApiModelProperty("实际收益")
    private BigDecimal actualIncome;

    @ApiModelProperty("实际收益环比 %")
    private BigDecimal actualIncomeQoQ;

    @ApiModelProperty("拦截率 %（active）")
    private BigDecimal rejectRate;

    @ApiModelProperty("拦截率环比 pp")
    private BigDecimal rejectRateQoQ;

    @ApiModelProperty("拦截量（active）")
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

    @ApiModelProperty("成功办理量")
    private Long successCount;

    @ApiModelProperty("成功办理量环比 %")
    private BigDecimal successCountQoQ;

    @ApiModelProperty("成功率 %")
    private BigDecimal successRate;

    @ApiModelProperty("成功率环比 pp")
    private BigDecimal successRateQoQ;

    @ApiModelProperty("收益")
    private BigDecimal income;

    @ApiModelProperty("收益环比 %")
    private BigDecimal incomeQoQ;

    // ============ 预警特有字段（5.7 命中策略列表）============
    @ApiModelProperty("命中记录对应的规则ID")
    private Long ruleId;

    @ApiModelProperty("规则名称")
    private String ruleName;

    @ApiModelProperty("预警指标编码")
    private String metricCode;

    @ApiModelProperty("预警指标名称")
    private String metricName;

    @ApiModelProperty("指标当前值")
    private BigDecimal metricValue;

    @ApiModelProperty("偏离值")
    private BigDecimal deviation;

    @ApiModelProperty("命中时间 yyyy-MM-dd HH:mm")
    private String hitTime;

    @ApiModelProperty("是否已关注")
    private Boolean followed;

    // ============ 收藏特有字段（6.3 收藏列表）============
    @ApiModelProperty("收藏时间 yyyy-MM-dd HH:mm")
    private String favTime;

    @ApiModelProperty("来源：manual=主动收藏，follow=预警关注")
    private String source;

    @ApiModelProperty("统计账期 yyyy-MM-dd")
    private String statMonth;

    @ApiModelProperty("数据时间（冗余）")
    private Date dataDate;
}
