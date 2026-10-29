package com.asiainfo.biapp.pec.plan.jx.strategyreview.service.impl;

import com.asiainfo.biapp.pec.plan.jx.strategyreview.mapper.SrStrategyReviewMapper;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.mapper.SrStrategyScopeMapper;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.OverviewQueryReq;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.KpiCardVO;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.KpiTrendVO;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

/** Current-month fact aggregation with existing published values as a safety guard. */
@Slf4j
@Service
public class OverviewMonthlyReconciler {
    private static final List<String> STOCK_CLASSES = Arrays.asList("升接", "稳", "降拆", "离", "重点客群");
    @Autowired private SrStrategyScopeMapper scopeMapper;
    @Autowired private SrStrategyReviewMapper reviewMapper;

    public List<KpiCardVO> reconcile(OverviewQueryReq request, List<KpiCardVO> existing) {
        if (existing == null || existing.isEmpty()) return existing;
        Map<String, Object> facts = currentFacts(request);
        if (facts == null) return existing;
        for (KpiCardVO card : existing) {
            BigDecimal factValue = decimal(facts.get(card.getMetricCode()));
            if (matches(request, card.getMetricCode(), card.getValue(), factValue)) card.setValue(factValue);
        }
        return existing;
    }

    public KpiTrendVO reconcileTrend(OverviewQueryReq request, KpiTrendVO existing) {
        if (existing == null || existing.getMonths() == null || existing.getMonths().isEmpty()
                || existing.getValues() == null || existing.getValues().size() != existing.getMonths().size()) return existing;
        Map<String, Object> facts = currentFacts(request);
        if (facts == null) return existing;
        String currentMonth = month(request.getStatMonth());
        if (currentMonth == null) currentMonth = month(reviewMapper.selectLatestStrategyMonth(request.getTabType(),
                request.getCityId(), request.getCountyId(), request.getStrategyClass()));
        if (currentMonth == null) return existing;
        int last = existing.getMonths().size() - 1;
        String label = existing.getMonths().get(last);
        String expected = Integer.parseInt(currentMonth.substring(5, 7)) + "月";
        if (!expected.equals(label) && !currentMonth.equals(label)) return existing;
        BigDecimal factValue = decimal(facts.get(request.getMetricCode()));
        if (matches(request, request.getMetricCode(), existing.getValues().get(last), factValue)) {
            existing.getValues().set(last, factValue);
        }
        return existing;
    }

    private Map<String, Object> currentFacts(OverviewQueryReq request) {
        if (!"active".equals(request.getTabType()) || !STOCK_CLASSES.contains(request.getStrategyClass())) return null;
        String latest = month(reviewMapper.selectLatestStrategyMonth(request.getTabType(), request.getCityId(),
                request.getCountyId(), request.getStrategyClass()));
        String requested = month(request.getStatMonth());
        if (requested == null) requested = latest;
        // Historical months retain their published series; only the latest fact month is in scope.
        if (requested == null || !requested.equals(latest)) return null;
        String channel = "离".equals(request.getStrategyClass()) ? null : request.getChannel();
        if ("降拆".equals(request.getStrategyClass()) && StringUtils.isBlank(channel)) channel = "整体";
        Map<String, Object> facts = scopeMapper.selectOverviewMonthlyFacts(request, requested, channel);
        if (facts == null || decimal(facts.get("fact_rows")) == null
                || decimal(facts.get("fact_rows")).signum() == 0) return null;
        return facts;
    }

    private boolean matches(OverviewQueryReq request, String metric, BigDecimal published, BigDecimal fact) {
        if (fact != null && published != null && fact.compareTo(published) == 0) return true;
        if ((fact == null) != (published == null) || (fact != null && fact.compareTo(published) != 0)) {
            // Existing published values are retained until each discrepancy is explained.
            log.warn("Overview fact differs from published value: class={}, month={}, channel={}, metric={}",
                    request.getStrategyClass(), request.getStatMonth(), request.getChannel(), metric);
        }
        return false;
    }

    private static BigDecimal decimal(Object value) {
        return value == null ? null : new BigDecimal(value.toString());
    }

    private static String month(String value) {
        if (StringUtils.isBlank(value)) return null;
        String text = value.trim();
        if (text.matches("[0-9]{6}([0-9]{2})?")) return text.substring(0, 4) + "-" + text.substring(4, 6);
        return text.matches("[0-9]{4}-[0-9]{2}.*") ? text.substring(0, 7) : null;
    }
}
