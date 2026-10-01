/** Экранирует значение для ячейки CSV: кавычки удваиваются, поле оборачивается в кавычки */
function escapeCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

/**
 * Собирает CSV из заголовков и строк и скачивает файл в браузере.
 * BOM в начале нужен, чтобы Excel на Windows не ломал кириллицу.
 */
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const lines = [headers, ...rows].map((row) => row.map((cell) => escapeCell(String(cell))).join(';'))
  const csv = '﻿' + lines.join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
