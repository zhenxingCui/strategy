package com.asiainfo.biapp.pec.plan.jx.strategyreview.controller;

import com.asiainfo.biapp.pec.common.jx.util.UserUtilJx;
import com.asiainfo.biapp.pec.core.common.ActionResponse;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.service.IStrategyWarningService;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.FavoriteOpReq;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.WarningRuleOpReq;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.WarningRuleQueryReq;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.WarningRuleSaveReq;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.PageResultVO;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.StrategyRowVO;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.WarningRuleVO;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 策略复盘-历史预警规则
 */
@Slf4j
@RestController
@RequestMapping("/strategyReview/warning")
@Validated
@Api(tags = "策略复盘与预警-历史预警规则")
public class StrategyWarningController {

    @Autowired
    private IStrategyWarningService warningService;

    @ApiOperation("规则列表（分页）")
    @PostMapping("/ruleList")
    public ActionResponse<PageResultVO<WarningRuleVO>> ruleList(@Validated @RequestBody WarningRuleQueryReq req) {
        return ActionResponse.getSuccessResp(warningService.queryRuleList(req));
    }

    @ApiOperation("新增规则，返回新规则ID")
    @PostMapping("/ruleCreate")
    public ActionResponse<Long> ruleCreate(@Validated @RequestBody WarningRuleSaveReq req) {
        String userId = resolveUserId(req.getUserId());
        return ActionResponse.getSuccessResp(warningService.createRule(req, userId));
    }

    @ApiOperation("编辑规则")
    @PostMapping("/ruleUpdate")
    public ActionResponse<Boolean> ruleUpdate(@Validated @RequestBody WarningRuleSaveReq req) {
        String userId = resolveUserId(req.getUserId());
        warningService.updateRule(req, userId);
        return ActionResponse.getSuccessResp(Boolean.TRUE);
    }

    @ApiOperation("删除规则（逻辑删除）")
    @PostMapping("/ruleDelete")
    public ActionResponse<Boolean> ruleDelete(@Validated @RequestBody WarningRuleOpReq req) {
        String userId = resolveUserId(req.getUserId());
        warningService.deleteRule(req, userId);
        return ActionResponse.getSuccessResp(Boolean.TRUE);
    }

    @ApiOperation("规则详情（含预警条件）")
    @PostMapping("/ruleDetail")
    public ActionResponse<WarningRuleVO> ruleDetail(@Validated @RequestBody WarningRuleOpReq req) {
        return ActionResponse.getSuccessResp(warningService.queryRuleDetail(req));
    }

    @ApiOperation("规则状态变更（启用/停用）")
    @PostMapping("/ruleUpdateStatus")
    public ActionResponse<Boolean> ruleUpdateStatus(@Validated @RequestBody WarningRuleOpReq req) {
        String userId = resolveUserId(req.getUserId());
        warningService.updateRuleStatus(req, userId);
        return ActionResponse.getSuccessResp(Boolean.TRUE);
    }

    @ApiOperation("命中策略列表（分页）")
    @PostMapping("/hitStrategyList")
    public ActionResponse<PageResultVO<StrategyRowVO>> hitStrategyList(@Validated @RequestBody WarningRuleQueryReq req) {
        return ActionResponse.getSuccessResp(warningService.queryHitStrategyList(req));
    }

    @ApiOperation("切换关注（关注自动加入收藏，取消关注自动移出收藏）")
    @PostMapping("/toggleFollow")
    public ActionResponse<Boolean> toggleFollow(@Validated @RequestBody FavoriteOpReq req) {
        String userId = resolveUserId(req.getUserId());
        warningService.toggleFollow(req, userId);
        return ActionResponse.getSuccessResp(Boolean.TRUE);
    }

    /**
     * 解析当前用户ID：IOP 单点登录透传参数优先，其次登录态，最后兜底 admin
     */
    private String resolveUserId(String reqUserId) {
        if (reqUserId != null && !reqUserId.trim().isEmpty()) {
            return reqUserId.trim();
        }
        try {
            String userId = UserUtilJx.getUser().getUserId();
            return userId != null ? userId : "root";
        } catch (Exception e) {
            return "root";
        }
    }
}
