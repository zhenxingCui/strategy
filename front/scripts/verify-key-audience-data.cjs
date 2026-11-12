// Read-only consistency checks for the independently generated key-audience samples.
const assert = require('assert/strict')
const mysql = require('mysql2/promise')

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.SR_DB_HOST || '127.0.0.1', port: Number(process.env.SR_DB_PORT || 3306),
    user: process.env.SR_DB_USER || 'root', password: process.env.SR_DB_PASSWORD || '123456',
    database: process.env.SR_DB_NAME || 'strategy_review_active_class_local', dateStrings: true,
  })
  try {
    const [strategies] = await connection.query("SELECT * FROM t_sr_strategy_key_audience WHERE tab_type='active' AND strategy_class='重点客群' AND is_deleted=0")
    assert.equal(strategies.length, 8)
    assert.equal(new Set(strategies.map(row => row.channel)).size, 4)
    const fields = ['original_cust', 'push_count', 'usage_count', 'reach_count', 'target_conv_num', 'product_conv_num', 'expected_income', 'actual_income', 'reject_count']
    const [periods] = await connection.query("SELECT * FROM t_sr_strategy_period_summary_ap_key_audience WHERE tab_type='active' AND strategy_class='重点客群' AND strategy_id!='999' AND is_deleted=0")
    const [daily] = await connection.query("SELECT * FROM t_sr_strategy_daily_ap_key_audience WHERE tab_type='active' AND strategy_class='重点客群' AND is_deleted=0")
    const [kpis] = await connection.query("SELECT * FROM v_sr_kpi_summary_read WHERE tab_type='active' AND city_id='999' AND is_deleted=0")
    assert.equal(new Set(periods.map(row => row.stat_month.slice(0, 7))).size, 12)
    assert.ok(periods.every(row => strategies.some(strategy => strategy.strategy_code === row.strategy_id)))
    for (const row of periods) {
      assert.ok(row.original_cust >= row.push_count && row.push_count >= row.usage_count && row.usage_count >= row.reach_count)
      assert.ok(row.reach_count >= row.product_conv_num && row.product_conv_num >= row.target_conv_num)
      const days = daily.filter(day => day.strategy_id === row.strategy_id && day.stat_month.slice(0, 7) === row.stat_month.slice(0, 7))
      for (const field of fields) assert.equal(days.reduce((sum, day) => sum + Number(day[field]), 0), Number(row[field]), `${row.strategy_id} ${row.stat_month} ${field}`)
    }
    const classes = ['升接', '稳', '降拆', '离', '重点客群']
    for (const kpi of kpis.filter(row => row.strategy_class === '重点客群')) {
      const monthly = periods.filter(row => row.stat_month.slice(0, 7) === kpi.stat_month)
      if (fields.includes(kpi.metric_code)) assert.equal(Number(kpi.value), monthly.reduce((sum, row) => sum + Number(row[kpi.metric_code]), 0))
      if (kpi.metric_code === 'strategy_count') assert.equal(Number(kpi.value), monthly.length)
    }
    for (const total of kpis.filter(row => row.strategy_class === '全部' && fields.concat('strategy_count').includes(row.metric_code))) {
      const parts = kpis.filter(row => classes.includes(row.strategy_class) && row.stat_month === total.stat_month && row.metric_code === total.metric_code)
      assert.equal(parts.length, classes.length)
      assert.equal(Number(total.value), parts.reduce((sum, row) => sum + Number(row.value), 0), `${total.stat_month} ${total.metric_code} total`)
    }
    console.log(`PASS: 8 independent strategies, 4 channels, 12 months, ${daily.length} daily rows; funnel, daily/monthly reconciliation and total KPI consistency`)
  } finally {
    await connection.end()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
