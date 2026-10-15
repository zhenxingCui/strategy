package com.asiainfo.biapp.pec.plan.jx.strategyreview.service;

import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.FavoriteOpReq;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.FavoriteQueryReq;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.PageResultVO;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.StrategyRowVO;

/**
 * 策略复盘-收藏服务
 */
public interface IStrategyFavoriteService {

    /** 批量加入收藏（已收藏的静默跳过） */
    void addFavorites(FavoriteOpReq req, String userId);

    /** 批量移出收藏 */
    void removeFavorites(FavoriteOpReq req, String userId);

    /** 收藏列表（分页，含当期执行指标） */
    PageResultVO<StrategyRowVO> queryFavoriteList(FavoriteQueryReq req, String userId);
}
