package com.asiainfo.biapp.pec.plan.jx.strategyreview.mapper;

import com.asiainfo.biapp.pec.plan.jx.strategyreview.model.SrFavorite;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.StrategyRowVO;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.FavoriteQueryReq;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 策略收藏 Mapper
 */
@Mapper
public interface SrFavoriteMapper {

    /** 收藏列表-当前页 */
    List<StrategyRowVO> selectFavoriteList(@Param("userId") String userId,
                                           @Param("tabType") String tabType,
                                           @Param("statMonth") String statMonth,
                                           @Param("offset") int offset,
                                           @Param("limit") int limit,
                                           @Param("query") FavoriteQueryReq query);

    /** 收藏列表-总数 */
    long countFavoriteList(@Param("userId") String userId,
                           @Param("tabType") String tabType,
                           @Param("query") FavoriteQueryReq query);

    /** 当前用户已收藏策略及来源，用于关注/取消关注时保留手动收藏 */
    List<SrFavorite> selectFavoriteStates(@Param("userId") String userId,
                                          @Param("tabType") String tabType,
                                          @Param("strategyIds") List<String> strategyIds);

    /** 更新收藏来源和关联规则 */
    int updateFavoriteSource(@Param("userId") String userId,
                             @Param("tabType") String tabType,
                             @Param("strategyId") String strategyId,
                             @Param("source") String source,
                             @Param("ruleId") String ruleId);

    /** 已存在的有效收藏策略ID集合 */
    List<Long> selectExistFavoriteIds(@Param("userId") String userId,
                                      @Param("tabType") String tabType,
                                      @Param("strategyIds") List<String> strategyIds);

    /** 新增收藏（GreatDB 不支持 ON DUPLICATE KEY UPDATE，需先 deleteFavorite 物理删除后再插入，避免唯一索引冲突） */
    int upsertFavorite(SrFavorite favorite);

    /** 物理删除指定收藏（含逻辑删除历史行，释放唯一索引 uk_fav_user_tab_str 占用） */
    int deleteFavorite(@Param("userId") String userId,
                       @Param("tabType") String tabType,
                       @Param("strategyId") String strategyId);

    /** 批量移出收藏（逻辑删除） */
    int removeFavorites(@Param("userId") String userId,
                        @Param("tabType") String tabType,
                        @Param("strategyIds") List<String> strategyIds);

    /** 根据策略ID集合查询策略名称/渠道（收藏冗余），数据源与预警命中列表一致（period_summary） */
    List<SrFavorite> selectStrategyBaseInfo(@Param("strategyIds") List<String> strategyIds,
                                            @Param("tabType") String tabType);

    /** control 分支：根据策略ID集合查询策略名称/渠道（收藏冗余） */
    List<SrFavorite> selectStrategyBaseInfoCtrl(@Param("strategyIds") List<String> strategyIds);
}
