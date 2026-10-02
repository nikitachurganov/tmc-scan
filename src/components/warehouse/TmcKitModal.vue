<script setup lang="ts">
import { DeleteOutlined, EditOutlined, ScanOutlined, UploadOutlined } from '@ant-design/icons-vue'
import { Drawer, message, Modal, type FormInstance, type TableColumnsType } from 'ant-design-vue'
import type { Rule } from 'ant-design-vue/es/form'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import TmcAddAdhocEquipment from './TmcAddAdhocEquipment.vue'
import TmcDurationInput from './TmcDurationInput.vue'
import TmcEquipmentScanner from './TmcEquipmentScanner.vue'
import TmcOverlayScroll from './TmcOverlayScroll.vue'
import TmcKitComposition from './TmcKitComposition.vue'
import TmcStatusTag from './TmcStatusTag.vue'
import type { ScanResult } from './scan'
import { useCurrentWarehouse } from '@/composables/useCurrentWarehouse'
import { useIsMobile } from '@/composables/useIsMobile'
import { useWarehouse, type KitInput, type ManualUnitStatus } from '@/composables/useWarehouse'
import {
  equipmentStatusLabels,
  tmcKindLabel,
  tmcStatusLabels,
  type Employee,
  type EquipmentUnit,
  type TmcGroup,
  type TmcKit,
  type TmcType,
  type UsageLogEntry,
} from '@/mocks/tmc'
import { rentalRangeLabel } from '@/utils/duration'

/** Смена статуса единицы, сделанная в дровере; применяется вместе с сохранением ТМЦ */
export interface UnitStatusChange {
  unitId: number
  status: ManualUnitStatus
  comment: string
}

const props = defineProps<{
  open: boolean
  /** Редактируемый комплект; null — форма создания */
  kit: TmcKit | null
  categories: string[]
  employees: Employee[]
  /** Единицы оборудования, доступные для этого комплекта */
  availableUnits: EquipmentUnit[]
  /** Открыть карточку ТМЦ на просмотр (клик по названию в реестре); «Изменить» переводит в правку */
  readonly?: boolean
}>()

const emit = defineEmits<{ close: []; submit: [payload: KitInput, statusChanges: UnitStatusChange[]] }>()

/**
 * Создание — модал с двумя колонками; просмотр и редактирование — дровер справа с вкладками
 * «Основная информация / Оборудование / Журнал выдачи». Поля и логика формы общие.
 */
const asDrawer = computed(() => props.kit !== null)
type DrawerTab = 'info' | 'equipment' | 'log'
const tab = ref<DrawerTab>('info')

/** Режим дровера: просмотр карточки или правка */
const mode = ref<'view' | 'edit'>('edit')
const isView = computed(() => asDrawer.value && mode.value === 'view')

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const isMobile = useIsMobile()
const { equipment, templates, unitById, logEntriesFor, kitAvailability, employeeName } = useWarehouse()
const modalBodyStyle = computed(() =>
  isMobile.value
    ? { maxHeight: 'calc(100vh - 128px)', overflowY: 'auto' as const }
    : // ПК: тело окна не прокручивается, каждая колонка скроллится сама (см. .km-col)
      { height: '70vh', overflow: 'hidden' as const },
)

interface FormState {
  type: TmcType
  /** Одна единица в нескольких экземплярах одной категории (иначе — одна уникальная) */
  multiple: boolean
  /** Единица оборудования для уникальной «одной единицы» */
  unitId: number | undefined
  name: string
  category: string | undefined
  description: string
  usageRules: string
  responsibleId: number | undefined
  image: string | undefined
  groups: KitInput['groups']
  /** Мин. и макс. срок аренды в минутах */
  minRental: number | undefined
  maxRental: number | undefined
}

const formRef = ref<FormInstance>()
const form = reactive<FormState>({
  type: 'single',
  multiple: false,
  unitId: undefined,
  name: '',
  category: undefined,
  description: '',
  usageRules: '',
  responsibleId: undefined,
  image: undefined,
  groups: [],
  minRental: undefined,
  maxRental: undefined,
})

const templateOptions = computed(() => templates.value.map((t) => ({ value: t.id, label: t.name })))
/** Селект шаблона — только действие «подставить», после выбора снова пустой */
const templatePick = ref<number>()

/** Шаблон дописывается в правила использования; дальше текст можно править вручную */
function applyTemplate(id: unknown) {
  const template = templates.value.find((t) => t.id === id)
  if (template) {
    const current = form.usageRules.trim()
    if (!current.includes(template.text)) {
      form.usageRules = current ? `${current}\n\n${template.text}` : template.text
    }
  }
  nextTick(() => {
    templatePick.value = undefined
  })
}

const rentalError = computed(() =>
  form.minRental !== undefined && form.maxRental !== undefined && form.minRental > form.maxRental
    ? 'Минимальный срок больше максимального'
    : '',
)
const groupsError = ref('')
const scanning = ref(false)
const unitSearch = ref('')
const addingAdhocUnit = ref(false)

const isEdit = computed(() => props.kit !== null)
const categoryOptions = computed(() => props.categories.map((value) => ({ value })))
/** Ответственным можно выбрать управляющего или старшего администратора текущего склада */
const { current: currentWarehouse } = useCurrentWarehouse()

