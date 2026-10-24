"""Import the active '降拆' tab data from the compact V5 workbook into the local review DB.

The workbook is read-only. The script writes normalized source/backup artifacts next to
the workbook output and uses the local MySQL CLI so it does not add project dependencies.
"""
from __future__ import annotations

import argparse
import calendar
import hashlib
import json
import math
import os
import shutil
import subprocess
from collections import defaultdict
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from zoneinfo import ZoneInfo

from openpyxl import load_workbook


DATABASE = "strategy_review_active_class_local"
TAB_TYPE = "active"
STRATEGY_CLASS = "降拆"
CITY_ID = "999"
METRIC_LABELS = {
    "strategy_count": "策略数",
    "original_cust": "原始客群",
    "push_count": "咨询量",
    "usage_count": "挽留量",
    "usage_rate": "挽留率",
    "reach_count": "派单量",
    "reach_rate": "派单率",
    "target_conv_num": "目标成功量",
    "target_conv_rate": "目标成功率",
    "product_conv_num": "成功量",
    "product_conv_rate": "成功率",
    "expected_income": "预计收益",
    "actual_income": "实际收益",
    "reject_count": "拒绝量",
    "reject_rate": "拒绝率",
}
ADDITIVE = [
    "original_cust", "push_count", "usage_count", "reach_count", "target_conv_num",
    "product_conv_num", "expected_income", "actual_income", "reject_count",
]
RATE_FIELDS = {"usage_rate", "reach_rate", "target_conv_rate", "product_conv_rate", "reject_rate"}
REASON_COLORS = ["#3b82f6", "#5ac4d1", "#a78bfa", "#f6bd60", "#94a3b8"]
SOURCE_DEFAULT = Path(r"D:\xwechat_files\wxid_9cu5e6y7w6k322_9566\msg\file\2026-10\存量策略_精简填报模板_3张输入表(1)V5.xlsx")


class ImportErrorForSource(RuntimeError):
    pass


def as_json(value):
    if isinstance(value, SqlExpression):
        return value.expression
    if isinstance(value, (datetime, date)):
        return value.isoformat()[:10]
    if isinstance(value, Decimal):
        return float(value)
    return value


def clean(value):
    value = as_json(value)
    if isinstance(value, str):
        value = value.strip()
        if value in ("", "不填"):
            return None
    return value


def round4(value):
    if value is None:
        return None
    return float(Decimal(str(value)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP))


def pct(value, denominator):
    if value is None or denominator is None or denominator == 0:
        return None
    return round4(Decimal(str(value)) * Decimal(100) / Decimal(str(denominator)))


def month_shift(month, delta):
    year, number = map(int, month.split("-"))
    absolute = year * 12 + number - 1 + delta
    return f"{absolute // 12:04d}-{absolute % 12 + 1:02d}"


def month_days(month):
    year, number = map(int, month.split("-"))
    return calendar.monthrange(year, number)[1]


def noise(key, low, high):
    value = 2166136261
    for char in key:
        value = ((value ^ ord(char)) * 16777619) & 0xFFFFFFFF
    return low + (high - low) * (value / 0xFFFFFFFF)


def choose_previous(current, factor, partial_scale=1.0):
    """Choose an integer prior value whose observed change stays within [-2%, 5%]."""
    if current is None:
        return None
    current = int(current)
    if current == 0:
        return 0
    adjusted = current * partial_scale
    minimum = max(1, math.ceil(adjusted / 1.05 - 1e-10))
    maximum = max(0, math.floor(adjusted / 0.98 + 1e-10))
    candidates = [n for n in range(minimum, maximum + 1)
                  if 0.98 - 1e-9 <= adjusted / n <= 1.05 + 1e-9]
    if not candidates:
        raise ImportErrorForSource(
            f"Cannot generate an integer prior value in the allowed change range for {current}"
        )
    return min(candidates, key=lambda n: (abs(adjusted / n - factor), n))


def metrics(rows):
    values = {"strategy_count": len({row["strategy_id"] for row in rows})}
    for field in ADDITIVE:
        present = [row[field] for row in rows if row.get(field) is not None]
        values[field] = sum(present) if present else None
    values["usage_rate"] = pct(values["usage_count"], values["push_count"])
    values["reach_rate"] = pct(values["reach_count"], values["usage_count"])
    values["target_conv_rate"] = pct(values["target_conv_num"], values["reach_count"])
    values["product_conv_rate"] = pct(values["product_conv_num"], values["reach_count"])
    values["reject_rate"] = pct(values["reject_count"], values["push_count"])
    return values


def comparison(current, previous, partial=False, cutoff_day=None, previous_days=None):
    result = {}
    for field in METRIC_LABELS:
        value = current.get(field)
        prior = None if previous is None else previous.get(field)
        if value is None or prior is None:
            result[field + "_qoq"] = None
        elif field in RATE_FIELDS:
            result[field + "_qoq"] = round4(value - prior)
        elif partial and field != "strategy_count":
            if prior == 0 or not cutoff_day or not previous_days:
                result[field + "_qoq"] = None
            else:
                result[field + "_qoq"] = round4((value * previous_days / cutoff_day - prior) * 100 / prior)
        else:
            result[field + "_qoq"] = None if prior == 0 else round4((value - prior) * 100 / prior)
    return result


