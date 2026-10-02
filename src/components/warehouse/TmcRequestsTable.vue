<script setup lang="ts">
import { message, type TableColumnsType } from 'ant-design-vue'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import TmcRequestDetails, { type RequestDetailItem } from '@/components/warehouse/TmcRequestDetails.vue'
import TmcStatusTag from '@/components/warehouse/TmcStatusTag.vue'
import { useIsMobile } from '@/composables/useIsMobile'
import { useWarehouse } from '@/composables/useWarehouse'
import type { RequestStatus, WarehouseRequest } from '@/mocks/tmc'
import { requestDates, type RequestDates } from '@/utils/requestDates'

/**
 * Таблица заявок — одна и та же на «Активных заявках», «Журнале выдачи» и «Обзоре»:
 * колонки с план/факт датами, действия по статусу, раскрытие строки с `TmcRequestDetails`,
 * на телефоне — карточки с «Показать детали».
 */
type DateKey = keyof RequestDates
const DATE_KEYS: DateKey[] = ['plannedStart', 'actualStart', 'plannedEnd', 'actualEnd']

const DATE_TITLES: Record<DateKey, string> = {
  plannedStart: 'План. начало',
  actualStart: 'Факт. начало',
  plannedEnd: 'План. окончание',
  actualEnd: 'Факт. окончание',
}

const props = withDefaults(
  defineProps<{
    requests: WarehouseRequest[]
    /** Колонка действий по статусу; в журнале выдачи её нет */
    actions?: boolean
    /** Размер страницы; без него — все строки без пагинации (превью на «Обзоре») */
    pageSize?: number
    emptyText?: string
    /** Какие даты показывать; по умолчанию все четыре (план/факт начала и окончания) */
    dates?: DateKey[]
    /** Узкий блок (половина ширины «Обзора»): ФИО сокращено, колонки уже, без горизонтальной прокрутки */
    compact?: boolean
  }>(),
  {
    actions: true,
    pageSize: undefined,
    emptyText: 'Ничего не найдено',
    // литерал, а не DATE_KEYS: defineProps выносится из setup и не видит локальных констант
    dates: () => ['plannedStart', 'actualStart', 'plannedEnd', 'actualEnd'],
    compact: false,
  },
)

const router = useRouter()
const isMobile = useIsMobile()
const { requestItems, requestById, kitForItemName, advanceRequestStatus, rejectRequest } = useWarehouse()

/** «Фотоаппарат», а для нескольких ТМЦ — «Фотоаппарат +1» */
function itemsLabel(request: WarehouseRequest): string {
  const [first, ...others] = requestItems(request)
  if (!first) return ''
  return others.length ? `${first.name} +${others.length}` : first.name
}

interface Row extends RequestDates {
  id: number
  number: string
  status: RequestStatus
  fullName: string
  items: string
}

/** «Петрова Анна Сергеевна» → «Петрова А.С.» */
function shortName(fullName: string): string {
  const [last, ...rest] = fullName.split(' ')
  return `${last} ${rest.map((part) => `${part[0]}.`).join('')}`
}

const rows = computed<Row[]>(() =>
  props.requests.map((request) => ({
    id: request.id,
    number: request.number,
    status: request.status,
    fullName: props.compact ? shortName(request.fullName) : request.fullName,
    items: itemsLabel(request),
    ...requestDates(request),
  })),
)

const page = ref(1)
watch(
  () => props.requests,
  () => {
    page.value = 1
  },
)
const mobileRows = computed(() =>
  props.pageSize ? rows.value.slice((page.value - 1) * props.pageSize, page.value * props.pageSize) : rows.value,
)

const pagination = computed(() =>
  props.pageSize
    ? { pageSize: props.pageSize, showSizeChanger: false, showTotal: (total: number) => `Всего: ${total}` }
    : false,
)

/**
 * В компактном режиме ширины не фиксируем: таблица с авто-раскладкой делит место по содержимому.
 * Фиксированные ширины (и `ellipsis`, который включает fixed-раскладку) в половине «Обзора»
 * съедали всё место, и «Пользователь» сжимался до нуля.
 */
