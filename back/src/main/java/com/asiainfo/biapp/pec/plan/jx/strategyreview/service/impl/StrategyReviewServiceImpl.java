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
 * 环比/同比等指标均由写表方写入，后端不做指标计算；
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

    static {
        AP_SORT_MAP.put("channel", "channel");
        AP_SORT_MAP.put("strategyCount", "strategy_count");
        AP_SORT_MAP.put("originalCust", "original_cust");
        AP_SORT_MAP.put("pushCount", "push_count");
        AP_SORT_MAP.put("usageCount", "usage_count");
        AP_SORT_MAP.put("usageRate", "usage_rate");
        AP_SORT_MAP.put("reachCount", "reach_count");
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
        CTRL_SORT_MAP.put("consultCount", "consult_count");
        CTRL_SORT_MAP.put("retainCount", "retain_count");
        CTRL_SORT_MAP.put("retainRate", "retain_rate");
        CTRL_SORT_MAP.put("dispatchCount", "dispatch_count");
        CTRL_SORT_MAP.put("successCount", "success_count");
        CTRL_SORT_MAP.put("successRate", "success_rate");
        CTRL_SORT_MAP.put("income", "income");

        AP_METRIC_MAP.put("originalCust", "original_cust");
        AP_METRIC_MAP.put("pushCount", "push_count");
        AP_METRIC_MAP.put("usageCount", "usage_count");
        AP_METRIC_MAP.put("reachCount", "reach_count");
        AP_METRIC_MAP.put("targetConvNum", "target_conv_num");
        AP_METRIC_MAP.put("productConvNum", "product_conv_num");
        AP_METRIC_MAP.put("expectedIncome", "expected_income");
        AP_METRIC_MAP.put("actualIncome", "actual_income");

        CTRL_METRIC_MAP.put("consultCount", "consult_count");
        CTRL_METRIC_MAP.put("retainCount", "retain_count");
        CTRL_METRIC_MAP.put("dispatchCount", "dispatch_count");
        CTRL_METRIC_MAP.put("successCount", "success_count");
        CTRL_METRIC_MAP.put("income", "income");
    }

    @Autowired
    private SrStrategyReviewMapper reviewMapper;

    @Override
    public List<DimItemVO> queryDims(DimQueryReq req) {
        switch (req.getType()) {
            case "触点渠道":
                return reviewMapper.selectChannelDims(req.getTabType());
            case "策略名称":
                return reviewMapper.selectStrategyNameDims(req.getTabType(), req.getChannel(), req.getKeyword());
            case "预警指标":
                return reviewMapper.selectMetricDims(req.getTabType());
            case "规则状态":
                return buildStatusDims();
            default:
                throw new BaseException("不支持的枚举类型：" + req.getType());
        }
    }

    @Override
    public List<KpiCardVO> queryKpiCard(OverviewQueryReq req) {
        String statMonth = normalizeStatMonth(req.getStatMonth());
        if (StringUtils.isBlank(statMonth)) {
            statMonth = reviewMapper.selectLatestKpiMonth(req.getTabType(), req.getCityId(), req.getCountyId());
            if (StringUtils.isBlank(statMonth)) {
                return new ArrayList<>();
            }
        }
        if (StringUtils.isNotBlank(req.getChannel())) {
            List<ChannelSummaryRowVO> rows = reviewMapper.selectChannelSummaryList(
                    req.getTabType(), toYearMonth(statMonth), req.getCityId(), req.getCountyId(),
                    "c.strategy_count DESC", req.getChannel(), req.getStrategyClass());
            if (rows == null || rows.isEmpty()) return new ArrayList<>();
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
                    {"consultCount", "consult_count", "咨询量", "次"},
                    {"retainCount", "retain_count", "挽留量", "次"},
                    {"retainRate", "retain_rate", "挽留率", "%"},
                    {"dispatchCount", "dispatch_count", "派单量", "次"},
                    {"successCount", "success_count", "成功量", "次"},
                    {"successRate", "success_rate", "成功率", "%"},
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
            return cards;
        }
        List<KpiCardVO> list = reviewMapper.selectKpiCard(req.getTabType(), statMonth,
                req.getCityId(), req.getCountyId(), req.getStrategyClass());
        return list == null ? new ArrayList<>() : list;
    }

    @Override
    public KpiTrendVO queryKpiTrend(OverviewQueryReq req) {
        if (StringUtils.isBlank(req.getMetricCode())) {
            throw new BaseException("指标编码metricCode不能为空");
        }
        List<KpiTrendItemVO> rows;
        String statMonth = normalizeStatMonth(req.getStatMonth());
        if (StringUtils.isNotBlank(req.getChannel())) {
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
        } else {
            rows = reviewMapper.selectKpiTrend(req.getTabType(), req.getMetricCode(),
                    req.getCityId(), req.getCountyId(), statMonth, req.getStrategyClass());
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
        resp.setMonths(months);
        resp.setValues(values);
        resp.setQoq(qoq);
        return resp;
    }

    @Override
    public ChannelSummaryRespVO queryChannelSummary(TouchpointQueryReq req) {
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
                "s.", control ? "s.success_count DESC" : "s.product_conv_num DESC");
        int pageNum = normalizePageNum(req.getPageNum());
        int pageSize = normalizePageSize(req.getPageSize());
        long total = reviewMapper.countStrategyList(req.getTabType(), statMonth,
                req.getCityId(), req.getCountyId(), req.getChannel(),
                req.getBigCategory(), req.getSmallCategory(), req.getStrategyClass(), req.getStrategyName());
        List<StrategyRowVO> list = total == 0 ? new ArrayList<>() : reviewMapper.selectStrategyList(
                req.getTabType(), statMonth, req.getCityId(), req.getCountyId(),
                req.getChannel(), req.getBigCategory(), req.getSmallCategory(),
                req.getStrategyClass(), req.getStrategyName(), orderBy, (pageNum - 1) * pageSize, pageSize,"0");
        String channel=StringUtils.isBlank(req.getChannel())?"全部":req.getChannel();
        String bigCategory=StringUtils.isBlank(req.getBigCategory())?"全部":req.getBigCategory();
        String smallCategory=StringUtils.isBlank(req.getSmallCategory())?"全部":req.getSmallCategory();
        List<StrategyRowVO> calculate = total == 0 ? new ArrayList<>() : reviewMapper.selectStrategyList(
                req.getTabType(), statMonth, req.getCityId(), req.getCountyId(),
                channel, bigCategory,smallCategory,
                req.getStrategyClass(), req.getStrategyName(), orderBy, (pageNum - 1) * pageSize, pageSize,"1");

        return PageResultVO.of(list, total,calculate==null||calculate.size()==0?new StrategyRowVO():calculate.get(0), pageNum, pageSize);
    }

    @Override
    public List<ChannelTrendVO> queryChannelCapacityTrend(TouchpointQueryReq req) {
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
        String statMonth = requireStatMonth(req.getStatMonth());
        List<ChannelBizVO> list = reviewMapper.selectChannelBizCapacity(
                req.getTabType(), statMonth, req.getCityId(), req.getCountyId(),
                req.getChannel(), req.getBigCategory(), req.getSmallCategory(), req.getStrategyClass());
        return list == null ? new ArrayList<>() : list;
    }

    @Override
    public CategoryRespVO queryCategorySummary(TouchpointQueryReq req) {
        String statMonth = requireStatMonth(req.getStatMonth());
        List<CategoryRowVO> list = reviewMapper.selectCategorySummary(
                req.getTabType(), statMonth, req.getCityId(), req.getCountyId(), req.getChannel(),req.getBigCategory(),req.getSmallCategory(),req.getStrategyClass(),"0");
        String channel=StringUtils.isBlank(req.getChannel())?"全部":req.getChannel();
        String bigCategory=StringUtils.isBlank(req.getBigCategory())?"全部":req.getBigCategory();
        String smallCategory=StringUtils.isBlank(req.getSmallCategory())?"全部":req.getSmallCategory();
        List<CategoryRowVO> calculate=reviewMapper.selectCategorySummary(req.getTabType(), statMonth, req.getCityId(), req.getCountyId(), channel,bigCategory,smallCategory,req.getStrategyClass(),"1");
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
        StrategyInfoVO info = reviewMapper.selectStrategyInfo(req.getTabType(), req.getStrategyId());
        return info == null ? new StrategyInfoVO() : info;
    }

    @Override
    public StrategyTrendVO queryStrategyCapacityTrend(ExecutionQueryReq req) {
        boolean control = "control".equals(req.getTabType());
        Map<String, String> metricMap = control ? CTRL_METRIC_MAP : AP_METRIC_MAP;
        String metricColumn = metricMap.get(req.getMetricCode());
        if (metricColumn == null) {
            metricColumn = control ? "success_count" : "product_conv_num";
        }
        List<StrategyTrendItemVO> rows = reviewMapper.selectStrategyCapacityTrend(
                req.getTabType(), req.getStrategyId(), metricColumn,
                req.getCityId(), req.getCountyId(), toYearMonth(normalizeStatMonth(req.getStatMonth())));
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
                req.getCityId(), req.getCountyId());
        List<StrategyBizVO> list = total == 0 ? new ArrayList<>() : reviewMapper.selectStrategyBizCapacity(
                req.getTabType(), req.getStrategyId(), statMonth,
                req.getCityId(), req.getCountyId(),
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
                req.getStartDate(), req.getEndDate());
        List<StrategyDailyVO> list = total == 0 ? new ArrayList<>() : reviewMapper.selectStrategyDailyDetail(
                req.getTabType(), req.getStrategyId(),
                req.getCityId(), req.getCountyId(),
                req.getStartDate(), req.getEndDate(),
                (pageNum - 1) * pageSize, pageSize);
        return PageResultVO.of(list, total,new StrategyDailyVO(), pageNum, pageSize);
    }

    @Override
    public RejectReasonRespVO queryRejectReason(ExecutionQueryReq req) {
        String statMonth = requireStatMonth(req.getStatMonth());
        RejectReasonRespVO resp = new RejectReasonRespVO();
        StrategyRowVO summary =
                reviewMapper.selectStrategyRejectSummary(req.getStrategyId(), statMonth,
                        req.getCityId(), req.getCountyId());
        if (summary != null) {
            resp.setRejectRate(summary.getRejectRate());
            resp.setRejectRateQoQ(summary.getRejectRateQoQ());
            resp.setRejectCount(summary.getRejectCount());
        }
        List<RejectReasonItemVO> reasons =
                reviewMapper.selectRejectReasons(req.getStrategyId(), statMonth,
                        req.getCityId(), req.getCountyId());
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
        String latestMonth = reviewMapper.selectLatestKpiMonth(tabType, req.getCityId(), req.getCountyId());
        // KPI 表无数据时，兜底查策略周期汇总表
        if (StringUtils.isBlank(latestMonth)) {
            latestMonth = reviewMapper.selectLatestStrategyMonth(tabType, req.getCityId(), req.getCountyId());
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