const responsibleOptions = computed(() => {
  const warehouse = currentWarehouse.value
  const nameOf = (id: number) => props.employees.find((e) => e.id === id)?.name ?? '—'
  const managers = warehouse?.managerIds ?? []
  // сотрудник с обеими ролями показан один раз — среди управляющих
  const seniors = (warehouse?.seniorAdminIds ?? []).filter((id) => !managers.includes(id))
  const groups = [
    { label: 'Управляющие', options: managers.map((id) => ({ value: id, label: nameOf(id) })) },
    { label: 'Старшие администраторы', options: seniors.map((id) => ({ value: id, label: nameOf(id) })) },
  ].filter((group) => group.options.length)
  // ответственный, сохранённый раньше и уже не входящий в роли склада, остаётся в списке
  const saved = props.kit?.responsibleId
  const listed = [...managers, ...seniors]
  if (saved !== undefined && !listed.includes(saved)) {
    groups.push({ label: 'Назначен ранее', options: [{ value: saved, label: nameOf(saved) }] })
  }
  return groups
})
const unitOptions = computed(() =>
  // label — для поиска и выбранного значения, name и code — для двух строк в выпадающем списке
  props.availableUnits.map((u) => ({ value: u.id, label: `${u.name} · ${u.code}`, name: u.name, code: u.code })),
)

const rules: Record<string, Rule[]> = {
  name: [{ required: true, whitespace: true, message: 'Укажите наименование', trigger: 'blur' }],
  category: [{ required: true, message: 'Выберите категорию', trigger: 'change' }],
  responsibleId: [{ required: true, type: 'number', message: 'Выберите ответственного', trigger: 'change' }],
}

watch(
  () => props.open,
  (open) => {
    if (open) loadForm()
  },
)

/** Заполнить форму из ТМЦ (или пустую); `keepTab` — остаться на текущей вкладке при отмене правки */
function loadForm(keepTab = false) {
  form.type = props.kit?.type ?? 'single'
  form.multiple = props.kit?.type === 'single' && !!props.kit.multiple
  form.unitId =
    props.kit?.type === 'single' && !props.kit.multiple ? props.kit.groups[0]?.unitIds[0] : undefined
  form.name = props.kit?.name ?? ''
  form.category = props.kit?.category
  form.description = props.kit?.description ?? ''
  form.usageRules = props.kit?.usageRules ?? ''
  form.responsibleId = props.kit?.responsibleId
  form.image = props.kit?.image
  form.groups = props.kit
    ? props.kit.groups.map((g) => ({ id: g.id, name: g.name, unitIds: [...g.unitIds] }))
    : []
  form.minRental = props.kit?.minRentalMinutes
  form.maxRental = props.kit?.maxRentalMinutes
  groupsError.value = ''
  scanning.value = false
  unitSearch.value = ''
  if (!keepTab) tab.value = 'info'
  mode.value = props.readonly ? 'view' : 'edit'
  statusChanges.value = {}
  formRef.value?.clearValidate()
  initialState = formState()
}

/* ---------- статусы единиц (только в дровере редактирования) ---------- */

/** Черновик смен статуса: только единицы, которым поставили статус, отличный от текущего */
const statusChanges = ref<Record<number, { status: ManualUnitStatus; comment: string }>>({})

const MANUAL_STATUSES: ManualUnitStatus[] = ['available', 'damaged', 'lost']
const unitStatusOptions = MANUAL_STATUSES.map((value) => ({ value, label: equipmentStatusLabels[value] }))

/** Бронь и пользование задаёт заявка — такие единицы вручную не меняются */
function isLocked(unit: EquipmentUnit): boolean {
  return unit.status === 'booked' || unit.status === 'in_use'
}

function draftStatus(unit: EquipmentUnit): ManualUnitStatus | undefined {
  if (isLocked(unit)) return undefined
  return statusChanges.value[unit.id]?.status ?? (unit.status as ManualUnitStatus)
}

function setDraftStatus(unit: EquipmentUnit, status: unknown) {
  const next = { ...statusChanges.value }
  if (status === unit.status) delete next[unit.id]
  else next[unit.id] = { status: status as ManualUnitStatus, comment: '' }
  statusChanges.value = next
}

/** Комментарий спрашиваем, только когда единицу помечают повреждённой или утерянной */
function needsComment(unit: EquipmentUnit): boolean {
  const change = statusChanges.value[unit.id]
  return change !== undefined && change.status !== 'available'
}

const selectedUnit = computed(() => (form.unitId !== undefined ? unitById(form.unitId) : undefined))

/* ---------- журнал выдачи (только в дровере редактирования) ---------- */

const logColumns: TableColumnsType = [
  { title: '№ заявки', dataIndex: 'requestNumber', width: 130 },
  { title: 'Оборудование', key: 'unit' },
  { title: 'Пользователь', dataIndex: 'userFullName' },
  { title: 'Выдано', dataIndex: 'issuedAt', width: 110 },
  { title: 'Возвращено', key: 'returnedAt', width: 130 },
  { title: 'Статус', key: 'status', width: 140 },
]

/** Одна выдача ТМЦ: все единицы, выданные по одной заявке */
interface LogRow {
  requestNumber: string
  userFullName: string
  issuedAt: string
  units: UsageLogEntry[]
  /** Для сортировки: самая свежая запись выдачи */
  lastId: number
}

