package com.asiainfo.biapp.pec.plan.jx.strategyreview.service.impl;

/** Product-view names for legacy control metric codes, including existing database metadata. */
final class ControlMetricNames {
    private ControlMetricNames() {}

    static String overviewCode(String code) {
        if (code == null) return null;
        switch (code) {
            case "push_count": return "consult_count";
            case "usage_count": return "retain_count";
            case "usage_rate": return "retain_rate";
            case "reach_count": return "dispatch_count";
            case "product_conv_num": return "success_count";
            case "product_conv_rate": return "success_rate";
            case "actual_income": return "income";
            default: return code;
        }
    }

    static String summaryCode(String code) {
        if (code == null) return null;
        switch (code) {
            case "consult_count": return "push_count";
            case "retain_count": return "usage_count";
            case "retain_rate": return "usage_rate";
            case "dispatch_count": return "reach_count";
            case "success_count": return "product_conv_num";
            case "success_rate": return "product_conv_rate";
            case "income": return "actual_income";
            default: return code;
        }
    }

    static String label(String code, String fallback) {
        if (code == null) return fallback;
        switch (code) {
            case "consult_count": return "推送量";
            case "retain_count": return "使用量";
            case "retain_rate": return "使用率";
            case "reach_rate": return "触达率";
            case "dispatch_count": return "触达量";
            case "success_count": return "转化量";
            case "success_rate": return "转化率";
            case "income": return "收入";
            default: return fallback;
        }
    }

    static String unit(String code, String fallback) {
        return "dispatch_count".equals(code) || "success_count".equals(code) ? "次" : fallback;
    }
}
