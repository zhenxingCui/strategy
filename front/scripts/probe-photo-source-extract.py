import json, sys, hashlib
import openpyxl

path, output = sys.argv[1:3]
book = openpyxl.load_workbook(path, read_only=True, data_only=True)
sheet = book.active
rows = iter(sheet.values)
headers = next(rows)
data = [dict(zip(headers, row)) for row in rows if any(v is not None for v in row)]
with open(path, 'rb') as f:
    digest = hashlib.sha256(f.read()).hexdigest()
with open(output, 'w', encoding='utf-8') as f:
    json.dump({'sha256': digest, 'sheet': sheet.title, 'rows': data}, f, ensure_ascii=False, default=str)
