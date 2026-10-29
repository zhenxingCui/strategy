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


def paired_rows(values_sheet, formula_sheet):
    """Read physical worksheet rows without scanning formatted blank rows.

    Some workbooks set the used range to Excel's final row even when the XML only
    contains a few thousand rows. Read-only mode plus reset_dimensions follows the
    worksheet XML and avoids allocating or iterating through that blank tail.
    """
    values_sheet.reset_dimensions()
    formula_sheet.reset_dimensions()
    for row_num, (values, formulas) in enumerate(
        zip(values_sheet.iter_rows(), formula_sheet.iter_rows()), start=1
    ):
        yield row_num, values, formulas


def extract(path: Path):
    content = path.read_bytes()
    formula_wb = load_workbook(path, data_only=False, read_only=True)
    values_wb = load_workbook(path, data_only=True, read_only=True)
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
        for row_num, value_cells, formula_cells_in_row in paired_rows(values_sheet, formula_sheet):
            if row_num < 3:
                continue
            values = [cell.value for cell in value_cells]
            if not values or is_empty(values[0]):
                continue
            for cell in value_cells:
                if cell.data_type == "e":
                    raise ValueError(f"{path.name}/{spec[0]}!{cell.coordinate}: {cell.value}")
            record = {header: json_value(value) for header, value in zip(headers, values) if header is not None}
            record["_source_row"] = row_num
            formula_cells = []
            formula_fields = []
            for formula_cell, value_cell in zip(formula_cells_in_row, value_cells):
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
        formula_sheet = formula_wb[worksheet.title]
        for row_num, value_cells, formula_cells_in_row in paired_rows(worksheet, formula_sheet):
            values = [cell.value for cell in value_cells]
            if any(not is_empty(value) for value in values) or any(
                cell.data_type == "f" for cell in formula_cells_in_row
            ):
                formula_cells = []
                for formula_cell, value_cell in zip(formula_cells_in_row, value_cells):
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
