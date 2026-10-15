package com.asiainfo.biapp.pec.plan.jx.strategyreview.service.impl;

import com.asiainfo.biapp.pec.core.exception.BaseException;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.mapper.SrFavoriteMapper;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.model.SrFavorite;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.service.IStrategyFavoriteService;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.FavoriteOpReq;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.FavoriteQueryReq;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.PageResultVO;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.StrategyRowVO;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * 策略复盘-收藏服务实现
 */
@Slf4j
@Service
public class StrategyFavoriteServiceImpl implements IStrategyFavoriteService {

    @Autowired
    private SrFavoriteMapper favoriteMapper;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void addFavorites(FavoriteOpReq req, String userId) {
        List<SrFavorite> baseInfos = "control".equals(req.getTabType())
                ? favoriteMapper.selectStrategyBaseInfoCtrl(req.getStrategyIds())
                : favoriteMapper.selectStrategyBaseInfo(req.getStrategyIds(), req.getTabType());
        if (baseInfos.size() != req.getStrategyIds().size()) {
            throw new BaseException("存在无效的策略ID，请刷新后重试");
        }
        for (SrFavorite base : baseInfos) {
            SrFavorite favorite = new SrFavorite();
            favorite.setUserId(userId);
            favorite.setTabType(req.getTabType());
            favorite.setStrategyId(base.getStrategyId());
            favorite.setStrategyName(base.getStrategyName());
            favorite.setChannel(base.getChannel());
            favorite.setRuleId(req.getRuleId());
            favorite.setSource("manual");
            favoriteMapper.deleteFavorite(userId, favorite.getTabType(), favorite.getStrategyId());
            favoriteMapper.upsertFavorite(favorite);
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void removeFavorites(FavoriteOpReq req, String userId) {
        favoriteMapper.removeFavorites(userId, req.getTabType(), req.getStrategyIds());
    }

    @Override
    public PageResultVO<StrategyRowVO> queryFavoriteList(FavoriteQueryReq req, String userId) {
        if (StringUtils.isBlank(userId)) {
            throw new BaseException("用户未登录");
        }
        String statMonth = StringUtils.defaultIfBlank(req.getStatMonth(), currentMonth());
        int pageNum = req.getPageNum() == null || req.getPageNum() < 1 ? 1 : req.getPageNum();
        int pageSize = normalizePageSize(req.getPageSize());
        long total = favoriteMapper.countFavoriteList(userId, req.getTabType());
        List<StrategyRowVO> list;
        if (total == 0) {
            list = new ArrayList<>();
        } else {
            list = favoriteMapper.selectFavoriteList(userId, req.getTabType(), statMonth,
                    (pageNum - 1) * pageSize, pageSize);
        }
        return PageResultVO.of(list, total,new StrategyRowVO(), pageNum, pageSize);
    }

    // ==================== 私有工具方法 ====================

    /** 当前账期 yyyy-MM */
    private String currentMonth() {
        return java.time.YearMonth.now().toString();
    }

    private int normalizePageSize(Integer pageSize) {
        if (pageSize == null || pageSize < 1) {
            return 10;
        }
        return Math.min(pageSize, 500);
    }
}
