"""Read a downgrade workbook without modifying it and emit exact raw rows/formulas as JSON."""
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
    return value


def main():
    path = Path(sys.argv[1]).resolve()
    if not path.is_file():
        raise FileNotFoundError(path)
    content = path.read_bytes()
    formulas_wb = load_workbook(path, data_only=False, read_only=False)
    values_wb = load_workbook(path, data_only=True, read_only=False)

    raw_rows = []
    inputs = {"strategies": [], "execution": [], "details": []}
    sheet_specs = (("1_", "strategies"), ("2_", "execution"), ("3_", "details"))
    for formula_sheet in formulas_wb.worksheets:
        values_sheet = values_wb[formula_sheet.title]
        formula_rows = formula_sheet.iter_rows()
        value_rows = values_sheet.iter_rows()
        for row_num, (formula_row, value_row) in enumerate(zip(formula_rows, value_rows), start=1):
            source_values = [json_value(cell.value) for cell in value_row]
            if not any(value is not None for value in source_values):
                continue
            formula_cells = []
            for formula_cell, value_cell in zip(formula_row, value_row):
                if formula_cell.data_type == "f":
                    formula_cells.append({
                        "cell": formula_cell.coordinate,
                        "formula": formula_cell.value,
                        "cached": json_value(value_cell.value),
                    })
            raw_rows.append({
                "sheetName": formula_sheet.title,
                "sourceRow": row_num,
                "values": source_values,
                "formulaCells": formula_cells,
            })

        for prefix, key in sheet_specs:
            if not formula_sheet.title.startswith(prefix):
                continue
            headers = list(next(values_sheet.iter_rows(min_row=1, max_row=1, values_only=True)))
            for row_num, cells in enumerate(values_sheet.iter_rows(min_row=3, values_only=False), start=3):
                values = [cell.value for cell in cells]
                if not values or values[0] is None:
                    continue
                record = {header: json_value(value) for header, value in zip(headers, values) if header is not None}
                record["_source_row"] = row_num
                inputs[key].append(record)

    formula_errors = []
    for row in raw_rows:
        if any("#" in str(value) for value in row["values"] if isinstance(value, str)):
            formula_errors.append({"sheet": row["sheetName"], "row": row["sourceRow"]})
    if formula_errors:
        raise ValueError("Workbook contains formula error text: " + json.dumps(formula_errors, ensure_ascii=False))

    result = {
        "sourcePath": str(path),
        "sourceFile": path.name,
        "sha256": hashlib.sha256(content).hexdigest(),
        "byteLength": len(content),
        "sheetNames": formulas_wb.sheetnames,
        "rawRows": raw_rows,
        **inputs,
    }
    formulas_wb.close()
    values_wb.close()
    json.dump(result, sys.stdout, ensure_ascii=False, separators=(",", ":"))
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
