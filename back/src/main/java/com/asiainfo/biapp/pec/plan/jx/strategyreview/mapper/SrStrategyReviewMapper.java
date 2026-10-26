package com.asiainfo.biapp.pec.plan.jx.strategyreview.mapper;

import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.ChannelBizVO;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.ChannelSummaryRowVO;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.ChannelTrendVO;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.CategoryRowVO;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.DimItemVO;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.KpiCardVO;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.KpiTrendItemVO;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.RejectReasonItemVO;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.StrategyBizVO;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.StrategyDailyVO;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.StrategyInfoVO;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.StrategyRowVO;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.StrategyCategoryOptionVO;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.TouchpointQueryReq;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.StrategyTrendItemVO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 策略复盘-只读查询 Mapper（active/passive 走 _ap 表，control 走 _ctrl 表）
 */
@Mapper
public interface SrStrategyReviewMapper {

    // ==================== 通用枚举 ====================

    /** 触点渠道枚举 */
    List<DimItemVO> selectChannelDims(@Param("query") com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.DimQueryReq query);

    /** 策略名称枚举 */
    List<DimItemVO> selectStrategyNameDims(@Param("tabType") String tabType,
                                           @Param("strategyClass") String strategyClass,
                                           @Param("channel") String channel,
                                           @Param("keyword") String keyword);

    /** 预警指标枚举 */
    List<DimItemVO> selectMetricDims(@Param("tabType") String tabType);

    /** AP渠道触达率及与上个自然月相比的百分点变化，使用真实分子分母计算。 */
    List<KpiTrendItemVO> selectChannelReachRateTrend(@Param("tabType") String tabType,
            @Param("channel") String channel, @Param("statMonth") String statMonth,
            @Param("cityId") String cityId, @Param("countyId") String countyId,
            @Param("strategyClass") String strategyClass);

    // ==================== 策略整体情况（t_sr_kpi_summary 长表） ====================

    /** KPI 卡片（单账期，每个指标一行，按 sort_no 排序） */
    List<KpiCardVO> selectKpiCard(@Param("tabType") String tabType,
                                  @Param("statMonth") String statMonth,
                                  @Param("cityId") String cityId,
                                  @Param("countyId") String countyId,
                                  @Param("strategyClass") String strategyClass);

    /** 最新有数据的账期（t_sr_kpi_summary.stat_month，格式 yyyyMM） */
    String selectLatestKpiMonth(@Param("tabType") String tabType,
                                @Param("cityId") String cityId,
                                @Param("countyId") String countyId,
                                @Param("strategyClass") String strategyClass);

    /** 降拆等指定触点的渠道月汇总最新账期，不依赖 KPI 汇总或策略事实。 */
    String selectLatestChannelSummaryMonth(@Param("tabType") String tabType,
                                           @Param("channel") String channel,
                                           @Param("cityId") String cityId,
                                           @Param("countyId") String countyId,
                                           @Param("strategyClass") String strategyClass);

    /** 兜底：从策略周期汇总表取最新月份（KPI 汇总表可能未同步） */
    String selectLatestStrategyMonth(@Param("tabType") String tabType,
                                     @Param("cityId") String cityId,
                                     @Param("countyId") String countyId,
                                     @Param("strategyClass") String strategyClass);

    /** KPI 趋势（某指标近12个月，DESC 取出后由 Service 反转为正序） */
    List<KpiTrendItemVO> selectKpiTrend(@Param("tabType") String tabType,
                                        @Param("metricCode") String metricCode,
                                        @Param("cityId") String cityId,
                                        @Param("countyId") String countyId,
                                        @Param("statMonth") String statMonth,
                                        @Param("strategyClass") String strategyClass);

    List<KpiTrendItemVO> selectChannelKpiTrend(@Param("tabType") String tabType,
                                              @Param("channel") String channel,
                                              @Param("metricColumn") String metricColumn,
                                              @Param("cityId") String cityId,
                                              @Param("countyId") String countyId,
                                              @Param("statMonth") String statMonth,
                                              @Param("strategyClass") String strategyClass);