/** История выдач ТМЦ: строка на заявку, новые сверху */
const logEntries = computed<LogRow[]>(() => {
  const ids = props.kit?.groups.flatMap((g) => g.unitIds) ?? []
  const byRequest = new Map<string, LogRow>()
  for (const entry of ids.flatMap((id) => logEntriesFor(id))) {
    const row = byRequest.get(entry.requestNumber) ?? {
      requestNumber: entry.requestNumber,
      userFullName: entry.userFullName,
      issuedAt: entry.issuedAt,
      units: [],
      lastId: 0,
    }
    row.units.push(entry)
    row.lastId = Math.max(row.lastId, entry.id)
    byRequest.set(entry.requestNumber, row)
  }
  return [...byRequest.values()].sort((a, b) => b.lastId - a.lastId)
})

/** «Проектор, HDMI-кабель, Удлинитель» — названия без повторов и без количества */
function logUnitsLabel(row: LogRow): string {
  return [...new Set(row.units.map((u) => u.unitName))].join(', ')
}

/** Дата возврата: самая поздняя среди единиц; «—», пока что-то ещё на руках */
function logReturnedAt(row: LogRow): string {
  if (row.units.some((u) => !u.returnedAt)) return '—'
  return row.units.map((u) => u.returnedAt!).sort(compareRuDates).pop() ?? '—'
}

/** «дд.мм.гггг» → по возрастанию даты */
function compareRuDates(a: string, b: string): number {
  const key = (value: string) => value.split('.').reverse().join('')
  return key(a).localeCompare(key(b))
}

function logStatus(row: LogRow): string {
  if (row.units.some((u) => u.lost)) return 'Утеряно'
  return row.units.every((u) => u.returnedAt) ? 'Возвращено' : 'В пользовании'
}

/* ---------- оболочка: модал или дровер ---------- */

const containerProps = computed(() =>
  asDrawer.value
    ? {
        open: props.open,
        width: isMobile.value ? '100%' : 760,
        placement: 'right' as const,
        destroyOnClose: true,
        rootClassName: 'km km-drawer',
      }
    : {
        open: props.open,
        width: isMobile.value ? '100%' : 1100,
        centered: !isMobile.value,
        wrapClassName: isMobile.value ? 'km km-mobile' : 'km',
        destroyOnClose: true,
        bodyStyle: modalBodyStyle.value,
      },
)

const titleText = computed(() => {
  if (!asDrawer.value) return 'Добавить ТМЦ'
  return isView.value ? (props.kit?.name ?? '') : 'Редактировать ТМЦ'
})

/* ---------- режим просмотра ---------- */

const viewAvailability = computed(() => (props.kit ? kitAvailability(props.kit) : null))

