"""Generate deterministic daily facts for the active '降拆' source month.

The monthly facts are the source of truth. Generated daily values sum exactly to
each source-month value; feasible funnel relationships are respected day by day.
"""
from __future__ import annotations

import argparse
import json
import sys
import subprocess
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from zoneinfo import ZoneInfo

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = ROOT / "front/src/views/strategyReview/active/declineSimulation.json"
IMPORTER_PATH = ROOT / "front/scripts/import-decline-excel.py"
OUTPUT_DIR = ROOT / "outputs/decline-import-20261024"
TABLE = "t_sr_strategy_daily_ap_special"
MONTH_TABLE = "t_sr_strategy_period_summary_ap_special"
DB_MODULE = __import__("runpy").run_path(str(IMPORTER_PATH))
DATABASE = DB_MODULE["DATABASE"]
TAB_TYPE = "active"
STRATEGY_CLASS = "降拆"
CITY_ID = "999"
INT_FIELDS = {
    "original_cust", "push_count", "usage_count", "reach_count", "target_conv_num",
    "product_conv_num", "reject_count",
}
AMOUNT_FIELDS = {"expected_income", "actual_income"}
ALLOCATED_FIELDS = [
    "original_cust", "push_count", "usage_count", "reach_count", "target_conv_num",
    "product_conv_num", "expected_income", "actual_income", "reject_count",
]


class SimulationError(RuntimeError):
    pass


def stable_noise(key: str, low: float, high: float) -> float:
    value = 2166136261
    for char in key:
        value = ((value ^ ord(char)) * 16777619) & 0xFFFFFFFF
    return low + (high - low) * (value / 0xFFFFFFFF)


def day_weights(strategy_id: str, days: list[date]) -> list[float]:
    weights = []
    for day in days:
        weekday_factor = 1.08 if day.weekday() < 5 else 0.78
        noise = stable_noise(f"decline-daily-v1:{strategy_id}:{day.isoformat()}", 0.86, 1.14)
        weights.append(weekday_factor * noise)
    return weights


def allocate(total: int | None, weights: list[float]) -> list[int | None]:
    if total is None:
        return [None] * len(weights)
    total = int(total)
    if total < 0 or not weights:
        raise SimulationError(f"Invalid allocation request: total={total}, days={len(weights)}")
    weight_sum = sum(weights)
    raw = [total * weight / weight_sum for weight in weights]
    values = [int(value) for value in raw]
    remainder = total - sum(values)
    order = sorted(range(len(weights)), key=lambda index: (-(raw[index] - values[index]), index))
    for index in order[:remainder]:
        values[index] += 1
    return values


def allocate_bounded(total: int | None, weights: list[float], caps: list[int | None] | None) -> list[int | None]:
    if total is None:
        return [None] * len(weights)
    if caps is None or any(cap is None for cap in caps):
        return allocate(total, weights)
    cap_values = [int(cap) for cap in caps]
    if total < 0 or total > sum(cap_values):
        raise SimulationError(f"Total {total} exceeds available daily capacity {sum(cap_values)}")
    values = [0] * len(weights)
    remaining = int(total)
    while remaining:
        eligible = [index for index, cap in enumerate(cap_values) if values[index] < cap]
        if not eligible:
            raise SimulationError("Unable to satisfy bounded daily allocation")
        weight_sum = sum(weights[index] for index in eligible)
        raw = {index: remaining * weights[index] / weight_sum for index in eligible}
        for index in eligible:
            room = cap_values[index] - values[index]
            addition = min(room, int(raw[index]))
            values[index] += addition
            remaining -= addition
        if not remaining:
            break
        ranked = sorted(
            (index for index in eligible if values[index] < cap_values[index]),
            key=lambda index: (-(raw[index] - int(raw[index])), index),
        )
        if not ranked:
            continue
        for index in ranked:
            if not remaining:
                break
            values[index] += 1
            remaining -= 1
    return values


def money_to_cents(value) -> int | None:
    if value is None:
        return None
    cents = Decimal(str(value)) * 100
    if cents != cents.to_integral_value():
        raise SimulationError(f"Source amount has more than two decimals: {value}")
    return int(cents)


def pct(numerator, denominator):
    return DB_MODULE["pct"](numerator, denominator)


