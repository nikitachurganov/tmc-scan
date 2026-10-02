<script setup lang="ts">
import { PlusOutlined, ScanOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { computed, ref, watch } from 'vue'
import TmcAddAdhocEquipment from './TmcAddAdhocEquipment.vue'
import TmcEquipmentScanner from './TmcEquipmentScanner.vue'
import TmcOverlayScroll from './TmcOverlayScroll.vue'
import type { ScanResult } from './scan'
import { useIsMobile } from '@/composables/useIsMobile'
import { useWarehouse } from '@/composables/useWarehouse'
import type { EquipmentUnit } from '@/mocks/tmc'

const MAX_SHOWN = 50

const props = defineProps<{
  open: boolean
  /** Название группы, в которую добавляют оборудование */
  groupName: string
  /** Единицы, которые можно добавить в эту группу */
  units: EquipmentUnit[]
  /** Единицы, уже добавленные в эту группу */
  selectedIds: number[]
  categories: string[]
  /** Категория по умолчанию для нового оборудования не из реестра ОС */
  defaultCategory?: string
}>()

const emit = defineEmits<{ close: []; add: [unitId: number] }>()

const { equipment } = useWarehouse()
const isMobile = useIsMobile()

const search = ref('')
const scanning = ref(false)
const addingAdhoc = ref(false)

watch(
  () => props.open,
  (open) => {
    if (open) search.value = ''
    else scanning.value = false
  },
)

const filtered = computed(() => {
  const query = search.value.trim().toLowerCase()
  return props.units.filter(
    (u) =>
      !query ||
      u.name.toLowerCase().includes(query) ||
      u.code.includes(query) ||
      u.category.toLowerCase().includes(query),
  )
})
const shown = computed(() => filtered.value.slice(0, MAX_SHOWN))

function add(unit: EquipmentUnit) {
  emit('add', unit.id)
}

/** Enter в поиске: ручной сканер штрихкодов вводит код и жмёт Enter */
function onEnter() {
  const query = search.value.trim()
  const exact = props.units.find((u) => u.code === query)
  if (exact) {
    add(exact)
    message.success(`Добавлено: ${exact.name} · ${exact.code}`)
    search.value = ''
  } else if (filtered.value.length === 1) {
    add(filtered.value[0]!)
    search.value = ''
  }
}

function handleScan(raw: string): ScanResult {
  const code = raw.trim()
  const unit = equipment.value.find((u) => u.code === code)
  if (!unit) return { kind: 'wrong', text: `Оборудование с кодом ${code} не найдено` }
  if (props.selectedIds.includes(unit.id)) {
    return { kind: 'dup', text: `${unit.name} уже в этой группе` }
  }
  if (!props.units.some((u) => u.id === unit.id)) {
    return { kind: 'wrong', text: `${unit.name} недоступно: уже в комплекте, заявке или выдано` }
  }
  emit('add', unit.id)
  return { kind: 'ok', text: `Добавлено: ${unit.name} · ${unit.code}` }
}

function onAdhocCreated(units: EquipmentUnit[]) {
  addingAdhoc.value = false
  units.forEach((unit) => emit('add', unit.id))
  const [first] = units
  if (first) {
    const count = units.length > 1 ? ` × ${units.length}` : ''
    message.success(`Добавлено: ${first.name}${count} (не в реестре ОС)`)
  }
}
</script>

<template>
  <a-modal
    :open="open"
    :title="groupName ? `Добавить оборудование: ${groupName}` : 'Добавить оборудование'"
    :width="isMobile ? '100%' : 620"
    :centered="!isMobile"
    :wrap-class-name="isMobile ? 'km-mobile' : undefined"
    destroy-on-close
    @cancel="emit('close')"
  >
    <div class="ep__search">
      <a-input
        v-model:value="search"
        allow-clear
        size="large"
        placeholder="Поиск по названию или коду"
        class="ep__input"
        @press-enter="onEnter"
      >
        <template #prefix><SearchOutlined class="ep__icon" /></template>
      </a-input>
      <a-tooltip title="Сканировать">
        <a-button size="large" aria-label="Сканировать" @click="scanning = true">
          <template #icon><ScanOutlined /></template>
        </a-button>
      </a-tooltip>
    </div>

    <!-- полоса прокрутки поверх строк, не отнимает у списка ширину -->
    <TmcOverlayScroll class="ep__scroll">
      <ul class="ep__list">
        <li v-if="!shown.length" class="ep__empty">
          {{ units.length ? 'Ничего не найдено' : 'Нет свободного оборудования' }}
        </li>
        <li v-for="unit in shown" :key="unit.id" class="ep__row">
          <div class="ep__desc">
            <div class="ep__name">{{ unit.name }}</div>
            <div class="ep__meta">{{ unit.code }} · {{ unit.category }}</div>
          </div>
          <a-tooltip title="Добавить">
            <a-button :aria-label="`Добавить ${unit.name} ${unit.code}`" @click="add(unit)">
              <template #icon><PlusOutlined /></template>
            </a-button>
          </a-tooltip>
        </li>
        <li v-if="filtered.length > MAX_SHOWN" class="ep__more">
          Показаны первые {{ MAX_SHOWN }} из {{ filtered.length }}, уточните поиск
        </li>
      </ul>
    </TmcOverlayScroll>

    <!-- подвал: слева «не стоит на учёте? Добавить», справа «Готово» -->
    <template #footer>
      <div class="ep__footer">
        <div class="ep__adhoc">
          <span class="ep__adhoc-text">Оборудование не стоит на учёте?</span>
          <a-button type="link" class="ep__adhoc-link" @click="addingAdhoc = true">Добавить</a-button>
        </div>
        <a-button type="primary" size="large" :block="isMobile" @click="emit('close')">Готово</a-button>
      </div>
    </template>

    <TmcEquipmentScanner v-if="scanning" :handler="handleScan" @close="scanning = false" />
    <TmcAddAdhocEquipment
      :open="addingAdhoc"
      :categories="categories"
      :default-category="defaultCategory"
      @close="addingAdhoc = false"
      @created="onAdhocCreated"
    />
  </a-modal>
</template>

<style scoped>
.ep__search {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.ep__input {
  flex: 1;
  min-width: 0;
}

.ep__icon {
  color: var(--tmc-icon);
}

.ep__scroll {
  max-height: 380px;
}

.ep__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ep__row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  /* фон страницы (bg layout); модал вне каркаса склада, поэтому с запасным значением */
  background: var(--tmc-bg-layout, #f5f5f5);
  border-radius: 8px;
}

.ep__desc {
  flex: 1;
  min-width: 0;
}

.ep__name {
  font-size: 15px;
  line-height: 20px;
  font-weight: 600;
  color: var(--tmc-text);
}

.ep__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

/* как в окне ТМЦ: вопрос и ссылка «Добавить» — оборудование не из реестра ОС */
.ep__adhoc {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ep__adhoc-text {
  color: rgba(0, 0, 0, 0.65);
}

.ep__adhoc-link {
  height: auto;
  padding: 0;
}

.ep__meta {
  font-size: 12px;
  line-height: 16px;
  color: var(--tmc-text-tertiary);
  word-break: break-all;
}

.ep__empty,
.ep__more {
  padding: 12px;
  text-align: center;
  color: var(--tmc-text-tertiary);
}

@media (max-width: 767px) {
  .ep__scroll {
    max-height: calc(100vh - 260px);
  }

  .ep__footer {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