    // ==================== 策略触点执行情况 ====================

    /** 渠道执行汇总-明细行 */
    List<ChannelSummaryRowVO> selectChannelSummaryList(@Param("tabType") String tabType,
                                                       @Param("statMonth") String statMonth,
                                                       @Param("cityId") String cityId,
                                                       @Param("countyId") String countyId,
                                                       @Param("orderByClause") String orderByClause,
                                                       @Param("channel") String channel,
                                                       @Param("strategyClass") String strategyClass);

    /** 渠道执行汇总-合计行 */
    ChannelSummaryRowVO selectChannelSummaryTotal(@Param("tabType") String tabType,
                                                  @Param("statMonth") String statMonth,
                                                  @Param("cityId") String cityId,
                                                  @Param("countyId") String countyId,
                                                  @Param("strategyClass") String strategyClass);

    /** 策略列表-当前页 */
    List<StrategyRowVO> selectStrategyList(@Param("tabType") String tabType,
                                           @Param("statMonth") String statMonth,
                                           @Param("cityId") String cityId,
                                           @Param("countyId") String countyId,
                                           @Param("channel") String channel,
                                           @Param("bigCategory") String bigCategory,
                                           @Param("smallCategory") String smallCategory,
                                           @Param("strategyClass") String strategyClass,
                                           @Param("customerGroup") String customerGroup,
                                           @Param("productName") String productName,
                                           @Param("strategyName") String strategyName,
                                           @Param("orderByClause") String orderByClause,
                                           @Param("offset") int offset,
                                           @Param("limit") int limit,
                                           @Param("queryList") String queryList
    );

    /** 与逐策略列表同口径的分类组合（不分页）。 */
    List<StrategyCategoryOptionVO> selectStrategyCategoryOptions(TouchpointQueryReq req);

    /** 策略列表-总数 */
    long countStrategyList(@Param("tabType") String tabType,
                           @Param("statMonth") String statMonth,
                           @Param("cityId") String cityId,
                           @Param("countyId") String countyId,
                           @Param("channel") String channel,
                           @Param("bigCategory") String bigCategory,
                           @Param("smallCategory") String smallCategory,
                           @Param("strategyClass") String strategyClass,
                                           @Param("customerGroup") String customerGroup,
                                           @Param("productName") String productName,
                           @Param("strategyName") String strategyName);

    /** 渠道产能趋势（近6个月，支持大类/小类联动筛选） */
    List<ChannelTrendVO> selectChannelCapacityTrend(@Param("tabType") String tabType,
                                                    @Param("channel") String channel,
                                                    @Param("bigCategory") String bigCategory,
                                                    @Param("smallCategory") String smallCategory,
                                                    @Param("cityId") String cityId,
                                                    @Param("countyId") String countyId,
                                                    @Param("statMonth") String statMonth,
                                                    @Param("strategyClass") String strategyClass);

    /** 渠道业务产能 */
    List<ChannelBizVO> selectChannelBizCapacity(@Param("tabType") String tabType,
                                                @Param("statMonth") String statMonth,
                                                @Param("cityId") String cityId,
                                                @Param("countyId") String countyId,
                                                @Param("channel") String channel,
                                                @Param("bigCategory") String bigCategory,
                                                @Param("smallCategory") String smallCategory,
                                                @Param("strategyClass") String strategyClass);

    /** 策略分类汇总（按大类+小类聚合，可按渠道筛选） */
    List<CategoryRowVO> selectCategorySummary(@Param("tabType") String tabType,
                                              @Param("statMonth") String statMonth,
                                              @Param("cityId") String cityId,
                                              @Param("countyId") String countyId,
                                              @Param("channel") String channel,
                                              @Param("bigCategory") String bigCategory,
                                              @Param("smallCategory") String smallCategory,
                                              @Param("strategyClass") String strategyClass,
                                              @Param("queryList") String queryList
    );