def source_rows(month: str) -> list[dict]:
    selected = [
        "strategy_id", "strategy_code", "strategy_name", "channel", "big_category", "small_category",
        "original_cust", "push_count", "usage_count", "reach_count", "target_conv_num",
        "product_conv_num", "expected_income", "actual_income", "reject_count", "city_id", "county_id",
    ]
    sql = (
        "SELECT " + ",".join(f"`{column}`" for column in selected) +
        f" FROM `{MONTH_TABLE}` WHERE tab_type='{TAB_TYPE}' AND strategy_class='{STRATEGY_CLASS}' "
        f"AND city_id='{CITY_ID}' AND stat_month='{month}-01' AND strategy_id<>'999' AND is_deleted=0 "
        "ORDER BY strategy_id"
    )
    raw = DB_MODULE["query"](sql)
    result = []
    for values in raw:
        row = dict(zip(selected, values))
        for field in INT_FIELDS:
            row[field] = None if row[field] in (None, "NULL", r"\N") else int(row[field])
        for field in AMOUNT_FIELDS:
            row[field] = None if row[field] in (None, "NULL", r"\N") else Decimal(row[field])
        result.append(row)
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    if len(result) != int(config["strategiesPerMonth"]):
        raise SimulationError(f"Expected configured strategy count, got {len(result)}")
    if len({row["strategy_id"] for row in result}) != len(result):
        raise SimulationError("Source month contains duplicate strategy rows")
    return result


def daily_rows(monthly: list[dict], start: date, end: date) -> list[dict]:
    days = []
    current = start
    while current <= end:
        days.append(current)
        current += timedelta(days=1)
    if not days:
        raise SimulationError("Daily date range is empty")
    result = []
    for source in monthly:
        strategy_id = source["strategy_id"]
        weights = day_weights(strategy_id, days)
        daily = {}
        daily["push_count"] = allocate(source["push_count"], weights)
        daily["usage_count"] = allocate_bounded(
            source["usage_count"], weights,
            daily["push_count"] if source["push_count"] is not None and
            source["usage_count"] is not None and source["usage_count"] <= source["push_count"] else None,
        )
        daily["reach_count"] = allocate_bounded(
            source["reach_count"], weights,
            daily["usage_count"] if source["reach_count"] is not None and
            source["usage_count"] is not None and source["reach_count"] <= source["usage_count"] else None,
        )
        for field in ("target_conv_num", "product_conv_num"):
            total = source[field]
            if field == "product_conv_num" and total == source["target_conv_num"]:
                daily[field] = list(daily["target_conv_num"])
            else:
                daily[field] = allocate_bounded(
                    total, weights,
                    daily["reach_count"] if total is not None and source["reach_count"] is not None and
                    total <= source["reach_count"] else None,
                )
        for field in ("original_cust", "reject_count"):
            daily[field] = allocate(source[field], weights)
        for field in AMOUNT_FIELDS:
            cents = money_to_cents(source[field])
            allocated = allocate(cents, weights)
            daily[field] = [None if value is None else Decimal(value) / 100 for value in allocated]

        for index, day in enumerate(days):
            row = {
                "tab_type": TAB_TYPE,
                "strategy_class": STRATEGY_CLASS,
                "strategy_id": strategy_id,
                "stat_date": day.isoformat(),
                "channel": source["channel"],
                "big_category": source["big_category"],
                "small_category": source["small_category"],
                "strategy_name": source["strategy_name"],
                "city_id": source["city_id"],
                "county_id": source["county_id"],
                "strategy_code": source["strategy_code"] or strategy_id,
                "is_deleted": 0,
                "create_time": DB_MODULE["SqlExpression"]("NOW()"),
                "update_time": DB_MODULE["SqlExpression"]("NOW()"),
            }
            for field in ALLOCATED_FIELDS:
                row[field] = daily[field][index]
            row["usage_rate"] = pct(row["usage_count"], row["push_count"])
            row["target_conv_rate"] = pct(row["target_conv_num"], row["reach_count"])
            row["product_conv_rate"] = pct(row["product_conv_num"], row["reach_count"])
            row["reject_rate"] = pct(row["reject_count"], row["push_count"])
            result.append(row)
    return result


