import { computed, reactive } from 'vue'
import {
  createWarehouseData,
  CURRENT_EMPLOYEE_ID,
  employees,
  problemTypeLabels,
  type EquipmentStatus,
  type EquipmentUnit,
  type ProblemType,
  type RequestComment,
  type RequestStatus,
  type TmcChannel,
  type TmcKit,
  type UsageLogEntry,
  type UsageRuleTemplate,
  type WarehouseRequest,
  type WarehouseSettings,
} from '@/mocks/tmc'
import { formatRuDate, nowRu } from '@/utils/date'

/** Пользователь, от имени которого кладовщик оставляет комментарии (сквозная авторизация не реализована) */
const CURRENT_USER_NAME = employees.find((e) => e.id === CURRENT_EMPLOYEE_ID)?.name ?? ''

/** Поля комплекта, которые вводит пользователь в модале */
export type KitInput = Omit<TmcKit, 'id'>

/** Поля оборудования, которого нет в реестре основных средств, заводится «по месту» */
export interface AdhocUnitInput {
  name: string
  category: string
}

/** Что кладовщик указывает, отмечая проблему с единицей */
export interface ProblemInput {
  type: ProblemType
  comment?: string
  photo?: string
}

export type TemplateInput = Omit<UsageRuleTemplate, 'id'>

const state = reactive(createWarehouseData())

const newRequests = computed(() =>
  state.requests.filter((r) => r.status === 'Новая' || r.status === 'В обработке'),
)
const pickupRequests = computed(() =>
  state.requests.filter((r) => r.status === 'Подготовка' || r.status === 'Готово'),
)
/** Статусы, в которых ТМЦ заявки у пользователя: отсюда заявку закрывают возвратом */
const ON_HAND_STATUSES: RequestStatus[] = ['На руках', 'Частично выдана']

const rentalRequests = computed(() => state.requests.filter((r) => ON_HAND_STATUSES.includes(r.status)))

const metrics = computed(() => ({
  newRequests: newRequests.value.length,
  pickupToday: pickupRequests.value.length,
  activeRentals: rentalRequests.value.length,
  // «Доступные ТМЦ» считает единицы оборудования в наличии
  availableItems: state.items.filter((i) => i.status === 'available').length,
}))

const categories = computed(() =>
  [...new Set([...state.items.map((i) => i.category), ...state.kits.map((k) => k.category)])].sort(),
)

function requestById(id: number): WarehouseRequest | undefined {
  return state.requests.find((r) => r.id === id)
}

function unitById(id: number): EquipmentUnit | undefined {
  return state.items.find((i) => i.id === id)
}

function requestItems(request: WarehouseRequest): EquipmentUnit[] {
  return request.itemIds
    .map(unitById)
    .filter((i): i is EquipmentUnit => i !== undefined)
}

/** Единицы оборудования, которые можно добавить в комплект `kitId` (или в новый) */
function availableUnitsFor(kitId?: number): EquipmentUnit[] {
  // невыданное при частичной выдаче к заявке больше не привязано
  const reserved = new Set(
    state.requests.flatMap((r) => r.itemIds.filter((id) => !r.notIssuedIds.includes(id))),
  )
  const inOtherKits = new Set(
    state.kits.filter((k) => k.id !== kitId).flatMap((k) => k.groups.flatMap((g) => g.unitIds)),
  )
  const inThisKit = new Set(
    state.kits.filter((k) => k.id === kitId).flatMap((k) => k.groups.flatMap((g) => g.unitIds)),
  )
  return state.items.filter(
    (u) => inThisKit.has(u.id) || (u.status === 'available' && !reserved.has(u.id) && !inOtherKits.has(u.id)),
  )
}

/** Статус набора единиц: обслуживание важнее выдачи, иначе доступен */
function unitsStatus(unitIds: number[]): EquipmentStatus {
  const statuses = unitIds.map((id) => unitById(id)?.status)
  if (statuses.includes('maintenance')) return 'maintenance'
  if (statuses.includes('issued')) return 'issued'
  return 'available'
}

function kitUnitIds(kit: TmcKit): number[] {
  return kit.groups.flatMap((g) => g.unitIds)
}

function kitStatus(kit: TmcKit): EquipmentStatus {
  return unitsStatus(kitUnitIds(kit))
}

