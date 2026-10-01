/** Длительность хранится в минутах, в интерфейсе — дни, часы и минуты */

export const MINUTES_IN_HOUR = 60
export const MINUTES_IN_DAY = 24 * MINUTES_IN_HOUR

export interface DurationParts {
  days: number
  hours: number
  minutes: number
}

export function splitDuration(total: number): DurationParts {
  return {
    days: Math.floor(total / MINUTES_IN_DAY),
    hours: Math.floor((total % MINUTES_IN_DAY) / MINUTES_IN_HOUR),
    minutes: total % MINUTES_IN_HOUR,
  }
}

export function joinDuration({ days, hours, minutes }: DurationParts): number {
  return days * MINUTES_IN_DAY + hours * MINUTES_IN_HOUR + minutes
}

/** 1590 → «1 д 2 ч 30 мин» */
export function formatDuration(total: number): string {
  const { days, hours, minutes } = splitDuration(total)
  const parts = [
    days ? `${days} д` : '',
    hours ? `${hours} ч` : '',
    minutes ? `${minutes} мин` : '',
  ].filter(Boolean)
  return parts.length ? parts.join(' ') : '0 мин'
}

/** Мин. и макс. срок аренды одной строкой: «от 1 ч до 3 д», «до 3 д», «—» */
export function rentalRangeLabel(min?: number, max?: number): string {
  if (min === undefined && max === undefined) return '—'
  if (min !== undefined && max !== undefined) return `от ${formatDuration(min)} до ${formatDuration(max)}`
  return min !== undefined ? `от ${formatDuration(min)}` : `до ${formatDuration(max!)}`
}
