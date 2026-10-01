import { RETURN_DEADLINE_TIME, type WarehouseRequest } from '@/mocks/tmc'
import { parseRuDate } from '@/utils/date'

/** Ячейка даты: текст и признак опоздания (факт позже плана) */
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

function isAfter(a: string, b: string): boolean {
  const left = parseRuDate(a)
  const right = parseRuDate(b)
  return left !== null && right !== null && left > right
}

/**
 * План и факт начала и окончания пользования. Просрочка — не статус заявки:
 * факт подсвечивается, если он позже плана. Пока ТМЦ не выдали или не вернули, факт — просто прочерк.
 */
export function requestDates(request: WarehouseRequest): RequestDates {
  const plannedEnd = `${request.returnUntil} ${RETURN_DEADLINE_TIME}`

  let actualStart: DateCell = { text: '—', late: false }
  if (request.pickupActualAt) {
    actualStart = { text: request.pickupActualAt, late: isAfter(request.pickupActualAt, request.pickupPlannedAt) }
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