/** Всего единиц в составе (для нескольких экземпляров — сколько их заведено) */
function kitUnitCount(kit: TmcKit): number {
  return kitUnitIds(kit).length
}

/** Сколько экземпляров сейчас свободно для брони (актуально для одной единицы в нескольких экземплярах) */
function kitAvailableQuantity(kit: TmcKit): number {
  return kitUnitIds(kit)
    .map(unitById)
    .filter((u): u is EquipmentUnit => u !== undefined && u.status === 'available').length
}

function employeeName(id: number): string {
  return employees.find((e) => e.id === id)?.name ?? '—'
}

/** Причина, по которой комплект нельзя удалить, либо null, если удалить можно */
function removeKitBlockReason(id: number): string | null {
  const kit = state.kits.find((k) => k.id === id)
  if (!kit) return 'ТМЦ не найден'
  if (kitUnitIds(kit).some((unitId) => unitById(unitId)?.status === 'issued')) {
    return 'В комплекте есть выданное оборудование'
  }
  return null
}

function cloneInput(input: KitInput): KitInput {
  return {
    type: input.type,
    multiple: input.type === 'single' ? input.multiple : undefined,
    name: input.name.trim(),
    category: input.category,
    description: input.description.trim(),
    usageRules: input.usageRules.trim(),
    responsibleId: input.responsibleId,
    image: input.image,
    groups: input.groups.map((g) => ({ id: g.id, name: g.name.trim(), unitIds: [...g.unitIds] })),
    minRentalMinutes: input.minRentalMinutes,
    maxRentalMinutes: input.maxRentalMinutes,
  }
}

function addKit(input: KitInput): TmcKit {
  const id = state.kits.reduce((max, k) => Math.max(max, k.id), 0) + 1
  const kit: TmcKit = { id, ...cloneInput(input) }
  state.kits.unshift(kit)
  return kit
}

function updateKit(id: number, input: KitInput) {
  const index = state.kits.findIndex((k) => k.id === id)
  if (index === -1) return
  state.kits[index] = { id, ...cloneInput(input) }
}

function removeKit(id: number): boolean {
  if (removeKitBlockReason(id) !== null) return false
  const index = state.kits.findIndex((k) => k.id === id)
  if (index === -1) return false
  state.kits.splice(index, 1)
  return true
}

/**
 * Завести оборудование «по месту», без записи в реестре основных средств: на учёт как ОС
 * не ставится, существует только для выдачи через реестр ТМЦ. `count` — сразу несколько
 * одинаковых экземпляров (например, 6 утюгов); код каждому система присваивает сама.
 */
function addAdhocUnits(input: AdhocUnitInput, count = 1): EquipmentUnit[] {
  const created: EquipmentUnit[] = []
  for (let n = 0; n < Math.max(1, count); n += 1) {
    const id = state.items.reduce((max, i) => Math.max(max, i.id), 0) + 1
    const unit: EquipmentUnit = {
      id,
      name: input.name.trim(),
      category: input.category.trim(),
      code: `ADHOC-${id}`,
      status: 'available',
      origin: 'adhoc',
    }
    state.items.push(unit)
    created.push(unit)
  }
  return created
}

function kitForUnit(unitId: number): TmcKit | undefined {
  return state.kits.find((k) => k.groups.some((g) => g.unitIds.includes(unitId)))
}

/**
 * ТМЦ реестра, в состав которой обычно входит оборудование с этим названием (по имени группы),
 * даже если конкретная выданная единица заведена отдельно (заявки не привязаны к id комплекта).
 * Подсказывает кладовщику, к какому комплекту/пулу относится позиция заявки.
 */
function kitForItemName(name: string): TmcKit | undefined {
  return state.kits.find((k) => k.groups.some((g) => g.name === name))
}

function logEntriesFor(unitId: number): UsageLogEntry[] {
  return state.log
    .filter((e) => e.unitId === unitId)
    .slice()
    .sort((a, b) => b.id - a.id)
}

/** Порядок статусов заявки от подачи до выдачи */
const REQUEST_FLOW: RequestStatus[] = ['Новая', 'В обработке', 'Подготовка', 'Готово', 'На руках']

/** Следующий статус в очереди обработки заявки, если он есть */
function nextRequestStatus(status: RequestStatus): RequestStatus | undefined {
  const index = REQUEST_FLOW.indexOf(status)
  return index === -1 || index === REQUEST_FLOW.length - 2 ? undefined : REQUEST_FLOW[index + 1]
}

