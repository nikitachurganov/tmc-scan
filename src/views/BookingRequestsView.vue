<script setup lang="ts">
import { SearchOutlined } from '@ant-design/icons-vue'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import TmcDesktopLayout from '@/components/warehouse/TmcDesktopLayout.vue'
import TmcRequestsTable from '@/components/warehouse/TmcRequestsTable.vue'
import { useWarehouse } from '@/composables/useWarehouse'
import { FINISHED_REQUEST_STATUSES, type RequestStatus, type WarehouseRequest } from '@/mocks/tmc'

type Tab = 'active' | 'journal'

/** Один экран на два раздела склада: «Активные заявки» и «Журнал выдачи» (маршруты requests и journal) */
const props = defineProps<{ tab: Tab }>()

const route = useRoute()
const { requests } = useWarehouse()

/** Быстрые группы статусов — те же, что на карточках-метриках обзора */
const STATUS_GROUPS: Record<string, RequestStatus[]> = {
  new: ['Новая', 'В обработке'],
  pickup: ['Подготовка', 'Готово'],
  rental: ['На руках', 'Частично выдана'],
}

const ACTIVE_STATUSES: RequestStatus[] = [
  'Новая',
  'В обработке',
  'Подготовка',
  'Готово',
  'На руках',
  'Частично выдана',
]

const tab = computed(() => props.tab)
const title = computed(() => (tab.value === 'active' ? 'Активные заявки' : 'Журнал выдачи'))
const search = ref('')
const statusFilter = ref<RequestStatus[]>([])

// переход между разделами сбрасывает фильтр; группа из метрик обзора задаёт набор статусов
watch(
  () => [tab.value, route.query.group] as const,
  ([current, group]) => {
    statusFilter.value =
      current === 'active' && typeof group === 'string' && STATUS_GROUPS[group] ? STATUS_GROUPS[group] : []
    search.value = ''
  },
  { immediate: true },
)

const statusOptions = computed(() =>
  (tab.value === 'active' ? ACTIVE_STATUSES : FINISHED_REQUEST_STATUSES).map((value) => ({ value, label: value })),
)

function isInTab(request: WarehouseRequest, current: Tab): boolean {
  return FINISHED_REQUEST_STATUSES.includes(request.status) === (current === 'journal')
}

const filtered = computed(() => {
  const query = search.value.trim().toLowerCase()
  return requests.value.filter(
    (r) =>
      isInTab(r, tab.value) &&
      (!query ||
        r.number.toLowerCase().includes(query) ||
        r.fullName.toLowerCase().includes(query) ||
        r.email.toLowerCase().includes(query)) &&
      (!statusFilter.value.length || statusFilter.value.includes(r.status)),
  )
})
</script>

<template>
  <TmcDesktopLayout fluid>
    <div class="bq-intro">
      <a-breadcrumb class="bq-breadcrumb">
        <a-breadcrumb-item>Главная</a-breadcrumb-item>
        <a-breadcrumb-item>
          <RouterLink :to="{ name: 'warehouse' }">Виртуальный склад</RouterLink>
        </a-breadcrumb-item>
        <a-breadcrumb-item>{{ title }}</a-breadcrumb-item>
      </a-breadcrumb>
      <h1 class="bq-title">{{ title }}</h1>
    </div>

    <div class="bq-filterbar">
      <div class="bq-filterbar__row">
        <a-input v-model:value="search" allow-clear placeholder="№ заявки, ФИО или email" class="bq-search">
          <template #prefix><SearchOutlined class="bq-search-icon" /></template>
        </a-input>
        <label class="bq-filter">
          <span class="bq-filter__label">Статус :</span>
          <a-select
            v-model:value="statusFilter"
            mode="multiple"
            allow-clear
            max-tag-count="responsive"
            placeholder="Любой"
            :options="statusOptions"
            class="bq-select"
          />
        </label>
      </div>
    </div>

    <TmcRequestsTable :requests="filtered" :actions="tab === 'active'" :page-size="10" />
  </TmcDesktopLayout>
</template>

<style scoped>
.bq-intro {
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
  min-height: 66px;
}

.bq-breadcrumb :deep(.ant-breadcrumb-link),
.bq-breadcrumb :deep(.ant-breadcrumb-separator) {
  color: var(--tmc-text-tertiary);
}

.bq-title {
  margin: 0;
  font-size: 28px;
  line-height: 36px;
  font-weight: 700;
  color: #0d1321;
}

.bq-filterbar {
  background: var(--tmc-bg-container);
  border-radius: 12px;
}

.bq-filterbar__row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
}

.bq-filter {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bq-filter__label {
  font-size: 13px;
  color: var(--tmc-text);
  white-space: nowrap;
}

.bq-search {
  width: 320px;
  max-width: 100%;
}

.bq-search-icon {
  color: var(--tmc-icon);
}

.bq-select {
  width: 260px;
}

@media (max-width: 767px) {
  .bq-intro {
    min-height: 0;
  }

  .bq-breadcrumb {
    display: none;
  }

  .bq-title {
    font-size: 20px;
    line-height: 28px;
  }

  .bq-filterbar__row {
    flex-wrap: wrap;
    padding: 12px;
  }

  .bq-search {
    width: 100%;
  }

  .bq-filter {
    flex: 1 1 100%;
  }

  .bq-select {
    flex: 1;
    width: auto;
    min-width: 0;
  }
}
</style>
