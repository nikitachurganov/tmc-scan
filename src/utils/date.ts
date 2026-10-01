/** Даты в моках и UI — строки «дд.мм.гггг» или «дд.мм.гггг чч:мм» */

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function formatRuDate(date: Date): string {
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`
}

export function formatRuDateTime(date: Date): string {
  return `${formatRuDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Текущий момент в формате «дд.мм.гггг чч:мм» */
export function nowRu(): string {
  return formatRuDateTime(new Date())
}

/** «дд.мм.гггг» или «дд.мм.гггг чч:мм» → Date; без времени — начало дня */
export function parseRuDate(value: string): Date | null {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/.exec(value.trim())
  if (!match) return null
  const [, dd, mm, yyyy, hh = '0', min = '0'] = match
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min))
}

/** Сдвиг даты «дд.мм.гггг» на `days` дней; с `time` — «дд.мм.гггг чч:мм» */
export function addDaysRu(value: string, days: number, time?: string): string {
  const date = parseRuDate(value) ?? new Date()
  date.setDate(date.getDate() + days)
  return time ? `${formatRuDate(date)} ${time}` : formatRuDate(date)
}

/** Дата без времени из «дд.мм.гггг чч:мм» */
export function datePart(value: string): string {
  return value.trim().split(/\s+/)[0] ?? value
}
