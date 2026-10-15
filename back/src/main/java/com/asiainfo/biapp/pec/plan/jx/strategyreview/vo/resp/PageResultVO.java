package com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 通用分页结果
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@ApiModel("通用分页结果")
public class PageResultVO<T> {

    @ApiModelProperty("当前页数据")
    private List<T> list;

    @ApiModelProperty("总条数")
    private Long total;

    @ApiModelProperty("合计行")
    private T calculate;

    @ApiModelProperty("页码")
    private Integer pageNum;

    @ApiModelProperty("每页条数")
    private Integer pageSize;

    public static <T> PageResultVO<T> of(List<T> list, long total, T calculate, int pageNum, int pageSize) {
        return new PageResultVO<>(list, total,calculate, pageNum, pageSize);
    }
}
