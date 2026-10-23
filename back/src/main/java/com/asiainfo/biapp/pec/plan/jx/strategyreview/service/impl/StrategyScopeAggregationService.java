package com.asiainfo.biapp.pec.plan.jx.strategyreview.service.impl;

import com.asiainfo.biapp.pec.core.exception.BaseException;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.mapper.SrStrategyScopeMapper;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.mapper.SrStrategyReviewMapper;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.*;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.*;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.BeanWrapper;
import org.springframework.beans.BeanWrapperImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.YearMonth;
import java.util.*;
import java.util.stream.Collectors;

/** Aggregates strategy facts for selected customer groups or products; totals use existing summary queries. */
@Service
public class StrategyScopeAggregationService {
    @Autowired private SrStrategyScopeMapper mapper;
    @Autowired private SrStrategyReviewMapper reviewMapper;

    private static final String[][] METRICS = {
        {"strategyCount", "strategy_count", "策略数", "个"},
        {"originalCust", "original_cust", "客群", "人"},
        {"pushCount", "push_count", "推送量", "次"},
        {"usageCount", "usage_count", "使用量", "次"},
        {"reachCount", "reach_count", "触达量", "次"},
        {"targetConvNum", "target_conv_num", "目标转化量", "次"},
        {"productConvNum", "product_conv_num", "全产品转化量", "次"},
        {"usageRate", "usage_rate", "使用率", "%"},
        {"reachRate", "reach_rate", "触达率", "%"},
        {"targetConvRate", "target_conv_rate", "目标转化率", "%"},
        {"productConvRate", "product_conv_rate", "全产品转化率", "%"},
        {"expectedIncome", "expected_income", "预期收入", "元"},
        {"actualIncome", "actual_income", "收入", "元"},
        {"rejectCount", "reject_count", "拒绝量", "次"},
        {"rejectRate", "reject_rate", "拒绝率", "%"}
    };

    private static final String[][] CONTROL_METRICS = {
        {"strategyCount", "strategy_count", "策略数", "个"},
        {"consultCount", "consult_count", "推送量", "次"},
        {"retainCount", "retain_count", "使用量", "次"},
        {"retainRate", "retain_rate", "使用率", "%"},
        {"reachRate", "reach_rate", "触达率", "%"},
        {"dispatchCount", "dispatch_count", "触达量", "次"},
        {"successCount", "success_count", "转化量", "次"},
        {"successRate", "success_rate", "转化率", "%"},
        {"income", "income", "收入", "元"}
    };

    private static String[][] metrics(String tabType) {
        return "control".equals(tabType) ? CONTROL_METRICS : METRICS;
    }

    public List<DimItemVO> customerDimensions(DimQueryReq req) {
        return "active".equals(req.getTabType()) ? mapper.selectCustomerDimensions() : Collections.emptyList();
    }

    public List<DimItemVO> productDimensions(DimQueryReq req) {
        return "control".equals(req.getTabType()) ? mapper.selectProductDimensions() : Collections.emptyList();
    }

    private TouchpointQueryReq scope(OverviewQueryReq req) {
        TouchpointQueryReq scope = new TouchpointQueryReq();
        BeanUtils.copyProperties(req, scope);
        return normalize(scope);
    }

    private TouchpointQueryReq normalize(TouchpointQueryReq req) {
        TouchpointQueryReq copy = new TouchpointQueryReq();
        BeanUtils.copyProperties(req, copy);
        String month = copy.getStatMonth();
        if (month == null || month.trim().isEmpty()) {
            month = reviewMapper.selectLatestKpiMonth(req.getTabType(), req.getCityId(), req.getCountyId());
        }
        if (month == null || month.trim().isEmpty()) month = YearMonth.now().toString();
        if (month.matches("[0-9]{6}")) month = month.substring(0, 4) + "-" + month.substring(4);
        copy.setStatMonth(YearMonth.parse(month).toString());
        return copy;
    }

    private static BigDecimal number(Map<String, Object> row, String key) {
        Object value = row == null ? null : row.get(key);
        return value == null ? null : new BigDecimal(value.toString());
    }

    private static BigDecimal percent(BigDecimal numerator, BigDecimal denominator) {
        return numerator == null || denominator == null || denominator.signum() == 0 ? null
            : numerator.multiply(BigDecimal.valueOf(100)).divide(denominator, 2, RoundingMode.HALF_UP);
    }

