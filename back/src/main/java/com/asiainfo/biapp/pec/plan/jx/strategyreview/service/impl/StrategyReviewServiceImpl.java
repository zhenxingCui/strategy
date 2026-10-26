package com.asiainfo.biapp.pec.plan.jx.strategyreview.service.impl;

import com.asiainfo.biapp.pec.core.exception.BaseException;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.mapper.SrStrategyReviewMapper;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.service.IStrategyReviewService;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.DimQueryReq;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.ExecutionQueryReq;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.OverviewQueryReq;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.TouchpointQueryReq;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.*;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.apache.ibatis.annotations.Param;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 策略复盘-查询服务实现
 * 常规查询读取预计算汇总；选定重点客群时从策略事实聚合，并重算比率和环比。
 * active/passive 查 _ap 表，control 查 _ctrl 表。
 */
@Slf4j
@Service
public class StrategyReviewServiceImpl implements IStrategyReviewService {

    /** 排序字段白名单：active/passive（驼峰字段 -> 数据库列名） */
    private static final Map<String, String> AP_SORT_MAP = new HashMap<>();

    /** 排序字段白名单：control */
    private static final Map<String, String> CTRL_SORT_MAP = new HashMap<>();

    /** 策略产能趋势对比指标白名单：active/passive */
    private static final Map<String, String> AP_METRIC_MAP = new HashMap<>();

    /** 策略产能趋势对比指标白名单：control */
    private static final Map<String, String> CTRL_METRIC_MAP = new HashMap<>();

    /** 拒绝原因默认色板 */
    private static final String[] REASON_COLORS = {"#F56C6C", "#E6A23C", "#409EFF", "#67C23A", "#909399", "#B37FEB"};

    private static boolean isAllStockScope(String tabType, String strategyClass) {
        return "active".equals(tabType)
                && (StringUtils.isBlank(strategyClass) || "全部".equals(strategyClass));
    }

    private static boolean usesLeaveKpiSummary(OverviewQueryReq req) {
        return req != null && "active".equals(req.getTabType()) && "离".equals(req.getStrategyClass());
    }

    static {
        AP_SORT_MAP.put("channel", "channel");
        AP_SORT_MAP.put("strategyCount", "strategy_count");
        AP_SORT_MAP.put("originalCust", "original_cust");
        AP_SORT_MAP.put("pushCount", "push_count");
        AP_SORT_MAP.put("usageCount", "usage_count");
        AP_SORT_MAP.put("usageRate", "usage_rate");
        AP_SORT_MAP.put("reachCount", "reach_count");
        AP_SORT_MAP.put("reachRate", "reach_rate");
        AP_SORT_MAP.put("targetConvNum", "target_conv_num");
        AP_SORT_MAP.put("targetConvRate", "target_conv_rate");
        AP_SORT_MAP.put("productConvNum", "product_conv_num");
        AP_SORT_MAP.put("productConvRate", "product_conv_rate");
        AP_SORT_MAP.put("expectedIncome", "expected_income");
        AP_SORT_MAP.put("actualIncome", "actual_income");
        AP_SORT_MAP.put("rejectRate", "reject_rate");
        AP_SORT_MAP.put("rejectCount", "reject_count");

        CTRL_SORT_MAP.put("channel", "channel");
        CTRL_SORT_MAP.put("strategyCount", "strategy_count");
        CTRL_SORT_MAP.put("consultCount", "push_count");
        CTRL_SORT_MAP.put("retainCount", "usage_count");
        CTRL_SORT_MAP.put("retainRate", "usage_rate");
        CTRL_SORT_MAP.put("dispatchCount", "reach_count");
        CTRL_SORT_MAP.put("successCount", "product_conv_num");
        CTRL_SORT_MAP.put("successRate", "product_conv_rate");
        CTRL_SORT_MAP.put("income", "actual_income");

        AP_METRIC_MAP.put("originalCust", "original_cust");
        AP_METRIC_MAP.put("pushCount", "push_count");
        AP_METRIC_MAP.put("usageCount", "usage_count");
        AP_METRIC_MAP.put("reachCount", "reach_count");
        AP_METRIC_MAP.put("targetConvNum", "target_conv_num");
        AP_METRIC_MAP.put("productConvNum", "product_conv_num");
        AP_METRIC_MAP.put("expectedIncome", "expected_income");
        AP_METRIC_MAP.put("actualIncome", "actual_income");

        CTRL_METRIC_MAP.put("consultCount", "push_count");
        CTRL_METRIC_MAP.put("retainCount", "usage_count");
        CTRL_METRIC_MAP.put("dispatchCount", "reach_count");
        CTRL_METRIC_MAP.put("successCount", "product_conv_num");
        CTRL_METRIC_MAP.put("income", "actual_income");
    }

    @Autowired
    private SrStrategyReviewMapper reviewMapper;

    @Autowired
    private StrategyScopeAggregationService scopeAggregation;

    @Override
    public List<DimItemVO> queryDims(DimQueryReq req) {
        switch (req.getType()) {
            case "客群分类":
                return scopeAggregation.customerDimensions(req);
            case "产品名称":
                return scopeAggregation.productDimensions(req);
            case "触点渠道":
                return reviewMapper.selectChannelDims(req);
            case "策略名称":
                return reviewMapper.selectStrategyNameDims(req.getTabType(), req.getStrategyClass(), req.getChannel(), req.getKeyword());
            case "预警指标":
                List<DimItemVO> metrics = reviewMapper.selectMetricDims(req.getTabType());
                if ("control".equals(req.getTabType())) {
                    for (DimItemVO metric : metrics) metric.setKeyName(ControlMetricNames.label(metric.getKeyCode(), metric.getKeyName()));
                }
                return metrics;
            case "规则状态":
                return buildStatusDims();
            default:
                throw new BaseException("不支持的枚举类型：" + req.getType());
        }
    }