const columns = computed<TableColumnsType>(() => {
  const w = (width: number) => (props.compact ? undefined : width)
  return [
    { title: '№ заявки', dataIndex: 'number', width: w(130) },
    { title: 'Статус', key: 'status', width: w(140) },
    { title: 'Пользователь', dataIndex: 'fullName' },
    { title: 'ТМЦ', dataIndex: 'items' },
    ...props.dates.map((key) => ({
      title: DATE_TITLES[key],
      key,
      width: w(key.endsWith('End') ? 140 : 130),
    })),
    // в компактной действия закреплены справа: при прокрутке колонок кнопки остаются на виду
    ...(props.actions
      ? [{ title: '', key: 'actions', width: props.compact ? 160 : 260, fixed: props.compact ? ('right' as const) : undefined, align: props.compact ? undefined : ('right' as const) }]
      : []),
  ]
})

/**
 * Полная таблица прокручивается по горизонтали уже от 1240 px. Компактная — от 760 px: столько нужно
 * колонкам без сжатия в ноль; в половине экрана 1440 это небольшая прокрутка внутри блока.
 */
const scroll = computed(() => ({ x: props.compact ? 760 : 1240 }))

function hasDate(key: DateKey) {
  return props.dates.includes(key)
}

function isDateKey(key: unknown): key is DateKey {
  return DATE_KEYS.includes(key as DateKey)
}

function advance(row: Row, successText: string) {
  if (advanceRequestStatus(row.id)) message.success(successText)
}

/** Отклонение: сначала окно с обязательной причиной отказа */
const rejectTarget = ref<Row | null>(null)
const rejectReason = ref('')
const rejectError = ref(false)

function askReject(row: Row) {
  rejectTarget.value = row
  rejectReason.value = ''
  rejectError.value = false
}

function confirmReject() {
  const row = rejectTarget.value
  if (!row) return
  if (!rejectReason.value.trim()) {
    rejectError.value = true
    return
  }
  if (rejectRequest(row.id, rejectReason.value)) {
    message.success(`Заявка ${row.number} отклонена и перенесена в журнал выдачи`)
  }
  rejectTarget.value = null
}

function startIssue(row: Row) {
  router.push({ name: 'tmc', params: { id: row.id } })
}

function startReturn(row: Row) {
  router.push({ name: 'tmc-return', params: { id: row.id } })
}

function isOnHand(status: RequestStatus) {
  return status === 'В пользовании'
}

/** Состав заявки для раскрытой строки: единица + комплект по реестру, проблема, «не выдано» */
function detailItems(request: WarehouseRequest): RequestDetailItem[] {
  return requestItems(request).map((unit) => ({
    id: unit.id,
    name: unit.name,
    category: unit.category,
    code: unit.code,
    status: unit.status,
    origin: unit.origin,
    kitName: kitForItemName(unit.name)?.name ?? null,
    problem: unit.problem,
    notIssued: request.notIssuedIds.includes(unit.id),
  }))
}
</script>