    private static void rate(Map<String, Object> row, String name, String numerator, String denominator) {
        row.put(name, percent(number(row, numerator), number(row, denominator)));
    }

    private static List<Object> key(Map<String, Object> row, String month) {
        return Arrays.asList(month, row.get("channel"), row.get("bigCategory"), row.get("smallCategory"), row.get("bizName"));
    }

    private List<Map<String, Object>> rows(TouchpointQueryReq req, String dimension) {
        List<Map<String, Object>> rows = "business".equals(dimension)
            ? mapper.selectBusiness(req) : mapper.selectMetrics(req, dimension);
        Map<List<Object>, Map<String, Object>> byMonth = new HashMap<>();
        for (Map<String, Object> row : rows) {
            if (!"business".equals(dimension) && "control".equals(req.getTabType())) {
                rate(row, "retainRate", "retainCount", "consultCount");
                rate(row, "reachRate", "dispatchCount", "retainCount");
                rate(row, "successRate", "successCount", "dispatchCount");
            } else if (!"business".equals(dimension)) {
                rate(row, "usageRate", "usageCount", "pushCount");
                rate(row, "reachRate", "reachCount", "usageCount");
                rate(row, "targetConvRate", "targetConvNum", "reachCount");
                rate(row, "productConvRate", "productConvNum", "reachCount");
                rate(row, "rejectRate", "rejectCount", "pushCount");
            }
            byMonth.put(key(row, row.get("statMonth").toString()), row);
        }
        for (Map<String, Object> row : rows) {
            String previousMonth = YearMonth.parse(row.get("statMonth").toString()).minusMonths(1).toString();
            Map<String, Object> previous = byMonth.get(key(row, previousMonth));
            if ("business".equals(dimension)) {
                row.put("qoq", change(number(row, "capacity"), number(previous, "capacity"), false));
            } else {
                for (String[] metric : metrics(req.getTabType())) row.put(metric[0] + "QoQ",
                    change(number(row, metric[0]), number(previous, metric[0]), "%".equals(metric[3])));
            }
        }
        return rows;
    }

    private static BigDecimal change(BigDecimal current, BigDecimal previous, boolean rate) {
        if (current == null || previous == null) return null;
        return rate ? current.subtract(previous) : percent(current.subtract(previous), previous);
    }

    private List<Map<String, Object>> current(List<Map<String, Object>> rows, TouchpointQueryReq req) {
        return rows.stream().filter(row -> req.getStatMonth().equals(row.get("statMonth"))).collect(Collectors.toList());
    }

    private static <T> T bean(Map<String, Object> row, T target) {
        if (row == null) return target;
        BeanWrapper wrapper = new BeanWrapperImpl(target);
        row.forEach((name, value) -> { if (wrapper.isWritableProperty(name)) wrapper.setPropertyValue(name, value); });
        return target;
    }

    private Map<String, Object> total(TouchpointQueryReq req) {
        List<Map<String, Object>> total = current(rows(req, "total"), req);
        return total.isEmpty() ? null : total.get(0);
    }

    public List<KpiCardVO> kpis(OverviewQueryReq req) {
        Map<String, Object> total = total(scope(req));
        if (total == null) return Collections.emptyList();
        List<KpiCardVO> cards = new ArrayList<>();
        for (String[] metric : metrics(req.getTabType())) {
            KpiCardVO card = new KpiCardVO();
            card.setMetricCode(metric[1]); card.setLabel(metric[2]); card.setUnit(metric[3]);
            card.setValue(number(total, metric[0])); card.setTrendQoQ(number(total, metric[0] + "QoQ"));
            cards.add(card);
        }
        return cards;
    }

    public KpiTrendVO trend(OverviewQueryReq req) {
        String[] selected = Arrays.stream(metrics(req.getTabType())).filter(metric -> metric[1].equals(req.getMetricCode()))
            .findFirst().orElseThrow(() -> new BaseException("不支持的指标编码"));
        List<Map<String, Object>> all = rows(scope(req), "total");
        List<Map<String, Object>> latest = all.subList(Math.max(0, all.size() - 12), all.size());
        KpiTrendVO result = new KpiTrendVO();
        result.setMonths(latest.stream().map(row -> monthLabel(row.get("statMonth").toString())).collect(Collectors.toList()));
        result.setValues(latest.stream().map(row -> number(row, selected[0])).collect(Collectors.toList()));
        result.setQoq(latest.stream().map(row -> number(row, selected[0] + "QoQ")).collect(Collectors.toList()));
        result.setUnit(selected[3]);
        return result;
    }