/** Продвинуть заявку на следующий шаг обработки (кроме самой выдачи — она через issueRequest) */
function advanceRequestStatus(id: number): boolean {
  const request = requestById(id)
  if (!request) return false
  const next = nextRequestStatus(request.status)
  if (!next) return false
  request.status = next
  return true
}

/** Отклонить заявку на любом этапе до выдачи */
function rejectRequest(id: number): boolean {
  const request = requestById(id)
  if (!request || !REQUEST_FLOW.slice(0, -1).includes(request.status)) return false
  request.status = 'Отклонена'
  return true
}

/**
 * Оформить выдачу: заявка уходит в активные аренды, выданные ТМЦ помечаются выданными, пишется журнал.
 * `issuedIds` — если выдают не всё: остальное освобождается, заявка становится «Частично выдана»,
 * причина пишется в комментарии к ТМЦ.
 */
function issueRequest(id: number, issuedIds?: number[], reason?: string): boolean {
  const request = requestById(id)
  if (!request || request.status !== 'Готово') return false
  const all = requestItems(request)
  const issued = issuedIds ? all.filter((u) => issuedIds.includes(u.id)) : all
  if (!issued.length) return false
  const notIssued = all.filter((u) => !issued.includes(u))

  request.status = notIssued.length ? 'Частично выдана' : 'На руках'
  request.pickupActualAt = nowRu()
  request.notIssuedIds = notIssued.map((u) => u.id)
  if (notIssued.length) {
    const names = notIssued.map((u) => `${u.name} (${u.code})`).join(', ')
    const why = reason?.trim()
    addComment(request.itemComments, `Не выдано: ${names}.${why ? ` Причина: ${why}` : ''}`)
  }

  const nextLogId = state.log.reduce((max, e) => Math.max(max, e.id), 0) + 1
  issued.forEach((item, index) => {
    item.status = 'issued'
    const kit = kitForUnit(item.id)
    state.log.unshift({
      id: nextLogId + index,
      unitId: item.id,
      unitName: item.name,
      unitCode: item.code,
      kitId: kit?.id ?? null,
      kitName: kit?.name ?? null,
      requestNumber: request.number,
      userFullName: request.fullName,
      userEmail: request.email,
      issuedAt: formatRuDate(new Date()),
      dueAt: request.returnUntil,
      returnedAt: null,
      place: request.place,
    })
  })
  return true
}

/** Открытая запись журнала: единица выдана по этой заявке и ещё не возвращена */
function openLogEntry(request: WarehouseRequest, unitId: number): UsageLogEntry | undefined {
  return state.log.find(
    (e) => e.unitId === unitId && e.requestNumber === request.number && e.returnedAt === null,
  )
}

/** Единицы заявки, которые сейчас на руках у пользователя — их и сверяют при возврате */
function unitsOnHand(request: WarehouseRequest): EquipmentUnit[] {
  if (!ON_HAND_STATUSES.includes(request.status)) return []
  return requestItems(request).filter((u) => openLogEntry(request, u.id) !== undefined)
}

/**
 * Принять возврат: только полный, все выданные единицы сверены или отмечены проблемой.
 * Единицы с проблемой остаются на обслуживании, остальные освобождаются.
 */
function returnRequest(id: number): boolean {
  const request = requestById(id)
  if (!request || !ON_HAND_STATUSES.includes(request.status)) return false
  const today = formatRuDate(new Date())
  for (const item of unitsOnHand(request)) {
    item.status = item.problem ? 'maintenance' : 'available'
    const entry = openLogEntry(request, item.id)
    if (entry) entry.returnedAt = today
  }
  request.status = 'Возвращена'
  request.returnActualAt = nowRu()
  return true
}

/**
 * Отметить проблему с единицей: она уходит на обслуживание до устранения.
 * С `requestId` проблема попадает и в комментарии к ТМЦ заявки.
 */
function reportProblem(unitId: number, input: ProblemInput, requestId?: number): boolean {
  const unit = unitById(unitId)
  if (!unit) return false
  const comment = input.comment?.trim() || undefined
  unit.problem = {
    type: input.type,
    comment,
    photo: input.photo,
    reportedAt: nowRu(),
    reportedBy: CURRENT_USER_NAME,
  }
  unit.status = 'maintenance'
  const request = requestId !== undefined ? requestById(requestId) : undefined
  if (request) {
    addComment(
      request.itemComments,
      `Проблема «${problemTypeLabels[input.type]}»: ${unit.name} (${unit.code}).${comment ? ` ${comment}` : ''}`,
    )
  }
  return true
}

