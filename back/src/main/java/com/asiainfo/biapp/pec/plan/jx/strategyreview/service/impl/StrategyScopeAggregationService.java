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

/** Aggregates strategy facts for selected customer groups, products, and the stock "全部" scope. */
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

    private static final List<String> KEY_AUDIENCE_TREND_METRICS = Arrays.asList(
        "strategy_count", "original_cust", "push_count", "usage_count", "reach_count",
        "product_conv_num", "actual_income", "usage_rate", "reach_rate", "product_conv_rate"
    );

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
            month = reviewMapper.selectLatestKpiMonth(req.getTabType(), req.getCityId(), req.getCountyId(), req.getStrategyClass());
        }
        if (month == null || month.trim().isEmpty()) {
            month = reviewMapper.selectLatestStrategyMonth(req.getTabType(), req.getCityId(), req.getCountyId(), req.getStrategyClass());
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

    private static void rateWhenComplete(Map<String, Object> row, String name, String numerator,
                                        String denominator, String numeratorKnownRows,
                                        String denominatorKnownRows) {
        BigDecimal rows = number(row, "metricRowCount");
        if (rows == null) rows = number(row, "strategyCount");
        BigDecimal knownNumerators = number(row, numeratorKnownRows);
        BigDecimal knownDenominators = number(row, denominatorKnownRows);
        if (rows == null || knownNumerators == null || knownDenominators == null
                || rows.compareTo(knownNumerators) != 0 || rows.compareTo(knownDenominators) != 0) {
            row.put(name, null);
            return;
        }
        rate(row, name, numerator, denominator);
    }

    private Set<String> declineCityServiceChannelCodes(TouchpointQueryReq req) {
        if (!"active".equals(req.getTabType()) || !"降拆".equals(req.getStrategyClass())) return Collections.emptySet();
        DimQueryReq dimensions = new DimQueryReq();
        dimensions.setTabType(req.getTabType());
        return reviewMapper.selectChannelDims(dimensions).stream()
            .filter(item -> "市级-营服".equals(item.getKeyName()))
            .map(DimItemVO::getKeyCode)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());
    }

    private static boolean isDeclineCityServiceRow(TouchpointQueryReq req, Map<String, Object> row,
                                                    Set<String> cityServiceCodes) {
        if (!"active".equals(req.getTabType()) || !"降拆".equals(req.getStrategyClass())) return false;
        if ("市级-营服".equals(req.getChannel())) return true;
        return cityServiceCodes.contains(Objects.toString(row.get("channel"), ""));
    }

    private void applyMetricRates(TouchpointQueryReq req, Map<String, Object> row,
                                  Set<String> cityServiceCodes) {
        if ("active".equals(req.getTabType()) && "降拆".equals(req.getStrategyClass())) {
            // V3: all channels keep success in reach_count and dispatch in target/product.
            rate(row, "reachRate", "reachCount", "pushCount");
            rate(row, "targetConvRate", "targetConvNum", "pushCount");
            rate(row, "productConvRate", "productConvNum", "pushCount");
            rate(row, "usageRate", "usageCount", "pushCount");
            rate(row, "rejectRate", "rejectCount", "pushCount");
            return;
        }
        rate(row, "usageRate", "usageCount", "pushCount");
        rate(row, "reachRate", "reachCount", reachRateDenominator(req));
        rate(row, "targetConvRate", "targetConvNum", "reachCount");
        rate(row, "productConvRate", "productConvNum", productConvRateDenominator(req));
        rate(row, "rejectRate", "rejectCount", "pushCount");
    }

    private static String productConvRateDenominator(TouchpointQueryReq req) {
        return "active".equals(req.getTabType()) && "降拆".equals(req.getStrategyClass())
            ? "pushCount" : "reachCount";
    }

    private static String reachRateDenominator(TouchpointQueryReq req) {
        return "active".equals(req.getTabType()) && "降拆".equals(req.getStrategyClass())
            ? "pushCount" : "usageCount";
    }

    private static List<Object> key(Map<String, Object> row, String month) {
        return Arrays.asList(month, row.get("channel"), row.get("bigCategory"), row.get("smallCategory"), row.get("bizName"));
    }

    private List<Map<String, Object>> rows(TouchpointQueryReq req, String dimension) {
        List<Map<String, Object>> rows = "business".equals(dimension)
            ? mapper.selectBusiness(req) : mapper.selectMetrics(req, dimension);
        if (rows == null) rows = new ArrayList<>();
        if ("business".equals(dimension)) reconcileBusinessRows(rows, req);
        Set<String> cityServiceCodes = declineCityServiceChannelCodes(req);
        Map<List<Object>, Map<String, Object>> byMonth = new HashMap<>();
        for (Map<String, Object> row : rows) {
            if (!"business".equals(dimension) && "control".equals(req.getTabType())) {
                rateWhenComplete(row, "retainRate", "retainCount", "consultCount",
                    "retainKnownRows", "consultKnownRows");
                rateWhenComplete(row, "reachRate", "dispatchCount", "retainCount",
                    "dispatchKnownRows", "retainKnownRows");
                rateWhenComplete(row, "successRate", "successCount", "dispatchCount",
                    "successKnownRows", "dispatchKnownRows");
            } else if (!"business".equals(dimension)) {
                applyMetricRates(req, row, cityServiceCodes);
            }
            byMonth.put(key(row, row.get("statMonth").toString()), row);
        }
        Map<List<Object>, Map<String, Object>> samePeriod = samePeriodRows(req, dimension);
        for (Map<String, Object> row : rows) {
            String previousMonth = YearMonth.parse(row.get("statMonth").toString()).minusMonths(1).toString();
            Map<String, Object> previous = byMonth.get(key(row, previousMonth));
            if ("business".equals(dimension)) {
                row.put("qoq", change(number(row, "capacity"), number(previous, "capacity"), false));
            } else {
                for (String[] metric : metrics(req.getTabType())) row.put(metric[0] + "QoQ",
                    change(number(row, metric[0]), number(previous, metric[0]), "%".equals(metric[3])));
                if (req.getStatMonth().equals(row.get("statMonth")) && samePeriod != null) {
                    Map<String, Object> currentComparable = samePeriod.get(key(row, req.getStatMonth()));
                    Map<String, Object> previousComparable = samePeriod.get(key(row, previousMonth));
                    if (completeComparablePeriod(currentComparable, previousComparable)) {
                        applyChanges(row, currentComparable, previousComparable, req.getTabType());
                    } else if (currentComparable != null && previous != null) {
                        applyPartialMonthChanges(row, previous, currentComparable, req.getTabType());
                    }
                }
            }
        }
        return rows;
    }

    private Map<List<Object>, Map<String, Object>> samePeriodRows(TouchpointQueryReq req, String dimension) {
        if (!"active".equals(req.getTabType()) || "business".equals(dimension)) return null;
        Integer cutoff = mapper.selectDailyCutoff(req);
        if (cutoff == null || cutoff < 1 || cutoff >= YearMonth.parse(req.getStatMonth()).lengthOfMonth()) return null;
        String previousMonth = YearMonth.parse(req.getStatMonth()).minusMonths(1).toString();
        List<Map<String, Object>> comparable = mapper.selectSamePeriodMetrics(req, dimension, previousMonth, cutoff);
        Map<List<Object>, Map<String, Object>> result = new HashMap<>();
        Set<String> cityServiceCodes = declineCityServiceChannelCodes(req);
        for (Map<String, Object> row : comparable) {
            applyMetricRates(req, row, cityServiceCodes);
            result.put(key(row, row.get("statMonth").toString()), row);
        }
        return result;
    }

    private static boolean completeComparablePeriod(Map<String, Object> current, Map<String, Object> previous) {
        if (current == null || previous == null) return false;
        BigDecimal currentDays = number(current, "dayCount"), previousDays = number(previous, "dayCount");
        BigDecimal currentMin = number(current, "minDay"), previousMin = number(previous, "minDay");
        BigDecimal currentMax = number(current, "maxDay"), previousMax = number(previous, "maxDay");
        return currentDays != null && previousDays != null && currentDays.compareTo(previousDays) == 0 && currentMin != null &&
            previousMin != null && currentMin.compareTo(BigDecimal.ONE) == 0 &&
            previousMin.compareTo(BigDecimal.ONE) == 0 && currentMax != null &&
            currentMax.compareTo(previousMax) == 0 && currentDays.compareTo(currentMax) == 0;
    }

    /** Normalize an incomplete current month to the previous month's calendar span when matching daily rows are unavailable. */
    private static void applyPartialMonthChanges(Map<String, Object> target, Map<String, Object> previous,
                                                 Map<String, Object> currentComparable, String tabType) {
        BigDecimal cutoffValue = number(currentComparable, "maxDay");
        if (cutoffValue == null || cutoffValue.signum() <= 0) return;
        int spanDays = YearMonth.parse(target.get("statMonth").toString()).minusMonths(1).lengthOfMonth();
        BigDecimal span = BigDecimal.valueOf(spanDays);
        for (String[] metric : metrics(tabType)) {
            BigDecimal current = number(target, metric[0]);
            BigDecimal before = number(previous, metric[0]);
            if (current == null || before == null) {
                target.put(metric[0] + "QoQ", null);
            } else if ("%".equals(metric[3]) || "strategyCount".equals(metric[0])) {
                target.put(metric[0] + "QoQ", change(current, before, "%".equals(metric[3])));
            } else {
                BigDecimal normalized = current.multiply(span)
                    .divide(cutoffValue, 8, RoundingMode.HALF_UP);
                target.put(metric[0] + "QoQ", change(normalized, before, false));
            }
        }
    }

    private static void applyChanges(Map<String, Object> target, Map<String, Object> current,
                                     Map<String, Object> previous, String tabType) {
        for (String[] metric : metrics(tabType)) target.put(metric[0] + "QoQ",
            change(number(current, metric[0]), number(previous, metric[0]), "%".equals(metric[3])));
    }

    private static BigDecimal change(BigDecimal current, BigDecimal previous, boolean rate) {
        if (current == null || previous == null) return null;
        return rate ? current.subtract(previous) : percent(current.subtract(previous), previous);
    }

    private static String businessTargetMetric(TouchpointQueryReq req) {
        if ("control".equals(req.getTabType())) return "successCount";
        if ("active".equals(req.getTabType()) && "降拆".equals(req.getStrategyClass())) return "reachCount";
        if ("active".equals(req.getTabType())) return "productConvNum";
        return "targetConvNum";
    }

    /** Reallocate business counts to the page success total, preserving their proportions and exact sum. */
    private void reconcileBusinessRows(List<Map<String, Object>> businessRows, TouchpointQueryReq req) {
        List<Map<String, Object>> metricRows = mapper.selectMetrics(req, "total");
        if (metricRows == null || metricRows.isEmpty()) return;

        String targetMetric = businessTargetMetric(req);
        Map<String, BigDecimal> targetByMonth = new HashMap<>();
        for (Map<String, Object> metricRow : metricRows) {
            Object month = metricRow.get("statMonth");
            BigDecimal target = number(metricRow, targetMetric);
            if (month != null && target != null) targetByMonth.put(month.toString(), target);
        }
        if (targetByMonth.isEmpty()) return;

        Map<String, List<Map<String, Object>>> rowsByMonth = new HashMap<>();
        for (Map<String, Object> row : businessRows) {
            Object month = row.get("statMonth");
            if (month != null) rowsByMonth.computeIfAbsent(month.toString(), key -> new ArrayList<>()).add(row);
        }

        for (Map.Entry<String, BigDecimal> entry : targetByMonth.entrySet()) {
            String month = entry.getKey();
            BigDecimal target = entry.getValue();
            if (target.signum() < 0) continue;

            List<Map<String, Object>> monthRows = rowsByMonth.computeIfAbsent(month, key -> new ArrayList<>());
            BigDecimal totalWeight = BigDecimal.ZERO;
            List<BusinessAllocation> allocations = new ArrayList<>();
            for (Map<String, Object> row : monthRows) {
                BigDecimal capacity = number(row, "capacity");
                BigDecimal weight = capacity == null || capacity.signum() < 0 ? BigDecimal.ZERO : capacity;
                totalWeight = totalWeight.add(weight);
                allocations.add(new BusinessAllocation(row, weight));
            }

            if (monthRows.isEmpty() || totalWeight.signum() == 0) {
                businessRows.removeIf(row -> month.equals(String.valueOf(row.get("statMonth"))));
                monthRows.clear();
                if (target.signum() > 0) {
                    Map<String, Object> unassigned = new HashMap<>();
                    unassigned.put("statMonth", month);
                    unassigned.put("bizName", "未分配");
                    unassigned.put("capacity", target);
                    businessRows.add(unassigned);
                    monthRows.add(unassigned);
                }
                continue;
            }

            int scale = Math.max(0, target.stripTrailingZeros().scale());
            BigDecimal normalizedTarget = target.setScale(scale, RoundingMode.HALF_UP);
            BigDecimal unit = BigDecimal.ONE.movePointLeft(scale);
            BigDecimal allocatedTotal = BigDecimal.ZERO;
            for (BusinessAllocation allocation : allocations) {
                BigDecimal exact = allocation.weight.multiply(normalizedTarget)
                    .divide(totalWeight, Math.max(12, scale + 8), RoundingMode.HALF_UP);
                BigDecimal allocated = exact.setScale(scale, RoundingMode.DOWN);
                allocation.row.put("capacity", allocated);
                allocation.remainder = exact.subtract(allocated);
                allocatedTotal = allocatedTotal.add(allocated);
            }

            int remainingUnits = normalizedTarget.subtract(allocatedTotal)
                .divide(unit, 0, RoundingMode.UNNECESSARY).intValueExact();
            allocations.sort((left, right) -> {
                int byRemainder = right.remainder.compareTo(left.remainder);
                if (byRemainder != 0) return byRemainder;
                return String.valueOf(left.row.get("bizName")).compareTo(String.valueOf(right.row.get("bizName")));
            });
            for (int i = 0; i < remainingUnits && i < allocations.size(); i++) {
                BusinessAllocation allocation = allocations.get(i);
                allocation.row.put("capacity", number(allocation.row, "capacity").add(unit));
            }
            BigDecimal reconciledTotal = BigDecimal.ZERO;
            for (BusinessAllocation allocation : allocations) {
                reconciledTotal = reconciledTotal.add(number(allocation.row, "capacity"));
            }
            BigDecimal roundingRemainder = normalizedTarget.subtract(reconciledTotal);
            if (roundingRemainder.signum() != 0 && !allocations.isEmpty()) {
                BusinessAllocation allocation = allocations.get(0);
                allocation.row.put("capacity", number(allocation.row, "capacity").add(roundingRemainder));
            }
        }
    }

    private static final class BusinessAllocation {
        private final Map<String, Object> row;
        private final BigDecimal weight;
        private BigDecimal remainder = BigDecimal.ZERO;

        private BusinessAllocation(Map<String, Object> row, BigDecimal weight) {
            this.row = row;
            this.weight = weight;
        }
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

    private static String normalizeAudienceMonth(String month) {
        if (month == null || month.trim().isEmpty()) return null;
        String normalized = month.trim();
        if (normalized.matches("[0-9]{6}")) return normalized.substring(0, 4) + "-" + normalized.substring(4);
        if (normalized.length() >= 7) return normalized.substring(0, 7);
        return normalized;
    }

    public List<KpiCardVO> audienceManualKpis(OverviewQueryReq request) {
        String statMonth = normalizeAudienceMonth(request.getStatMonth());
        if (statMonth == null) {
            statMonth = mapper.selectLatestAudienceTrendMonth(request);
        }
        if (statMonth == null || statMonth.trim().isEmpty()) return Collections.emptyList();

        Map<String, Map<String, Object>> rowsByMetric = new HashMap<>();
        for (Map<String, Object> row : mapper.selectAudienceManualKpis(request, statMonth)) {
            rowsByMetric.put(Objects.toString(row.get("metricCode"), ""), row);
        }
        List<KpiCardVO> result = new ArrayList<>();
        for (String metricCode : KEY_AUDIENCE_TREND_METRICS) {
            Map<String, Object> row = rowsByMetric.get(metricCode);
            if (row == null || number(row, "metricValue") == null) continue;
            String[] metadata = Arrays.stream(METRICS).filter(metric -> metricCode.equals(metric[1]))
                .findFirst().orElse(null);
            if (metadata == null) continue;
            KpiCardVO card = new KpiCardVO();
            card.setMetricCode(metricCode);
            card.setLabel(metadata[2]);
            card.setUnit(metadata[3]);
            card.setValue(number(row, "metricValue"));
            card.setTrendQoQ(number(row, "manualQoq"));
            result.add(card);
        }
        return result;
    }

    public List<KpiCardVO> upgradeStableManualKpis(OverviewQueryReq request) {
        String statMonth = normalizeAudienceMonth(request.getStatMonth());
        if (statMonth == null) statMonth = mapper.selectLatestUpgradeStableTrendMonth(request);
        if (statMonth == null || statMonth.trim().isEmpty()) return Collections.emptyList();

        Map<String, Map<String, Object>> rowsByMetric = new HashMap<>();
        for (Map<String, Object> row : mapper.selectUpgradeStableManualKpis(request, statMonth)) {
            rowsByMetric.put(Objects.toString(row.get("metricCode"), ""), row);
        }
        List<KpiCardVO> result = new ArrayList<>();
        for (String metricCode : KEY_AUDIENCE_TREND_METRICS) {
            Map<String, Object> row = rowsByMetric.get(metricCode);
            if (row == null || number(row, "metricValue") == null) continue;
            String[] metadata = Arrays.stream(METRICS).filter(metric -> metricCode.equals(metric[1]))
                .findFirst().orElse(null);
            if (metadata == null) continue;
            KpiCardVO card = new KpiCardVO();
            card.setMetricCode(metricCode);
            card.setLabel(metadata[2]);
            card.setUnit(metadata[3]);
            card.setValue(number(row, "metricValue"));
            card.setTrendQoQ(number(row, "manualQoq"));
            result.add(card);
        }
        return result;
    }

    public KpiTrendVO audienceManualTrend(OverviewQueryReq request) {
        String[] metadata = Arrays.stream(METRICS)
            .filter(metric -> metric[1].equals(request.getMetricCode()))
            .findFirst().orElseThrow(() -> new BaseException("不支持的指标编码"));
        String statMonth = normalizeAudienceMonth(request.getStatMonth());
        if (statMonth == null) {
            statMonth = mapper.selectLatestAudienceTrendMonth(request);
        }

        KpiTrendVO result = new KpiTrendVO();
        result.setUnit(metadata[3]);
        if (statMonth == null || statMonth.trim().isEmpty()) {
            result.setMonths(Collections.emptyList());
            result.setValues(Collections.emptyList());
            result.setQoq(Collections.emptyList());
            return result;
        }
        List<Map<String, Object>> rows = mapper.selectAudienceManualTrend(request, request.getMetricCode(), statMonth);
        Collections.reverse(rows);
        result.setMonths(rows.stream().map(row -> monthLabel(Objects.toString(row.get("month"), "")))
            .collect(Collectors.toList()));
        result.setValues(rows.stream().map(row -> number(row, "value")).collect(Collectors.toList()));
        result.setQoq(rows.stream().map(row -> number(row, "qoq")).collect(Collectors.toList()));
        return result;
    }

    public KpiTrendVO upgradeStableManualTrend(OverviewQueryReq request) {
        String[] metadata = Arrays.stream(METRICS)
            .filter(metric -> metric[1].equals(request.getMetricCode()))
            .findFirst().orElseThrow(() -> new BaseException("不支持的指标编码"));
        String statMonth = normalizeAudienceMonth(request.getStatMonth());
        if (statMonth == null) statMonth = mapper.selectLatestUpgradeStableTrendMonth(request);

        KpiTrendVO result = new KpiTrendVO();
        result.setUnit(metadata[3]);
        if (statMonth == null || statMonth.trim().isEmpty()) {
            result.setMonths(Collections.emptyList());
            result.setValues(Collections.emptyList());
            result.setQoq(Collections.emptyList());
            return result;
        }
        List<Map<String, Object>> rows = mapper.selectUpgradeStableManualTrend(
            request, request.getMetricCode(), statMonth);
        Collections.reverse(rows);
        result.setMonths(rows.stream().map(row -> monthLabel(Objects.toString(row.get("month"), "")))
            .collect(Collectors.toList()));
        result.setValues(rows.stream().map(row -> number(row, "value")).collect(Collectors.toList()));
        result.setQoq(rows.stream().map(row -> number(row, "qoq")).collect(Collectors.toList()));
        return result;
    }

    public List<ChannelTrendVO> audienceManualCapacityTrend(TouchpointQueryReq request) {
        TouchpointQueryReq req = new TouchpointQueryReq();
        BeanUtils.copyProperties(request, req);
        String statMonth = normalizeAudienceMonth(req.getStatMonth());
        if (statMonth == null || statMonth.trim().isEmpty()) {
            statMonth = mapper.selectLatestAudienceCapacityTrendMonth(req);
        }
        if (statMonth == null || statMonth.trim().isEmpty()) return Collections.emptyList();
        req.setStatMonth(normalizeAudienceMonth(statMonth));
        List<Map<String, Object>> rows = mapper.selectAudienceManualCapacityTrend(req, req.getStatMonth());
        Collections.reverse(rows);
        return rows.stream().map(row -> {
            ChannelTrendVO item = new ChannelTrendVO();
            item.setMonth(Objects.toString(row.get("month"), ""));
            item.setMonthLabel(monthLabel(item.getMonth()));
            item.setCapacity(number(row, "capacity"));
            item.setQoq(number(row, "qoq"));
            return item;
        }).collect(Collectors.toList());
    }

    public List<KpiCardVO> passiveManualKpis(OverviewQueryReq request) {
        String statMonth = normalizeAudienceMonth(request.getStatMonth());
        if (statMonth == null) statMonth = mapper.selectLatestPassiveTrendMonth(request);
        if (statMonth == null || statMonth.trim().isEmpty()) return Collections.emptyList();

        Map<String, Map<String, Object>> rowsByMetric = new HashMap<>();
        for (Map<String, Object> row : mapper.selectPassiveManualKpis(request, statMonth)) {
            rowsByMetric.put(Objects.toString(row.get("metricCode"), ""), row);
        }
        List<KpiCardVO> result = new ArrayList<>();
        for (String metricCode : KEY_AUDIENCE_TREND_METRICS) {
            Map<String, Object> row = rowsByMetric.get(metricCode);
            if (row == null || number(row, "metricValue") == null) continue;
            String[] metadata = Arrays.stream(METRICS).filter(metric -> metricCode.equals(metric[1]))
                .findFirst().orElse(null);
            if (metadata == null) continue;
            KpiCardVO card = new KpiCardVO();
            card.setMetricCode(metricCode);
            card.setLabel(metadata[2]);
            card.setUnit(metadata[3]);
            card.setValue(number(row, "metricValue"));
            card.setTrendQoQ(number(row, "manualQoq"));
            result.add(card);
        }
        return result;
    }

    public KpiTrendVO passiveManualTrend(OverviewQueryReq request) {
        String[] metadata = Arrays.stream(METRICS)
            .filter(metric -> metric[1].equals(request.getMetricCode()))
            .findFirst().orElseThrow(() -> new BaseException("不支持的指标编码"));
        String statMonth = normalizeAudienceMonth(request.getStatMonth());
        if (statMonth == null) statMonth = mapper.selectLatestPassiveTrendMonth(request);

        KpiTrendVO result = new KpiTrendVO();
        result.setUnit(metadata[3]);
        if (statMonth == null || statMonth.trim().isEmpty()) {
            result.setMonths(Collections.emptyList());
            result.setValues(Collections.emptyList());
            result.setQoq(Collections.emptyList());
            return result;
        }
        List<Map<String, Object>> rows = mapper.selectPassiveManualTrend(request, request.getMetricCode(), statMonth);
        Collections.reverse(rows);
        result.setMonths(rows.stream().map(row -> monthLabel(Objects.toString(row.get("month"), "")))
            .collect(Collectors.toList()));
        result.setValues(rows.stream().map(row -> number(row, "value")).collect(Collectors.toList()));
        result.setQoq(rows.stream().map(row -> number(row, "qoq")).collect(Collectors.toList()));
        return result;
    }

    public List<ChannelTrendVO> passiveManualCapacityTrend(TouchpointQueryReq request) {
        TouchpointQueryReq req = new TouchpointQueryReq();
        BeanUtils.copyProperties(request, req);
        String statMonth = normalizeAudienceMonth(req.getStatMonth());
        if (statMonth == null || statMonth.trim().isEmpty()) {
            statMonth = mapper.selectLatestPassiveCapacityTrendMonth(req);
        }
        if (statMonth == null || statMonth.trim().isEmpty()) return Collections.emptyList();
        req.setStatMonth(normalizeAudienceMonth(statMonth));
        List<Map<String, Object>> rows = mapper.selectPassiveManualCapacityTrend(req, req.getStatMonth());
        Collections.reverse(rows);
        return rows.stream().map(row -> {
            ChannelTrendVO item = new ChannelTrendVO();
            item.setMonth(Objects.toString(row.get("month"), ""));
            item.setMonthLabel(monthLabel(item.getMonth()));
            item.setCapacity(number(row, "capacity"));
            item.setQoq(number(row, "qoq"));
            return item;
        }).collect(Collectors.toList());
    }

    public List<ChannelTrendVO> upgradeStableManualCapacityTrend(TouchpointQueryReq request) {
        TouchpointQueryReq req = new TouchpointQueryReq();
        BeanUtils.copyProperties(request, req);
        String statMonth = normalizeAudienceMonth(req.getStatMonth());
        if (statMonth == null || statMonth.trim().isEmpty()) {
            statMonth = mapper.selectLatestUpgradeStableCapacityTrendMonth(req);
        }
        if (statMonth == null || statMonth.trim().isEmpty()) return Collections.emptyList();
        req.setStatMonth(normalizeAudienceMonth(statMonth));
        List<Map<String, Object>> rows = mapper.selectUpgradeStableManualCapacityTrend(req, req.getStatMonth());
        Collections.reverse(rows);
        return rows.stream().map(row -> {
            ChannelTrendVO item = new ChannelTrendVO();
            item.setMonth(Objects.toString(row.get("month"), ""));
            item.setMonthLabel(monthLabel(item.getMonth()));
            item.setCapacity(number(row, "capacity"));
            item.setQoq(number(row, "qoq"));
            return item;
        }).collect(Collectors.toList());
    }

    public List<KpiCardVO> controlManualKpis(OverviewQueryReq request) {
        String statMonth = normalizeAudienceMonth(request.getStatMonth());
        if (statMonth == null) statMonth = mapper.selectLatestControlTrendMonth(request);
        if (statMonth == null || statMonth.trim().isEmpty()) return Collections.emptyList();

        Map<String, Map<String, Object>> rowsByMetric = new HashMap<>();
        for (Map<String, Object> row : mapper.selectControlManualKpis(request, statMonth)) {
            rowsByMetric.put(Objects.toString(row.get("metricCode"), ""), row);
        }
        List<KpiCardVO> result = new ArrayList<>();
        for (String[] metadata : CONTROL_METRICS) {
            Map<String, Object> row = rowsByMetric.get(metadata[1]);
            if (row == null || number(row, "metricValue") == null) continue;
            KpiCardVO card = new KpiCardVO();
            card.setMetricCode(metadata[1]);
            card.setLabel(metadata[2]);
            card.setUnit(metadata[3]);
            card.setValue(number(row, "metricValue"));
            card.setTrendQoQ(number(row, "manualQoq"));
            result.add(card);
        }
        return result;
    }

    public KpiTrendVO controlManualTrend(OverviewQueryReq request) {
        String[] metadata = Arrays.stream(CONTROL_METRICS)
            .filter(metric -> metric[1].equals(request.getMetricCode()))
            .findFirst().orElseThrow(() -> new BaseException("不支持的指标编码"));
        String statMonth = normalizeAudienceMonth(request.getStatMonth());
        if (statMonth == null) statMonth = mapper.selectLatestControlTrendMonth(request);

        KpiTrendVO result = new KpiTrendVO();
        result.setUnit(metadata[3]);
        if (statMonth == null || statMonth.trim().isEmpty()) {
            result.setMonths(Collections.emptyList());
            result.setValues(Collections.emptyList());
            result.setQoq(Collections.emptyList());
            return result;
        }
        List<Map<String, Object>> rows = mapper.selectControlManualTrend(request, request.getMetricCode(), statMonth);
        Collections.reverse(rows);
        result.setMonths(rows.stream().map(row -> monthLabel(Objects.toString(row.get("month"), "")))
            .collect(Collectors.toList()));
        result.setValues(rows.stream().map(row -> number(row, "value")).collect(Collectors.toList()));
        result.setQoq(rows.stream().map(row -> number(row, "qoq")).collect(Collectors.toList()));
        return result;
    }

    public List<ChannelTrendVO> controlManualCapacityTrend(TouchpointQueryReq request) {
        TouchpointQueryReq req = new TouchpointQueryReq();
        BeanUtils.copyProperties(request, req);
        String statMonth = normalizeAudienceMonth(req.getStatMonth());
        if (statMonth == null || statMonth.trim().isEmpty()) {
            statMonth = mapper.selectLatestControlCapacityTrendMonth(req);
        }
        if (statMonth == null || statMonth.trim().isEmpty()) return Collections.emptyList();
        List<Map<String, Object>> rows = mapper.selectControlManualCapacityTrend(req, normalizeAudienceMonth(statMonth));
        Collections.reverse(rows);
        return rows.stream().map(row -> {
            ChannelTrendVO item = new ChannelTrendVO();
            item.setMonth(Objects.toString(row.get("month"), ""));
            item.setMonthLabel(monthLabel(item.getMonth()));
            item.setCapacity(number(row, "capacity"));
            item.setQoq(number(row, "qoq"));
            return item;
        }).collect(Collectors.toList());
    }

    public List<KpiCardVO> kpis(OverviewQueryReq req) {
        Map<String, Object> total = total(scope(req));
        if (total == null) return Collections.emptyList();
        List<KpiCardVO> cards = new ArrayList<>();
        for (String[] metric : metrics(req.getTabType())) {
            KpiCardVO card = new KpiCardVO();
            card.setMetricCode(metric[1]); card.setLabel(metric[2]); card.setUnit(metric[3]);
            if ("active".equals(req.getTabType()) && "降拆".equals(req.getStrategyClass())) {
                switch (metric[1]) {
                    case "push_count":
                        card.setLabel("市级-营服".equals(req.getChannel()) || "网格-面客".equals(req.getChannel()) ? "接单量" : "咨询量");
                        break;
                    case "reach_count": card.setLabel("成功量"); break;
                    case "reach_rate": card.setLabel("成功率"); break;
                    case "target_conv_num": case "product_conv_num": card.setLabel("派单量"); break;
                    case "target_conv_rate": case "product_conv_rate": card.setLabel("派单率"); break;
                    default: break;
                }
            }
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
        DimQueryReq dimensions = new DimQueryReq();
        dimensions.setTabType(req.getTabType());
        for (DimItemVO dim : reviewMapper.selectChannelDims(dimensions)) names.put(dim.getKeyCode(), dim.getKeyName());
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
        // 页面传空、"全部"或"全部渠道"时汇总所有触点；选中具体触点时保留渠道条件。
        if (req.getChannel() == null || req.getChannel().trim().isEmpty()
                || "全部".equals(req.getChannel()) || "全部渠道".equals(req.getChannel())) {
            req.setChannel(null);
        }
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
        // Match the successful quantity shown in the page's strategy tables.
        String metric = businessTargetMetric(request);
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
        if (usesManualBusinessQoq(req)) {
            Map<String, BigDecimal> manualQoqByBiz = new LinkedHashMap<>();
            List<Map<String, Object>> manualRows = mapper.selectManualBusinessQoq(req);
            if (manualRows != null) {
                for (Map<String, Object> manualRow : manualRows) {
                    String bizName = Objects.toString(manualRow.get("bizName"), null);
                    if (bizName != null && !manualQoqByBiz.containsKey(bizName)) {
                        manualQoqByBiz.put(bizName, number(manualRow, "qoq"));
                    }
                }
            }
            for (Map<String, Object> row : current) {
                // Missing manual values deliberately stay null; never fall back to a calculated qoq.
                row.put("qoq", manualQoqByBiz.get(Objects.toString(row.get("bizName"), "")));
            }
        }
        sort(current, req, "capacity");
        return current.stream().map(row -> bean(row, new ChannelBizVO())).collect(Collectors.toList());
    }

    private static boolean usesManualBusinessQoq(TouchpointQueryReq req) {
        return "passive".equals(req.getTabType())
            || ("active".equals(req.getTabType())
                && Arrays.asList("升接", "稳", "重点客群").contains(req.getStrategyClass()));
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
