package com.asiainfo.biapp.pec.plan.jx.strategyreview.controller;

import com.asiainfo.biapp.pec.common.jx.util.UserUtilJx;
import com.asiainfo.biapp.pec.core.common.ActionResponse;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.service.IStrategyFavoriteService;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.FavoriteOpReq;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.FavoriteQueryReq;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.PageResultVO;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.StrategyRowVO;
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
 * 策略复盘-策略收藏
 */
@Slf4j
@RestController
@RequestMapping("/strategyReview/favorite")
@Validated
@Api(tags = "策略复盘与预警-策略收藏")
public class StrategyFavoriteController {

    @Autowired
    private IStrategyFavoriteService favoriteService;

    @ApiOperation("批量加入收藏（已收藏的静默跳过）")
    @PostMapping("/add")
    public ActionResponse<Boolean> add(@Validated @RequestBody FavoriteOpReq req) {
        String userId = resolveUserId(req.getUserId());
        favoriteService.addFavorites(req, userId);
        return ActionResponse.getSuccessResp(Boolean.TRUE);
    }

    @ApiOperation("批量移出收藏")
    @PostMapping("/remove")
    public ActionResponse<Boolean> remove(@Validated @RequestBody FavoriteOpReq req) {
        String userId = resolveUserId(req.getUserId());
        favoriteService.removeFavorites(req, userId);
        return ActionResponse.getSuccessResp(Boolean.TRUE);
    }

    @ApiOperation("收藏列表（分页，含当期执行指标）")
    @PostMapping("/list")
    public ActionResponse<PageResultVO<StrategyRowVO>> list(@Validated @RequestBody FavoriteQueryReq req) {
        String userId = resolveUserId(req.getUserId());
        return ActionResponse.getSuccessResp(favoriteService.queryFavoriteList(req, userId));
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
            return userId != null ? userId : "admin";
        } catch (Exception e) {
            return "admin";
        }
    }
}
