package com.asiainfo.biapp.pec.plan.jx.strategyreview.service.impl;

import com.asiainfo.biapp.pec.core.exception.BaseException;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Set;

/** 复用现有 rule_id 字段保存规则ID集合，兼容历史单ID，不修改表结构。 */
final class FavoriteRuleLinks {
    private FavoriteRuleLinks() { }

    static String add(String existing, String ruleId) {
        Set<String> ids = parse(existing);
        ids.add(ruleId);
        String value = String.join(",", ids);
        if (value.length() > 64) {
            throw new BaseException("该策略关联的关注规则已达到现有存储容量，请先取消部分规则关注");
        }
        return value;
    }

    static String remove(String existing, String ruleId) {
        Set<String> ids = parse(existing);
        ids.remove(ruleId);
        return ids.isEmpty() ? null : String.join(",", ids);
    }

    private static Set<String> parse(String value) {
        Set<String> ids = new LinkedHashSet<>();
        if (value != null && !value.trim().isEmpty()) {
            Arrays.stream(value.split(",")).map(String::trim).filter(s -> !s.isEmpty()).forEach(ids::add);
        }
        return ids;
    }
}
