package com.asiainfo.biapp.pec.plan.jx.strategyreview.service.impl;

/** Product-view names for legacy control metric codes, including existing database metadata. */
final class ControlMetricNames {
    private ControlMetricNames() {}

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
            default: return fallback;
        }
    }

    static String unit(String code, String fallback) {
        return "dispatch_count".equals(code) || "success_count".equals(code) ? "次" : fallback;
    }
}
