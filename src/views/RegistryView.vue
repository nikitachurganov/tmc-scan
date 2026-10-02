<script setup lang="ts">
import { DeleteOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { message, type TableColumnsType } from 'ant-design-vue'
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import TmcDesktopLayout from '@/components/warehouse/TmcDesktopLayout.vue'
import TmcKitModal, { type UnitStatusChange } from '@/components/warehouse/TmcKitModal.vue'
import TmcStatusTag from '@/components/warehouse/TmcStatusTag.vue'
import { useIsMobile } from '@/composables/useIsMobile'
import { useWarehouse, type KitInput } from '@/composables/useWarehouse'
import {
  equipmentStatusLabels,
  tmcStatusLabels,
  tmcKindLabel,
  type EquipmentStatus,
  type TmcKit,
  type TmcStatus,
} from '@/mocks/tmc'
import { rentalRangeLabel } from '@/utils/duration'

const {
  kits,
  employees,
  categories,
  unitById,
  availableUnitsFor,
  kitStatus,
  kitAvailability,
  kitUnitCount,
  employeeName,
  removeKitBlockReason,
  addKit,
  updateKit,
  setUnitStatus,
  removeKit,
} = useWarehouse()

const isMobile = useIsMobile()

const search = ref('')
const categoryFilter = ref<string | undefined>()
const statusFilter = ref<TmcStatus | undefined>()

const categoryOptions = computed(() => categories.value.map((value) => ({ value })))
const statusOptions = (Object.keys(tmcStatusLabels) as TmcStatus[]).map((value) => ({
  value,
  label: tmcStatusLabels[value],
}))

function kitCodes(kit: TmcKit): string[] {
  return kit.groups.flatMap((g) => g.unitIds.map((id) => unitById(id)?.code ?? ''))
}

const rows = computed(() => {
  const query = search.value.trim().toLowerCase()
  return kits.value.filter(
    (kit) =>
      (!query ||
        kit.name.toLowerCase().includes(query) ||
        kit.category.toLowerCase().includes(query) ||
        kitCodes(kit).some((code) => code.includes(query))) &&
      (!categoryFilter.value || kit.category === categoryFilter.value) &&
      (!statusFilter.value || kitStatus(kit) === statusFilter.value),
  )
})

const PAGE_SIZE = 10
const page = ref(1)
const pagedRows = computed(() =>
  rows.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE),
)
watch([search, categoryFilter, statusFilter], () => {
  page.value = 1
})

const columns: TableColumnsType = [
  { title: 'Название', key: 'name' },
  { title: 'Тип', key: 'type', width: 140 },
  { title: 'Категория', dataIndex: 'category' },
  { title: 'Ответственный', key: 'responsible' },
  { title: 'Состав', key: 'count', width: 100 },
  { title: 'Срок аренды', key: 'rental', width: 170 },
  { title: 'Статус', key: 'status', width: 170 },
  { title: '', key: 'actions', width: 190 },
]

/** «5 ед.» — сколько единиц в составе, для нескольких экземпляров тоже просто количество */
function compositionLabel(kit: TmcKit): string {
  const { available, total } = kitAvailability(kit)
  // у нескольких экземпляров видно, сколько осталось свободно
  if (kit.type === 'single' && kit.multiple && available < total) return `${available} из ${total} ед.`
  return `${kitUnitCount(kit)} ед.`
}

/** Подсказка к «Недоступно»: какие единицы и в каком статусе */
function unavailableHint(kit: TmcKit): string[] {
  return kitAvailability(kit).reasons.map((r) => `${r.name} · ${r.code} — ${equipmentStatusLabels[r.status]}`)
}

interface KitUnit {
  id: number
  name: string
  code: string
  status: EquipmentStatus
}

function kitUnitIds(kit: TmcKit): number[] {
  return kit.groups.flatMap((g) => g.unitIds)
}

/** Единицы состава построчно: у каждой своя ссылка на оборудование и свой статус */
function kitUnits(kit: TmcKit): KitUnit[] {
  return kitUnitIds(kit).flatMap((id) => {
    const unit = unitById(id)
    return unit ? [{ id, name: unit.name, code: unit.code, status: unit.status }] : []
  })
}

const groupColumns: TableColumnsType = [
  { title: 'Оборудование', key: 'name', width: 260 },
  { title: 'Инвентарный код', key: 'code' },
  { title: 'Статус', key: 'status', width: 170 },
]

const modalOpen = ref(false)
const editing = ref<TmcKit | null>(null)
/** Карточка открыта на просмотр (клик по названию), а не сразу на правку */
const viewOnly = ref(false)

