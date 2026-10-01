import { RETURN_DEADLINE_TIME, type RequestStatus, type WarehouseRequest } from '@/mocks/tmc'
import { parseRuDate } from '@/utils/date'

/** Ячейка даты: текст и признак опоздания (факт позже плана или план прошёл без факта) */
export interface DateCell {
  text: string
  late: boolean
}

export interface RequestDates {
  plannedStart: DateCell
  actualStart: DateCell
  plannedEnd: DateCell
  actualEnd: DateCell
}

/** До выдачи: заявку ещё можно выдать, факта начала нет */
const BEFORE_PICKUP: RequestStatus[] = ['Новая', 'В обработке', 'Подготовка', 'Готово']

function isAfter(a: string, b: string): boolean {
  const left = parseRuDate(a)
  const right = parseRuDate(b)
  return left !== null && right !== null && left > right
}

function isPast(value: string, now: Date): boolean {
  const date = parseRuDate(value)
  return date !== null && date < now
}

/**
 * План и факт начала и окончания пользования. Просрочка — не статус заявки:
 * факт подсвечивается, если он позже плана; без факта выдачи после планового начала — «Не выдано».
 * Пока ТМЦ не вернули, факт окончания — просто прочерк, без пометки.
 */
export function requestDates(request: WarehouseRequest, now = new Date()): RequestDates {
  const plannedEnd = `${request.returnUntil} ${RETURN_DEADLINE_TIME}`

  let actualStart: DateCell = { text: '—', late: false }
  if (request.pickupActualAt) {
    actualStart = { text: request.pickupActualAt, late: isAfter(request.pickupActualAt, request.pickupPlannedAt) }
  } else if (BEFORE_PICKUP.includes(request.status) && isPast(request.pickupPlannedAt, now)) {
    actualStart = { text: 'Не выдано', late: true }
  }

  const actualEnd: DateCell = request.returnActualAt
    ? { text: request.returnActualAt, late: isAfter(request.returnActualAt, plannedEnd) }
    : { text: '—', late: false }

  return {
    plannedStart: { text: request.pickupPlannedAt, late: false },
    actualStart,
    plannedEnd: { text: plannedEnd, late: false },
    actualEnd,
  }
}
