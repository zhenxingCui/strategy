"""Read cached Excel results without modifying the source workbook."""
import json, sys, hashlib
from pathlib import Path
from datetime import datetime, date
from openpyxl import load_workbook

source, target = map(Path, sys.argv[1:3])
wb = load_workbook(source, data_only=True, read_only=True)
groups = []
for index, width in [(0, 12), (1, 17), (2, 8)]:
    sheet = wb.worksheets[index]
    headers = [sheet.cell(1, col).value for col in range(1, width + 1)]
    records = []
    for row in sheet.iter_rows(min_row=3, max_col=width):
        if row[0].value is None:
            continue
        record = {}
        for key, cell in zip(headers, row):
            if cell.data_type == 'e':
                raise ValueError(f'{sheet.title}!{cell.coordinate}: {cell.value}')
            value = cell.value
            if isinstance(value, (datetime, date)):
                value = value.isoformat()[:10]
            if value == '不填' or value == '':
                value = None
            record[key] = value
        records.append(record)
    groups.append(records)
target.parent.mkdir(parents=True, exist_ok=True)
payload = dict(source=str(source), sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
               strategies=groups[0], execution=groups[1], details=groups[2])
if '分日展示' in wb.sheetnames:
    sheet = wb['分日展示']
    import math
    rules = {}
    for category, start_row in [('反向', 6), ('查码', 10)]:
        fields = {}
        for offset, field in enumerate(['push_count', 'usage_count', 'reach_count', 'target_conv_num']):
            values = [sheet.cell(start_row + offset, col).value for col in range(3, 24)]
            if not all(isinstance(value, (int, float)) and math.isfinite(value) and value >= 0 for value in values):
                raise ValueError(f'Invalid daily weights: {category}/{field}')
            if abs(sum(values) - 1) > 1e-8:
                raise ValueError(f'Daily weights do not sum to 1: {category}/{field}')
            fields[field] = values
        rules[category] = fields
    payload['dailyRules'] = dict(sheet='分日展示', startDate='2026-10-01', endDate='2026-10-21', categories=rules)
target.write_text(json.dumps(payload,
                             ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'counts': [len(group) for group in groups]}, ensure_ascii=False))