def read_workbook(path):
    formulas_wb = load_workbook(path, data_only=False, read_only=False)
    cached_wb = load_workbook(path, data_only=True, read_only=False)
    formulas = []
    errors = []
    for ws in formulas_wb.worksheets:
        cached = cached_wb[ws.title]
        for row in ws.iter_rows():
            for cell in row:
                value = cell.value
                cached_value = cached[cell.coordinate].value
                if cell.data_type == "f":
                    formulas.append({"sheet": ws.title, "cell": cell.coordinate,
                                     "formula": value, "cached": clean(cached_value)})
                if cell.data_type == "e" or cached[cell.coordinate].data_type == "e":
                    errors.append({"sheet": ws.title, "cell": cell.coordinate,
                                   "formulaValue": value, "cachedValue": cached_value})
    if errors:
        raise ImportErrorForSource("Workbook contains formula errors: " + json.dumps(errors, ensure_ascii=False))
    records = {}
    raw_sheets = []
    for ws in cached_wb.worksheets:
        rows = []
        for row in ws.iter_rows():
            values = [clean(cell.value) for cell in row]
            if any(value is not None for value in values):
                rows.append(values)
        raw_sheets.append({"name": ws.title, "rows": rows})
        if ws.title.startswith("1_"):
            records["strategies"] = rows_as_dicts(ws, skip_rows=2)
        elif ws.title.startswith("2_"):
            records["execution"] = rows_as_dicts(ws, skip_rows=2)
        elif ws.title.startswith("3_"):
            records["details"] = rows_as_dicts(ws, skip_rows=2)
    if not all(records.get(key) is not None for key in ("strategies", "execution", "details")):
        raise ImportErrorForSource("Workbook is missing one of the first three input sheets")
    return {"sheets": raw_sheets, "formulas": formulas, "formulaErrors": errors, **records}


def rows_as_dicts(ws, skip_rows):
    headers = [clean(ws.cell(1, col).value) for col in range(1, ws.max_column + 1)]
    result = []
    for row in ws.iter_rows(min_row=skip_rows + 1, max_col=ws.max_column):
        values = [clean(cell.value) for cell in row]
        if not values or values[0] is None:
            continue
        result.append({key: value for key, value in zip(headers, values) if key is not None})
    return result


def mysql_env():
    env = os.environ.copy()
    env["MYSQL_PWD"] = env.get("SR_DB_PASSWORD") or env.get("MYSQL_PWD") or "123456"
    return env


def find_cli(name, fallback):
    found = shutil.which(name)
    if found:
        return found
    if Path(fallback).exists():
        return fallback
    raise ImportErrorForSource(f"Required local database utility is unavailable: {name}")


MYSQL = find_cli("mysql.exe", r"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe")
MYSQLDUMP = find_cli("mysqldump.exe", r"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe")


def mysql_args(no_headers=True):
    args = [MYSQL, "--protocol=tcp", "-h", os.environ.get("SR_DB_HOST", "127.0.0.1"),
            "-P", os.environ.get("SR_DB_PORT", "3306"), "-u", os.environ.get("SR_DB_USER", "root"),
            "--default-character-set=utf8mb4", "--batch", "--raw"]
    if no_headers:
        args.append("--skip-column-names")
    args.append(DATABASE)
    return args


def query(sql):
    result = subprocess.run(mysql_args() + ["-e", sql], env=mysql_env(), text=True,
                            encoding="utf-8", capture_output=True)
    if result.returncode:
        raise ImportErrorForSource("Local DB query failed: " + result.stderr.strip())
    return [[None if field == r"\N" else field for field in line.split("\t")]
            for line in result.stdout.splitlines() if line]


def sql_literal(value):
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        if not math.isfinite(value):
            raise ImportErrorForSource("Non-finite numeric value encountered")
        return format(value, ".10g")
    if isinstance(value, Decimal):
        return format(value, "f")
    text = str(value).replace("\\", "\\\\").replace("'", "''").replace("\0", "")
    return "'" + text + "'"


class SqlExpression:
    def __init__(self, expression):
        self.expression = expression


def sql_value(value):
    return value.expression if isinstance(value, SqlExpression) else sql_literal(value)


def table_columns(table):
    return {row[0] for row in query(f"SHOW COLUMNS FROM `{table}`")}


def insert_statements(table, rows, columns_by_table, batch_size=150):
    if not rows:
        return []
    allowed = columns_by_table[table] - {"id"}
    columns = [key for key in rows[0] if key in allowed]
    if not columns:
        return []
    statements = []
    for start in range(0, len(rows), batch_size):
        chunk = rows[start:start + batch_size]
        values = []
        for row in chunk:
            values.append("(" + ",".join(sql_value(row.get(key)) for key in columns) + ")")
        statements.append(f"INSERT INTO `{table}` (`" + "`,`".join(columns) + "`) VALUES\n" + ",\n".join(values) + ";")
    return statements