    // ==================== 策略执行明细 ====================

    /** 策略基本信息（tabType 用于选择大类/小类子查询来源表） */
    StrategyInfoVO selectStrategyInfo(@Param("tabType") String tabType,
                                      @Param("strategyId") String strategyId,
                                      @Param("channel") String channel,
                                      @Param("strategyClass") String strategyClass);

    /** 策略产能趋势（近6个月；升接/稳取成功量，其余存量/增量取产品转化量，重点产品取成功量） */
    List<StrategyTrendItemVO> selectStrategyCapacityTrend(@Param("tabType") String tabType,
                                                      @Param("strategyId") String strategyId,
                                                      @Param("metricColumn") String metricColumn,
                                                      @Param("cityId") String cityId,
                                                      @Param("countyId") String countyId,
                                                      @Param("statMonth") String statMonth,
                                                      @Param("channel") String channel,
                                                      @Param("strategyClass") String strategyClass,
                                                      @Param("bigCategory") String bigCategory,
                                                      @Param("smallCategory") String smallCategory);

    /** 策略业务产能-当前页 */
    List<StrategyBizVO> selectStrategyBizCapacity(@Param("tabType") String tabType,
                                                  @Param("strategyId") String strategyId,
                                                  @Param("statMonth") String statMonth,
                                                  @Param("cityId") String cityId,
                                                  @Param("countyId") String countyId,
                                                  @Param("strategyClass") String strategyClass,
                                                  @Param("offset") int offset,
                                                  @Param("limit") int limit);

    /** 策略业务产能-总数 */
    long countStrategyBizCapacity(@Param("tabType") String tabType,
                                  @Param("strategyId") String strategyId,
                                  @Param("statMonth") String statMonth,
                                  @Param("cityId") String cityId,
                                  @Param("countyId") String countyId,
                                  @Param("strategyClass") String strategyClass);

    /** 策略日粒度明细-当前页 */
    List<StrategyDailyVO> selectStrategyDailyDetail(@Param("tabType") String tabType,
                                                    @Param("strategyId") String strategyId,
                                                    @Param("cityId") String cityId,
                                                    @Param("countyId") String countyId,
                                                    @Param("channel") String channel,
                                                    @Param("strategyClass") String strategyClass,
                                                    @Param("startDate") String startDate,
                                                    @Param("endDate") String endDate,
                                                    @Param("offset") int offset,
                                                    @Param("limit") int limit);

    /** 策略日粒度明细-总数 */
    long countStrategyDailyDetail(@Param("tabType") String tabType,
                                  @Param("strategyId") String strategyId,
                                  @Param("cityId") String cityId,
                                  @Param("countyId") String countyId,
                                  @Param("channel") String channel,
                                  @Param("strategyClass") String strategyClass,
                                  @Param("startDate") String startDate,
                                  @Param("endDate") String endDate);

    /** 策略当期拦截率/拦截量（t_sr_strategy_period_summary_ap） */
    StrategyRowVO selectStrategyRejectSummary(@Param("tabType") String tabType,
                                              @Param("strategyId") String strategyId,
                                              @Param("statMonth") String statMonth,
                                              @Param("cityId") String cityId,
                                              @Param("countyId") String countyId,
                                              @Param("channel") String channel,
                                              @Param("strategyClass") String strategyClass);

    /** 策略拒绝原因列表（active/passive/control） */
    List<RejectReasonItemVO> selectRejectReasons(@Param("tabType") String tabType,
                                                 @Param("strategyId") String strategyId,
                                                 @Param("statMonth") String statMonth,
                                                 @Param("cityId") String cityId,
                                                 @Param("countyId") String countyId,
                                                 @Param("strategyClass") String strategyClass);
}