    @Override
    public List<KpiCardVO> queryKpiCard(OverviewQueryReq req) {
        if ("passive".equals(req.getTabType())) {
            return scopeAggregation.passiveManualKpis(req);
        }
        if ("active".equals(req.getTabType()) && "重点客群".equals(req.getStrategyClass())) {
            return scopeAggregation.audienceManualKpis(req);
        }
        if ("control".equals(req.getTabType())) {
            return scopeAggregation.controlManualKpis(req);
        }
        if ("active".equals(req.getTabType()) && ("升接".equals(req.getStrategyClass()) || "稳".equals(req.getStrategyClass()))) {
            return scopeAggregation.upgradeStableManualKpis(req);
        }
        if (usesLeaveKpiSummary(req)) {
            String statMonth = normalizeStatMonth(req.getStatMonth());
            if (StringUtils.isBlank(statMonth)) {
                statMonth = reviewMapper.selectLatestKpiMonth(req.getTabType(), req.getCityId(), req.getCountyId(), req.getStrategyClass());
            }
            if (StringUtils.isBlank(statMonth)) return new ArrayList<>();
            List<KpiCardVO> cards = reviewMapper.selectKpiCard(req.getTabType(), statMonth,
                    req.getCityId(), req.getCountyId(), req.getStrategyClass());
            return cards == null ? new ArrayList<>() : cards;
        }
        if (isAllStockScope(req.getTabType(), req.getStrategyClass())) return scopeAggregation.kpis(req);
        if (usesDeclineChannelSummary(req)) return declineChannelKpis(req);
        if (req.getCustomerGroup() != null || req.getProductName() != null) return scopeAggregation.kpis(req);
        String statMonth = normalizeStatMonth(req.getStatMonth());
        if (StringUtils.isBlank(statMonth)) {
            statMonth = reviewMapper.selectLatestKpiMonth(req.getTabType(), req.getCityId(), req.getCountyId(), req.getStrategyClass());
            if (StringUtils.isBlank(statMonth)) {
                return new ArrayList<>();
            }
        }
        if (StringUtils.isNotBlank(req.getChannel())) {
            List<ChannelSummaryRowVO> rows = reviewMapper.selectChannelSummaryList(
                    req.getTabType(), toYearMonth(statMonth), req.getCityId(), req.getCountyId(),
                    "c.strategy_count DESC", req.getChannel(), req.getStrategyClass());
            if (rows == null || rows.isEmpty()) {
                // Channel summaries are not synchronized for every active class/channel.
                // Use the same filtered strategy facts as the other scope-aware KPIs.
                if ("active".equals(req.getTabType())) return scopeAggregation.kpis(req);
                return new ArrayList<>();
            }
            // 沿用渠道汇总的真实值和环比，不用原型的缩放系数推算指标。
            org.springframework.beans.BeanWrapper bean = new org.springframework.beans.BeanWrapperImpl(rows.get(0));
            String[][] apMetrics = {
                    {"strategyCount", "strategy_count", "策略数", "个"},
                    {"originalCust", "original_cust", "客群", "人"},
                    {"pushCount", "push_count", "推送量", "次"},
                    {"usageCount", "usage_count", "使用量", "次"},
                    {"reachCount", "reach_count", "触达量", "次"},
                    {"productConvNum", "product_conv_num", "全产品转化量", "次"},
                    {"usageRate", "usage_rate", "使用率", "%"},
                    {"productConvRate", "product_conv_rate", "全产品转化率", "%"},
                    {"actualIncome", "actual_income", "收入", "元"}
            };
            String[][] controlMetrics = {
                    {"strategyCount", "strategy_count", "策略数", "个"},
                    {"consultCount", "consult_count", "推送量", "次"},
                    {"retainCount", "retain_count", "使用量", "次"},
                    {"retainRate", "retain_rate", "使用率", "%"},
                    {"dispatchCount", "dispatch_count", "触达量", "次"},
                    {"successCount", "success_count", "转化量", "次"},
                    {"successRate", "success_rate", "转化率", "%"},
                    {"income", "income", "收入", "元"}
            };
            List<KpiCardVO> cards = new ArrayList<>();
            for (String[] metric : "control".equals(req.getTabType()) ? controlMetrics : apMetrics) {
                Object value = bean.getPropertyValue(metric[0]);
                if (value == null) continue;
                KpiCardVO card = new KpiCardVO();
                card.setMetricCode(metric[1]); card.setLabel(metric[2]); card.setUnit(metric[3]);
                card.setValue(new BigDecimal(value.toString()));
                Object qoq = bean.getPropertyValue(metric[0] + "QoQ");
                if (qoq != null) card.setTrendQoQ(new BigDecimal(qoq.toString()));
                cards.add(card);
            }
            if ("control".equals(req.getTabType())) {
                KpiCardVO reachRate = scopeAggregation.reachRate(req);
                if (reachRate != null) cards.add(reachRate);
            } else {
                List<KpiTrendItemVO> rates = reviewMapper.selectChannelReachRateTrend(req.getTabType(),
                        req.getChannel(), toYearMonth(statMonth), req.getCityId(), req.getCountyId(), req.getStrategyClass());
                String currentMonth = toYearMonth(statMonth).replace("-", "");
                for (KpiTrendItemVO rate : rates) {
                    if (!currentMonth.equals(rate.getMonth())) continue;
                    KpiCardVO card = new KpiCardVO();
                    card.setMetricCode("reach_rate"); card.setLabel("触达率"); card.setUnit("%");
                    card.setValue(rate.getValue()); card.setTrendQoQ(rate.getQoq());
                    cards.add(card);
                    break;
                }
            }
            return applyFactMetricOverrides(req, cards);
        }
        List<KpiCardVO> list = reviewMapper.selectKpiCard(req.getTabType(), statMonth,
                req.getCityId(), req.getCountyId(), req.getStrategyClass());
        // Some imported strategy classes have period facts but no matching KPI summary rows.
        // Derive the cards from those facts so the latest class view does not render empty.
        if ((list == null || list.isEmpty()) && "active".equals(req.getTabType())) {
            return scopeAggregation.kpis(req);
        }
        if ((list == null || list.isEmpty()) && "control".equals(req.getTabType())) {
            return scopeAggregation.kpis(req);
        }
        if (list != null && "control".equals(req.getTabType())) {
            list.removeIf(card -> "reach_rate".equals(card.getMetricCode()));
            KpiCardVO reachRate = scopeAggregation.reachRate(req);
            if (reachRate != null) list.add(reachRate);
            for (KpiCardVO card : list) {
                String metricCode = ControlMetricNames.overviewCode(card.getMetricCode());
                card.setMetricCode(metricCode);
                card.setLabel(ControlMetricNames.label(metricCode, card.getLabel()));
            }
            addControlRetainRate(list);
        }
        return applyFactMetricOverrides(req, list);
    }