<template>
  <div v-if="!isMobile" class="rq-card" :class="{ 'rq-card--compact': compact }">
    <a-table
      :columns="columns"
      :data-source="rows"
      row-key="id"
      :scroll="scroll"
      :pagination="pagination"
      :locale="{ emptyText }"
    >
      <template #expandedRowRender="{ record }">
        <TmcRequestDetails
          v-if="requestById((record as Row).id)"
          :request="requestById((record as Row).id)!"
          :items="detailItems(requestById((record as Row).id)!)"
        />
      </template>
      <template #bodyCell="{ column, record }">
        <TmcStatusTag v-if="column.key === 'status'" :label="(record as Row).status" />
        <span
          v-else-if="isDateKey(column.key)"
          class="rq-date"
          :class="{ 'rq-date--late': (record as Row)[column.key].late }"
        >
          {{ (record as Row)[column.key].text }}
        </span>
        <a-space
          v-else-if="column.key === 'actions'"
          :size="4"
          :direction="compact ? 'vertical' : 'horizontal'"
          :wrap="false"
          :align="compact ? 'start' : undefined"
        >
          <template v-if="(record as Row).status === 'Новая'">
            <a-button type="link" size="small" @click="advance(record as Row, 'Заявка передана на модерацию')">
              На модерацию
            </a-button>
            <a-button type="link" size="small" danger @click="askReject(record as Row)">Отклонить</a-button>
          </template>
          <template v-else-if="(record as Row).status === 'На модерации'">
            <a-button type="link" size="small" @click="advance(record as Row, 'Заявка передана в подготовку')">
              Начать подготовку
            </a-button>
            <a-button type="link" size="small" danger @click="askReject(record as Row)">Отклонить</a-button>
          </template>
          <a-button
            v-else-if="(record as Row).status === 'Подготовка'"
            type="link"
            size="small"
            @click="advance(record as Row, 'Заявка готова к выдаче')"
          >
            Отметить готовой
          </a-button>
          <a-button v-else-if="(record as Row).status === 'Готово к выдаче'" type="link" size="small" @click="startIssue(record as Row)">
            Перейти к выдаче
          </a-button>
          <a-button v-else-if="isOnHand((record as Row).status)" type="link" size="small" @click="startReturn(record as Row)">
            Перейти к возврату
          </a-button>
        </a-space>
      </template>
    </a-table>
  </div>

  <div v-else class="rq-list">
    <div v-if="!rows.length" class="rq-empty">{{ emptyText }}</div>
    <article v-for="row in mobileRows" :key="row.id" class="rq-row">
      <header class="rq-row__head">
        <h3 class="rq-row__title">{{ row.number }}</h3>
        <TmcStatusTag :label="row.status" />
      </header>
      <dl class="rq-row__fields">
        <div class="rq-row__field">
          <dt>Пользователь</dt>
          <dd>{{ row.fullName }}</dd>
        </div>
        <div class="rq-row__field">
          <dt>ТМЦ</dt>
          <dd>{{ row.items }}</dd>
        </div>
        <!-- на телефоне те же даты, что выбраны для таблицы: «план / факт» парами -->
        <div v-if="hasDate('plannedStart') || hasDate('actualStart')" class="rq-row__field">
          <dt>Начало</dt>
          <dd>
            <template v-if="hasDate('plannedStart')">{{ row.plannedStart.text }}</template>
            <template v-if="hasDate('plannedStart') && hasDate('actualStart')"> / </template>
            <span v-if="hasDate('actualStart')" class="rq-date" :class="{ 'rq-date--late': row.actualStart.late }">
              {{ row.actualStart.text }}
            </span>
          </dd>
        </div>
        <div v-if="hasDate('plannedEnd') || hasDate('actualEnd')" class="rq-row__field">
          <dt>Окончание</dt>
          <dd>
            <template v-if="hasDate('plannedEnd')">{{ row.plannedEnd.text }}</template>
            <template v-if="hasDate('plannedEnd') && hasDate('actualEnd')"> / </template>
            <span v-if="hasDate('actualEnd')" class="rq-date" :class="{ 'rq-date--late': row.actualEnd.late }">
              {{ row.actualEnd.text }}
            </span>
          </dd>
        </div>
      </dl>
      <a-collapse ghost class="rq-row__details">
        <a-collapse-panel key="details" header="Показать детали">
          <TmcRequestDetails
            v-if="requestById(row.id)"
            :request="requestById(row.id)!"
            :items="detailItems(requestById(row.id)!)"
          />
        </a-collapse-panel>
      </a-collapse>
      <footer v-if="actions" class="rq-row__actions">
        <template v-if="row.status === 'Новая'">
          <a-button type="link" size="small" @click="advance(row, 'Заявка передана на модерацию')">На модерацию</a-button>
          <a-button type="link" size="small" danger @click="askReject(row)">Отклонить</a-button>
        </template>
        <template v-else-if="row.status === 'На модерации'">
          <a-button type="link" size="small" @click="advance(row, 'Заявка передана в подготовку')">Начать подготовку</a-button>
          <a-button type="link" size="small" danger @click="askReject(row)">Отклонить</a-button>
        </template>
        <a-button v-else-if="row.status === 'Подготовка'" type="link" size="small" @click="advance(row, 'Заявка готова к выдаче')">
          Отметить готовой
        </a-button>
        <a-button v-else-if="row.status === 'Готово к выдаче'" type="link" size="small" @click="startIssue(row)">
          Перейти к выдаче
        </a-button>
        <a-button v-else-if="isOnHand(row.status)" type="link" size="small" @click="startReturn(row)">
          Перейти к возврату
        </a-button>
      </footer>
    </article>
    <a-pagination
      v-if="pageSize && rows.length > pageSize"
      v-model:current="page"
      :page-size="pageSize"
      :total="rows.length"
      simple
      :show-size-changer="false"
      class="rq-pagination"
    />
  </div>

  <a-modal
    :open="rejectTarget !== null"
    :title="`Отклонить заявку ${rejectTarget?.number ?? ''}`"
    centered
    ok-text="Отклонить"
    ok-type="danger"
    cancel-text="Отмена"
    @ok="confirmReject"
    @cancel="rejectTarget = null"
  >
    <a-form layout="vertical">
      <a-form-item
        label="Причина отказа"
        required
        :validate-status="rejectError ? 'error' : undefined"
        :help="rejectError ? 'Укажите причину отказа' : undefined"
      >
        <a-textarea
          v-model:value="rejectReason"
          :rows="4"
          :maxlength="500"
          show-count
          placeholder="Например, нет в наличии на эти даты"
          @change="rejectError = false"
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<style scoped>
/* белый блок как у фильтров: без рамки, radius 12 */
.rq-card {
  padding: 16px;
  background: var(--tmc-bg-container);
  border-radius: 12px;
}