/** Проблема устранена: единица возвращается в оборот (или остаётся выданной, если она на руках) */
function resolveProblem(unitId: number): boolean {
  const unit = unitById(unitId)
  if (!unit?.problem) return false
  unit.problem = undefined
  const onHand = state.log.some((e) => e.unitId === unitId && e.returnedAt === null)
  unit.status = onHand ? 'issued' : 'available'
  return true
}

function warehouseById(id: number): WarehouseSettings | undefined {
  return state.warehouses.find((w) => w.id === id)
}

function updateWarehouse(input: WarehouseSettings) {
  const index = state.warehouses.findIndex((w) => w.id === input.id)
  if (index === -1) return
  state.warehouses[index] = {
    ...input,
    name: input.name.trim(),
    managerIds: [...input.managerIds],
    seniorAdminIds: [...input.seniorAdminIds],
    moderatorIds: [...input.moderatorIds],
    channels: input.channels.map((c) => ({ id: c.id, title: c.title.trim(), url: c.url.trim() })),
  }
}

/** Каналы связи склада сохраняются отдельно от основных настроек — у блока своя кнопка */
function updateWarehouseChannels(id: number, channels: TmcChannel[]) {
  const warehouse = warehouseById(id)
  if (!warehouse) return
  updateWarehouse({ ...warehouse, channels })
}

function addTemplate(input: TemplateInput): UsageRuleTemplate {
  const id = state.templates.reduce((max, t) => Math.max(max, t.id), 0) + 1
  const template = { id, name: input.name.trim(), text: input.text.trim() }
  state.templates.push(template)
  return template
}

function updateTemplate(id: number, input: TemplateInput) {
  const template = state.templates.find((t) => t.id === id)
  if (!template) return
  template.name = input.name.trim()
  template.text = input.text.trim()
}

function removeTemplate(id: number) {
  const index = state.templates.findIndex((t) => t.id === id)
  if (index !== -1) state.templates.splice(index, 1)
}

let commentSeq = state.requests
  .flatMap((r) => [...r.requestComments, ...r.itemComments])
  .reduce((max, c) => Math.max(max, c.id), 0)

function addComment(list: RequestComment[], text: string): RequestComment | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  commentSeq += 1
  const comment: RequestComment = {
    id: commentSeq,
    author: CURRENT_USER_NAME,
    createdAt: new Date().toLocaleDateString('ru-RU'),
    text: trimmed,
  }
  list.push(comment)
  return comment
}

/** Добавить комментарий к заявке (согласование, договорённости с пользователем) */
function addRequestComment(id: number, text: string): boolean {
  const request = requestById(id)
  if (!request) return false
  return addComment(request.requestComments, text) !== null
}

/** Добавить комментарий к ТМЦ заявки (состояние, особенности выдаваемого оборудования) */
function addItemComment(id: number, text: string): boolean {
  const request = requestById(id)
  if (!request) return false
  return addComment(request.itemComments, text) !== null
}

export function useWarehouse() {
  return {
    equipment: computed(() => state.items),
    kits: computed(() => state.kits),
    employees,
    requests: computed(() => state.requests),
    log: computed(() => state.log),
    warehouses: computed(() => state.warehouses),
    templates: computed(() => state.templates),
    currentEmployeeId: CURRENT_EMPLOYEE_ID,
    newRequests,
    pickupRequests,
    rentalRequests,
    metrics,
    categories,
    requestById,
    requestItems,
    unitById,
    kitForUnit,
    kitForItemName,
    availableUnitsFor,
    unitsStatus,
    kitStatus,
    kitUnitCount,
    kitAvailableQuantity,
    employeeName,
    logEntriesFor,
    removeKitBlockReason,
    addKit,
    updateKit,
    removeKit,
    addAdhocUnits,
    advanceRequestStatus,
    rejectRequest,
    issueRequest,
    unitsOnHand,
    returnRequest,
    reportProblem,
    resolveProblem,
    warehouseById,
    updateWarehouse,
    updateWarehouseChannels,
    addTemplate,
    updateTemplate,
    removeTemplate,
    addRequestComment,
    addItemComment,
  }
}