def make_source_rows(raw, month, cutoff_day, channel_codes, reason_codes):
    strategies = raw["strategies"]
    strategy_codes = [row.get("strategy_code") for row in strategies]
    if not strategy_codes or len(strategy_codes) != len(set(strategy_codes)):
        raise ImportErrorForSource("Strategy codes are empty or duplicated")
    master_by_code = {row["strategy_code"]: row for row in strategies}
    execution = []
    actual_dates = set()
    for source in raw["execution"]:
        if source.get("period_type") != "月":
            raise ImportErrorForSource("Only monthly source rows are supported")
        value = source.get("stat_date")
        if not value:
            raise ImportErrorForSource("An execution row has no stat_date")
        stat_month = str(value)[:7]
        actual_dates.add(stat_month)
        if source.get("strategy_code") not in master_by_code:
            raise ImportErrorForSource(f"No strategy master for {source.get('strategy_code')}")
        if source.get("channel") not in channel_codes:
            raise ImportErrorForSource(f"No channel mapping for {source.get('channel')}")
        if source.get("big_category") is None or source.get("small_category") is None:
            raise ImportErrorForSource(f"Missing scenario category for {source.get('strategy_code')}")
        row = {
            "strategy_id": source["strategy_code"],
            "strategy_code": source["strategy_code"],
            "strategy_name": master_by_code[source["strategy_code"]]["strategy_name"],
            "strategy_class": STRATEGY_CLASS,
            "channel": channel_codes[source["channel"]],
            "big_category": source["big_category"],
            "small_category": source["small_category"],
            "stat_month": f"{stat_month}-01",
            "strategy_count": 1,
            "original_cust": None,
            "push_count": source.get("push_count"),
            "usage_count": source.get("usage_count"),
            "reach_count": source.get("reach_count"),
            "target_conv_num": source.get("target_conv_num"),
            "product_conv_num": source.get("product_conv_num") if source.get("product_conv_num") is not None else source.get("target_conv_num"),
            "expected_income": source.get("expected_income") if source.get("expected_income") is not None else source.get("actual_income"),
            "actual_income": source.get("actual_income"),
            "reject_count": source.get("reject_count"),
            "city_id": CITY_ID,
            "county_id": None,
            "is_deleted": 0,
            "create_time": SqlExpression("NOW()"),
            "update_time": SqlExpression("NOW()"),
        }
        for field in ADDITIVE:
            value = row[field]
            if value is not None:
                number = float(value)
                if not math.isfinite(number) or number < 0 or not number.is_integer():
                    raise ImportErrorForSource(f"Invalid non-integer count/amount {field} for {row['strategy_id']}: {value}")
                row[field] = int(number)
        row["usage_rate"] = pct(row["usage_count"], row["push_count"])
        row["reach_rate"] = pct(row["reach_count"], row["usage_count"])
        row["target_conv_rate"] = pct(row["target_conv_num"], row["reach_count"])
        row["product_conv_rate"] = pct(row["product_conv_num"], row["reach_count"])
        row["reject_rate"] = pct(row["reject_count"], row["push_count"])
        execution.append(row)
    if len(actual_dates) != 1 or next(iter(actual_dates)) != month:
        raise ImportErrorForSource(f"Execution sheet does not contain one source month ({month})")
    if {row["strategy_id"] for row in execution} != set(strategy_codes):
        raise ImportErrorForSource("Monthly execution strategy set does not match the strategy sheet")
    if len(execution) != len(strategy_codes):
        raise ImportErrorForSource("Monthly execution sheet must have one row per strategy")

    reasons = []
    for source in raw["details"]:
        if source.get("detail_type") != "拒绝原因":
            raise ImportErrorForSource(f"Unexpected detail type: {source.get('detail_type')}")
        if source.get("strategy_code") not in master_by_code:
            raise ImportErrorForSource(f"No strategy master for detail {source.get('strategy_code')}")
        name = source.get("item_name")
        count = source.get("item_count")
        if not name or name not in reason_codes:
            raise ImportErrorForSource(f"No reason code mapping for {name}")
        if count is None or not float(count).is_integer() or float(count) < 0:
            raise ImportErrorForSource(f"Invalid reject count for {source.get('strategy_code')}/{name}")
        reasons.append({"strategy_id": source["strategy_code"], "stat_month": month + "-01",
                        "reason_code": reason_codes[name], "reason_name": name,
                        "reject_count": int(count), "city_id": CITY_ID, "county_id": None,
                        "is_deleted": 0, "sort_no": 0, "color": None,
                        "create_time": SqlExpression("NOW()"), "update_time": SqlExpression("NOW()")})
    return execution, reasons, master_by_code


