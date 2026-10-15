package com.asiainfo.biapp.pec.plan.jx.strategyreview.service;

import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.FavoriteOpReq;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.WarningRuleOpReq;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.WarningRuleQueryReq;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.WarningRuleSaveReq;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.PageResultVO;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.StrategyRowVO;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.WarningRuleVO;

/**
 * 策略复盘-历史预警规则服务
 */
public interface IStrategyWarningService {

    /** 规则列表（分页） */
    PageResultVO<WarningRuleVO> queryRuleList(WarningRuleQueryReq req);

    /** 新增规则 */
    Long createRule(WarningRuleSaveReq req, String userId);

    /** 编辑规则 */
    void updateRule(WarningRuleSaveReq req, String userId);

    /** 删除规则（逻辑删除，同时删除条件与命中记录） */
    void deleteRule(WarningRuleOpReq req, String userId);

    /** 规则详情（含条件） */
    WarningRuleVO queryRuleDetail(WarningRuleOpReq req);

    /** 规则状态变更（启用/停用） */
    void updateRuleStatus(WarningRuleOpReq req, String userId);

    /** 命中策略列表（分页） */
    PageResultVO<StrategyRowVO> queryHitStrategyList(WarningRuleQueryReq req);

    /** 切换关注（同时同步收藏表），followed=true 关注，false 取消 */
    void toggleFollow(FavoriteOpReq req, String userId);
}
