package com.asiainfo.biapp.pec.plan.jx.strategyreview.mapper;

import com.asiainfo.biapp.pec.plan.jx.strategyreview.model.SrWarningRule;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.model.SrWarningRuleCondition;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.StrategyRowVO;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.WarningRuleVO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 历史预警规则 Mapper
 */
@Mapper
public interface SrWarningMapper {

    // ==================== 规则维护 ====================

    /** 规则列表-当前页 */
    List<WarningRuleVO> selectRuleList(@Param("tabType") String tabType,
                                       @Param("ruleName") String ruleName,
                                       @Param("status") String status,
                                       @Param("ruleId") String ruleId,
                                       @Param("userCode") String userCode,
                                       @Param("offset") int offset,
                                       @Param("limit") int limit);

    WarningRuleVO queryRuleById(@Param("tabType") String tabType,
                                       @Param("ruleId") String ruleId,
                                       @Param("status") String status);

    /** 规则列表-总数 */
    long countRuleList(@Param("tabType") String tabType,
                       @Param("ruleName") String ruleName,
                       @Param("status") String status,
                       @Param("ruleId") String ruleId,
                       @Param("userCode") String userCode
    );

    /** 规则详情（含条件） */
    WarningRuleVO selectRuleDetail(@Param("id") Long id);

    /** 规则条件列表 */
    List<WarningRuleVO.WarningRuleConditionVO> selectRuleConditions(@Param("ruleId") Long ruleId);

    /** 新增规则 */
    int insertRule(SrWarningRule rule);

    /** 更新规则 */
    int updateRule(SrWarningRule rule);

    /** 逻辑删除规则 */
    int deleteRuleById(@Param("id") Long id, @Param("updateBy") String updateBy);

    /** 更新规则状态 */
    int updateRuleStatus(@Param("id") Long id,
                         @Param("status") String status,
                         @Param("updateBy") String updateBy);

    /** 新增规则条件 */
    int insertRuleCondition(SrWarningRuleCondition condition);

    /** 批量逻辑删除规则条件 */
    int deleteRuleConditions(@Param("ruleId") Long ruleId, @Param("updateBy") String updateBy);

    /** 根据策略ID查渠道名称集合（收藏冗余用） */
    List<String> selectChannelNamesByCodes(@Param("channels") List<String> channels);

    // ==================== 命中策略 ====================

    /** 命中策略列表-当前页 */
    List<StrategyRowVO> selectHitStrategyList(@Param("tabType") String tabType,
                                              @Param("ruleId") Long ruleId,
                                              @Param("statMonth") String statMonth,
                                              @Param("conditionSQL") String conditionSQL,
                                              @Param("cityId") String cityId,
                                              @Param("countyId") String countyId,
                                              @Param("channel") String channel,
                                              @Param("strategyClass") String strategyClass,
                                              @Param("customerGroup") String customerGroup,
                                           @Param("productName") String productName,
                                              @Param("rule") WarningRuleVO rule,
                                              @Param("favorite") boolean favorite,
                                              @Param("userId") String userId,
                                              @Param("offset") int offset,
                                              @Param("limit") int limit);

    /** 命中策略列表-总数 */
    long countHitStrategyList(@Param("tabType") String tabType,
                              @Param("ruleId") Long ruleId,
                              @Param("statMonth") String statMonth,
                              @Param("conditionSQL") String conditionSQL,
                              @Param("cityId") String cityId,
                              @Param("countyId") String countyId,
                              @Param("channel") String channel,
                              @Param("strategyClass") String strategyClass,
                                              @Param("customerGroup") String customerGroup,
                                           @Param("productName") String productName,
                              @Param("rule") WarningRuleVO rule,
                              @Param("favorite") boolean favorite,
                              @Param("userId") String userId
    );

    /** 切换命中记录关注状态 */
    int updateHitFollowed(@Param("strategyId") String strategyId,
                          @Param("tabType") String tabType,
                          @Param("followed") Boolean followed,
                          @Param("userId") String userId);
}
