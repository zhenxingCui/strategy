package com.asiainfo.biapp.pec.plan.jx.strategyreview.service.impl;

import com.asiainfo.biapp.pec.core.exception.BaseException;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.mapper.SrFavoriteMapper;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.mapper.SrWarningMapper;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.model.SrFavorite;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.model.SrWarningRule;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.model.SrWarningRuleCondition;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.service.IStrategyWarningService;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.FavoriteOpReq;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.WarningConditionItem;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.WarningRuleOpReq;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.WarningRuleQueryReq;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.WarningRuleSaveReq;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.PageResultVO;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.StrategyRowVO;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.WarningRuleVO;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 策略复盘-历史预警规则服务实现
 */
@Slf4j
@Service
public class StrategyWarningServiceImpl implements IStrategyWarningService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private static final Map<String, String> OPERATOR_SYMBOL = new HashMap<>();

    static {
        OPERATOR_SYMBOL.put("gte", "≥");
        OPERATOR_SYMBOL.put("lte", "≤");
        OPERATOR_SYMBOL.put("gt", "＞");
        OPERATOR_SYMBOL.put("lt", "＜");
        OPERATOR_SYMBOL.put("eq", "＝");
    }

    @Autowired
    private SrWarningMapper warningMapper;

    @Autowired
    private SrFavoriteMapper favoriteMapper;

    @Override
    public PageResultVO<WarningRuleVO> queryRuleList(WarningRuleQueryReq req) {
        int pageNum = req.getPageNum() == null || req.getPageNum() < 1 ? 1 : req.getPageNum();
        int pageSize = normalizePageSize(req.getPageSize());
        long total = warningMapper.countRuleList(req.getTabType(), req.getRuleName(), req.getStatus(), null, req.getUserCode());
        List<WarningRuleVO> list;
        if (total == 0) {
            list = new ArrayList<>();
        } else {
            list = warningMapper.selectRuleList(req.getTabType(), req.getRuleName(), req.getStatus(), null, req.getUserCode(),
                    (pageNum - 1) * pageSize, pageSize);
        }
        for (WarningRuleVO vo : list) {
            vo.setConditions(warningMapper.selectRuleConditions(vo.getId()));
            decorateRule(vo);
        }
        return PageResultVO.of(list, total, new WarningRuleVO(),pageNum, pageSize);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Long createRule(WarningRuleSaveReq req, String userId) {
        SrWarningRule rule = buildRule(req, userId);
        rule.setCreateBy(userId);
        rule.setCreator(userId);
        warningMapper.insertRule(rule);
        saveConditions(rule.getId(), req.getConditions());
        return rule.getId();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void updateRule(WarningRuleSaveReq req, String userId) {
        if (req.getId() == null) {
            throw new BaseException("编辑规则时规则ID不能为空");
        }
        WarningRuleVO exist = warningMapper.selectRuleDetail(req.getId());
        if (exist == null) {
            throw new BaseException("规则不存在或已删除");
        }
        SrWarningRule rule = buildRule(req, userId);
        rule.setId(req.getId());
        // 状态沿用库里原值，避免编辑时误改状态
        rule.setStatus(exist.getStatus());
        warningMapper.updateRule(rule);
        // 条件全量替换：先逻辑删除旧条件，再写入新条件
        warningMapper.deleteRuleConditions(req.getId(), userId);
        saveConditions(req.getId(), req.getConditions());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteRule(WarningRuleOpReq req, String userId) {
        WarningRuleVO exist = warningMapper.selectRuleDetail(req.getId());
        if (exist == null) {
            throw new BaseException("规则不存在或已删除");
        }
        warningMapper.deleteRuleById(req.getId(), userId);
        warningMapper.deleteRuleConditions(req.getId(), userId);
    }

    @Override
    public WarningRuleVO queryRuleDetail(WarningRuleOpReq req) {
        WarningRuleVO vo = warningMapper.selectRuleDetail(req.getId());
        if (vo == null) {
            throw new BaseException("规则不存在或已删除");
        }
        vo.setConditions(warningMapper.selectRuleConditions(req.getId()));
        decorateRule(vo);
        return vo;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void updateRuleStatus(WarningRuleOpReq req, String userId) {
        String target = StringUtils.defaultIfBlank(req.getStatus(), "已停用");
        if (!"生效中".equals(target) && !"已停用".equals(target)) {
            throw new BaseException("目标状态只允许：生效中/已停用");
        }
        WarningRuleVO exist = warningMapper.selectRuleDetail(req.getId());
        if (exist == null) {
            throw new BaseException("规则不存在或已删除");
        }
        warningMapper.updateRuleStatus(req.getId(), target, userId);
    }

    @Override
    public PageResultVO<StrategyRowVO> queryHitStrategyList(WarningRuleQueryReq req) {
        if (req.getRuleId() == null) throw new BaseException("请选择预警规则");
        int pageNum = req.getPageNum() == null || req.getPageNum() < 1 ? 1 : req.getPageNum();
        int pageSize = normalizePageSize(req.getPageSize());
        String statMonth = StringUtils.defaultIfBlank(req.getStatMonth(), java.time.YearMonth.now().toString());
        WarningRuleVO warningRuleVO=warningMapper.queryRuleById(req.getTabType(), req.getRuleId().toString(),"生效中");
        // 规则不存在或已过期，返回空结果
        if (warningRuleVO == null) {
            log.warn("规则不存在或已过期: ruleId={}", req.getRuleId());
            return PageResultVO.of(new ArrayList<>(), 0L, new StrategyRowVO(), pageNum, pageSize);
        }
        decorateRule(warningRuleVO);
        List<WarningRuleVO.WarningRuleConditionVO> warnconditionlists = warningMapper.selectRuleConditions(warningRuleVO.getId());

        String conditionSQL = "";
        List<String> metricConditions = new ArrayList<>();
        // 限定事实表列名；OR 条件必须加括号，避免绕过账期、地区和触点过滤。
        List<String> allowedMetrics = "control".equals(req.getTabType())
                ? Arrays.asList("consult_count", "retain_count", "retain_rate", "dispatch_count", "success_count", "success_rate", "income")
                : Arrays.asList("strategy_count", "original_cust", "push_count", "usage_count", "usage_rate", "reach_count", "target_conv_num", "target_conv_rate", "product_conv_num", "product_conv_rate", "expected_income", "actual_income", "reject_count", "reject_rate");
        for (WarningRuleVO.WarningRuleConditionVO vo : warnconditionlists) {
            if (!allowedMetrics.contains(vo.getMetricCode()) || StringUtils.isBlank(getOption(vo.getOperator())) || vo.getThreshold() == null) {
                throw new BaseException("预警规则指标或操作符无效");
            }
            metricConditions.add("s." + vo.getMetricCode() + getOption(vo.getOperator()) + vo.getThreshold().toPlainString());
        }
        if (metricConditions.isEmpty()) throw new BaseException("预警规则未配置指标条件");
        conditionSQL += " AND (" + StringUtils.join(metricConditions, "or".equalsIgnoreCase(warningRuleVO.getLogic()) ? " OR " : " AND ") + ")";

        boolean favorite = StringUtils.isNotBlank(req.getFavorite());
        String userId = StringUtils.defaultIfBlank(req.getUserId(), "admin");
        long total = warningMapper.countHitStrategyList(req.getTabType(), req.getRuleId(), statMonth, conditionSQL,
                req.getCityId(), req.getCountyId(), req.getChannel(), req.getStrategyClass(), req.getCustomerGroup(), req.getProductName(), warningRuleVO, favorite, userId);
        List<StrategyRowVO> list;
        if (total == 0) {
            list = new ArrayList<>();
        } else {
            list = warningMapper.selectHitStrategyList(req.getTabType(), req.getRuleId(), statMonth,conditionSQL,
                    req.getCityId(), req.getCountyId(), req.getChannel(), req.getStrategyClass(), req.getCustomerGroup(), req.getProductName(), warningRuleVO, favorite, userId, (pageNum - 1) * pageSize, pageSize);
        }
        return PageResultVO.of(list, total,new StrategyRowVO(), pageNum, pageSize);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void toggleFollow(FavoriteOpReq req, String userId) {
        if (StringUtils.isBlank(req.getRuleId()) || !req.getRuleId().matches("[0-9]+")
                || warningMapper.queryRuleById(req.getTabType(), req.getRuleId(), null) == null) {
            throw new BaseException("请选择有效的预警规则");
        }
        boolean followed = !Boolean.FALSE.equals(req.getFollowed());
        Map<String, SrFavorite> existingFavorites = new HashMap<>();
        for (SrFavorite favorite : favoriteMapper.selectFavoriteStates(userId, req.getTabType(), req.getStrategyIds())) {
            existingFavorites.put(favorite.getStrategyId(), favorite);
        }
        if (followed) {
            // 关注的命中策略自动进入收藏，来源标记为 follow；数据源与命中列表一致（period_summary），strategyId 保持业务ID
            List<SrFavorite> baseInfos = "control".equals(req.getTabType())
                ? favoriteMapper.selectStrategyBaseInfoCtrl(req.getStrategyIds())
                : favoriteMapper.selectStrategyBaseInfo(req.getStrategyIds(), req.getTabType());
            if (baseInfos.size() != new java.util.HashSet<>(req.getStrategyIds()).size()) {
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
                SrFavorite existing = existingFavorites.get(favorite.getStrategyId());
                if (existing == null) {
                    favorite.setSource("follow");
                    // 清除软删除历史行占用的唯一键，支持取消关注后再次关注。
                    favoriteMapper.deleteFavorite(userId, favorite.getTabType(), favorite.getStrategyId());
                    favoriteMapper.upsertFavorite(favorite);
                } else {
                    // 同一策略可以同时被手动收藏和规则关注；保留其收藏记录，取消关注时再恢复为 manual。
                    String source = "manual".equals(existing.getSource()) || "manual+follow".equals(existing.getSource())
                            ? "manual+follow" : "follow";
                    favoriteMapper.updateFavoriteSource(userId, favorite.getTabType(), favorite.getStrategyId(),
                            source, FavoriteRuleLinks.add(existing.getRuleId(), req.getRuleId()));
                }
            }
        } else {
            List<String> removeIds = new ArrayList<>();
            for (String strategyId : req.getStrategyIds()) {
                SrFavorite existing = existingFavorites.get(strategyId);
                if (existing == null) continue;
                if ("manual+follow".equals(existing.getSource()) || "follow".equals(existing.getSource())) {
                    String remaining = FavoriteRuleLinks.remove(existing.getRuleId(), req.getRuleId());
                    boolean manual = "manual+follow".equals(existing.getSource());
                    if (remaining != null || manual) {
                        favoriteMapper.updateFavoriteSource(userId, req.getTabType(), strategyId,
                                remaining == null ? "manual" : manual ? "manual+follow" : "follow", remaining);
                    } else {
                        removeIds.add(strategyId);
                    }
                }
            }
            if (!removeIds.isEmpty()) {
                favoriteMapper.removeFavorites(userId, req.getTabType(), removeIds);
            }
        }
        for (String strategyId : req.getStrategyIds()) {
            warningMapper.updateHitFollowed(strategyId, req.getTabType(), followed, userId);
        }
    }

    // ==================== 私有工具方法 ====================

    /** 保存规则条件列表 */
    private void saveConditions(Long ruleId, List<WarningConditionItem> conditions) {
        int sortNo = 1;
        for (WarningConditionItem item : conditions) {
            SrWarningRuleCondition condition = new SrWarningRuleCondition();
            condition.setRuleId(ruleId);
            condition.setMetricCode(item.getMetricCode());
            condition.setMetricName(item.getMetricName());
            condition.setOperator(item.getOperator());
            condition.setThreshold(item.getThreshold());
            condition.setUnit(item.getUnit());
            condition.setSortNo(sortNo++);
            warningMapper.insertRuleCondition(condition);
        }
    }

    /** 数据账期兼容月份格式：yyyy-MM 补全为日期（开始取当月1日，结束取月末），yyyy-MM-dd 原样返回 */
    private String normalizeMonthToDay(String value, boolean endOfMonth) {
        if (StringUtils.isBlank(value)) {
            return value;
        }
        String t = value.trim();
        if (t.length() == 7 && t.indexOf('-') == 4) {
            YearMonth ym = YearMonth.parse(t);
            return endOfMonth ? ym.atEndOfMonth().toString() : ym.atDay(1).toString();
        }
        return t;
    }

    /** 请求转实体（含 desc 自动拼接、channels/strategies 逗号串转换） */
    private SrWarningRule buildRule(WarningRuleSaveReq req, String userId) {
        LocalDate start;
        LocalDate end;
        LocalDate datatartDate;
        LocalDate dataEndDate;
        try {
            start = LocalDate.parse(req.getStartDate(), DATE_FMT);
            end = LocalDate.parse(req.getEndDate(), DATE_FMT);
            datatartDate = LocalDate.parse(normalizeMonthToDay(req.getDataStartDate(), false), DATE_FMT);
            dataEndDate = LocalDate.parse(normalizeMonthToDay(req.getDataEndDate(), true), DATE_FMT);

        } catch (Exception e) {
            throw new BaseException("日期格式不正确，应为 yyyy-MM-dd 或 yyyy-MM（数据日期）");
        }
        if (end.isBefore(start)) {
            throw new BaseException("生效结束日不能早于生效起始日");
        }
        SrWarningRule rule = new SrWarningRule();
        rule.setRuleName(req.getRuleName());
        rule.setRuleDesc(StringUtils.defaultIfBlank(req.getDesc(), buildAutoDesc(req)));
        rule.setTabType(req.getTabType());
        rule.setStatus(StringUtils.defaultIfBlank(req.getStatus(), "生效中"));
        rule.setStartDate(java.sql.Date.valueOf(start));
        rule.setEndDate(java.sql.Date.valueOf(end));
        rule.setDataStartDate(java.sql.Date.valueOf(datatartDate));
        rule.setDataEndDate(java.sql.Date.valueOf(dataEndDate));
        rule.setChannels(req.getChannels() == null ? null : StringUtils.join(req.getChannels(), ","));
        rule.setStrategies(req.getStrategies() == null ? null : StringUtils.join(req.getStrategies(), ","));
        rule.setLogic(StringUtils.defaultIfBlank(req.getLogic(), "and"));
        rule.setUpdateBy(userId);
        return rule;
    }

    /** desc 为空时按条件自动拼接：指标A ≥ 100 且 指标B ≤ 50 */
    private String buildAutoDesc(WarningRuleSaveReq req) {
        String joiner = "or".equalsIgnoreCase(req.getLogic()) ? " 或 " : " 且 ";
        StringBuilder sb = new StringBuilder();
        List<String> parts = new ArrayList<>();
        for (WarningConditionItem item : req.getConditions()) {
            String symbol = OPERATOR_SYMBOL.getOrDefault(item.getOperator(), item.getOperator());
            String unit = StringUtils.isBlank(item.getUnit()) ? "" : item.getUnit();
            parts.add(item.getMetricName() + " " + symbol + " " + item.getThreshold() + unit);
        }
        return StringUtils.join(parts, joiner);
    }

    /** 列表行装饰：动态过期、状态徽标、日期区间、创建人展示、渠道/策略串拆分 */
    private void decorateRule(WarningRuleVO vo) {
        if ("control".equals(vo.getTabType()) && vo.getConditions() != null) {
            for (WarningRuleVO.WarningRuleConditionVO condition : vo.getConditions()) {
                condition.setMetricName(ControlMetricNames.label(condition.getMetricCode(), condition.getMetricName()));
                condition.setUnit(ControlMetricNames.unit(condition.getMetricCode(), condition.getUnit()));
            }
        }
        LocalDate today = LocalDate.now();
        LocalDate end;
        try {
            end = StringUtils.isBlank(vo.getEndDate()) ? null : LocalDate.parse(vo.getEndDate(), DATE_FMT);
        } catch (Exception e) {
            end = null;
        }
        // 已过期为动态判断：库里仍为生效中但已过生效期
        if ("生效中".equals(vo.getStatus()) && end != null && end.isBefore(today)) {
            vo.setStatus("已过期");
        }
        vo.setStatusType("生效中".equals(vo.getStatus()) ? "success" : "gray");
        vo.setDateRange(vo.getStartDate() + " ~ " + vo.getEndDate());
        if (StringUtils.isNotBlank(vo.getCreateTime()) && vo.getCreateTime().length() >= 10) {
            // 展示为 MM-dd 创建
            vo.setCreator(vo.getCreateTime().substring(5, 10).replace("-", "/") + " 创建");
        } else {
            vo.setCreator(vo.getCreateBy());
        }
        // 已过期/已停用规则不返回命中数
        if (!"生效中".equals(vo.getStatus())) {
            vo.setHitCount(null);
        }
        vo.setChannels(splitToList(vo.getChannelsStr()));
        vo.setChannelNames(queryChannelNames(vo.getChannels()));
        vo.setStrategies(splitToList(vo.getStrategiesStr()));
    }

    private List<String> queryChannelNames(List<String> channels) {
        if (channels == null || channels.isEmpty()) {
            return Collections.emptyList();
        }
        return warningMapper.selectChannelNamesByCodes(channels);
    }

    private List<String> splitToList(String str) {
        if (StringUtils.isBlank(str)) {
            return new ArrayList<>();
        }
        return new ArrayList<>(Arrays.asList(str.split(",")));
    }

    private int normalizePageSize(Integer pageSize) {
        if (pageSize == null || pageSize < 1) {
            return 10;
        }
        return Math.min(pageSize, 500);
    }

    /**
     * gte/lte/gt/lt/eq 转化为操作符号
     * @return
     */
    private  String getOption(String str){
        if (str == null) {
            return "";
        }
        switch (str.trim()) {
            case "gte":
            case ">=":
            case "≥":
                return " >= ";
            case "lte":
            case "<=":
            case "≤":
                return " <= ";
            case "gt":
            case ">":
            case "＞":
                return " > ";
            case "lt":
            case "<":
            case "＜":
                return " < ";
            case "eq":
            case "=":
            case "＝":
                return " = ";
            default:
                return "";
        }
    }

}
