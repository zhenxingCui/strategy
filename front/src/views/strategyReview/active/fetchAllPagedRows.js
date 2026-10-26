function rowsFromPage(result) {
  if (Array.isArray(result)) return result
  return result && Array.isArray(result.list) ? result.list : []
}

export async function fetchAllPagedRows(fetchPage, fallbackTotal = 0, pageSize = 500) {
  const firstPage = await fetchPage(1, pageSize)
  const rows = rowsFromPage(firstPage).slice()
  const reportedTotal = firstPage && firstPage.total != null ? Number(firstPage.total) : NaN
  const total = Number.isFinite(reportedTotal) && reportedTotal >= 0 ? reportedTotal : fallbackTotal
  const pageCount = Math.ceil(total / pageSize)

  for (let pageNum = 2; pageNum <= pageCount; pageNum += 1) {
    const result = await fetchPage(pageNum, pageSize)
    const nextRows = rowsFromPage(result)
    if (!nextRows.length) throw new Error('导出数据未完整加载，请重试')
    rows.push(...nextRows)
  }

  if (rows.length !== total) throw new Error('导出数据未完整加载，请重试')
  return rows
}
