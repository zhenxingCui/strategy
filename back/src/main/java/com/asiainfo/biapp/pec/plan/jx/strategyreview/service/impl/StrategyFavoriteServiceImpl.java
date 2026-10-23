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
import java.util.HashMap;
import java.util.List;
import java.util.Map;

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
        Map<String, SrFavorite> existingFavorites = new HashMap<>();
        for (SrFavorite favorite : favoriteMapper.selectFavoriteStates(userId, req.getTabType(), req.getStrategyIds())) {
            existingFavorites.put(favorite.getStrategyId(), favorite);
        }
        for (SrFavorite base : baseInfos) {
            SrFavorite existing = existingFavorites.get(base.getStrategyId());
            if (existing != null) {
                if ("follow".equals(existing.getSource())) {
                    favoriteMapper.updateFavoriteSource(userId, req.getTabType(), base.getStrategyId(),
                            "manual+follow", existing.getRuleId());
                }
                // 已手动收藏或已同时收藏/关注时静默跳过，避免覆盖规则关注关系。
                continue;
            }
            SrFavorite favorite = new SrFavorite();
            favorite.setUserId(userId);
            favorite.setTabType(req.getTabType());
            favorite.setStrategyId(base.getStrategyId());
            favorite.setStrategyName(base.getStrategyName());
            favorite.setChannel(base.getChannel());
            favorite.setRuleId(req.getRuleId());
            favorite.setSource("manual");
            // 释放可能存在的软删除历史行，满足 user/tab/strategy 唯一索引。
            favoriteMapper.deleteFavorite(userId, favorite.getTabType(), favorite.getStrategyId());
            favoriteMapper.upsertFavorite(favorite);
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void removeFavorites(FavoriteOpReq req, String userId) {
        Map<String, SrFavorite> existingFavorites = new HashMap<>();
        for (SrFavorite favorite : favoriteMapper.selectFavoriteStates(userId, req.getTabType(), req.getStrategyIds())) {
            existingFavorites.put(favorite.getStrategyId(), favorite);
        }
        List<String> removeIds = new ArrayList<>();
        for (String strategyId : req.getStrategyIds()) {
            SrFavorite existing = existingFavorites.get(strategyId);
            if (existing != null && "manual+follow".equals(existing.getSource())) {
                favoriteMapper.updateFavoriteSource(userId, req.getTabType(), strategyId, "follow", existing.getRuleId());
            } else if (existing != null) {
                removeIds.add(strategyId);
            }
        }
        if (!removeIds.isEmpty()) {
            favoriteMapper.removeFavorites(userId, req.getTabType(), removeIds);
        }
    }

    @Override
    public PageResultVO<StrategyRowVO> queryFavoriteList(FavoriteQueryReq req, String userId) {
        if (StringUtils.isBlank(userId)) {
            throw new BaseException("用户未登录");
        }
        String statMonth = StringUtils.defaultIfBlank(req.getStatMonth(), currentMonth());
        req.setStatMonth(statMonth);
        int pageNum = req.getPageNum() == null || req.getPageNum() < 1 ? 1 : req.getPageNum();
        int pageSize = normalizePageSize(req.getPageSize());
        long total = favoriteMapper.countFavoriteList(userId, req.getTabType(), req);
        List<StrategyRowVO> list;
        if (total == 0) {
            list = new ArrayList<>();
        } else {
            list = favoriteMapper.selectFavoriteList(userId, req.getTabType(), statMonth,
                    (pageNum - 1) * pageSize, pageSize, req);
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