/** Правила режем на абзацы по пустым строкам — длинный текст читается кусками */
const usageRuleParagraphs = computed(() =>
  (props.kit?.usageRules ?? '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean),
)

function viewUnits(group: TmcGroup): EquipmentUnit[] {
  return group.unitIds.map(unitById).filter((u): u is EquipmentUnit => u !== undefined)
}

/** «Отмена» в правке, открытой из просмотра: возвращаемся к просмотру, а не закрываем карточку */
function cancelEdit() {
  if (!props.readonly) {
    requestClose()
    return
  }
  const back = () => loadForm(true)
  if (formState() === initialState) {
    back()
    return
  }
  Modal.confirm({
    title: 'Отменить изменения?',
    okText: 'Отменить',
    cancelText: 'Продолжить',
    centered: true,
    onOk: back,
  })
}

function closeAny() {
  if (isView.value) emit('close')
  else requestClose()
}

/**
 * Снимок заполненных полей: пустые группы не считаем — в режиме комплекта и экземпляров форма
 * сама заводит одну пустую группу, а это ещё не ввод пользователя.
 */
function formState(): string {
  return JSON.stringify({
    type: form.type,
    multiple: form.multiple,
    unitId: form.unitId,
    name: form.name,
    category: form.category,
    description: form.description,
    usageRules: form.usageRules,
    responsibleId: form.responsibleId,
    image: form.image,
    groups: form.groups.filter((g) => g.name.trim() || g.unitIds.length).map((g) => [g.name, g.unitIds]),
    minRental: form.minRental,
    maxRental: form.maxRental,
    statuses: statusChanges.value,
  })
}

let initialState = ''

/** Закрытие окна: если в форме есть несохранённые изменения, сначала спрашиваем */
function requestClose() {
  if (formState() === initialState) {
    emit('close')
    return
  }
  Modal.confirm({
    title: 'Закрыть без сохранения?',
    okText: 'Закрыть',
    cancelText: 'Продолжить',
    centered: true,
    onOk: () => emit('close'),
  })
}
watch(
  () => [form.groups, form.type, form.multiple, form.unitId],
  () => {
    groupsError.value = ''
  },
  { deep: true },
)

/** Несколько экземпляров одной единицы: состав — одна группа взаимозаменяемых единиц */
const copiesMode = computed(() => form.type === 'single' && form.multiple)

// Переключение вида не теряет выбранное: уникальная единица становится первым экземпляром и обратно,
// а из комплекта в экземпляры переходит только первая группа
watch(
  () => [form.type, form.multiple] as const,
  ([type, multiple], [prevType, prevMultiple]) => {
    if (!props.open) return
    const wasUnique = prevType === 'single' && !prevMultiple
    if (type === 'single' && multiple) {
      if (wasUnique && form.unitId !== undefined && !form.groups.some((g) => g.unitIds.length)) {
        const unit = unitById(form.unitId)
        form.groups = [{ id: 1, name: unit?.name ?? '', unitIds: [form.unitId] }]
      } else if (form.groups.length > 1) {
        form.groups = form.groups.slice(0, 1)
      }
    } else if (type === 'single' && form.unitId === undefined) {
      form.unitId = form.groups[0]?.unitIds[0]
    } else if (type === 'kit' && wasUnique && form.unitId !== undefined && !form.groups.length) {
      const unit = unitById(form.unitId)
      form.groups = [{ id: 1, name: unit?.name ?? '', unitIds: [form.unitId] }]
    }
  },
)

// первый экземпляр подставляет пустые название и категорию — как выбор уникальной единицы
watch(
  () => form.groups[0]?.unitIds[0],
  (firstId) => {
    if (!copiesMode.value || firstId === undefined) return
    const unit = unitById(firstId)
    if (unit) onUnitChange(unit)
  },
)

function validateGroups(): string {
  if (copiesMode.value) {
    const total = form.groups.reduce((sum, g) => sum + g.unitIds.length, 0)
    return total === 0 ? 'Добавьте хотя бы один экземпляр' : ''
  }
  if (form.type === 'single') return form.unitId === undefined ? 'Выберите оборудование' : ''
  if (form.groups.length === 0) return 'Добавьте в комплект хотя бы одну группу'
  if (form.groups.some((g) => !g.name.trim())) return 'Укажите название каждой группы'
  if (form.groups.some((g) => g.unitIds.length === 0)) return 'В каждой группе выберите оборудование'
  return ''
}

/** Выбрали единицу: пустые название и категория подставляются из неё */
function onUnitChange(unit?: EquipmentUnit) {
  const picked = unit ?? props.availableUnits.find((u) => u.id === form.unitId)
  if (!picked) return
  if (!form.name.trim()) form.name = picked.name
  if (form.category === undefined) form.category = picked.category
}

/** Скан или ввод кода для типа «одна единица»: код должен принадлежать свободному оборудованию */
function pickUnitByCode(raw: string): ScanResult {
  const code = raw.trim()
  const unit = equipment.value.find((u) => u.code === code)
  if (!unit) return { kind: 'wrong', text: `Оборудование с кодом ${code} не найдено` }
  if (!props.availableUnits.some((u) => u.id === unit.id)) {
    return { kind: 'wrong', text: `${unit.name} недоступно: уже в комплекте, заявке или выдано` }
  }
  form.unitId = unit.id
  onUnitChange(unit)
  return { kind: 'ok', text: `Выбрано: ${unit.name} · ${unit.code}` }
}

/** Оборудования нет в реестре ОС: создаём его и сразу выбираем для уникальной единицы */
function onAdhocUnitCreated(units: EquipmentUnit[]) {
  addingAdhocUnit.value = false
  const [unit] = units
  if (!unit) return
  form.unitId = unit.id
  onUnitChange(unit)
}

/** Enter в поиске: ручной сканер штрихкодов вводит код и жмёт Enter */
function onUnitKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter') return
  const code = unitSearch.value.trim()
  if (!props.availableUnits.some((u) => u.code === code)) return
  pickUnitByCode(code)
  unitSearch.value = ''
}

function beforeUpload(file: File) {
  if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
    message.error('Подходят только изображения JPG и PNG')
    return false
  }
  if (file.size > MAX_IMAGE_BYTES) {
    message.error('Размер изображения не должен превышать 5 МБ')
    return false
  }
  const reader = new FileReader()
  reader.onload = () => {
    form.image = typeof reader.result === 'string' ? reader.result : undefined
  }
  reader.readAsDataURL(file)
  return false
}

/** Одна единица — единственная группа: из одной единицы или, в режиме экземпляров, из N */
function buildGroups(): KitInput['groups'] {
  if (form.type === 'kit') return form.groups
  if (copiesMode.value) {
    return form.groups.slice(0, 1).map((g) => ({ ...g, name: g.name.trim() || form.name }))
  }
  const unit = props.availableUnits.find((u) => u.id === form.unitId)
  const id = props.kit?.groups[0]?.id ?? 1
  return [{ id, name: unit?.name ?? form.name, unitIds: form.unitId === undefined ? [] : [form.unitId] }]
}

async function submit() {
  let formValid = true
  try {
    await formRef.value?.validate()
  } catch {
    formValid = false
  }
  groupsError.value = validateGroups()
  // в дровере ошибка может быть на другой вкладке — переключаемся туда, где её видно
  if (!formValid || rentalError.value) tab.value = 'info'
  else if (groupsError.value) tab.value = 'equipment'
  if (
    !formValid ||
    groupsError.value ||
    rentalError.value ||
    form.category === undefined ||
    form.responsibleId === undefined
  ) {
    return
  }
  const groups = buildGroups()
  const keptIds = new Set(groups.flatMap((g) => g.unitIds))
  const changes: UnitStatusChange[] = Object.entries(statusChanges.value)
    .map(([id, change]) => ({ unitId: Number(id), status: change.status, comment: change.comment }))
    .filter((change) => keptIds.has(change.unitId))
  emit('submit', {
    type: form.type,
    multiple: form.type === 'single' ? form.multiple : undefined,
    name: form.name,
    category: form.category,
    description: form.description,
    usageRules: form.usageRules,
    responsibleId: form.responsibleId,
    image: form.image,
    groups,
    minRentalMinutes: form.minRental,
    maxRentalMinutes: form.maxRental,
  }, changes)
}
</script>