def simulate_history(source_rows, source_reasons, month, cutoff_day):
    if int(month[5:]) == 1:
        return [], []
    prior_month = month_shift(month, -1)
    previous_days = month_days(prior_month)
    partial_scale = previous_days / cutoff_day
    by_code = {row["strategy_id"]: row for row in source_rows}
    reasons_by_code = defaultdict(list)
    for row in source_reasons:
        reasons_by_code[row["strategy_id"]].append(row)
    metric_fields = ADDITIVE
    rows_by_month_code = defaultdict(dict)
    reason_by_month_code = defaultdict(dict)

    for code, source in by_code.items():
        previous = dict(source)
        for field in metric_fields:
            factor = 1.0 + noise(f"decline:{code}:{field}:{prior_month}:source", 0.015, 0.035)
            previous[field] = choose_previous(source.get(field), factor, partial_scale)
        previous["stat_month"] = prior_month + "-01"
        rows_by_month_code[prior_month][code] = previous

        reason_previous = []
        for reason in reasons_by_code.get(code, []):
            factor = 1.0 + noise(f"decline:{code}:{reason['reason_code']}:{prior_month}:reason-source", 0.015, 0.035)
            # Reason counts are often 1-4; partial-month scaling can make the
            # integer range empty (for example 2 * 31 / 24). Keep reason detail
            # on whole-month counts, since it has no daily allocation in source.
            reason_previous.append({**reason, "reject_count": choose_previous(reason["reject_count"], factor),
                                    "stat_month": prior_month + "-01"})
        reason_by_month_code[prior_month][code] = reason_previous

    # Generate back to January from the preceding simulated month, keeping each adjacent
    # simulated monthly amount in the requested range after integer rounding.
    for offset in range(-2, -int(month[5:]), -1):
        target_month = month_shift(month, offset)
        next_month = month_shift(target_month, 1)
        for code, next_row in rows_by_month_code[next_month].items():
            current = dict(next_row)
            for field in metric_fields:
                factor = 1.0 + noise(f"decline:{code}:{field}:{target_month}:mom", 0.005, 0.035)
                current[field] = choose_previous(next_row.get(field), factor)
            current["stat_month"] = target_month + "-01"
            rows_by_month_code[target_month][code] = current
            reason_previous = []
            for reason in reason_by_month_code[next_month].get(code, []):
                factor = 1.0 + noise(f"decline:{code}:{reason['reason_code']}:{target_month}:reason-mom", 0.005, 0.035)
                reason_previous.append({**reason, "reject_count": choose_previous(reason["reject_count"], factor),
                                        "stat_month": target_month + "-01"})
            reason_by_month_code[target_month][code] = reason_previous

    first_year_month = month[:4] + "-01"
    if prior_month >= first_year_month:
        january = rows_by_month_code[first_year_month]
        baseline_month = month_shift(first_year_month, -1)
        for code, jan_row in january.items():
            baseline = dict(jan_row)
            for field in metric_fields:
                factor = 1.0 + noise(f"decline:{code}:{field}:{baseline_month}:baseline", 0.0, 0.03)
                baseline[field] = choose_previous(jan_row.get(field), factor)
            baseline["stat_month"] = baseline_month + "-01"
            rows_by_month_code[baseline_month][code] = baseline
            baseline_reasons = []
            for reason in reason_by_month_code[first_year_month].get(code, []):
                factor = 1.0 + noise(f"decline:{code}:{reason['reason_code']}:{baseline_month}:reason-baseline", 0.0, 0.03)
                baseline_reasons.append({**reason, "reject_count": choose_previous(reason["reject_count"], factor),
                                         "stat_month": baseline_month + "-01"})
            reason_by_month_code[baseline_month][code] = baseline_reasons

    history_months = [month_shift(month, offset) for offset in range(-1, -int(month[5:]), -1)]
    if first_year_month in history_months:
        history_months.append(month_shift(first_year_month, -1))
    history_rows = []
    history_reasons = []
    for historical_month in sorted(set(history_months)):
        for code, row in rows_by_month_code[historical_month].items():
            history_rows.append(row)
            reason_rows = reason_by_month_code[historical_month].get(code, [])
            total = sum(reason["reject_count"] for reason in reason_rows)
            for index, reason in enumerate(reason_rows, 1):
                history_reasons.append({**reason,
                                        "reject_ratio": pct(reason["reject_count"], total),
                                        "sort_no": index, "is_deleted": 0,
                                        "create_time": SqlExpression("NOW()"), "update_time": SqlExpression("NOW()")})
    return history_rows, history_reasons


def decorate_facts(rows, month, source_month, cutoff_day):
    by_code_month = {(row["strategy_id"], row["stat_month"][:7]): row for row in rows}
    for row in rows:
        current_month = row["stat_month"][:7]
        previous_month = month_shift(current_month, -1)
        previous = by_code_month.get((row["strategy_id"], previous_month))
        current_metrics = metrics([row])
        previous_metrics = metrics([previous]) if previous else None
        qoq = comparison(current_metrics, previous_metrics,
                        partial=(current_month == source_month), cutoff_day=cutoff_day,
                        previous_days=month_days(previous_month))
        row.update(current_metrics)
        row.update(qoq)
        for key in METRIC_LABELS:
            row[key + "_yoy"] = None
        row["strategy_class"] = STRATEGY_CLASS
        row["tab_type"] = TAB_TYPE
        row["city_id"] = CITY_ID
        row["county_id"] = None
        row["is_deleted"] = 0
        row["create_time"] = SqlExpression("NOW()")
        row["update_time"] = SqlExpression("NOW()")
    return rows


