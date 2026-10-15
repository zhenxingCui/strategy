package com.asiainfo.biapp.pec.plan.jx.strategyreview.controller;

import com.asiainfo.biapp.pec.core.common.ActionResponse;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.service.IStrategyReviewService;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.DimQueryReq;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.ExecutionQueryReq;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.OverviewQueryReq;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.TouchpointQueryReq;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.*;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 策略复盘-通用枚举/策略整体情况/触点执行/执行明细
 */
@Slf4j
@RestController
@RequestMapping("/strategyReview")
@Validated
@Api(tags = "策略复盘与预警-查询")
public class StrategyReviewController {

    @Autowired
    private IStrategyReviewService reviewService;

    @ApiOperation("通用枚举查询：触点渠道/策略名称/预警指标/规则状态")
    @PostMapping("/dim")
    public ActionResponse<List<DimItemVO>> dim(@Validated @RequestBody DimQueryReq req) {
        return ActionResponse.getSuccessResp(reviewService.queryDims(req));
    }

    @ApiOperation("策略整体情况-KPI卡片（每指标一张卡）")
    @PostMapping("/overview/kpi")
    public ActionResponse<List<KpiCardVO>> kpi(@Validated @RequestBody OverviewQueryReq req) {
        return ActionResponse.getSuccessResp(reviewService.queryKpiCard(req));
    }

    @ApiOperation("策略整体情况-趋势（某指标近12个月）")
    @PostMapping("/overview/trend")
    public ActionResponse<KpiTrendVO> trend(@Validated @RequestBody OverviewQueryReq req) {
        return ActionResponse.getSuccessResp(reviewService.queryKpiTrend(req));
    }

    @ApiOperation("策略触点执行-渠道执行汇总（含合计行）")
    @PostMapping("/touchpoint/channelSummary")
    public ActionResponse<ChannelSummaryRespVO> channelSummary(@Validated @RequestBody TouchpointQueryReq req) {
        return ActionResponse.getSuccessResp(reviewService.queryChannelSummary(req));
    }

    @ApiOperation("策略触点执行-策略列表（分页）")
    @PostMapping("/touchpoint/strategyList")
    public ActionResponse<PageResultVO<StrategyRowVO>> strategyList(@Validated @RequestBody TouchpointQueryReq req) {
        return ActionResponse.getSuccessResp(reviewService.queryStrategyList(req));
    }

    @ApiOperation("策略触点执行-渠道产能趋势（近6个月）")
    @PostMapping("/touchpoint/channelCapacityTrend")
    public ActionResponse<List<ChannelTrendVO>> channelCapacityTrend(@Validated @RequestBody TouchpointQueryReq req) {
        return ActionResponse.getSuccessResp(reviewService.queryChannelCapacityTrend(req));
    }

    @ApiOperation("策略触点执行-渠道业务产能")
    @PostMapping("/touchpoint/channelBizCapacity")
    public ActionResponse<List<ChannelBizVO>> channelBizCapacity(@Validated @RequestBody TouchpointQueryReq req) {
        return ActionResponse.getSuccessResp(reviewService.queryChannelBizCapacity(req));
    }

    @ApiOperation("策略触点执行-策略分类汇总（按业务大类+小类）")
    @PostMapping("/touchpoint/categorySummary")
    public ActionResponse<CategoryRespVO> categorySummary(@Validated @RequestBody TouchpointQueryReq req) {
        return ActionResponse.getSuccessResp(reviewService.queryCategorySummary(req));
    }

    @ApiOperation("策略执行明细-策略信息")
    @PostMapping("/execution/strategyInfo")
    public ActionResponse<StrategyInfoVO> strategyInfo(@Validated @RequestBody ExecutionQueryReq req) {
        return ActionResponse.getSuccessResp(reviewService.queryStrategyInfo(req));
    }

    @ApiOperation("策略执行明细-产能趋势（近6个月）")
    @PostMapping("/execution/capacityTrend")
    public ActionResponse<StrategyTrendVO> capacityTrend(@Validated @RequestBody ExecutionQueryReq req) {
        return ActionResponse.getSuccessResp(reviewService.queryStrategyCapacityTrend(req));
    }

    @ApiOperation("策略执行明细-业务产能（分页）")
    @PostMapping("/execution/bizCapacity")
    public ActionResponse<PageResultVO<StrategyBizVO>> bizCapacity(@Validated @RequestBody ExecutionQueryReq req) {
        return ActionResponse.getSuccessResp(reviewService.queryStrategyBizCapacity(req));
    }

    @ApiOperation("策略执行明细-日粒度明细（分页）")
    @PostMapping("/execution/dailyDetail")
    public ActionResponse<PageResultVO<StrategyDailyVO>> dailyDetail(@Validated @RequestBody ExecutionQueryReq req) {
        return ActionResponse.getSuccessResp(reviewService.queryStrategyDailyDetail(req));
    }

    @ApiOperation("策略执行明细 - 拒绝原因（active）")
    @PostMapping("/execution/rejectReason")
    public ActionResponse<RejectReasonRespVO> rejectReason(@Validated @RequestBody ExecutionQueryReq req) {
        return ActionResponse.getSuccessResp(reviewService.queryRejectReason(req));
    }

    @ApiOperation("获取最新数据日期（用于前端初始化日期范围）")
    @PostMapping("/latestDate")
    public ActionResponse<String> latestDate(@RequestBody DimQueryReq req) {
        // 注意：ActionResponse.getSuccessResp(String) 重载会把参数当作 message，
        // 必须强转为 Object 走 getSuccessResp(Object) 重载，才能正确放入 data
        return ActionResponse.getSuccessResp((Object) reviewService.getLatestDataDate(req));
    }
}