<template>
  <component :is="asDrawer ? Drawer : Modal" v-bind="containerProps" @cancel="closeAny" @close="closeAny">
    <template #title>
      <span class="km-title">
        {{ titleText }}
        <TmcStatusTag v-if="isView && viewAvailability" :label="tmcStatusLabels[viewAvailability.status]" />
      </span>
    </template>

    <!-- дровер: вкладки — продолжение шапки и прилипают к ней при прокрутке; разделы общие с модалом создания -->
    <a-tabs v-if="asDrawer" v-model:active-key="tab" class="km-tabs">
      <a-tab-pane key="info" tab="Основная информация" />
      <a-tab-pane key="equipment" tab="Оборудование" />
      <a-tab-pane key="log" tab="Журнал выдачи" />
    </a-tabs>

    <div class="km-columns" :class="{ 'km-columns--drawer': asDrawer }">
      <section v-if="!isView" v-show="!asDrawer || tab === 'info'" class="km-col">
        <h3 v-if="!asDrawer" class="km-col__title">Основная информация</h3>
        <TmcOverlayScroll class="km-col__scroll">
        <a-form ref="formRef" :model="form" :rules="rules" layout="vertical" @finish="submit">
          <a-form-item label="Наименование ТМЦ" name="name">
            <a-input v-model:value="form.name" placeholder="Например, Набор для презентаций" />
          </a-form-item>
          <a-form-item label="Категория" name="category">
            <a-select
              v-model:value="form.category"
              placeholder="Выберите категорию"
              :options="categoryOptions"
            />
          </a-form-item>
          <a-form-item label="Описание" name="description">
            <a-textarea
              v-model:value="form.description"
              :rows="3"
              :maxlength="1000"
              show-count
              placeholder="Кратко опишите ТМЦ: что входит, для чего подходит"
            />
          </a-form-item>
          <a-form-item label="Правила использования" name="usageRules">
            <a-form-item-rest>
              <a-select
                v-model:value="templatePick"
                placeholder="Подставить шаблон правил использования"
                :options="templateOptions"
                :not-found-content="'Шаблонов нет — добавьте их в настройках склада'"
                class="km-template"
                @change="applyTemplate"
              />
            </a-form-item-rest>
            <a-textarea
              v-model:value="form.usageRules"
              :rows="4"
              :maxlength="2000"
              show-count
              placeholder="Как пользоваться ТМЦ, что запрещено, в каком виде вернуть"
            />
          </a-form-item>
          <a-form-item label="Ответственный" name="responsibleId">
            <a-select
              v-model:value="form.responsibleId"
              allow-clear
              placeholder="Выберите ответственного"
              :options="responsibleOptions"
            />
          </a-form-item>
          <a-form-item
            label="Срок аренды"
            :validate-status="rentalError ? 'error' : undefined"
            :help="rentalError || undefined"
          >
            <a-form-item-rest>
              <div class="km-rental">
                <span class="km-rental__label">Минимальный</span>
                <TmcDurationInput v-model:value="form.minRental" :status="rentalError ? 'error' : undefined" />
                <span class="km-rental__label">Максимальный</span>
                <TmcDurationInput v-model:value="form.maxRental" :status="rentalError ? 'error' : undefined" />
              </div>
            </a-form-item-rest>
          </a-form-item>
          <a-form-item label="Изображение" name="image">
            <div class="km-image">
              <div v-if="form.image" class="km-image__preview">
                <img :src="form.image" alt="Изображение ТМЦ" class="km-image__img" />
                <a-button
                  type="primary"
                  shape="circle"
                  size="small"
                  danger
                  class="km-image__remove"
                  aria-label="Удалить изображение"
                  @click="form.image = undefined"
                >
                  <template #icon><DeleteOutlined /></template>
                </a-button>
              </div>
              <div class="km-image__upload">
                <a-upload
                  accept="image/png,image/jpeg"
                  :show-upload-list="false"
                  :multiple="false"
                  :before-upload="beforeUpload"
                >
                  <a-button>
                    <template #icon><UploadOutlined /></template>
                    {{ form.image ? 'Заменить изображение' : 'Загрузить изображение' }}
                  </a-button>
                </a-upload>
                <span class="km-image__hint">JPG, PNG до 5 МБ</span>
              </div>
            </div>
          </a-form-item>
        </a-form>
        </TmcOverlayScroll>
      </section>

      <a-divider v-if="!asDrawer" type="vertical" class="km-divider" />

      <section v-if="!isView" v-show="!asDrawer || tab === 'equipment'" class="km-col">
        <!-- тип определяет, что ниже: оборудование, экземпляры или состав комплекта; правил нет — отдельная форма для подписи -->
        <h3 v-if="!asDrawer" class="km-col__title">{{ form.type === 'kit' ? 'Состав комплекта' : 'Оборудование' }}</h3>
        <TmcOverlayScroll class="km-col__scroll">
        <a-form layout="vertical">
          <a-form-item label="Тип">
            <a-radio-group v-model:value="form.type" button-style="solid" class="km-type">
              <a-radio-button value="single">Одно ТМЦ</a-radio-button>
              <a-radio-button value="kit">Комплект ТМЦ</a-radio-button>
            </a-radio-group>
          </a-form-item>
          <a-form-item v-if="form.type === 'single'" label="Количество">
            <a-radio-group v-model:value="form.multiple">
              <a-radio :value="false">Один экземпляр</a-radio>
              <a-radio :value="true">Несколько экземпляров</a-radio>
            </a-radio-group>
          </a-form-item>
        </a-form>

        <template v-if="form.type === 'kit' || copiesMode">
          <TmcKitComposition
            v-model:groups="form.groups"
            :available-units="availableUnits"
            :categories="props.categories"
            :error="groupsError"
            :copies-mode="copiesMode"
            :copies-category="form.category"
          >
            <!-- статус каждой единицы: выбор прямо в строке, применяется по «Сохранить» -->
            <template v-if="asDrawer" #unit-extra="{ unit }">
              <a-tooltip v-if="isLocked(unit)" title="Статус ведёт заявка">
                <span><TmcStatusTag :label="equipmentStatusLabels[unit.status as EquipmentUnit['status']]" /></span>
              </a-tooltip>
              <a-select
                v-else
                :value="draftStatus(unit)"
                :options="unitStatusOptions"
                size="small"
                class="km-status"
                :aria-label="`Статус: ${unit.name} ${unit.code}`"
                @change="(value: unknown) => setDraftStatus(unit, value)"
              />
            </template>
            <template v-if="asDrawer" #unit-below="{ unit }">
              <a-input
                v-if="needsComment(unit)"
                v-model:value="statusChanges[unit.id]!.comment"
                size="small"
                :maxlength="500"
                placeholder="Комментарий: что случилось"
              />
            </template>
          </TmcKitComposition>
        </template>
        <template v-else>
          <div class="km-unit-row">
            <a-select
              v-model:value="form.unitId"
              show-search
              allow-clear
              option-filter-prop="label"
              placeholder="Найдите по названию или коду"
              :options="unitOptions"
              :list-item-height="52"
              dropdown-class-name="km-unit-dropdown"
              :status="groupsError ? 'error' : undefined"
              class="km-unit"
              @change="() => onUnitChange()"
              @search="unitSearch = $event"
              @input-key-down="onUnitKeydown"
            >
              <template #option="{ name, code }">
                <div class="km-unit-option__name">{{ name }}</div>
                <div class="km-unit-option__code">{{ code }}</div>
              </template>
              <template #notFoundContent>Нет свободного оборудования</template>
            </a-select>
            <a-button @click="scanning = true">
              <template #icon><ScanOutlined /></template>
              Сканировать
            </a-button>
          </div>
          <div v-if="groupsError" class="km-unit__error" role="alert">{{ groupsError }}</div>
          <!-- один экземпляр: статус выбранной единицы — под выбором оборудования -->
          <a-form v-if="asDrawer && selectedUnit" layout="vertical" class="km-unit-status">
            <a-form-item label="Статус">
              <a-tooltip v-if="isLocked(selectedUnit)" title="Статус ведёт заявка">
                <span><TmcStatusTag :label="equipmentStatusLabels[selectedUnit.status]" /></span>
              </a-tooltip>
              <template v-else>
                <a-select
                  :value="draftStatus(selectedUnit)"
                  :options="unitStatusOptions"
                  class="km-status km-status--wide"
                  @change="(value: unknown) => setDraftStatus(selectedUnit!, value)"
                />
                <a-input
                  v-if="needsComment(selectedUnit)"
                  v-model:value="statusChanges[selectedUnit.id]!.comment"
                  :maxlength="500"
                  placeholder="Комментарий: что случилось"
                  class="km-status-comment"
                />
              </template>
            </a-form-item>
          </a-form>
          <div class="km-adhoc">
            <span class="km-adhoc__text">Оборудование не стоит на учёте?</span>
            <a-button type="link" class="km-adhoc__link" @click="addingAdhocUnit = true">Добавить</a-button>
          </div>
          <TmcEquipmentScanner
            v-if="scanning"
            close-on-ok
            :handler="pickUnitByCode"
            @close="scanning = false"
          />
          <TmcAddAdhocEquipment
            :open="addingAdhocUnit"
            :categories="props.categories"
            @close="addingAdhocUnit = false"
            @created="onAdhocUnitCreated"
          />
        </template>
        </TmcOverlayScroll>
      </section>

      <!-- просмотр карточки: те же разделы, но значениями, без полей ввода -->
      <template v-if="isView && kit">
        <section v-show="tab === 'info'" class="km-col km-view">
          <img v-if="kit.image" :src="kit.image" alt="Изображение ТМЦ" class="km-view__image" />

          <!-- главное — короткими карточками: быстро найти нужное, не читая текст целиком -->
          <div class="km-facts">
            <div class="km-fact">
              <span class="km-fact__label">Категория</span>
              <span class="km-fact__value">{{ kit.category }}</span>
            </div>
            <div class="km-fact">
              <span class="km-fact__label">Тип</span>
              <span class="km-fact__value">{{ tmcKindLabel(kit) }}</span>
            </div>
            <div class="km-fact">
              <span class="km-fact__label">Ответственный</span>
              <span class="km-fact__value">{{ employeeName(kit.responsibleId) }}</span>
            </div>
            <div class="km-fact">
              <span class="km-fact__label">Срок аренды</span>
              <span class="km-fact__value">
                {{ kit.minRentalMinutes || kit.maxRentalMinutes ? rentalRangeLabel(kit.minRentalMinutes, kit.maxRentalMinutes) : 'Не ограничен' }}
              </span>
            </div>
          </div>

          <section class="km-block">
            <h4 class="km-block__title">Описание</h4>
            <p v-if="kit.description" class="km-block__text">{{ kit.description }}</p>
            <p v-else class="km-block__empty">Описание не добавлено</p>
          </section>

          <section class="km-block">
            <h4 class="km-block__title">Правила использования</h4>
            <div v-if="kit.usageRules" class="km-rules">
              <p v-for="(paragraph, index) in usageRuleParagraphs" :key="index" class="km-block__text">
                {{ paragraph }}
              </p>
            </div>
            <p v-else class="km-block__empty">Правила не добавлены</p>
          </section>
        </section>

        <section v-show="tab === 'equipment'" class="km-col km-view">
          <p class="km-view__summary">
            {{ tmcKindLabel(kit) }} · {{ viewAvailability?.total ?? 0 }} ед.
            <template v-if="viewAvailability && viewAvailability.available < viewAvailability.total">
              · доступно {{ viewAvailability.available }}
            </template>
          </p>
          <div v-for="group in kit.groups" :key="group.id" class="km-view__group">
            <h4 v-if="kit.type === 'kit'" class="km-view__group-name">{{ group.name }}</h4>
            <ul class="km-view__units">
              <li v-for="unit in viewUnits(group)" :key="unit.id" class="km-view__unit">
                <div class="km-view__unit-text">
                  <RouterLink :to="{ name: 'equipment', params: { id: unit.id } }" class="km-view__unit-name">
                    {{ unit.name }}
                  </RouterLink>
                  <div class="km-view__unit-code">{{ unit.code }}</div>
                  <div v-if="unit.problem?.comment" class="km-view__unit-note">{{ unit.problem.comment }}</div>
                </div>
                <TmcStatusTag :label="equipmentStatusLabels[unit.status]" />
              </li>
            </ul>
          </div>
        </section>
      </template>

      <!-- журнал выдачи: все выдачи единиц этого ТМЦ, только просмотр -->
      <section v-if="asDrawer" v-show="tab === 'log'" class="km-col">
        <a-table
          :columns="logColumns"
          :data-source="logEntries"
          row-key="requestNumber"
          size="small"
          :pagination="logEntries.length > 10 ? { pageSize: 10, showSizeChanger: false } : false"
          :scroll="{ x: 680 }"
          :locale="{ emptyText: 'Выдач этого ТМЦ ещё не было' }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'unit'">{{ logUnitsLabel(record as LogRow) }}</template>
            <template v-else-if="column.key === 'returnedAt'">{{ logReturnedAt(record as LogRow) }}</template>
            <TmcStatusTag v-else-if="column.key === 'status'" :label="logStatus(record as LogRow)" />
          </template>
        </a-table>
      </section>
    </div>

    <template #footer>
      <div v-if="isView" class="km-footer">
        <a-button :block="isMobile" @click="emit('close')">Закрыть</a-button>
        <a-button type="primary" :block="isMobile" @click="mode = 'edit'">
          <template #icon><EditOutlined /></template>
          Изменить
        </a-button>
      </div>
      <div v-else class="km-footer">
        <a-button :block="isMobile" @click="cancelEdit">Отмена</a-button>
        <a-button type="primary" :block="isMobile" @click="submit">
          {{ isEdit ? 'Сохранить' : 'Создать ТМЦ' }}
        </a-button>
      </div>
    </template>
  </component>