def build_summaries(rows, source_month, cutoff_day):
    by_month = defaultdict(list)
    for row in rows:
        by_month[row["stat_month"][:7]].append(row)
    months = sorted(by_month)
    kpis, channel_summaries, categories, capacities = [], [], [], []
    total_previous = {}
    channel_previous = {}
    category_previous = {}

    for month in months:
        month_rows = by_month[month]
        total = metrics(month_rows)
        prior_month = month_shift(month, -1)
        partial = month == source_month
        total_qoq = comparison(total, total_previous.get(prior_month), partial,
                               cutoff_day, month_days(prior_month))
        for index, (metric_code, metric_name) in enumerate(METRIC_LABELS.items(), 1):
            unit = "%" if metric_code.endswith("_rate") else ("元" if "income" in metric_code else ("个" if metric_code == "strategy_count" else ("人" if metric_code == "original_cust" else "次")))
            kpis.append({"tab_type": TAB_TYPE, "strategy_class": STRATEGY_CLASS,
                         "stat_month": month, "metric_code": metric_code, "metric_name": metric_name,
                         "value": total[metric_code], "unit": unit,
                         "qoq": total_qoq.get(metric_code + "_qoq"), "yoy": None,
                         "sort_no": index, "city_id": CITY_ID, "county_id": None,
                         "is_deleted": 0, "create_time": SqlExpression("NOW()"),
                         "update_time": SqlExpression("NOW()")})

        channel_groups = defaultdict(list)
        category_groups = defaultdict(list)
        for row in month_rows:
            channel_groups[row["channel"]].append(row)
            category_groups[(row["channel"], row["big_category"], row["small_category"])].append(row)
        groups_for_channel = [(channel, records) for channel, records in channel_groups.items()]
        groups_for_channel.append(("全部", month_rows))
        for channel, channel_rows in groups_for_channel:
            channel_metrics = metrics(channel_rows)
            key = channel
            channel_qoq = comparison(channel_metrics, channel_previous.get((key, prior_month)), partial,
                                     cutoff_day, month_days(prior_month))
            channel_summaries.append({"tab_type": TAB_TYPE, "strategy_class": STRATEGY_CLASS,
                                      "stat_month": month + "-01", "channel": channel,
                                      **channel_metrics, **channel_qoq,
                                      "city_id": CITY_ID, "county_id": None, "is_deleted": 0,
                                      "create_time": SqlExpression("NOW()"), "update_time": SqlExpression("NOW()")})
            channel_previous[(key, month)] = channel_metrics

            category_rows = [(big, small, records) for (ch, big, small), records in category_groups.items() if ch == channel]
            category_rows.append(("全部", "全部", channel_rows))
            for big, small, records in category_rows:
                cat_metrics = metrics(records)
                cat_key = (channel, big, small)
                cat_qoq = comparison(cat_metrics, category_previous.get((cat_key, prior_month)), partial,
                                     cutoff_day, month_days(prior_month))
                categories.append({"tab_type": TAB_TYPE, "strategy_class": STRATEGY_CLASS,
                                   "strategy_id": "999", "strategy_code": "999",
                                   "strategy_name": "分类汇总", "stat_month": month + "-01",
                                   "channel": channel, "big_category": big, "small_category": small,
                                   **cat_metrics, **cat_qoq, "city_id": CITY_ID, "county_id": None,
                                   "is_deleted": 0, "create_time": SqlExpression("NOW()"),
                                   "update_time": SqlExpression("NOW()")})
                capacities.append({"tab_type": TAB_TYPE, "strategy_class": STRATEGY_CLASS,
                                   "stat_month": month + "-01", "channel": channel,
                                   "big_category": big, "small_category": small,
                                   "capacity": cat_metrics["product_conv_num"],
                                   "qoq": cat_qoq.get("product_conv_num_qoq"), "yoy": None,
                                   "city_id": CITY_ID, "county_id": None, "is_deleted": 0,
                                   "create_time": SqlExpression("NOW()"), "update_time": SqlExpression("NOW()")})
                category_previous[(cat_key, month)] = cat_metrics
        total_previous[month] = total

    return kpis, channel_summaries, categories, capacities


def normalize_reason_rows(rows):
    by_strategy_month = defaultdict(list)
    for row in rows:
        by_strategy_month[(row["strategy_id"], row["stat_month"])].append(row)
    for group in by_strategy_month.values():
        total = sum(row["reject_count"] for row in group)
        for index, row in enumerate(group, 1):
            row["reject_ratio"] = pct(row["reject_count"], total)
            row["sort_no"] = index
            row["color"] = REASON_COLORS[(index - 1) % len(REASON_COLORS)]
    return rows


def backup_table(out_dir, table, where, cli_args, env):
    command = [MYSQLDUMP, "--protocol=tcp", "-h", os.environ.get("SR_DB_HOST", "127.0.0.1"),
               "-P", os.environ.get("SR_DB_PORT", "3306"), "-u", os.environ.get("SR_DB_USER", "root"),
               "--default-character-set=utf8mb4", "--no-create-info", "--replace",
               "--skip-add-locks", "--skip-comments", "--single-transaction", f"--where={where}", DATABASE, table]
    result = subprocess.run(command, env=env, text=True, encoding="utf-8", capture_output=True)
    if result.returncode:
        raise ImportErrorForSource(f"Backup failed for {table}: {result.stderr.strip()}")
    return result.stdout


