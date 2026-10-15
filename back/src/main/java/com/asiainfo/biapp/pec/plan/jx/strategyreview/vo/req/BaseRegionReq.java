package com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req;

import lombok.Data;

/**
 * 策略复盘-公共请求参数
 * 说明：cityId/countyId 以网关注入值为准，body 传值仅作为兜底
 */
@Data
public class BaseRegionReq {

    /** 地市编码（以网关注入为准） */
    private String cityId;

    /** 区县编码（以网关注入为准） */
    private String countyId;

    /** 登录用户ID（IOP 单点登录透传，前端 sessionStorage 传入） */
    private String userId;
}