    private void addControlRetainRate(List<KpiCardVO> cards) {
        if (cards.stream().anyMatch(card -> "retain_rate".equals(card.getMetricCode()))) return;
        KpiCardVO consult = cards.stream().filter(card -> "consult_count".equals(card.getMetricCode()))
                .findFirst().orElse(null);
        KpiCardVO retain = cards.stream().filter(card -> "retain_count".equals(card.getMetricCode()))
                .findFirst().orElse(null);
        if (consult == null || retain == null || consult.getValue() == null || retain.getValue() == null
                || consult.getValue().signum() == 0) return;

        KpiCardVO rate = new KpiCardVO();
        rate.setMetricCode("retain_rate");
        rate.setLabel("使用率");
        rate.setUnit("%");
        rate.setValue(retain.getValue().multiply(BigDecimal.valueOf(100))
                .divide(consult.getValue(), 2, java.math.RoundingMode.HALF_UP));
        cards.add(rate);
    }

    private List<KpiCardVO> applyFactMetricOverrides(OverviewQueryReq req, List<KpiCardVO> cards) {
        if (!"active".equals(req.getTabType())) {
            return cards == null ? new ArrayList<>() : cards;
        }
        List<KpiCardVO> result = new ArrayList<>(cards == null ? Collections.emptyList() : cards);
        List<KpiCardVO> calculatedMetrics = scopeAggregation.kpis(req);
        KpiCardVO calculatedStrategyCount = calculatedMetrics.stream()
                .filter(card -> "strategy_count".equals(card.getMetricCode()))
                .findFirst().orElse(null);
        if (calculatedStrategyCount != null) {
            KpiCardVO existing = result.stream()
                    .filter(card -> "strategy_count".equals(card.getMetricCode()))
                    .findFirst().orElse(null);
            if (existing == null) {
                result.add(calculatedStrategyCount);
            } else {
                existing.setValue(calculatedStrategyCount.getValue());
                existing.setTrendQoQ(calculatedStrategyCount.getTrendQoQ());
            }
        }
        // Keep the overview conversion total on the same strategy facts as the execution categories.
        // The precomputed KPI summary can drift from the sum of product_conv_num in those facts.
        KpiCardVO calculatedProductConv = calculatedMetrics.stream()
                .filter(card -> "product_conv_num".equals(card.getMetricCode()))
                .findFirst().orElse(null);
        if (calculatedProductConv != null) {
            KpiCardVO existing = result.stream()
                    .filter(card -> "product_conv_num".equals(card.getMetricCode()))
                    .findFirst().orElse(null);
            if (existing == null) {
                result.add(calculatedProductConv);
            } else {
                existing.setValue(calculatedProductConv.getValue());
                existing.setTrendQoQ(calculatedProductConv.getTrendQoQ());
            }
        }
        if (!"降拆".equals(req.getStrategyClass())) return result;

        String[][] rateLabels = {{"reach_rate", "成功率"}, {"target_conv_rate", "派单率"}};
        for (String[] rateLabel : rateLabels) {
            KpiCardVO calculatedRate = calculatedMetrics.stream()
                    .filter(card -> rateLabel[0].equals(card.getMetricCode()))
                    .findFirst().orElse(null);
            if (calculatedRate == null) continue;
            calculatedRate.setLabel(rateLabel[1]);
            boolean replaced = false;
            for (int index = 0; index < result.size(); index++) {
                if (rateLabel[0].equals(result.get(index).getMetricCode())) {
                    result.set(index, calculatedRate);
                    replaced = true;
                    break;
                }
            }
            if (!replaced) result.add(calculatedRate);
        }
        return result;
    }