const modalUnits = computed(() => availableUnitsFor(editing.value?.id))

function openAdd() {
  editing.value = null
  viewOnly.value = false
  modalOpen.value = true
}

function openEdit(kit: TmcKit) {
  editing.value = kit
  viewOnly.value = false
  modalOpen.value = true
}

function openView(kit: TmcKit) {
  editing.value = kit
  viewOnly.value = true
  modalOpen.value = true
}

/** Сохранение: поля и состав ТМЦ, а в дровере ещё и смены статусов единиц */
function submit(payload: KitInput, statusChanges: UnitStatusChange[]) {
  if (editing.value) {
    updateKit(editing.value.id, payload)
    statusChanges.forEach((change) => setUnitStatus(change.unitId, change.status, change.comment))
    message.success('Изменения сохранены')
  } else {
    addKit(payload)
    message.success('ТМЦ создано')
  }
  modalOpen.value = false
}

function remove(kit: TmcKit) {
  if (removeKit(kit.id)) message.success(`«${kit.name}» удалено`)
}
</script>

<template>
  <TmcDesktopLayout fluid>
    <div class="rv-intro">
      <a-breadcrumb class="rv-breadcrumb">
        <a-breadcrumb-item>Главная</a-breadcrumb-item>
        <a-breadcrumb-item>
          <RouterLink :to="{ name: 'warehouse' }">Виртуальный склад</RouterLink>
        </a-breadcrumb-item>
        <a-breadcrumb-item>Реестр ТМЦ</a-breadcrumb-item>
      </a-breadcrumb>
      <h1 class="rv-title">Реестр ТМЦ</h1>
    </div>

    <div class="rv-filterbar">
      <div class="rv-filterbar__row">
        <a-input
          v-model:value="search"
          allow-clear
          placeholder="Поиск по названию или коду"
          class="rv-search"
        >
          <template #prefix><SearchOutlined class="rv-search-icon" /></template>
        </a-input>
        <label class="rv-filter">
          <span class="rv-filter__label">Категория :</span>
          <a-select
            v-model:value="categoryFilter"
            allow-clear
            placeholder="Любая"
            :options="categoryOptions"
            class="rv-select"
          />
        </label>
        <label class="rv-filter">
          <span class="rv-filter__label">Статус :</span>
          <a-select
            v-model:value="statusFilter"
            allow-clear
            placeholder="Любой"
            :options="statusOptions"
            class="rv-select"
          />
        </label>
        <a-button type="primary" :block="isMobile" class="rv-add" @click="openAdd">
          <template #icon><PlusOutlined /></template>
          Добавить ТМЦ
        </a-button>
      </div>
    </div>

    <div v-if="!isMobile" class="rv-card">
      <a-table
        :columns="columns"
        :data-source="rows"
        row-key="id"
        :pagination="{ pageSize: 10, showSizeChanger: false, showTotal: (total: number) => `Всего: ${total}` }"
      >
        <template #expandedRowRender="{ record }">
          <a-table
            :columns="groupColumns"
            :data-source="kitUnits(record as TmcKit)"
            :pagination="false"
            row-key="id"
            class="rv-nested"
          >
            <template #bodyCell="{ column, record: unit }">
              <template v-if="column.key === 'name'">{{ unit.name }}</template>
              <RouterLink v-else-if="column.key === 'code'" :to="{ name: 'equipment', params: { id: unit.id } }">
                {{ unit.code }}
              </RouterLink>
              <TmcStatusTag
                v-else-if="column.key === 'status'"
                :label="equipmentStatusLabels[(unit as KitUnit).status]"
              />
            </template>
          </a-table>
        </template>
        <template #bodyCell="{ column, record }">
          <a-button v-if="column.key === 'name'" type="link" class="rv-name" @click="openView(record as TmcKit)">
            {{ record.name }}
          </a-button>
          <template v-else-if="column.key === 'type'">{{ tmcKindLabel(record as TmcKit) }}</template>
          <template v-else-if="column.key === 'responsible'">{{ employeeName(record.responsibleId) }}</template>
          <template v-else-if="column.key === 'count'">{{ compositionLabel(record as TmcKit) }}</template>
          <template v-else-if="column.key === 'rental'">
            {{ rentalRangeLabel((record as TmcKit).minRentalMinutes, (record as TmcKit).maxRentalMinutes) }}
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tooltip v-if="kitStatus(record as TmcKit) === 'unavailable'" placement="topLeft">
              <template #title>
                <div v-for="line in unavailableHint(record as TmcKit)" :key="line">{{ line }}</div>
              </template>
              <span class="rv-status-hint"><TmcStatusTag :label="tmcStatusLabels.unavailable" /></span>
            </a-tooltip>
            <TmcStatusTag v-else :label="tmcStatusLabels[kitStatus(record as TmcKit)]" />
          </template>
          <a-space v-else-if="column.key === 'actions'" :size="4">
            <a-button type="link" size="small" @click="openEdit(record as TmcKit)">Изменить</a-button>
            <a-tooltip v-if="removeKitBlockReason(record.id)" :title="removeKitBlockReason(record.id)">
              <span>
                <a-button type="text" size="small" danger disabled aria-label="Удалить ТМЦ">
                  <template #icon><DeleteOutlined /></template>
                </a-button>
              </span>
            </a-tooltip>
            <a-popconfirm
              v-else
              title="Удалить ТМЦ?"
              placement="topRight"
              description="Комплект будет удалён, его оборудование освободится."
              ok-text="Удалить"
              cancel-text="Отмена"
              @confirm="remove(record as TmcKit)"
            >
              <a-button type="text" size="small" danger aria-label="Удалить ТМЦ">
                  <template #icon><DeleteOutlined /></template>
                </a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </a-table>
    </div>

    <div v-else class="rv-list">
      <div v-if="!rows.length" class="rv-empty">Ничего не найдено</div>
      <article v-for="kit in pagedRows" :key="kit.id" class="rv-kit">
        <header class="rv-kit__head">
          <h2 class="rv-kit__title">
            <a-button type="link" class="rv-name rv-name--title" @click="openView(kit)">{{ kit.name }}</a-button>
          </h2>
          <TmcStatusTag :label="tmcStatusLabels[kitStatus(kit)]" />
        </header>
        <dl class="rv-kit__fields">
          <div class="rv-kit__field">
            <dt>Тип</dt>
            <dd>{{ tmcKindLabel(kit) }}</dd>
          </div>
          <div class="rv-kit__field">
            <dt>Категория</dt>
            <dd>{{ kit.category }}</dd>
          </div>
          <div class="rv-kit__field">
            <dt>Ответственный</dt>
            <dd>{{ employeeName(kit.responsibleId) }}</dd>
          </div>
          <div class="rv-kit__field">
            <dt>Состав</dt>
            <dd>{{ compositionLabel(kit) }}</dd>
          </div>
          <div class="rv-kit__field">
            <dt>Срок аренды</dt>
            <dd>{{ rentalRangeLabel(kit.minRentalMinutes, kit.maxRentalMinutes) }}</dd>
          </div>
        </dl>
        <a-collapse ghost class="rv-kit__groups">
          <a-collapse-panel key="groups" header="Показать состав">
            <ul class="rv-groups">
              <li v-for="unit in kitUnits(kit)" :key="unit.id" class="rv-group rv-group--unit">
                <div class="rv-group__text">
                  <span class="rv-group__name">{{ unit.name }}</span>
                  <RouterLink :to="{ name: 'equipment', params: { id: unit.id } }" class="rv-group__codes">
                    {{ unit.code }}
                  </RouterLink>
                </div>
                <TmcStatusTag :label="equipmentStatusLabels[unit.status]" />
              </li>
            </ul>
          </a-collapse-panel>
        </a-collapse>
        <footer class="rv-kit__actions">
          <a-button type="link" size="small" @click="openEdit(kit)">Изменить</a-button>
          <a-tooltip v-if="removeKitBlockReason(kit.id)" :title="removeKitBlockReason(kit.id)">
            <span>
              <a-button type="text" size="small" danger disabled aria-label="Удалить ТМЦ">
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </span>
          </a-tooltip>
          <a-popconfirm
            v-else
            placement="topRight"
            title="Удалить ТМЦ?"
            description="Комплект будет удалён, его оборудование освободится."
            ok-text="Удалить"
            cancel-text="Отмена"
            @confirm="remove(kit)"
          >
            <a-button type="text" size="small" danger aria-label="Удалить ТМЦ">
              <template #icon><DeleteOutlined /></template>
            </a-button>
          </a-popconfirm>
        </footer>
      </article>
      <a-pagination
        v-if="rows.length > PAGE_SIZE"
        v-model:current="page"
        :page-size="PAGE_SIZE"
        :total="rows.length"
        simple
        :show-size-changer="false"
        class="rv-pagination"
      />
    </div>

    <TmcKitModal
      :open="modalOpen"
      :kit="editing"
      :categories="categories"
      :employees="employees"
      :available-units="modalUnits"
      :readonly="viewOnly"
      @close="modalOpen = false"
      @submit="submit"
    />
  </TmcDesktopLayout>