</template>

<style scoped>
.km-columns {
  display: flex;
  align-items: stretch;
  gap: 16px;
  height: 100%;
}

/* левая и правая части прокручиваются независимо друг от друга */
.km-col {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  height: 100%;
}

/* заголовок колонки зафиксирован, прокручивается только содержимое под ним */
.km-col__scroll {
  flex: 1;
  min-height: 0;
}

/* полоса прокрутки занимает свою дорожку справа и не заходит на поля и подписи */
.km-col__scroll :deep(.os__viewport > div) {
  padding-right: 14px;
}

/* второй уровень: подзаголовки колонок ниже заголовка окна */
.km-col__title {
  margin: 0 0 12px;
  font-size: 16px;
  line-height: 24px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
}

.km-type {
  display: flex;
}

.km-type :deep(.ant-radio-button-wrapper) {
  flex: 1;
  text-align: center;
}

.km-template {
  width: 100%;
  margin-bottom: 8px;
}

.km-rental {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 8px 12px;
}

.km-rental__label {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.65);
}

.km-unit-row {
  display: flex;
  gap: 8px;
}

.km-unit {
  flex: 1;
  min-width: 0;
}

.km-unit__error {
  margin-top: 4px;
  color: #ff4d4f;
}

/* «Оборудование не стоит на учёте?» + «Добавить» — заводит оборудование не из реестра ОС */
.km-adhoc {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}