    @Override
    public KpiTrendVO queryKpiTrend(OverviewQueryReq req) {
        if ("passive".equals(req.getTabType())) {
            return scopeAggregation.passiveManualTrend(req);
        }
        if ("active".equals(req.getTabType()) && "重点客群".equals(req.getStrategyClass())) {
            return scopeAggregation.audienceManualTrend(req);
        }
        if ("control".equals(req.getTabType())) {
            return scopeAggregation.controlManualTrend(req);
        }
        if ("active".equals(req.getTabType()) && ("升接".equals(req.getStrategyClass()) || "稳".equals(req.getStrategyClass()))) {
            return scopeAggregation.upgradeStableManualTrend(req);
        }
        boolean leaveKpiSummary = usesLeaveKpiSummary(req);
        if (usesDeclineChannelSummary(req)) return declineChannelTrend(req);
        if (!leaveKpiSummary) {
            if (isAllStockScope(req.getTabType(), req.getStrategyClass())) return scopeAggregation.trend(req);
            if ("active".equals(req.getTabType()) && "product_conv_num".equals(req.getMetricCode())) {
                return scopeAggregation.trend(req);
            }
            if ("active".equals(req.getTabType()) && "strategy_count".equals(req.getMetricCode())) {
                return scopeAggregation.trend(req);
            }
            if ("control".equals(req.getTabType()) && "reach_rate".equals(req.getMetricCode())) {
                return scopeAggregation.trend(req);
            }
            if ("control".equals(req.getTabType()) && "retain_rate".equals(req.getMetricCode())
                    && req.getProductName() == null && StringUtils.isBlank(req.getChannel())) {
                return controlRetainRateTrend(req);
            }
            if (req.getCustomerGroup() != null || req.getProductName() != null) return scopeAggregation.trend(req);
        }
        if (StringUtils.isBlank(req.getMetricCode())) {
            throw new BaseException("指标编码metricCode不能为空");
        }
        List<KpiTrendItemVO> rows;
        String statMonth = normalizeStatMonth(req.getStatMonth());
        if (StringUtils.isNotBlank(req.getChannel()) && !leaveKpiSummary) {
            if (!"control".equals(req.getTabType()) && "reach_rate".equals(req.getMetricCode())) {
                rows = reviewMapper.selectChannelReachRateTrend(req.getTabType(), req.getChannel(),
                        StringUtils.isBlank(statMonth) ? java.time.YearMonth.now().toString() : toYearMonth(statMonth),
                        req.getCityId(), req.getCountyId(), req.getStrategyClass());
            } else {
                Map<String, String> sortMap = "control".equals(req.getTabType()) ? CTRL_SORT_MAP : AP_SORT_MAP;
                String metricColumn = sortMap.get(req.getMetricCode());
                if (metricColumn == null && sortMap.containsValue(req.getMetricCode())) {
                    metricColumn = req.getMetricCode();
                }
                if (metricColumn == null || "channel".equals(metricColumn)) {
                    throw new BaseException("不支持的渠道指标编码");
                }
                rows = reviewMapper.selectChannelKpiTrend(req.getTabType(), req.getChannel(), metricColumn,
                        req.getCityId(), req.getCountyId(), StringUtils.isBlank(statMonth)
                                ? java.time.YearMonth.now().toString() : toYearMonth(statMonth), req.getStrategyClass());
            }
        } else {
            String metricCode = "control".equals(req.getTabType())
                    ? ControlMetricNames.summaryCode(req.getMetricCode()) : req.getMetricCode();
            rows = reviewMapper.selectKpiTrend(req.getTabType(), metricCode,
                    req.getCityId(), req.getCountyId(), statMonth, req.getStrategyClass());
        }
        if ("control".equals(req.getTabType()) && (rows == null || rows.isEmpty())) {
            return scopeAggregation.trend(req);
        }
        // Keep the category trend aligned with its KPI cards when the latest month
        // exists in strategy facts but has not yet been written to the KPI summary.
        if (!leaveKpiSummary && "active".equals(req.getTabType()) && StringUtils.isNotBlank(req.getStrategyClass())) {
            String latestMonth = statMonth;
            if (StringUtils.isBlank(latestMonth)) {
                latestMonth = reviewMapper.selectLatestKpiMonth(req.getTabType(), req.getCityId(), req.getCountyId(), req.getStrategyClass());
            }
            if (StringUtils.isBlank(latestMonth)) {
                latestMonth = reviewMapper.selectLatestStrategyMonth(req.getTabType(), req.getCityId(), req.getCountyId(), req.getStrategyClass());
            }
            final String targetMonth = toYearMonth(latestMonth);
            boolean hasTargetMonth = StringUtils.isNotBlank(targetMonth) && rows != null && rows.stream()
                    .anyMatch(row -> targetMonth.equals(toYearMonth(row.getMonth())));
            if (StringUtils.isNotBlank(targetMonth) && !hasTargetMonth) {
                return scopeAggregation.trend(req);
            }
        }
        KpiTrendVO resp = new KpiTrendVO();
        List<String> months = new ArrayList<>();
        List<BigDecimal> values = new ArrayList<>();
        List<BigDecimal> qoq = new ArrayList<>();
        if (rows != null) {
            // SQL 按 DESC 取近12条，反转为正序（1月→12月）
            Collections.reverse(rows);
            for (KpiTrendItemVO row : rows) {
                months.add(toMonthLabel(row.getMonth()));
                values.add(row.getValue());
                qoq.add(row.getQoq());
                if (StringUtils.isNotBlank(row.getUnit())) {
                    resp.setUnit(row.getUnit());
                }
            }
        }
        if ("control".equals(req.getTabType()) && StringUtils.isNotBlank(req.getChannel())) {
            resp.setUnit(ControlMetricNames.unit(req.getMetricCode(), resp.getUnit()));
        }
        resp.setMonths(months);
        resp.setValues(values);
        resp.setQoq(qoq);
        return resp;
    }

    private static boolean usesDeclineChannelSummary(OverviewQueryReq req) {
        return req != null && "active".equals(req.getTabType()) && "降拆".equals(req.getStrategyClass())
                && StringUtils.isBlank(req.getCustomerGroup()) && StringUtils.isBlank(req.getProductName());
    }

    private static String declineChannel(OverviewQueryReq req) {
        return StringUtils.isBlank(req.getChannel()) ? "整体" : req.getChannel();
    }

    private String declineChannelMonth(OverviewQueryReq req) {
        String month = normalizeStatMonth(req.getStatMonth());
        if (StringUtils.isBlank(month)) {
            month = reviewMapper.selectLatestChannelSummaryMonth(req.getTabType(), declineChannel(req),
                    req.getCityId(), req.getCountyId(), req.getStrategyClass());
        }
        return normalizeStatMonth(month);
    }

