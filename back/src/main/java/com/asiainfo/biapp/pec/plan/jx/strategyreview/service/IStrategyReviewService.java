package com.asiainfo.biapp.pec.plan.jx.strategyreview.service;

import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.DimQueryReq;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.ExecutionQueryReq;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.OverviewQueryReq;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.TouchpointQueryReq;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.*;

import java.util.List;

/**
 * 策略复盘-查询服务（通用枚举/整体情况/触点执行/执行明细）
 */
public interface IStrategyReviewService {

    /** 通用枚举查询 */
    List<DimItemVO> queryDims(DimQueryReq req);

    /** 策略整体情况-KPI卡片（每指标一张卡） */
    List<KpiCardVO> queryKpiCard(OverviewQueryReq req);

    /** 策略整体情况-趋势（某指标近12个月） */
    KpiTrendVO queryKpiTrend(OverviewQueryReq req);

    /** 策略触点执行-渠道执行汇总（含合计行） */
    ChannelSummaryRespVO queryChannelSummary(TouchpointQueryReq req);

    /** 策略触点执行-策略列表（分页） */
    PageResultVO<StrategyRowVO> queryStrategyList(TouchpointQueryReq req);

    /** 策略触点执行-渠道产能趋势（近6个月） */
    List<ChannelTrendVO> queryChannelCapacityTrend(TouchpointQueryReq req);

    /** 策略触点执行-渠道业务产能 */
    List<ChannelBizVO> queryChannelBizCapacity(TouchpointQueryReq req);

    /** 策略触点执行-策略分类汇总（按大类+小类聚合） */
    CategoryRespVO queryCategorySummary(TouchpointQueryReq req);

    /** 策略执行明细-策略信息 */
    StrategyInfoVO queryStrategyInfo(ExecutionQueryReq req);

    /** 策略执行明细-产能趋势（近6个月，聚合为序列） */
    StrategyTrendVO queryStrategyCapacityTrend(ExecutionQueryReq req);

    /** 策略执行明细-业务产能（分页） */
    PageResultVO<StrategyBizVO> queryStrategyBizCapacity(ExecutionQueryReq req);

    /** 策略执行明细-日粒度明细（分页） */
    PageResultVO<StrategyDailyVO> queryStrategyDailyDetail(ExecutionQueryReq req);

    /** 策略执行明细 - 拒绝原因（active） */
    RejectReasonRespVO queryRejectReason(ExecutionQueryReq req);

    /** 获取最新数据日期（yyyy-MM-dd 格式，用于前端初始化日期范围） */
    String getLatestDataDate(DimQueryReq req);
}
