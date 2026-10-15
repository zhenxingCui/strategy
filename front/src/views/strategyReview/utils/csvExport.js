/**
 * 前端 CSV 导出工具
 * 纯前端实现，无需后端接口支持
 * 支持：表头映射、数据格式化、BOM 头兼容 Excel 中文
 */

function formatCell (value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return String(value)
    return String(value)
  }
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

function pad2 (n) {
  return n < 10 ? '0' + n : String(n)
}

function getTimestamp () {
  const d = new Date()
  return d.getFullYear().toString() +
    pad2(d.getMonth() + 1) +
    pad2(d.getDate()) +
    pad2(d.getHours()) +
    pad2(d.getMinutes()) +
    pad2(d.getSeconds())
}

/**
 * 导出表格数据为 CSV 文件并触发浏览器下载
 *
 * @param {Object} options
 * @param {Array} options.columns - 列定义数组，每项 { label: string, prop?: string, formatter?: (row) => any }
 *   - label: 表头中文名称
 *   - prop: 对应数据字段名；若提供 formatter 可省略
 *   - formatter: 自定义取值函数，接收 row，返回显示值
 * @param {Array} options.data - 要导出的数据行数组
 * @param {string} [options.filename] - 文件名（不含扩展名），默认自动生成带时间戳
 * @param {string} [options.sheetName] - 预留，暂不使用（CSV 无 sheet 概念）
 */
export function exportTableToCsv ({ columns, data, filename }) {
  if (!Array.isArray(columns) || !columns.length) {
    throw new Error('exportTableToCsv: columns 不能为空')
  }
  if (!Array.isArray(data)) {
    throw new Error('exportTableToCsv: data 必须是数组')
  }

  const headerRow = columns.map(col => formatCell(col.label || col.prop || '')).join(',')

  const bodyRows = data.map(row => {
    return columns.map(col => {
      let val
      if (typeof col.formatter === 'function') {
        val = col.formatter(row)
      } else if (col.prop) {
        val = row[col.prop]
      } else {
        val = ''
      }
      return formatCell(val)
    }).join(',')
  })

  const csvContent = [headerRow, ...bodyRows].join('\r\n')

  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })

  const finalName = (filename || 'export') + '_' + getTimestamp() + '.csv'

  if (window.navigator && typeof window.navigator.msSaveBlob === 'function') {
    window.navigator.msSaveBlob(blob, finalName)
    return
  }

  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', finalName)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

export default {
  exportTableToCsv
}