def verify(monthly: list[dict], start: date, end: date) -> dict:
    fields = ["push_count", "usage_count", "reach_count", "target_conv_num", "product_conv_num",
              "original_cust", "expected_income", "actual_income", "reject_count"]
    aggregates = ",".join(f"SUM(`{field}`)" for field in fields)
    sql = (
        "SELECT strategy_id,COUNT(*),COUNT(DISTINCT stat_date),MIN(stat_date),MAX(stat_date)," + aggregates +
        f" FROM `{TABLE}` WHERE tab_type='{TAB_TYPE}' AND strategy_class='{STRATEGY_CLASS}' "
        f"AND city_id='{CITY_ID}' AND is_deleted=0 AND stat_date BETWEEN '{start}' AND '{end}' "
        "GROUP BY strategy_id ORDER BY strategy_id"
    )
    rows = DB_MODULE["query"](sql)
    expected_by_id = {row["strategy_id"]: row for row in monthly}
    if len(rows) != len(monthly):
        raise SimulationError(f"Expected {len(monthly)} strategy groups, found {len(rows)}")
    checked = 0
    for values in rows:
        strategy_id = values[0]
        if strategy_id not in expected_by_id:
            raise SimulationError(f"Unexpected daily strategy: {strategy_id}")
        if int(values[1]) != (end - start).days + 1 or int(values[2]) != (end - start).days + 1:
            raise SimulationError(f"Wrong daily row/date count for {strategy_id}: {values[1:3]}")
        if values[3] != start.isoformat() or values[4] != end.isoformat():
            raise SimulationError(f"Wrong date bounds for {strategy_id}: {values[3:5]}")
        source = expected_by_id[strategy_id]
        for field, actual in zip(fields, values[5:]):
            expected = source[field]
            if actual in (None, "NULL", r"\N"):
                actual = None
            if field in AMOUNT_FIELDS:
                expected = None if expected is None else format(expected, ".2f")
                actual = None if actual is None else format(Decimal(actual), ".2f")
            else:
                expected = None if expected is None else int(expected)
                actual = None if actual is None else int(actual)
            if actual != expected:
                raise SimulationError(f"Daily sum mismatch for {strategy_id}/{field}: {actual} != {expected}")
            checked += 1
    total_count = DB_MODULE["query"](
        f"SELECT COUNT(*),COUNT(DISTINCT CONCAT(strategy_id,'/',stat_date)) FROM `{TABLE}` "
        f"WHERE tab_type='{TAB_TYPE}' AND strategy_class='{STRATEGY_CLASS}' AND city_id='{CITY_ID}' "
        f"AND is_deleted=0 AND stat_date BETWEEN '{start}' AND '{end}'"
    )[0]
    expected_count = len(monthly) * ((end - start).days + 1)
    if int(total_count[0]) != expected_count or int(total_count[1]) != expected_count:
        raise SimulationError(f"Expected {expected_count} unique daily facts, got {total_count}")
    funnel_sql = (
        "SELECT "
        "SUM(IF(m.usage_count<=m.push_count AND d.usage_count>d.push_count,1,0)),"
        "SUM(IF(m.reach_count<=m.usage_count AND d.reach_count>d.usage_count,1,0)),"
        "SUM(IF(m.target_conv_num<=m.reach_count AND d.target_conv_num>d.reach_count,1,0)),"
        "SUM(IF(m.product_conv_num<=m.reach_count AND d.product_conv_num>d.reach_count,1,0)) "
        f"FROM `{TABLE}` d JOIN `{MONTH_TABLE}` m ON m.strategy_id=d.strategy_id "
        f"AND m.tab_type='{TAB_TYPE}' AND m.strategy_class='{STRATEGY_CLASS}' "
        f"AND m.city_id='{CITY_ID}' AND m.stat_month='{start.strftime('%Y-%m')}-01' AND m.is_deleted=0 "
        f"WHERE d.tab_type='{TAB_TYPE}' AND d.strategy_class='{STRATEGY_CLASS}' AND d.city_id='{CITY_ID}' "
        f"AND d.is_deleted=0 AND d.stat_date BETWEEN '{start}' AND '{end}'"
    )
    funnel_raw = DB_MODULE["query"](funnel_sql)[0]
    funnel_names = ["usageExceedsPush", "reachExceedsUsage", "targetExceedsReach", "productExceedsReach"]
    funnel_violations = {name: int(value) if value not in (None, "NULL", r"\N") else 0
                         for name, value in zip(funnel_names, funnel_raw)}
    if any(funnel_violations.values()):
        raise SimulationError(f"Daily funnel violation where monthly totals are feasible: {funnel_violations}")
    return {"strategyGroups": len(rows), "dailyRows": int(total_count[0]), "uniqueStrategyDates": int(total_count[1]),
            "daysPerStrategy": (end - start).days + 1, "sourceMetricComparisons": checked,
            "startDate": start.isoformat(), "endDate": end.isoformat(), "monthlySumsMatch": True,
            "feasibleMonthlyFunnelViolations": funnel_violations}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Replace active generated daily rows in the configured date range")
    args = parser.parse_args()
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    start = date.fromisoformat(config["dailyStartDate"])
    end = date.fromisoformat(config["dailyEndDate"])
    if start.strftime("%Y-%m") != config["sourceMonth"] or end.strftime("%Y-%m") != config["sourceMonth"]:
        raise SimulationError("Configured daily range must stay inside sourceMonth")
    monthly = source_rows(config["sourceMonth"])
    generated = daily_rows(monthly, start, end)
    columns = {TABLE: DB_MODULE["table_columns"](TABLE)}
    statements = ["SET NAMES utf8mb4;", "START TRANSACTION;"]
    statements.append(
        f"UPDATE `{TABLE}` SET is_deleted=1 WHERE tab_type='{TAB_TYPE}' AND strategy_class='{STRATEGY_CLASS}' "
        f"AND city_id='{CITY_ID}' AND stat_date BETWEEN '{start}' AND '{end}' AND is_deleted=0;"
    )
    statements.extend(DB_MODULE["insert_statements"](TABLE, generated, columns, batch_size=150))
    statements.append("COMMIT;")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    sql_path = OUTPUT_DIR / "simulate-daily.sql"
    sql_path.write_text("\n\n".join(statements) + "\n", encoding="utf-8")
    result = {
        "dryRun": not args.apply,
        "database": DATABASE,
        "tabType": TAB_TYPE,
        "strategyClass": STRATEGY_CLASS,
        "cityId": CITY_ID,
        "sourceMonth": config["sourceMonth"],
        "sourceCutoff": config["sourceCutoff"],
        "dailyRowsPrepared": len(generated),
        "strategies": len(monthly),
        "daysPerStrategy": (end - start).days + 1,
        "method": "FNV-1a fixed seed; weekday/weekend weighted daily allocations; largest remainder; feasible funnel metrics capped by parent daily metrics.",
        "sqlPath": str(sql_path),
    }
    if not args.apply:
        audit_path = OUTPUT_DIR / "simulated-daily.json"
        audit_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        result["auditPath"] = str(audit_path)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    where = (
        f"tab_type='{TAB_TYPE}' AND strategy_class='{STRATEGY_CLASS}' AND city_id='{CITY_ID}' "
        f"AND stat_date BETWEEN '{start}' AND '{end}' AND is_deleted=0"
    )
    backup_text = DB_MODULE["backup_table"](OUTPUT_DIR, TABLE, where, None, DB_MODULE["mysql_env"]())
    backup_path = OUTPUT_DIR / "daily-backup.sql"
    backup_path.write_text("SET NAMES utf8mb4;\n" + backup_text, encoding="utf-8")
    process = subprocess.run(
        DB_MODULE["mysql_args"]() + ["--show-warnings"],
        input=sql_path.read_text(encoding="utf-8"), env=DB_MODULE["mysql_env"](),
        text=True, encoding="utf-8", capture_output=True,
    )
    if process.returncode:
        raise SimulationError("Daily import SQL failed; the transaction should have rolled back: " + process.stderr.strip())
    result["verification"] = verify(monthly, start, end)
    result["dryRun"] = False
    result["backupPath"] = str(backup_path)
    result["mysqlOutput"] = process.stdout.strip()
    result["appliedAt"] = datetime.now(ZoneInfo("Asia/Shanghai")).isoformat()
    audit_path = OUTPUT_DIR / "simulated-daily.json"
    audit_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"DAILY_SIMULATION_ERROR: {error}")
        raise
