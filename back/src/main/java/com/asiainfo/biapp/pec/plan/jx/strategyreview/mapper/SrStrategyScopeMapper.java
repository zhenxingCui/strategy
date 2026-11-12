package com.asiainfo.biapp.pec.plan.jx.strategyreview.mapper;

import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.TouchpointQueryReq;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.OverviewQueryReq;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.DimItemVO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;
import java.util.Map;

@Mapper
public interface SrStrategyScopeMapper {
    List<DimItemVO> selectCustomerDimensions();
    List<DimItemVO> selectProductDimensions();
    List<Map<String, Object>> selectMetrics(@Param("query") TouchpointQueryReq query,
                                          @Param("dimension") String dimension);
    Map<String, Object> selectOverviewMonthlyFacts(@Param("query") OverviewQueryReq query,
                                                   @Param("statMonth") String statMonth,
                                                   @Param("channel") String channel);
    Integer selectDailyCutoff(@Param("query") TouchpointQueryReq query);
    List<Map<String, Object>> selectSamePeriodMetrics(@Param("query") TouchpointQueryReq query,
                                                       @Param("dimension") String dimension,
                                                       @Param("previousMonth") String previousMonth,
                                                       @Param("cutoffDay") Integer cutoffDay);
    List<Map<String, Object>> selectBusiness(@Param("query") TouchpointQueryReq query);
    List<Map<String, Object>> selectManualBusinessQoq(@Param("query") TouchpointQueryReq query);
    String selectLatestAudienceTrendMonth(@Param("query") OverviewQueryReq query);
    List<Map<String, Object>> selectAudienceManualKpis(@Param("query") OverviewQueryReq query,
                                                       @Param("statMonth") String statMonth);
    List<Map<String, Object>> selectAudienceManualTrend(@Param("query") OverviewQueryReq query,
                                                        @Param("metricCode") String metricCode,
                                                        @Param("statMonth") String statMonth);
    String selectLatestAudienceCapacityTrendMonth(@Param("query") TouchpointQueryReq query);
    List<Map<String, Object>> selectAudienceManualCapacityTrend(@Param("query") TouchpointQueryReq query,
                                                                 @Param("statMonth") String statMonth);
    String selectLatestPassiveTrendMonth(@Param("query") OverviewQueryReq query);
    List<Map<String, Object>> selectPassiveManualKpis(@Param("query") OverviewQueryReq query,
                                                      @Param("statMonth") String statMonth);
    List<Map<String, Object>> selectPassiveManualTrend(@Param("query") OverviewQueryReq query,
                                                       @Param("metricCode") String metricCode,
                                                       @Param("statMonth") String statMonth);
    String selectLatestPassiveCapacityTrendMonth(@Param("query") TouchpointQueryReq query);
    List<Map<String, Object>> selectPassiveManualCapacityTrend(@Param("query") TouchpointQueryReq query,
                                                                 @Param("statMonth") String statMonth);
    String selectLatestUpgradeStableFactMonth(@Param("query") OverviewQueryReq query);
    List<Map<String, Object>> selectUpgradeStableFactKpis(@Param("query") OverviewQueryReq query,
                                                            @Param("statMonth") String statMonth);
    List<Map<String, Object>> selectUpgradeStableFactTrend(@Param("query") OverviewQueryReq query,
                                                             @Param("metricCode") String metricCode,
                                                             @Param("statMonth") String statMonth);
    String selectLatestControlTrendMonth(@Param("query") OverviewQueryReq query);
    List<Map<String, Object>> selectControlManualKpis(@Param("query") OverviewQueryReq query,
                                                       @Param("statMonth") String statMonth);
    List<Map<String, Object>> selectControlManualTrend(@Param("query") OverviewQueryReq query,
                                                        @Param("metricCode") String metricCode,
                                                        @Param("statMonth") String statMonth);
    String selectLatestControlCapacityTrendMonth(@Param("query") TouchpointQueryReq query);
    List<Map<String, Object>> selectControlManualCapacityTrend(@Param("query") TouchpointQueryReq query,
                                                                @Param("statMonth") String statMonth);
}