.km-adhoc__text {
  color: rgba(0, 0, 0, 0.65);
}

/* ссылка вплотную к вопросу, без собственных отступов кнопки */
.km-adhoc__link {
  height: auto;
  padding: 0;
}

.km-divider {
  height: auto;
  margin: 0;
}

.km-image {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.km-image__preview {
  position: relative;
  flex: none;
  width: 130px;
  height: 130px;
  overflow: hidden;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
}

.km-image__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.km-image__remove {
  position: absolute;
  top: 6px;
  right: 6px;
}

/* загрузка кнопкой, без перетаскивания: кнопка и ограничения формата под ней */
.km-image__upload {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.km-image__hint {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}

.km-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* дровер: разделы друг под другом (видна одна вкладка), прокручивается тело дровера */
.km-columns--drawer {
  display: block;
  flex: 1;
  height: auto;
  min-height: 0;
  padding: 16px 24px 24px;
  overflow-y: auto;
}

.km-columns--drawer .km-col {
  height: auto;
}

.km-columns--drawer .km-col__scroll {
  flex: none;
}

.km-columns--drawer .km-col__scroll :deep(.os__viewport > div) {
  padding-right: 0;
}

/* вкладки — часть шапки дровера: на всю ширину, без отступа от заголовка, прилипают при прокрутке */
.km-tabs {
  flex: none;
  margin: 0;
  padding: 0 24px;
  background: #fff;
  /* граница от стенки до стенки дровера: рисует контейнер, а не полоса вкладок с отступами */
  border-bottom: 1px solid #f0f0f0;
}

/* полоса активной вкладки ложится на общую границу */
.km-tabs :deep(.ant-tabs-nav) {
  margin: 0 0 -1px;
}

.km-tabs :deep(.ant-tabs-nav::before) {
  display: none;
}

.km-title {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

/* просмотр карточки */
/* просмотр карточки: сверху ключевые факты карточками, ниже текстовые блоки с воздухом между ними */
.km-view__image {
  width: 100%;
  max-height: 200px;
  margin-bottom: 16px;
  object-fit: cover;
  border: 1px solid #f0f0f0;
  border-radius: 12px;
}

.km-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.km-fact {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 14px;
  background: var(--tmc-bg-layout, #f5f5f5);
  border-radius: 10px;
}

.km-fact__label {
  font-size: 12px;
  line-height: 16px;
  color: rgba(0, 0, 0, 0.45);
}

.km-fact__value {
  font-weight: 600;
  line-height: 22px;
  color: rgba(0, 0, 0, 0.88);
}

.km-block {
  margin-top: 24px;
}

.km-block__title {
  margin: 0 0 8px;
  font-size: 14px;
  line-height: 22px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
}

.km-block__text {
  margin: 0;
  font-size: 14px;
  line-height: 24px;
  color: rgba(0, 0, 0, 0.75);
}

.km-block__empty {
  margin: 0;
  color: rgba(0, 0, 0, 0.45);
}

/* правила — абзацы в светлой карточке с левой полосой, чтобы глаз цеплялся за начало каждого */
.km-rules {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 16px;
  background: var(--tmc-bg-layout, #f5f5f5);
  border-radius: 10px;
}
.km-view__summary {
  margin: 0 0 12px;
  color: rgba(0, 0, 0, 0.65);
}

.km-view__group + .km-view__group {
  margin-top: 16px;
}

.km-view__group-name {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
}

.km-view__units {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.km-view__unit {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: var(--tmc-bg-layout, #f5f5f5);
  border-radius: 6px;
}

.km-view__unit-text {
  flex: 1;
  min-width: 0;
}

.km-view__unit-name {
  font-weight: 600;
}

.km-view__unit-code,
.km-view__unit-note {
  font-size: 13px;
  line-height: 18px;
  color: rgba(0, 0, 0, 0.45);
}

.km-view__unit-note {
  color: rgba(0, 0, 0, 0.65);
}

/* статус единицы в строке состава */
.km-status {
  flex: none;
  width: 150px;
}

.km-status--wide {
  width: 100%;
}

.km-status-comment {
  margin-top: 8px;
}

.km-unit-status {
  margin-top: 16px;
}

.km-log__name {
  font-weight: 600;
}

.km-log__code {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}

@media (max-width: 767px) {
  .km-columns {
    flex-direction: column;
    gap: 8px;
  }

  .km-divider {
    display: none;
  }

  /* на телефоне колонки друг под другом, прокручивается всё окно целиком */
  .km-columns,
  .km-col {
    height: auto;
  }

  .km-col__scroll {
    flex: none;
  }

  .km-col__scroll :deep(.os__viewport > div) {
    padding-right: 0;
  }

  .km-image {
    flex-direction: column;
  }

  .km-rental {
    grid-template-columns: 1fr;
  }

  .km-image__preview {
    width: 100%;
    height: 180px;
  }
}
</style>

<style>
/* выбор оборудования: название и код на разных строках (выпадающий список вне scoped-области) */
.km-unit-dropdown .ant-select-item-option-content {
  white-space: normal;
}

.km-unit-option__name {
  line-height: 22px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
}

.km-unit-option__code {
  font-size: 13px;
  line-height: 18px;
  color: rgba(0, 0, 0, 0.45);
}

/* первый уровень заголовков: название окна крупнее подзаголовков колонок (16px) */
/* дровер: шапка и вкладки — единое целое, граница только под вкладками */
.km-drawer .ant-drawer-header {
  padding-bottom: 0;
  border-bottom: 0;
}

/* вкладки вне прокручиваемой области: их граница и ширина не зависят от полосы прокрутки */
.km-drawer .ant-drawer-body {
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
}

.km .ant-modal-title,
.km-drawer .ant-drawer-title {
  font-size: 20px;
  line-height: 28px;
  font-weight: 700;
}

/* модал — на весь экран на телефоне; порталы вне scoped-области */
.km-mobile .ant-modal {
  top: 0;
  max-width: 100%;
  margin: 0;
  padding-bottom: 0;
}

.km-mobile .ant-modal-content {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  border-radius: 0;
}

.km-mobile .ant-modal-body {
  flex: 1;
}
</style>