    private List<KpiCardVO> declineChannelKpis(OverviewQueryReq req) {
        String statMonth = declineChannelMonth(req);
        if (StringUtils.isBlank(statMonth)) return new ArrayList<>();
        List<ChannelSummaryRowVO> rows = reviewMapper.selectChannelSummaryList(
                req.getTabType(), toYearMonth(statMonth), req.getCityId(), req.getCountyId(),
                "c.strategy_count DESC", declineChannel(req), req.getStrategyClass());
        if (rows == null || rows.isEmpty()) return new ArrayList<>();

        ChannelSummaryRowVO row = rows.get(0);
        org.springframework.beans.BeanWrapper bean = new org.springframework.beans.BeanWrapperImpl(row);
        String channelName = StringUtils.defaultIfBlank(row.getChannelName(), declineChannel(req));
        String pushLabel = "市级-营服".equals(channelName) || "网格-面客".equals(channelName) ? "接单量" : "咨询量";
        String[][] metrics = {
                {"strategyCount", "strategy_count", "策略数", "个"},
                {"originalCust", "original_cust", "原始客群", "人"},
                {"pushCount", "push_count", pushLabel, "次"},
                {"usageCount", "usage_count", "使用量", "次"},
                {"usageRate", "usage_rate", "使用率", "%"},
                {"reachCount", "reach_count", "成功量", "次"},
                {"reachRate", "reach_rate", "成功率", "%"},
                {"targetConvNum", "target_conv_num", "派单量", "次"},
                {"targetConvRate", "target_conv_rate", "派单率", "%"},
                {"productConvNum", "product_conv_num", "派单量", "次"},
                {"productConvRate", "product_conv_rate", "派单率", "%"},
                {"expectedIncome", "expected_income", "预期收入", "元"},
                {"actualIncome", "actual_income", "收入", "元"}
        };
        List<KpiCardVO> cards = new ArrayList<>();
        for (String[] metric : metrics) {
            Object value = bean.getPropertyValue(metric[0]);
            if (value == null) continue;
            KpiCardVO card = new KpiCardVO();
            card.setMetricCode(metric[1]);
            card.setLabel(metric[2]);
            card.setUnit(metric[3]);
            card.setValue(new BigDecimal(value.toString()));
            Object qoq = bean.getPropertyValue(metric[0] + "QoQ");
            if (qoq != null) card.setTrendQoQ(new BigDecimal(qoq.toString()));
            cards.add(card);
        }
        return cards;
    }

    private KpiTrendVO declineChannelTrend(OverviewQueryReq req) {
        String statMonth = declineChannelMonth(req);
        KpiTrendVO resp = new KpiTrendVO();
        if (StringUtils.isBlank(statMonth)) {
            resp.setMonths(new ArrayList<>());
            resp.setValues(new ArrayList<>());
            resp.setQoq(new ArrayList<>());
            return resp;
        }
        if (StringUtils.isBlank(req.getMetricCode())) throw new BaseException("指标编码metricCode不能为空");
        String metricColumn = AP_SORT_MAP.get(req.getMetricCode());
        if (metricColumn == null && AP_SORT_MAP.containsValue(req.getMetricCode())) metricColumn = req.getMetricCode();
        List<String> supportedMetrics = Arrays.asList("strategy_count", "original_cust", "push_count", "usage_count",
                "usage_rate", "reach_count", "reach_rate", "target_conv_num", "target_conv_rate", "product_conv_num",
                "product_conv_rate", "expected_income", "actual_income");
        if (metricColumn == null || !supportedMetrics.contains(metricColumn)) {
            throw new BaseException("降拆渠道月汇总表不包含指标：" + req.getMetricCode());
        }
        List<KpiTrendItemVO> rows = reviewMapper.selectChannelKpiTrend(req.getTabType(), declineChannel(req),
                metricColumn, req.getCityId(), req.getCountyId(), toYearMonth(statMonth), req.getStrategyClass());
        if (rows == null) rows = new ArrayList<>();
        Collections.reverse(rows);
        List<String> months = new ArrayList<>();
        List<BigDecimal> values = new ArrayList<>();
        List<BigDecimal> qoq = new ArrayList<>();
        for (KpiTrendItemVO row : rows) {
            months.add(toMonthLabel(row.getMonth()));
            values.add(row.getValue());
            qoq.add(row.getQoq());
        }
        resp.setMonths(months);
        resp.setValues(values);
        resp.setQoq(qoq);
        resp.setUnit("reach_rate".equals(metricColumn) || metricColumn.endsWith("_rate") ? "%"
                : "strategy_count".equals(metricColumn) ? "个" : "actual_income".equals(metricColumn)
                || "expected_income".equals(metricColumn) ? "元" : "次");
        return resp;
    }

    private KpiTrendVO controlRetainRateTrend(OverviewQueryReq req) {
        String statMonth = normalizeStatMonth(req.getStatMonth());
        List<KpiTrendItemVO> consultRows = reviewMapper.selectKpiTrend("control", "push_count",
                req.getCityId(), req.getCountyId(), statMonth, req.getStrategyClass());
        List<KpiTrendItemVO> retainRows = reviewMapper.selectKpiTrend("control", "usage_count",
                req.getCityId(), req.getCountyId(), statMonth, req.getStrategyClass());
        Map<String, BigDecimal> consultByMonth = new HashMap<>();
        Map<String, BigDecimal> retainByMonth = new HashMap<>();
        for (KpiTrendItemVO row : consultRows) {
            if (row.getMonth() != null && row.getValue() != null) consultByMonth.put(row.getMonth(), row.getValue());
        }
        for (KpiTrendItemVO row : retainRows) {
            if (row.getMonth() != null && row.getValue() != null) retainByMonth.put(row.getMonth(), row.getValue());
        }
        java.util.TreeSet<String> monthKeys = new java.util.TreeSet<>(consultByMonth.keySet());
        monthKeys.retainAll(retainByMonth.keySet());
        List<String> orderedMonths = new ArrayList<>(monthKeys);
        if (orderedMonths.size() > 12) orderedMonths = orderedMonths.subList(orderedMonths.size() - 12, orderedMonths.size());

        KpiTrendVO result = new KpiTrendVO();
        List<String> months = new ArrayList<>();
        List<BigDecimal> values = new ArrayList<>();
        List<BigDecimal> qoq = new ArrayList<>();
        for (String month : orderedMonths) {
            BigDecimal currentConsult = consultByMonth.get(month);
            BigDecimal value = currentConsult.signum() == 0 ? null : retainByMonth.get(month)
                    .multiply(BigDecimal.valueOf(100))
                    .divide(currentConsult, 2, java.math.RoundingMode.HALF_UP);
            java.time.YearMonth date = java.time.YearMonth.of(
                    Integer.parseInt(month.substring(0, 4)), Integer.parseInt(month.substring(4, 6)));
            String previousMonth = date.minusMonths(1).format(java.time.format.DateTimeFormatter.ofPattern("yyyyMM"));
            BigDecimal previousConsult = consultByMonth.get(previousMonth);
            BigDecimal previous = previousConsult != null && previousConsult.signum() != 0 && retainByMonth.containsKey(previousMonth)
                    ? retainByMonth.get(previousMonth).multiply(BigDecimal.valueOf(100))
                        .divide(previousConsult, 2, java.math.RoundingMode.HALF_UP)
                    : null;
            months.add(toMonthLabel(month));
            values.add(value);
            qoq.add(value == null || previous == null ? null : value.subtract(previous));
        }
        result.setMonths(months);
        result.setValues(values);
        result.setQoq(qoq);
        result.setUnit("%");
        return result;
    }

