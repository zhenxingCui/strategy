package com.asiainfo.biapp.pec.plan.jx.strategyreview.service.impl;

import com.asiainfo.biapp.pec.plan.jx.strategyreview.vo.req.OverviewQueryReq;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.sql.*;
import java.time.YearMonth;
import java.util.*;

/** Refreshes existing overview summary rows from detail facts, preserving published QoQ. */
@Service
public class UpgradeStableOverviewRefreshService {
    @Autowired private JdbcTemplate jdbc;
    private static final String[] FIELDS = {"original_cust", "push_count", "usage_count", "reach_count", "target_conv_num", "product_conv_num", "expected_income", "actual_income", "reject_count"};
    private static final String DETAIL = " FROM t_sr_strategy_period_summary_ap WHERE tab_type='active' AND strategy_class=? AND city_id=? AND is_deleted=0 AND strategy_id IS NOT NULL AND strategy_id<>'999' AND channel IS NOT NULL AND channel<>'' AND channel<>'全部' AND big_category IS NOT NULL AND big_category<>'' AND big_category<>'全部' AND small_category IS NOT NULL AND small_category<>'' AND small_category<>'全部'";

    public String refresh(OverviewQueryReq req, String month, int months) {
        return jdbc.execute((ConnectionCallback<String>) c -> {
            String lock = "sr_overview_" + Integer.toHexString(req.getStrategyClass().hashCode());
            boolean acquired = false;
            boolean transactionStarted = false;
            SQLException failure = null;
            boolean oldAutoCommit = c.getAutoCommit();
            try {
                try (PreparedStatement s = c.prepareStatement("SELECT GET_LOCK(?,10)")) {
                    s.setString(1, lock);
                    try (ResultSet r = s.executeQuery()) { acquired = r.next() && r.getInt(1) == 1; }
                }
                if (!acquired) throw new SQLException("整体汇总正在更新，请稍后重试");
                c.setAutoCommit(false);
                transactionStarted = true;
                String city = !StringUtils.hasText(req.getCityId()) || "全部".equals(req.getCityId()) ? "999" : req.getCityId();
                String county = !StringUtils.hasText(req.getCountyId()) || "全部".equals(req.getCountyId()) ? null : req.getCountyId();
                String channel = resolveChannel(c, req.getChannel(), req.getStrategyClass(), city);
                String chosenMonth = month;
                if (!StringUtils.hasText(chosenMonth)) {
                    String sql = "SELECT DATE_FORMAT(MAX(stat_month),'%Y-%m')" + DETAIL + (county == null ? "" : " AND county_id=?") + ("全部".equals(channel) ? "" : " AND channel=?");
                    try (PreparedStatement s = c.prepareStatement(sql)) {
                        int i=1; s.setString(i++, req.getStrategyClass()); s.setString(i++, city);
                        if (county != null) s.setString(i++, county);
                        if (!"全部".equals(channel)) s.setString(i++, channel);
                        try (ResultSet r=s.executeQuery()) { if (r.next()) chosenMonth=r.getString(1); }
                    }
                }
                if (!StringUtils.hasText(chosenMonth)) { c.commit(); return null; }
                YearMonth end = YearMonth.parse(chosenMonth);
                for (int offset=months-1; offset>=0; offset--) {
                    refreshMonth(c, req.getStrategyClass(), city, county, channel, end.minusMonths(offset));
                }
                c.commit();
                return end.toString();
            } catch (Exception e) {
                failure = e instanceof SQLException ? (SQLException) e : new SQLException("自动更新整体汇总失败: " + e.getMessage(), e);
                if (transactionStarted) try { c.rollback(); } catch (SQLException rollback) { failure.addSuppressed(rollback); }
                throw failure;
            } finally {
                SQLException cleanupFailure = null;
                if (acquired) {
                    try (PreparedStatement s=c.prepareStatement("SELECT RELEASE_LOCK(?)")) { s.setString(1,lock); s.executeQuery().close(); }
                    catch (SQLException e) { cleanupFailure = e; }
                }
                if (transactionStarted) {
                    try { c.setAutoCommit(oldAutoCommit); }
                    catch (SQLException e) { if (cleanupFailure == null) cleanupFailure = e; else cleanupFailure.addSuppressed(e); }
                }
                if (cleanupFailure != null) {
                    if (failure != null) failure.addSuppressed(cleanupFailure);
                    else throw cleanupFailure;
                }
            }
        });
    }

