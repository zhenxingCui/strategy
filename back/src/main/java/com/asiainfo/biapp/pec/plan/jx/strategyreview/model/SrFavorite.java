package com.asiainfo.biapp.pec.plan.jx.strategyreview.model;

import lombok.Data;

import java.util.Date;

/**
 * 策略收藏表
 * 对应表：t_sr_favorite
 */
@Data
public class SrFavorite {

    /** 主键（收藏记录ID） */
    private Long id;

    /** 用户ID（网关注入） */
    private String userId;

    /** 策略类型：active/passive/control */
    private String tabType;

    /** 策略ID（t_sr_strategy.id） */
    private String strategyId;

    /** 策略名称（冗余，列表展示） */
    private String strategyName;

    /** 触点渠道（冗余） */
    private String channel;

    /** 关注规则ID集合，逗号分隔，兼容历史单ID；manual 来源时为 null。字段上限64字符。 */
    private String ruleId;

    /** 数据时间（冗余） */
    private Date dataDate;

    /** 来源：manual=主动收藏，follow=预警关注，manual+follow=同时手动收藏和规则关注 */
    private String source;

    /** 创建时间 */
    private Date createTime;

    /** 更新时间 */
    private Date updateTime;

    /** 逻辑删除：0=未删 1=已删 */
    private Integer isDeleted;
}
