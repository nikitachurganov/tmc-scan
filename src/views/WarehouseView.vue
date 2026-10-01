<script setup lang="ts">
import {
  CalendarOutlined,
  CodeSandboxOutlined,
  FieldTimeOutlined,
  FileTextOutlined,
} from '@ant-design/icons-vue'
import { computed } from 'vue'
import TmcDesktopLayout from '@/components/warehouse/TmcDesktopLayout.vue'
import TmcMetricCard from '@/components/warehouse/TmcMetricCard.vue'
import TmcRequestsTable from '@/components/warehouse/TmcRequestsTable.vue'
import { useWarehouse } from '@/composables/useWarehouse'

const { metrics, newRequests, pickupRequests, rentalRequests } = useWarehouse()

/**
 * Превью разделов: та же таблица заявок, что на «Активных заявках» (колонки, действия, раскрытие),
 * только первые строки без пагинации; «Все …» открывает раздел с тем же фильтром статусов.
 * Сверху «Активные аренды» на всю ширину, ниже в одну строку «Новые заявки» и «К выдаче сегодня» —
 * у них ещё нет факта и срока, поэтому из дат только плановое начало.
 */
const rental = computed(() => rentalRequests.value.slice(0, 3))
const pairedSections = computed(() => [
  { title: 'Новые заявки', link: 'Все заявки', group: 'new', rows: newRequests.value.slice(0, 5) },
  { title: 'К выдаче сегодня', link: 'Все к выдаче', group: 'pickup', rows: pickupRequests.value.slice(0, 4) },
])

const breadcrumbs = ['Главная', 'Виртуальный склад']
</script>

<template>
  <TmcDesktopLayout fluid>
    <div class="wv-intro">
      <a-breadcrumb class="wv-breadcrumb">
        <a-breadcrumb-item v-for="crumb in breadcrumbs" :key="crumb">{{ crumb }}</a-breadcrumb-item>
      </a-breadcrumb>
      <h1 class="wv-title">Виртуальный склад</h1>
    </div>

    <div class="wv-metrics">
      <TmcMetricCard
        :icon="FileTextOutlined"
        tone="primary"
        :value="metrics.newRequests"
        label="Новые заявки"
        :to="{ name: 'requests', query: { group: 'new' } }"
      />
      <TmcMetricCard
        :icon="CalendarOutlined"
        tone="success"
        :value="metrics.pickupToday"
        label="К выдаче сегодня"
        :to="{ name: 'requests', query: { group: 'pickup' } }"
      />
      <TmcMetricCard
        :icon="FieldTimeOutlined"
        tone="warning"
        :value="metrics.activeRentals"
        label="Активные аренды"
        :to="{ name: 'requests', query: { group: 'rental' } }"
      />
      <TmcMetricCard
        :icon="CodeSandboxOutlined"
        tone="purple"
        :value="metrics.availableItems"
        label="Доступные ТМЦ"
        :to="{ name: 'registry' }"
      />
    </div>

    <section class="wv-section">
      <header class="wv-section__head">
        <h2 class="wv-section__title">Активные аренды</h2>
        <RouterLink :to="{ name: 'requests', query: { group: 'rental' } }" class="wv-section__link">
          Все аренды
        </RouterLink>
      </header>
      <TmcRequestsTable :requests="rental" empty-text="Активных аренд нет" />
    </section>

    <div class="wv-pair">
      <section v-for="section in pairedSections" :key="section.group" class="wv-section">
        <header class="wv-section__head">
          <h2 class="wv-section__title">{{ section.title }}</h2>
          <RouterLink :to="{ name: 'requests', query: { group: section.group } }" class="wv-section__link">
            {{ section.link }}
          </RouterLink>
        </header>
        <TmcRequestsTable :requests="section.rows" :dates="['plannedStart']" compact empty-text="Заявок нет" />
      </section>
    </div>
  </TmcDesktopLayout>
</template>

<style scoped>
.wv-intro {
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
  min-height: 66px;
}

.wv-breadcrumb :deep(.ant-breadcrumb-link),
.wv-breadcrumb :deep(.ant-breadcrumb-separator) {
  color: var(--tmc-text-tertiary);
}

.wv-title {
  margin: 0;
  font-size: 28px;
  line-height: 36px;
  font-weight: 700;
  color: #0d1321;
}

.wv-metrics {
  display: flex;
  gap: 8px;
}

.wv-section {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* две таблицы в строку, равной ширины; блоки растягиваются до высоты соседа */
.wv-pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.wv-pair .wv-section :deep(.rq-card) {
  flex: 1;
}

.wv-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 32px;
  padding: 0 12px;
}

.wv-section__title {
  margin: 0;
  font-size: 15px;
  line-height: 20px;
  font-weight: 700;
  color: #111827;
}

/* как ссылка-кнопка Ant (Button type link): без подчёркивания из глобальных стилей */
.wv-section__link,
.wv-section__link:visited {
  font-size: 15px;
  line-height: 20px;
  color: var(--tmc-primary);
  text-decoration: none;
}

@media (max-width: 767px) {
  .wv-intro {
    min-height: 0;
  }

  .wv-breadcrumb {
    display: none;
  }

  .wv-title {
    font-size: 20px;
    line-height: 28px;
  }

  .wv-metrics {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .wv-section__head {
    padding: 0 4px;
  }

  .wv-pair {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}
</style>
