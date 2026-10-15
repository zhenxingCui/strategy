package com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

/**
 * 枚举字典项
 */
@Data
@ApiModel("枚举字典项")
public class DimItemVO {

    @ApiModelProperty("编码，持久化到数据库的值")
    private String keyCode;

    @ApiModelProperty("名称，用于展示")
    private String keyName;
}