def make_backup(out_dir, old_ids, source_codes, columns):
    env = mysql_env()
    targets = []
    old_id_sql = ",".join(sql_literal(value) for value in old_ids) or "''"
    source_id_sql = ",".join(sql_literal(value) for value in source_codes)
    specs = [
        ("t_sr_strategy_special", f"is_deleted=0 AND ((tab_type='active' AND strategy_class='降拆' AND city_id='999') OR strategy_code IN ({source_id_sql}))"),
        ("t_sr_strategy_period_summary_ap_special", "tab_type='active' AND strategy_class='降拆' AND city_id='999' AND is_deleted=0"),
        ("t_sr_strategy_daily_ap_special", "tab_type='active' AND strategy_class='降拆' AND city_id='999' AND is_deleted=0"),
        ("t_sr_strategy_biz_capacity_special", f"tab_type='active' AND city_id='999' AND strategy_id IN ({old_id_sql}) AND is_deleted=0"),
        ("t_sr_strategy_reject_reason_special", f"city_id='999' AND strategy_id IN ({old_id_sql}) AND is_deleted=0"),
        ("t_sr_kpi_summary_special", "tab_type='active' AND strategy_class='降拆' AND city_id='999' AND is_deleted=0"),
        ("t_sr_channel_summary_ap_special", "tab_type='active' AND strategy_class='降拆' AND city_id='999' AND is_deleted=0"),
        ("t_sr_channel_monthly_capacity_ap_special", "tab_type='active' AND strategy_class='降拆' AND city_id='999' AND is_deleted=0"),
        ("t_sr_channel_biz_capacity_ap_special", "tab_type='active' AND strategy_class='降拆' AND city_id='999' AND is_deleted=0"),
        ("t_sr_dim_channel", "1=1"),
    ]
    for table, where in specs:
        targets.append(f"-- Backup {table}\n" + backup_table(out_dir, table, where, None, env))
    stamp = datetime.now(ZoneInfo("Asia/Shanghai")).strftime("%Y-%m-%d %H:%M:%S %Z")
    content = "-- Local database backup created " + stamp + "\n-- Restore with mysql; REPLACE INTO restores rows by primary key.\nSET NAMES utf8mb4;\n\n" + "\n".join(targets)
    path = out_dir / "target-backup.sql"
    path.write_text(content, encoding="utf-8")
    return path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbook", nargs="?", default=str(SOURCE_DEFAULT))
    parser.add_argument("--apply", action="store_true", help="Apply the prepared SQL to the local database")
    args = parser.parse_args()
    source_path = Path(args.workbook).resolve()
    if not source_path.is_file():
        raise ImportErrorForSource(f"Workbook does not exist: {source_path}")
    sha256 = hashlib.sha256(source_path.read_bytes()).hexdigest()
    out_dir = Path.cwd() / "outputs" / "decline-import-20261024"
    out_dir.mkdir(parents=True, exist_ok=True)
    raw = read_workbook(source_path)
    source_rows = raw["execution"]
    months = {str(row.get("stat_date"))[:7] for row in source_rows}
    if len(months) != 1:
        raise ImportErrorForSource(f"Expected one monthly source period, found {sorted(months)}")
    source_month = next(iter(months))
    today = datetime.now(ZoneInfo("Asia/Shanghai")).date()
    cutoff_day = today.day if source_month == today.strftime("%Y-%m") else month_days(source_month)
    cutoff_day = min(cutoff_day, month_days(source_month))
    source_cutoff = f"{source_month}-{cutoff_day:02d}"
    source_json = {"source": str(source_path), "sourceFile": source_path.name,
                   "sha256": sha256, "sheets": raw["sheets"], "formulas": raw["formulas"],
                   "formulaErrors": raw["formulaErrors"]}
    (out_dir / "source.json").write_text(json.dumps(source_json, ensure_ascii=False, indent=2, default=as_json), encoding="utf-8")

    identity = query("SELECT DATABASE(),@@hostname,@@port,VERSION()")
    if not identity or identity[0][0] != DATABASE:
        raise ImportErrorForSource(f"Unexpected database identity: {identity}")
    strategy_codes = [row.get("strategy_code") for row in raw["strategies"]]
    source_id_sql = ",".join(sql_literal(value) for value in strategy_codes)
    channel_rows = query("SELECT key_code,key_name,tab_type,status,sort_no,is_deleted FROM t_sr_dim_channel")
    channel_codes = {}
    new_channels = []
    used_codes = {row[0] for row in channel_rows}
    active_channels = [row for row in channel_rows if row[5] == "0" and row[3] == "1" and
                       row[2] and "active" in row[2].split(",")]
    next_channel = 1
    for name in sorted({row.get("channel") for row in raw["strategies"]}):
        matches = [row for row in active_channels if row[1] == name]
        if len({row[0] for row in matches}) > 1:
            raise ImportErrorForSource(f"Ambiguous active channel mapping for {name}")
        if matches:
            channel_codes[name] = matches[0][0]
            continue
        while True:
            code = f"ACH{next_channel:04d}"
            next_channel += 1
            if code not in used_codes:
                break
        used_codes.add(code)
        channel_codes[name] = code
        new_channels.append({"key_code": code, "key_name": name, "tab_type": TAB_TYPE,
                             "status": 1, "sort_no": max([int(row[4] or 0) for row in channel_rows] + [0]) + len(new_channels) + 1,
                             "is_deleted": 0})

    reason_rows = query("SELECT DISTINCT reason_code,reason_name FROM v_sr_strategy_reject_reason_read WHERE is_deleted=0 AND reason_code IS NOT NULL AND reason_name IS NOT NULL")
    reason_codes = {}
    used_reason_codes = {row[0] for row in reason_rows}
    source_reason_names = sorted({row.get("item_name") for row in raw["details"] if row.get("detail_type") == "拒绝原因"})
    next_reason = 1
    for name in source_reason_names:
        matches = [row for row in reason_rows if row[1] == name]
        codes = {row[0] for row in matches}
        if len(codes) > 1:
            raise ImportErrorForSource(f"Ambiguous existing reason mapping for {name}: {sorted(codes)}")
        if codes:
            reason_codes[name] = next(iter(codes))
            continue
        while True:
            code = f"RSN{next_reason:06d}"
            next_reason += 1
            if code not in used_reason_codes:
                break
        used_reason_codes.add(code)
        reason_codes[name] = code

    execution, source_reasons, master_by_code = make_source_rows(raw, source_month, cutoff_day, channel_codes, reason_codes)
    old_ids = [row[0] for row in query("SELECT DISTINCT strategy_id FROM t_sr_strategy_period_summary_ap_special WHERE tab_type='active' AND strategy_class='降拆' AND city_id='999' AND is_deleted=0 AND strategy_id<>'999'")]
    old_ids_sql = ",".join(sql_literal(value) for value in old_ids) or "''"
    if old_ids:
        other_classes = query(f"SELECT DISTINCT strategy_id,strategy_class FROM v_sr_strategy_period_summary_ap_read WHERE tab_type='active' AND city_id='999' AND is_deleted=0 AND strategy_id IN ({old_ids_sql}) AND strategy_class<>'降拆'")
        if other_classes:
            raise ImportErrorForSource(f"Existing '降拆' IDs also belong to other classes; refusing to remove them: {other_classes[:10]}")
    existing_master_rows = query(f"SELECT id,strategy_code,tab_type,strategy_class FROM v_sr_strategy_read WHERE is_deleted=0 AND strategy_code IN ({source_id_sql})")
    for row in existing_master_rows:
        if row[2] != TAB_TYPE or row[3] != STRATEGY_CLASS:
            raise ImportErrorForSource(f"Strategy code collision across tab/class: {row}")
    existing_by_code = defaultdict(list)
    for row in existing_master_rows:
        existing_by_code[row[1]].append(row)
    if any(len(existing_by_code[code]) > 1 for code in strategy_codes):
        raise ImportErrorForSource("Duplicate active strategy masters exist for a source strategy code")

    history_rows, history_reasons = simulate_history(execution, source_reasons, source_month, cutoff_day)
    all_facts = decorate_facts(history_rows + execution, source_month, source_month, cutoff_day)
    all_reasons = normalize_reason_rows(history_reasons + source_reasons)
    kpis, channel_summaries, categories, capacities = build_summaries(all_facts, source_month, cutoff_day)

    source_data = {"strategies": raw["strategies"], "execution": raw["execution"], "details": raw["details"]}
    funnel_violations = sum(1 for row in execution if row["reach_count"] is not None and row["product_conv_num"] is not None and row["product_conv_num"] > row["reach_count"])
    missing_reach = sum(1 for row in execution if row["reach_count"] is None)
    manifest = {"tabType": TAB_TYPE, "strategyClass": STRATEGY_CLASS, "cityId": CITY_ID,
                "startMonth": source_month[:4] + "-01", "endMonth": month_shift(source_month, -1),
                "sourceMonth": source_month, "sourceCutoff": source_cutoff,
                "baselineMonth": month_shift(source_month[:4] + "-01", -1),
                "baselineSimulated": int(source_month[5:]) > 1,
                "strategiesPerMonth": len(strategy_codes), "dailyAvailable": False,
                "dailyNote": f"{source_month[5:]}月Excel只提供月度数据，未提供日数据或分日权重；其中派单量{missing_reach}条为空，且{funnel_violations}条成功量大于派单量。为保留来源月原值，未生成逐日明细。",
                "method": "Stable integer simulation based on this workbook's fixed strategy set; simulated monthly changes are constrained after rounding. Source month retains Excel values; the source-month comparison uses daily averages.",
                "sourceFile": source_path.name, "sourceSha256": sha256}
    prepared = {"database": DATABASE, "databaseIdentity": identity[0], "source": source_json,
                "scope": {"tabType": TAB_TYPE, "strategyClass": STRATEGY_CLASS, "cityId": CITY_ID,
                          "countyId": None, "sourceMonth": source_month, "sourceCutoff": source_cutoff,
                          "cutoffBasis": "Workbook has a month start but no as-of day; use Asia/Shanghai current date for the current month."},
                "manifest": manifest, "mappings": {"channels": channel_codes, "newChannels": new_channels,
                                                        "reasons": reason_codes},
                "sourceCounts": {"strategies": len(strategy_codes), "monthlyRows": len(execution),
                                 "detailRows": len(source_reasons), "businessRows": 0,
                                 "missingReachRows": missing_reach, "successOverReachRows": funnel_violations},
                "simulationCounts": {"months": len({row['stat_month'] for row in history_rows}),
                                     "monthlyRows": len(history_rows), "reasonRows": len(history_reasons),
                                     "dailyRows": 0},
                "monthlyFacts": all_facts, "reasons": all_reasons,
                "summaries": {"kpis": kpis, "channels": channel_summaries,
                              "categories": categories, "capacities": capacities}}
    (out_dir / "normalized.json").write_text(json.dumps(prepared, ensure_ascii=False, indent=2, default=as_json), encoding="utf-8")

    relevant_tables = ["t_sr_strategy_special", "t_sr_strategy_period_summary_ap_special", "t_sr_strategy_daily_ap_special",
                       "t_sr_strategy_biz_capacity_special", "t_sr_strategy_reject_reason_special", "t_sr_kpi_summary_special",
                       "t_sr_channel_summary_ap_special", "t_sr_channel_monthly_capacity_ap_special", "t_sr_channel_biz_capacity_ap_special",
                       "t_sr_dim_channel"]
    columns_by_table = {table: table_columns(table) for table in relevant_tables}
    backup_path = make_backup(out_dir, old_ids, strategy_codes, columns_by_table)
    statements = ["SET NAMES utf8mb4;", "START TRANSACTION;"]
    statements.append("UPDATE t_sr_strategy_period_summary_ap_special SET is_deleted=1,update_time=NOW() WHERE tab_type='active' AND strategy_class='降拆' AND city_id='999' AND is_deleted=0;")
    statements.append("UPDATE t_sr_strategy_daily_ap_special SET is_deleted=1 WHERE tab_type='active' AND strategy_class='降拆' AND city_id='999' AND is_deleted=0;")
    if old_ids:
        statements.append(f"UPDATE t_sr_strategy_biz_capacity_special SET is_deleted=1,update_time=NOW() WHERE tab_type='active' AND city_id='999' AND strategy_id IN ({old_ids_sql}) AND is_deleted=0;")
        statements.append(f"UPDATE t_sr_strategy_reject_reason_special SET is_deleted=1,update_time=NOW() WHERE city_id='999' AND strategy_id IN ({old_ids_sql}) AND is_deleted=0;")
    for table in ("t_sr_kpi_summary_special", "t_sr_channel_summary_ap_special", "t_sr_channel_monthly_capacity_ap_special", "t_sr_channel_biz_capacity_ap_special"):
        statements.append(f"UPDATE `{table}` SET is_deleted=1 WHERE tab_type='active' AND strategy_class='降拆' AND city_id='999' AND is_deleted=0;")
    statements.extend(insert_statements("t_sr_dim_channel", new_channels, columns_by_table))
    new_masters = []
    master_updates = []
    for code in strategy_codes:
        source = master_by_code[code]
        master = {"strategy_code": code, "strategy_name": source.get("strategy_name"),
                  "tab_type": TAB_TYPE, "strategy_class": STRATEGY_CLASS,
                  "product_name": None, "customer_group": source.get("customer_group"),
                  "channel": channel_codes[source.get("channel")],
                  "strategy_level": source.get("strategy_level"), "caliber": source.get("caliber"),
                  "iteration": source.get("iteration"), "owner": source.get("owner"),
                  "status": source.get("status"), "city_id": CITY_ID, "county_id": None,
                  "start_date": source.get("start_date"), "end_date": source.get("end_date"),
                  "create_time": SqlExpression("NOW()"), "update_time": SqlExpression("NOW()"), "is_deleted": 0}
        if existing_by_code[code]:
            row_id = existing_by_code[code][0][0]
            allowed = columns_by_table["t_sr_strategy_special"] - {"id"}
            fields = [key for key in master if key in allowed]
            master_updates.append("UPDATE t_sr_strategy_special SET " + ",".join(f"`{key}`={sql_value(master[key])}" for key in fields) + f" WHERE id={int(row_id)};")
        else:
            new_masters.append(master)
    statements.extend(master_updates)
    statements.extend(insert_statements("t_sr_strategy_special", new_masters, columns_by_table))
    statements.extend(insert_statements("t_sr_strategy_period_summary_ap_special", all_facts, columns_by_table))
    statements.extend(insert_statements("t_sr_strategy_reject_reason_special", all_reasons, columns_by_table))
    statements.extend(insert_statements("t_sr_kpi_summary_special", kpis, columns_by_table))
    statements.extend(insert_statements("t_sr_channel_summary_ap_special", channel_summaries, columns_by_table))
    statements.extend(insert_statements("t_sr_strategy_period_summary_ap_special", categories, columns_by_table))
    statements.extend(insert_statements("t_sr_channel_monthly_capacity_ap_special", capacities, columns_by_table))
    statements.append("COMMIT;")
    sql_path = out_dir / "import.sql"
    sql_path.write_text("\n\n".join(statements) + "\n", encoding="utf-8")

    result = {"dryRun": not args.apply, "database": DATABASE, "sourceMonth": source_month,
              "sourceCutoff": source_cutoff, "strategies": len(strategy_codes),
              "monthlyFacts": len(all_facts), "simulatedMonthlyFacts": len(history_rows),
              "dailyFacts": 0, "businessFacts": 0, "rejectReasons": len(all_reasons),
              "kpiRows": len(kpis), "channelSummaryRows": len(channel_summaries),
              "categorySummaryRows": len(categories), "capacityRows": len(capacities),
              "missingReachRows": missing_reach, "successOverReachRows": funnel_violations,
              "backupPath": str(backup_path), "normalizedPath": str(out_dir / "normalized.json"),
              "sqlPath": str(sql_path)}
    if not args.apply:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return
    process = subprocess.run(mysql_args() + ["--show-warnings"], input=sql_path.read_text(encoding="utf-8"),
                             env=mysql_env(), text=True, encoding="utf-8", capture_output=True)
    if process.returncode:
        raise ImportErrorForSource("Import SQL failed; the transaction should have rolled back: " + process.stderr.strip())
    verification = query(
        "SELECT DATE_FORMAT(stat_month,'%Y-%m'),COUNT(*),COUNT(DISTINCT strategy_id),"
        "SUM(strategy_id<>'999'),SUM(strategy_id='999'),SUM(county_id IS NOT NULL) "
        "FROM t_sr_strategy_period_summary_ap_special WHERE tab_type='active' AND strategy_class='降拆' AND city_id='999' AND is_deleted=0 "
        "GROUP BY DATE_FORMAT(stat_month,'%Y-%m') ORDER BY DATE_FORMAT(stat_month,'%Y-%m')"
    )
    daily = query("SELECT COUNT(*) FROM t_sr_strategy_daily_ap_special WHERE tab_type='active' AND strategy_class='降拆' AND city_id='999' AND is_deleted=0")
    reasons = query("SELECT COUNT(*),COUNT(DISTINCT strategy_id),SUM(county_id IS NOT NULL) FROM t_sr_strategy_reject_reason_special WHERE city_id='999' AND stat_month='" + source_month + "-01' AND is_deleted=0 AND strategy_id IN (" + source_id_sql + ")")
    result.update({"dryRun": False, "verificationPeriods": verification,
                   "activeDailyRows": int(daily[0][0]), "sourceMonthReasonRows": reasons[0] if reasons else None,
                   "newChannels": new_channels, "mappings": {"channels": channel_codes, "reasons": reason_codes},
                   "manifest": manifest, "mysqlOutput": process.stdout.strip(),
                   "appliedAt": datetime.now(ZoneInfo("Asia/Shanghai")).isoformat()})
    result_path = out_dir / "import-result.json"
    result_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"IMPORT_ERROR: {error}")
        raise