    @Override
    public ChannelSummaryRespVO queryChannelSummary(TouchpointQueryReq req) {
        // 降拆的触点映射依赖渠道口径（例如营服派单率=派单量/接单量），
        // 汇总表没有保存派单率，需从策略事实动态聚合并计算。
        if ("active".equals(req.getTabType()) && "降拆".equals(req.getStrategyClass())) {
            return scopeAggregation.channels(req);
        }
        if (isAllStockScope(req.getTabType(), req.getStrategyClass())) return scopeAggregation.channels(req);
        if (req.getCustomerGroup() != null || req.getProductName() != null) return scopeAggregation.channels(req);
        String statMonth = requireStatMonth(req.getStatMonth());
        boolean control = "control".equals(req.getTabType());
        String orderBy = buildOrderByClause(
                req.getSortField(), req.getSortDir(),
                control ? CTRL_SORT_MAP : AP_SORT_MAP,
                "c.", "c.strategy_count DESC");
        List<ChannelSummaryRowVO> list =
                reviewMapper.selectChannelSummaryList(req.getTabType(), statMonth,
                        req.getCityId(), req.getCountyId(), orderBy,req.getChannel(),req.getStrategyClass());
        List<ChannelSummaryRowVO> calculate = reviewMapper.selectChannelSummaryList(req.getTabType(), statMonth,
                req.getCityId(), req.getCountyId(),orderBy,StringUtils.isBlank(req.getChannel())?"全部":req.getChannel(),req.getStrategyClass());
        ChannelSummaryRespVO resp = new ChannelSummaryRespVO();
        resp.setList(list == null ? new ArrayList<>() : list);
        resp.setCalculate(calculate == null || calculate.size()==0 ? new ChannelSummaryRowVO() : calculate.get(0));
        return resp;
    }

    @Override
    public PageResultVO<StrategyRowVO> queryStrategyList(TouchpointQueryReq req) {
        String statMonth = requireStatMonth(req.getStatMonth());
        boolean control = "control".equals(req.getTabType());
        String orderBy = buildOrderByClause(
                req.getSortField(), req.getSortDir(),
                control ? CTRL_SORT_MAP : AP_SORT_MAP,
                "s.", "s.product_conv_num DESC");
        int pageNum = normalizePageNum(req.getPageNum());
        int pageSize = normalizePageSize(req.getPageSize());
        long total = reviewMapper.countStrategyList(req.getTabType(), statMonth,
                req.getCityId(), req.getCountyId(), req.getChannel(),
                req.getBigCategory(), req.getSmallCategory(), req.getStrategyClass(), req.getCustomerGroup(), req.getProductName(), req.getStrategyName());
        List<StrategyRowVO> list = total == 0 ? new ArrayList<>() : reviewMapper.selectStrategyList(
                req.getTabType(), statMonth, req.getCityId(), req.getCountyId(),
                req.getChannel(), req.getBigCategory(), req.getSmallCategory(),
                req.getStrategyClass(), req.getCustomerGroup(), req.getProductName(), req.getStrategyName(), orderBy, (pageNum - 1) * pageSize, pageSize,"0");
        String channel=StringUtils.isBlank(req.getChannel())?"全部":req.getChannel();
        String bigCategory=StringUtils.isBlank(req.getBigCategory())?"全部":req.getBigCategory();
        String smallCategory=StringUtils.isBlank(req.getSmallCategory())?"全部":req.getSmallCategory();
        List<StrategyRowVO> calculate = total == 0 || req.getCustomerGroup() != null || req.getProductName() != null ? new ArrayList<>() : reviewMapper.selectStrategyList(
                req.getTabType(), statMonth, req.getCityId(), req.getCountyId(),
                channel, bigCategory,smallCategory,
                req.getStrategyClass(), req.getCustomerGroup(), req.getProductName(), req.getStrategyName(), orderBy, (pageNum - 1) * pageSize, pageSize,"1");

        if (req.getCustomerGroup() != null || req.getProductName() != null) {
            calculate = java.util.Collections.singletonList(scopeAggregation.strategyTotal(req));
        }
        return PageResultVO.of(list, total,calculate==null||calculate.size()==0?new StrategyRowVO():calculate.get(0), pageNum, pageSize);
    }

    @Override
    public List<StrategyCategoryOptionVO> queryStrategyCategoryOptions(TouchpointQueryReq req) {
        req.setStatMonth(requireStatMonth(req.getStatMonth()));
        return reviewMapper.selectStrategyCategoryOptions(req);
    }