    /** Historical summary tables lack this column, so derive it from strategy facts for every product scope. */
    public KpiCardVO reachRate(OverviewQueryReq req) {
        return kpis(req).stream().filter(card -> "reach_rate".equals(card.getMetricCode())).findFirst().orElse(null);
    }

    public ChannelSummaryRespVO channels(TouchpointQueryReq request) {
        TouchpointQueryReq req = normalize(request);
        Map<String, String> names = new HashMap<>();
        for (DimItemVO dim : reviewMapper.selectChannelDims(req.getTabType())) names.put(dim.getKeyCode(), dim.getKeyName());
        List<Map<String, Object>> current = current(rows(req, "channel"), req);
        sort(current, req, "strategyCount");
        List<ChannelSummaryRowVO> list = current.stream().map(row -> {
            ChannelSummaryRowVO value = bean(row, new ChannelSummaryRowVO());
            value.setChannelName(names.get(value.getChannel()));
            return value;
        }).collect(Collectors.toList());
        ChannelSummaryRespVO result = new ChannelSummaryRespVO();
        result.setList(list); result.setCalculate(bean(total(req), new ChannelSummaryRowVO()));
        return result;
    }

    public CategoryRespVO categories(TouchpointQueryReq request) {
        TouchpointQueryReq req = normalize(request);
        List<Map<String, Object>> current = current(rows(req, "category"), req);
        sort(current, req, "strategyCount");
        CategoryRespVO result = new CategoryRespVO();
        result.setList(current.stream().map(row -> bean(row, new CategoryRowVO())).collect(Collectors.toList()));
        result.setCalculate(bean(total(req), new CategoryRowVO()));
        return result;
    }

    public StrategyRowVO strategyTotal(TouchpointQueryReq req) {
        return bean(total(normalize(req)), new StrategyRowVO());
    }

    public List<ChannelTrendVO> capacityTrend(TouchpointQueryReq request) {
        String metric = "control".equals(request.getTabType()) ? "successCount" : "productConvNum";
        List<Map<String, Object>> all = rows(normalize(request), "total");
        List<ChannelTrendVO> result = new ArrayList<>();
        for (Map<String, Object> row : all.subList(Math.max(0, all.size() - 6), all.size())) {
            ChannelTrendVO item = new ChannelTrendVO();
            item.setMonth(row.get("statMonth").toString()); item.setMonthLabel(monthLabel(item.getMonth()));
            item.setCapacity(number(row, metric)); item.setQoq(number(row, metric + "QoQ"));
            result.add(item);
        }
        return result;
    }

    public List<ChannelBizVO> business(TouchpointQueryReq request) {
        TouchpointQueryReq req = normalize(request);
        List<Map<String, Object>> current = current(rows(req, "business"), req);
        sort(current, req, "capacity");
        return current.stream().map(row -> bean(row, new ChannelBizVO())).collect(Collectors.toList());
    }

    private static String monthLabel(String month) { return YearMonth.parse(month).getMonthValue() + "月"; }

    private static void sort(List<Map<String, Object>> rows, TouchpointQueryReq req, String defaultField) {
        Set<String> allowed = new HashSet<>(Arrays.asList("channel", "bigCategory", "smallCategory", "capacity"));
        for (String[] metric : metrics(req.getTabType())) allowed.add(metric[0]);
        String field = allowed.contains(req.getSortField()) ? req.getSortField() : defaultField;
        boolean ascending = "asc".equalsIgnoreCase(req.getSortDir());
        rows.sort((left, right) -> {
            Object a = left.get(field), b = right.get(field);
            if (a == null) return b == null ? 0 : 1;
            if (b == null) return -1;
            int comparison = a instanceof Number && b instanceof Number
                ? new BigDecimal(a.toString()).compareTo(new BigDecimal(b.toString())) : a.toString().compareTo(b.toString());
            return ascending ? comparison : -comparison;
        });
    }
}
