"""Read the primary sheets of review workbooks without changing their source files."""
from __future__ import annotations

import hashlib
import json
import sys
from datetime import date, datetime
from pathlib import Path

from openpyxl import load_workbook


def json_value(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    # openpyxl represents dynamic/legacy array formulas as objects instead of
    # strings. Keep their formula text in the extraction metadata.
    formula_text = getattr(value, "text", None)
    if formula_text is not None:
        return formula_text
    return value


def is_empty(value):
    return value is None or value == ""


def extract(path: Path):
    content = path.read_bytes()
    formula_wb = load_workbook(path, data_only=False, read_only=False)
    values_wb = load_workbook(path, data_only=True, read_only=False)
    raw_rows = []
    sheets = {}
    for spec in (("1_策略档案", "strategies"), ("2_执行数据", "execution"), ("3_业务及拒绝明细", "details")):
        if spec[0] not in values_wb.sheetnames:
            raise ValueError(f"{path.name}: missing required sheet {spec[0]}")
        values_sheet = values_wb[spec[0]]
        formula_sheet = formula_wb[spec[0]]
        headers = [cell.value for cell in values_sheet[1]]
        sheets[f"{spec[1]}_columns"] = headers
        records = []
        for row_num in range(3, values_sheet.max_row + 1):
            values = [cell.value for cell in values_sheet[row_num]]
            if not values or is_empty(values[0]):
                continue
            for cell in values_sheet[row_num]:
                if cell.data_type == "e":
                    raise ValueError(f"{path.name}/{spec[0]}!{cell.coordinate}: {cell.value}")
            record = {header: json_value(value) for header, value in zip(headers, values) if header is not None}
            record["_source_row"] = row_num
            formula_cells = []
            formula_fields = []
            for formula_cell, value_cell in zip(formula_sheet[row_num], values_sheet[row_num]):
                if formula_cell.data_type == "f":
                    formula_cells.append({"cell": formula_cell.coordinate, "formula": json_value(formula_cell.value),
                                          "cached": json_value(value_cell.value)})
                    if formula_cell.column <= len(headers) and headers[formula_cell.column - 1] is not None:
                        formula_fields.append(headers[formula_cell.column - 1])
            record["_formula_cells"] = formula_cells
            record["_formula_fields"] = formula_fields
            records.append(record)
            raw_rows.append({"sheetName": spec[0], "sourceRow": row_num, "values": [json_value(value) for value in values],
                             "formulaCells": formula_cells})
        sheets[spec[1]] = records

    # Preserve the workbook's explicit daily rules, including rows and formulas used to explain them.
    for worksheet in values_wb.worksheets:
        if worksheet.title == "填报与加工说明" or worksheet.title.startswith("3_业务及拒绝明细"):
            continue
        for row_num in range(1, worksheet.max_row + 1):
            values = [cell.value for cell in worksheet[row_num]]
            if any(not is_empty(value) for value in values):
                formula_sheet = formula_wb[worksheet.title]
                formula_cells = []
                for formula_cell, value_cell in zip(formula_sheet[row_num], worksheet[row_num]):
                    if formula_cell.data_type == "f":
                        formula_cells.append({"cell": formula_cell.coordinate, "formula": json_value(formula_cell.value),
                                              "cached": json_value(value_cell.value)})
                raw_rows.append({"sheetName": worksheet.title, "sourceRow": row_num,
                                 "values": [json_value(value) for value in values], "formulaCells": formula_cells})

    sheet_names = list(values_wb.sheetnames)
    formula_wb.close()
    values_wb.close()
    return {
        "sourcePath": str(path.resolve()), "sourceFile": path.name,
        "sha256": hashlib.sha256(content).hexdigest(), "byteLength": len(content),
        "sheetNames": sheet_names,
        "columns": {"strategies": sheets["strategies_columns"], "execution": sheets["execution_columns"],
                    "details": sheets["details_columns"]},
        "strategies": sheets["strategies"], "execution": sheets["execution"], "details": sheets["details"],
        "rawRows": raw_rows,
    }


def main():
    source = Path(sys.argv[1]).resolve()
    files = [source] if source.is_file() else sorted(path for path in source.glob("*.xlsx") if not path.name.startswith("~$"))
    if not files:
        raise FileNotFoundError(f"No .xlsx workbooks found in {source}")
    result = {"sourceDirectory": str(source.parent if source.is_file() else source), "workbooks": [extract(path) for path in files]}
    json.dump(result, sys.stdout, ensure_ascii=False, separators=(",", ":"))
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