    @Override
    public List<ChannelTrendVO> queryChannelCapacityTrend(TouchpointQueryReq req) {
        if ("passive".equals(req.getTabType())) {
            return scopeAggregation.passiveManualCapacityTrend(req);
        }
        if ("active".equals(req.getTabType()) && "重点客群".equals(req.getStrategyClass())) {
            return scopeAggregation.audienceManualCapacityTrend(req);
        }
        if ("control".equals(req.getTabType())) {
            return scopeAggregation.controlManualCapacityTrend(req);
        }
        if ("active".equals(req.getTabType()) && ("升接".equals(req.getStrategyClass()) || "稳".equals(req.getStrategyClass()))) {
            return scopeAggregation.upgradeStableManualCapacityTrend(req);
        }
        // Active/passive capacity is shown as the successful quantity for the selected channel.
        // Decline has a dedicated monthly channel summary table; query it directly so the
        // historical trend follows the same values that can be maintained in that table.
        boolean declineChannelSummary = "active".equals(req.getTabType())
                && "降拆".equals(req.getStrategyClass())
                && req.getCustomerGroup() == null && req.getProductName() == null;
        if (!declineChannelSummary && ("active".equals(req.getTabType()) || "passive".equals(req.getTabType())
                || req.getCustomerGroup() != null || req.getProductName() != null
                || StringUtils.isNotBlank(req.getBigCategory()) || StringUtils.isNotBlank(req.getSmallCategory()))) {
            return scopeAggregation.capacityTrend(req);
        }
        List<ChannelTrendVO> list = reviewMapper.selectChannelCapacityTrend(
                req.getTabType(), req.getChannel(),
                req.getBigCategory(), req.getSmallCategory(),
                req.getCityId(), req.getCountyId(), toYearMonth(normalizeStatMonth(req.getStatMonth())), req.getStrategyClass());
        if (list != null) {
            Collections.reverse(list);
            for (ChannelTrendVO vo : list) {
                vo.setMonthLabel(toMonthLabel(vo.getMonth()));
            }
        }
        return list == null ? new ArrayList<>() : list;
    }

    @Override
    public List<ChannelBizVO> queryChannelBizCapacity(TouchpointQueryReq req) {
        return scopeAggregation.business(req);
    }

    @Override
    public CategoryRespVO queryCategorySummary(TouchpointQueryReq req) {
        // Stock categories must match the current facts queried by their linked capacity/business panels.
        // Legacy precomputed categories can retain names from before strategy metadata was updated.
        if ("active".equals(req.getTabType()) || "control".equals(req.getTabType())
                || req.getCustomerGroup() != null || req.getProductName() != null) {
            return scopeAggregation.categories(req);
        }
        String statMonth = requireStatMonth(req.getStatMonth());
        // 空渠道表示全部渠道；显式渠道则读取对应的分类汇总行。
        String categoryChannel = StringUtils.isBlank(req.getChannel())
                || "全部".equals(req.getChannel()) || "全部渠道".equals(req.getChannel())
                ? "全部" : req.getChannel();
        List<CategoryRowVO> list = reviewMapper.selectCategorySummary(
                req.getTabType(), statMonth, req.getCityId(), req.getCountyId(), categoryChannel, req.getBigCategory(), req.getSmallCategory(), req.getStrategyClass(), "0");
        String bigCategory=StringUtils.isBlank(req.getBigCategory())?"全部":req.getBigCategory();
        String smallCategory=StringUtils.isBlank(req.getSmallCategory())?"全部":req.getSmallCategory();
        List<CategoryRowVO> calculate=reviewMapper.selectCategorySummary(req.getTabType(), statMonth, req.getCityId(), req.getCountyId(), categoryChannel, bigCategory, smallCategory, req.getStrategyClass(), "1");
        CategoryRespVO res=new CategoryRespVO();
        res.setList(list == null ? new ArrayList<>():list);
        res.setCalculate(calculate==null||calculate.size()==0?new CategoryRowVO():calculate.get(0));
        return res;
    }


    @Override
    public StrategyInfoVO queryStrategyInfo(ExecutionQueryReq req) {
        if (req.getStrategyId() == null) {
            return new StrategyInfoVO();
        }
        StrategyInfoVO info = reviewMapper.selectStrategyInfo(req.getTabType(), req.getStrategyId(), req.getChannel(), req.getStrategyClass());
        return info == null ? new StrategyInfoVO() : info;
    }

    @Override
    public StrategyTrendVO queryStrategyCapacityTrend(ExecutionQueryReq req) {
        boolean control = "control".equals(req.getTabType());
        Map<String, String> metricMap = control ? CTRL_METRIC_MAP : AP_METRIC_MAP;
        String metricColumn = metricMap.get(req.getMetricCode());
        if (metricColumn == null) {
            metricColumn = "active".equals(req.getTabType()) && "降拆".equals(req.getStrategyClass())
                    ? "reach_count" : "product_conv_num";
        }
        List<StrategyTrendItemVO> rows = reviewMapper.selectStrategyCapacityTrend(
                req.getTabType(), req.getStrategyId(), metricColumn,
                req.getCityId(), req.getCountyId(), toYearMonth(normalizeStatMonth(req.getStatMonth())), req.getChannel(), req.getStrategyClass(),
                req.getBigCategory(), req.getSmallCategory());
        StrategyTrendVO resp = new StrategyTrendVO();
        List<String> months = new ArrayList<>();
        List<BigDecimal> capacity = new ArrayList<>();
        List<BigDecimal> qoq = new ArrayList<>();
        if (rows != null) {
            // SQL 按 DESC 取近6条，反转为正序
            Collections.reverse(rows);
            for (StrategyTrendItemVO row : rows) {
                months.add(toMonthLabel(row.getMonth()));
                capacity.add(row.getCapacity());
                qoq.add(row.getQoq());
            }
        }
        resp.setMonths(months);
        resp.setCapacity(capacity);
        resp.setQoq(qoq);
        return resp;
    }

    @Override
    public PageResultVO<StrategyBizVO> queryStrategyBizCapacity(ExecutionQueryReq req) {
        String statMonth = requireStatMonth(req.getStatMonth());
        int pageNum = normalizePageNum(req.getPageNum());
        int pageSize = normalizePageSize(req.getPageSize());
        long total = reviewMapper.countStrategyBizCapacity(
                req.getTabType(), req.getStrategyId(), statMonth,
                req.getCityId(), req.getCountyId(), req.getStrategyClass());
        List<StrategyBizVO> list = total == 0 ? new ArrayList<>() : reviewMapper.selectStrategyBizCapacity(
                req.getTabType(), req.getStrategyId(), statMonth,
                req.getCityId(), req.getCountyId(),
                req.getStrategyClass(),
                (pageNum - 1) * pageSize, pageSize);
        return PageResultVO.of(list, total,list.size()>0?list.get(0):new StrategyBizVO(), pageNum, pageSize);
    }

