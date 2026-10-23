package com.asiainfo.biapp.pec.plan.jx.strategyreview.mapper;

import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.TouchpointQueryReq;
import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.resp.DimItemVO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;
import java.util.Map;

@Mapper
public interface SrStrategyScopeMapper {
    List<DimItemVO> selectCustomerDimensions();
    List<DimItemVO> selectProductDimensions();
    List<Map<String, Object>> selectMetrics(@Param("query") TouchpointQueryReq query,
                                          @Param("dimension") String dimension);
    Integer selectDailyCutoff(@Param("query") TouchpointQueryReq query);
    List<Map<String, Object>> selectSamePeriodMetrics(@Param("query") TouchpointQueryReq query,
                                                       @Param("dimension") String dimension,
                                                       @Param("previousMonth") String previousMonth,
                                                       @Param("cutoffDay") Integer cutoffDay);
    List<Map<String, Object>> selectBusiness(@Param("query") TouchpointQueryReq query);
}