</template>

<style scoped>
/* название ТМЦ — ссылка на карточку: перенос длинных названий, без отступов кнопки */
.rv-name {
  height: auto;
  padding: 0;
  text-align: left;
  white-space: normal;
}

.rv-name--title {
  font-size: inherit;
  font-weight: inherit;
}

/* «Недоступно» с подсказкой причин: курсор показывает, что можно навести */
.rv-status-hint {
  cursor: help;
}

.rv-intro {
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
  min-height: 66px;
}

.rv-breadcrumb :deep(.ant-breadcrumb-link),
.rv-breadcrumb :deep(.ant-breadcrumb-separator) {
  color: var(--tmc-text-tertiary);
}

.rv-title {
  margin: 0;
  font-size: 28px;
  line-height: 36px;
  font-weight: 700;
  color: #0d1321;
}

.rv-filterbar {
  background: var(--tmc-bg-container);
  border-radius: 12px;
}

.rv-filterbar__row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
}

.rv-filter {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rv-filter__label {
  font-size: 13px;
  color: var(--tmc-text);
  white-space: nowrap;
}

.rv-add {
  margin-left: auto;
}

/* вложенная таблица заполняет раскрытую строку без внешних отступов */
/* отступ слева не переопределяем: ant сдвигает вложенную таблицу на ширину колонки раскрытия,
   и первая колонка встаёт ровно под «Название» основной таблицы (как в заявках) */
.rv-nested :deep(.ant-table-thead > tr > th) {
  font-weight: 600;
}

.rv-nested :deep(.ant-table-tbody > tr:last-child > td) {
  border-bottom: 0;
}

.rv-search {
  width: 360px;
  max-width: 100%;
}

.rv-search-icon {
  color: var(--tmc-icon);
}

.rv-select {
  width: 200px;
}

/* как блок фильтров: белый, без рамки, radius 12 */
.rv-card {
  padding: 16px;
  background: var(--tmc-bg-container);
  border-radius: 12px;
}

.rv-groups {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rv-group {
  display: flex;
  gap: 12px;
}

.rv-group__name {
  min-width: 200px;
  font-weight: 600;
}

.rv-group__codes {
  color: var(--tmc-text-tertiary);
}

.rv-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rv-empty {
  padding: 16px;
  text-align: center;
  color: var(--tmc-text-tertiary);
  background: var(--tmc-bg-container);
  border-radius: 12px;
}

.rv-kit {
  padding: 12px 16px;
  background: var(--tmc-bg-container);
  border-radius: 12px;
}

.rv-kit__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.rv-kit__title {
  margin: 0;
  font-size: 15px;
  line-height: 20px;
  font-weight: 700;
  color: var(--tmc-text);
}

.rv-kit__fields {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 8px 0 0;
}

.rv-kit__field {
  display: flex;
  gap: 8px;
  font-size: 13px;
  line-height: 16px;
}

.rv-kit__field dt {
  flex: none;
  min-width: 112px;
  color: var(--tmc-text-tertiary);
}

.rv-kit__field dd {
  margin: 0;
  color: var(--tmc-text);
}

.rv-kit__groups :deep(.ant-collapse-header) {
  padding: 8px 0 0 !important;
  font-size: 13px;
  color: var(--tmc-primary);
}

.rv-kit__groups :deep(.ant-collapse-content-box) {
  padding: 8px 0 0 !important;
}

.rv-kit__actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.rv-group--unit {
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}

.rv-group--unit .rv-group__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.rv-group--unit .rv-group__name {
  min-width: 0;
}

.rv-pagination {
  align-self: center;
}

@media (max-width: 767px) {
  .rv-intro {
    min-height: 0;
  }

  .rv-breadcrumb {
    display: none;
  }

  .rv-title {
    font-size: 20px;
    line-height: 28px;
  }

  .rv-filterbar__row {
    flex-wrap: wrap;
    gap: 8px 12px;
    padding: 12px;
  }

  .rv-search {
    width: 100%;
  }

  .rv-filter {
    flex: 1 1 100%;
    min-width: 0;
  }

  .rv-select {
    flex: 1;
    width: auto;
    min-width: 0;
  }

  .rv-add {
    flex: 1 1 100%;
    margin-left: 0;
  }
}
</style>