    @Override
    public PageResultVO<StrategyDailyVO> queryStrategyDailyDetail(ExecutionQueryReq req) {
        int pageNum = normalizePageNum(req.getPageNum());
        int pageSize = normalizePageSize(req.getPageSize());
        long total = reviewMapper.countStrategyDailyDetail(
                req.getTabType(), req.getStrategyId(),
                req.getCityId(), req.getCountyId(),
                req.getChannel(),
                req.getStrategyClass(),
                req.getStartDate(), req.getEndDate());
        List<StrategyDailyVO> list = total == 0 ? new ArrayList<>() : reviewMapper.selectStrategyDailyDetail(
                req.getTabType(), req.getStrategyId(),
                req.getCityId(), req.getCountyId(),
                req.getChannel(),
                req.getStrategyClass(),
                req.getStartDate(), req.getEndDate(),
                (pageNum - 1) * pageSize, pageSize);
        return PageResultVO.of(list, total,new StrategyDailyVO(), pageNum, pageSize);
    }

    @Override
    public RejectReasonRespVO queryRejectReason(ExecutionQueryReq req) {
        String statMonth = requireStatMonth(req.getStatMonth());
        RejectReasonRespVO resp = new RejectReasonRespVO();
        StrategyRowVO summary =
                reviewMapper.selectStrategyRejectSummary(req.getTabType(), req.getStrategyId(), statMonth,
                        req.getCityId(), req.getCountyId(), req.getChannel(), req.getStrategyClass());
        if (summary != null) {
            resp.setRejectRate(summary.getRejectRate());
            resp.setRejectRateQoQ(summary.getRejectRateQoQ());
            resp.setRejectCount(summary.getRejectCount());
        }
        List<RejectReasonItemVO> reasons =
                reviewMapper.selectRejectReasons(req.getTabType(), req.getStrategyId(), statMonth,
                        req.getCityId(), req.getCountyId(), req.getStrategyClass());
        if (reasons == null) {
            reasons = new ArrayList<>();
        }
        for (int i = 0; i < reasons.size(); i++) {
            reasons.get(i).setColor(REASON_COLORS[i % REASON_COLORS.length]);
        }
        resp.setReasons(reasons);
        return resp;
    }

    // ==================== 私有工具方法 ====================

    /** 规则状态枚举为固定项 */
    private List<DimItemVO> buildStatusDims() {
        List<DimItemVO> list = new ArrayList<>();
        for (String status : Arrays.asList("生效中", "已过期", "已停用")) {
            DimItemVO item = new DimItemVO();
            item.setKeyCode(status);
            item.setKeyName(status);
            list.add(item);
        }
        return list;
    }

    /**
     * 构造排序子句：字段必须命中白名单，否则使用默认排序，防止 SQL 注入
     */
    private String buildOrderByClause(String sortField, String sortDir,
                                      Map<String, String> sortMap, String prefix, String defaultClause) {
        if (StringUtils.isBlank(sortField)) {
            return defaultClause;
        }
        String column = sortMap.get(sortField);
        if (column == null) {
            return defaultClause;
        }
        String dir = "asc".equalsIgnoreCase(sortDir) ? "ASC" : "DESC";
        return prefix + column + " " + dir;
    }

    /** 账期校验：空则默认当前月份 yyyy-MM */
    private String requireStatMonth(String statMonth) {
        if (StringUtils.isBlank(statMonth)) {
            return java.time.YearMonth.now().toString();
        }
        return toYearMonth(statMonth);
    }

    /** 账期格式规整：yyyy-MM 或 yyyyMM -> yyyy-MM */
    private String normalizeStatMonth(String statMonth) {
        if (StringUtils.isBlank(statMonth)) {
            return null;
        }
        return toYearMonth(statMonth);
    }

    /** yyyyMM -> yyyy-MM（已是 yyyy-MM 的原样返回） */
    private String toYearMonth(String month) {
        if (StringUtils.isBlank(month)) {
            return month;
        }
        String compact = month.replace("-", "");
        if (compact.length() == 6) {
            return compact.substring(0, 4) + "-" + compact.substring(4);
        }
        return month;
    }

    /** yyyy-MM / yyyyMM -> N月 */
    private String toMonthLabel(String month) {
        String compact = month == null ? "" : month.replace("-", "");
        if (compact.length() >= 6) {
            int m = Integer.parseInt(compact.substring(4, 6));
            return m + "月";
        }
        return month;
    }

    private int normalizePageNum(Integer pageNum) {
        return pageNum == null || pageNum < 1 ? 1 : pageNum;
    }

    private int normalizePageSize(Integer pageSize) {
        if (pageSize == null || pageSize < 1) {
            return 10;
        }
        return Math.min(pageSize, 500);
    }

    @Override
    public String getLatestDataDate(DimQueryReq req) {
        String tabType = req.getTabType() != null ? req.getTabType() : "active";
        // 先查 KPI 汇总表
        String latestMonth = reviewMapper.selectLatestKpiMonth(tabType, req.getCityId(), req.getCountyId(), req.getStrategyClass());
        // KPI 表无数据时，兜底查策略周期汇总表
        if (StringUtils.isBlank(latestMonth)) {
            latestMonth = reviewMapper.selectLatestStrategyMonth(tabType, req.getCityId(), req.getCountyId(), req.getStrategyClass());
        }
        if (StringUtils.isBlank(latestMonth)) {
            // 都无数据时返回当月 1 号
            java.time.YearMonth now = java.time.YearMonth.now();
            return now.toString() + "-01";
        }
        String ym = toYearMonth(latestMonth);
        return ym + "-01";
    }
}