/* компактная: слова не рвутся посередине («Пользова-тель»), номер заявки — в одну строку */
.rq-card--compact :deep(.ant-table-thead > tr > th),
.rq-card--compact :deep(.ant-table-tbody > tr.ant-table-row > td) {
  overflow-wrap: normal;
  word-break: normal;
}

.rq-card--compact :deep(.ant-table-thead > tr > th),
.rq-card--compact :deep(.ant-table-tbody > tr.ant-table-row > td:nth-child(2)) {
  white-space: nowrap;
}

.rq-date {
  white-space: nowrap;
}

.rq-date--late {
  color: #ff4d4f;
  font-weight: 600;
}

.rq-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rq-empty {
  padding: 16px;
  text-align: center;
  color: var(--tmc-text-tertiary);
  background: var(--tmc-bg-container);
  border-radius: 12px;
}

.rq-row {
  padding: 12px 16px;
  background: var(--tmc-bg-container);
  border-radius: 12px;
}

.rq-row__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.rq-row__title {
  margin: 0;
  font-size: 15px;
  line-height: 20px;
  font-weight: 700;
  color: var(--tmc-text);
}

.rq-row__fields {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 8px 0 0;
}

.rq-row__field {
  display: flex;
  gap: 8px;
  font-size: 13px;
  line-height: 16px;
}

.rq-row__field dt {
  flex: none;
  min-width: 88px;
  color: var(--tmc-text-tertiary);
}

.rq-row__field dd {
  margin: 0;
  color: var(--tmc-text);
}

.rq-row__field .rq-date {
  white-space: normal;
}

/* как «Показать состав» в карточках реестра: заголовок-ссылка без боковых отступов */
.rq-row__details :deep(.ant-collapse-header) {
  padding: 8px 0 0 !important;
  font-size: 13px;
  color: var(--tmc-primary);
}

.rq-row__details :deep(.ant-collapse-content-box) {
  padding: 8px 0 0 !important;
}

.rq-row__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.rq-pagination {
  align-self: center;
}
</style>