    private String resolveChannel(Connection c, String channel, String strategyClass, String city) throws SQLException {
        if (!StringUtils.hasText(channel) || "全部".equals(channel) || "全部渠道".equals(channel)) return "全部";
        Set<String> aliases = new LinkedHashSet<>();
        aliases.add(channel);
        try (PreparedStatement s=c.prepareStatement("SELECT key_code,key_name FROM t_sr_dim_channel WHERE (key_code=? OR key_name=?) AND status=1 AND is_deleted=0 AND (tab_type='active' OR FIND_IN_SET('active',tab_type)>0)")) {
            s.setString(1,channel); s.setString(2,channel);
            try (ResultSet r=s.executeQuery()) { while(r.next()) { aliases.add(r.getString(1)); aliases.add(r.getString(2)); } }
        }
        String placeholders=String.join(",", Collections.nCopies(aliases.size(), "?"));
        Set<String> actual=new LinkedHashSet<>();
        try (PreparedStatement s=c.prepareStatement("SELECT DISTINCT channel"+DETAIL+" AND channel IN ("+placeholders+")")) {
            int i=1; s.setString(i++,strategyClass); s.setString(i++,city);
            for(String alias:aliases) s.setString(i++,alias);
            try(ResultSet r=s.executeQuery()) { while(r.next()) actual.add(r.getString(1)); }
        }
        if(actual.size()>1) throw new SQLException("触点同时存在名称与编码明细，请先统一口径："+channel);
        return actual.isEmpty() ? channel : actual.iterator().next();
    }

    private void refreshMonth(Connection c, String cls, String city, String county, String channel, YearMonth month) throws SQLException {
        StringBuilder sql = new StringBuilder("SELECT county_id, COUNT(DISTINCT strategy_id) strategy_count");
        for (String field:FIELDS) sql.append(", CASE WHEN COUNT(").append(field).append(")=COUNT(*) THEN SUM(").append(field).append(") ELSE NULL END AS ").append(field);
        sql.append(DETAIL).append(" AND stat_month>=? AND stat_month<?");
        if (county!=null) sql.append(" AND county_id=?");
        if (!"全部".equals(channel)) sql.append(" AND channel=?");
        sql.append(" GROUP BY county_id");
        List<Map<String,Object>> rows=new ArrayList<>();
        try (PreparedStatement s=c.prepareStatement(sql.toString())) {
            int i=1; s.setString(i++,cls); s.setString(i++,city); s.setDate(i++,java.sql.Date.valueOf(month.atDay(1))); s.setDate(i++,java.sql.Date.valueOf(month.plusMonths(1).atDay(1)));
            if(county!=null) s.setString(i++,county);
            if(!"全部".equals(channel)) s.setString(i++,channel);
            try(ResultSet r=s.executeQuery()) { while(r.next()) { Map<String,Object> row=new HashMap<>(); row.put("county_id",r.getString("county_id")); row.put("strategy_count",r.getObject("strategy_count")); for(String f:FIELDS) row.put(f,r.getObject(f)); rows.add(row); } }
        }
        // A total and county details must never be summed together without an explicit scope.
        if(rows.size()>1) throw new SQLException("月份 "+month+" 存在多个区县范围，请指定区县后重试");
        String scope="tab_type='active' AND strategy_class=? AND city_id=? AND channel=? AND big_category='全部' AND small_category='全部' AND strategy_id='999' AND stat_month>=? AND stat_month<? AND is_deleted=0";
        // Unspecified county is unrestricted in the reader: prevent it reading multiple summaries.
        String check="SELECT county_id FROM t_sr_strategy_period_summary_ap WHERE "+scope+(county==null?"":" AND county_id=?");
        List<String> existingCounties=new ArrayList<>();
        try(PreparedStatement s=c.prepareStatement(check)) { int i=bindScope(s,cls,city,channel,month); if(county!=null)s.setString(i,county); try(ResultSet r=s.executeQuery()){while(r.next()) existingCounties.add(r.getString(1));} }
        if(existingCounties.size()>1) throw new SQLException("月份 "+month+" 存在多条汇总行，请先处理重复或指定区县");
        if(rows.isEmpty()) {
            if(!existingCounties.isEmpty()) throw new SQLException("月份 "+month+" 存在汇总行但没有对应策略明细，无法安全重算");
            return;
        }
        Map<String,Object> row=rows.get(0);
        if(!existingCounties.isEmpty() && !Objects.equals(existingCounties.get(0), row.get("county_id")))
            throw new SQLException("月份 "+month+" 的汇总与明细区县不一致，无法安全重算");
        if(existingCounties.size()==1) {
            StringBuilder update=new StringBuilder("UPDATE t_sr_strategy_period_summary_ap SET strategy_count=?");
            for(String f:FIELDS) update.append(", ").append(f).append("=?");
            update.append(", usage_rate=ROUND(usage_count*100/NULLIF(push_count,0),2), target_conv_rate=ROUND(target_conv_num*100/NULLIF(reach_count,0),2), product_conv_rate=ROUND(product_conv_num*100/NULLIF(reach_count,0),2), reject_rate=ROUND(reject_count*100/NULLIF(push_count,0),2), update_time=NOW() WHERE ").append(scope);
            if(county!=null) update.append(" AND county_id=?");
            try(PreparedStatement s=c.prepareStatement(update.toString())) { int i=1; s.setObject(i++,row.get("strategy_count")); for(String f:FIELDS)s.setObject(i++,row.get(f)); i=bindScope(s,i,cls,city,channel,month); if(county!=null)s.setString(i,county); s.executeUpdate(); }
        } else {
            StringBuilder cols=new StringBuilder("strategy_id,strategy_code,strategy_name,strategy_count,tab_type,strategy_class,channel,big_category,small_category,stat_month,city_id,county_id,create_time,update_time,is_deleted");
            StringBuilder vals=new StringBuilder("'999','999','分类汇总',?,'active',?,?,'全部','全部',?,?,?,NOW(),NOW(),0");
            for(String f:FIELDS){cols.append(',').append(f); vals.append(",?");}
            for(String f:new String[]{"original_cust_qoq","push_count_qoq","usage_count_qoq","usage_rate_qoq","reach_count_qoq","target_conv_num_qoq","target_conv_rate_qoq","product_conv_num_qoq","product_conv_rate_qoq","expected_income_qoq","actual_income_qoq","reject_rate_qoq"}) {cols.append(',').append(f); vals.append(",NULL");}
            try(PreparedStatement s=c.prepareStatement("INSERT INTO t_sr_strategy_period_summary_ap ("+cols+") VALUES ("+vals+")")) { int i=1;s.setObject(i++,row.get("strategy_count"));s.setString(i++,cls);s.setString(i++,channel);s.setDate(i++,java.sql.Date.valueOf(month.atDay(1)));s.setString(i++,city);s.setObject(i++,row.get("county_id"));for(String f:FIELDS)s.setObject(i++,row.get(f));s.executeUpdate(); }
            // Compute rates from totals; all QoQ values stay NULL on a new row.
            try(PreparedStatement s=c.prepareStatement("UPDATE t_sr_strategy_period_summary_ap SET usage_rate=ROUND(usage_count*100/NULLIF(push_count,0),2),target_conv_rate=ROUND(target_conv_num*100/NULLIF(reach_count,0),2),product_conv_rate=ROUND(product_conv_num*100/NULLIF(reach_count,0),2),reject_rate=ROUND(reject_count*100/NULLIF(push_count,0),2) WHERE "+scope+(county==null?"":" AND county_id=?"))) {int i=bindScope(s,cls,city,channel,month);if(county!=null)s.setString(i,county);s.executeUpdate();}
        }
    }
    private int bindScope(PreparedStatement s,String cls,String city,String channel,YearMonth month)throws SQLException{return bindScope(s,1,cls,city,channel,month);}
    private int bindScope(PreparedStatement s,int i,String cls,String city,String channel,YearMonth month)throws SQLException {s.setString(i++,cls);s.setString(i++,city);s.setString(i++,channel);s.setDate(i++,java.sql.Date.valueOf(month.atDay(1)));s.setDate(i++,java.sql.Date.valueOf(month.plusMonths(1).atDay(1)));return i;}
}
