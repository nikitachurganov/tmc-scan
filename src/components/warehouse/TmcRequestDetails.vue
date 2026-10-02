<script setup lang="ts">
import type { TableColumnsType } from 'ant-design-vue'
import { computed } from 'vue'
import { useIsMobile } from '@/composables/useIsMobile'
import {
  problemTypeLabels,
  type EquipmentOrigin,
  type EquipmentStatus,
  type UnitProblem,
  type WarehouseRequest,
} from '@/mocks/tmc'

/** Позиция состава заявки: единица оборудования + к какой ТМЦ реестра она относится */
export interface RequestDetailItem {
  id: number
  name: string
  category: string
  code: string
  status: EquipmentStatus
  origin: EquipmentOrigin
  /** Название ТМЦ реестра (комплекта/пула), если оборудование с таким именем туда входит */
  kitName: string | null
  problem?: UnitProblem
  /** Не выдана при частичной выдаче */
  notIssued: boolean
}

/**
 * Раскрытая строка заявки — вложенная таблица: строка на каждую ТМЦ,
 * «Контакты» и «Комментарий к заявке» (текст пользователя из брони) общие для заявки и объединены на все строки.
 */
const props = defineProps<{
  request: WarehouseRequest
  items: RequestDetailItem[]
}>()

const isMobile = useIsMobile()

/** Объединённая на все строки ячейка: первая строка тянется на весь состав, остальные скрыты */
function spanAll(_: unknown, index?: number) {
  return { rowSpan: index === 0 ? Math.max(props.items.length, 1) : 0 }
}

const columns = computed<TableColumnsType>(() => [
  { title: 'ТМЦ', key: 'item', width: '40%' },
  { title: 'Контакты', key: 'contacts', width: '25%', customCell: spanAll },
  { title: 'Комментарий к заявке', key: 'comment', customCell: spanAll },
])
</script>

<template>
  <div v-if="isMobile" class="rd-mobile">
    <section>
      <h3 class="rd-title">ТМЦ</h3>
      <ul class="rd-units">
        <li v-for="item in items" :key="item.id">
          <div class="rd-unit">
            <RouterLink :to="{ name: 'equipment', params: { id: item.id } }" class="rd-unit__name">
              {{ item.name }}
            </RouterLink>
            <a-tag v-if="item.notIssued" :bordered="false">Не выдано</a-tag>
            <a-tag v-if="item.problem" color="orange" :bordered="false">
              {{ problemTypeLabels[item.problem.type] }}
            </a-tag>
          </div>
          <div class="rd-code">{{ item.code }}</div>
        </li>
      </ul>
    </section>
    <section>
      <h3 class="rd-title">Контакты</h3>
      <a :href="`mailto:${request.email}`">{{ request.email }}</a>
    </section>
    <section>
      <h3 class="rd-title">Комментарий к заявке</h3>
      <p class="rd-comment">{{ request.userComment || '—' }}</p>
    </section>
    <section v-if="request.rejectReason">
      <h3 class="rd-title">Причина отказа</h3>
      <p class="rd-comment">{{ request.rejectReason }}</p>
    </section>
  </div>

  <a-table
    v-else
    :columns="columns"
    :data-source="items"
    :pagination="false"
    row-key="id"
    class="rd-nested"
  >
    <template #bodyCell="{ column, record }">
      <template v-if="column.key === 'item'">
        <div class="rd-unit">
          <RouterLink :to="{ name: 'equipment', params: { id: record.id } }" class="rd-unit__name">
            {{ record.name }}
          </RouterLink>
          <a-tag v-if="record.origin === 'adhoc'" color="purple" :bordered="false">Не в реестре ОС</a-tag>
          <a-tag v-if="record.notIssued" :bordered="false">Не выдано</a-tag>
          <a-tag v-if="record.problem" color="orange" :bordered="false">
            {{ problemTypeLabels[(record as RequestDetailItem).problem!.type] }}
          </a-tag>
        </div>
        <div class="rd-code">{{ record.code }}</div>
      </template>

      <a v-else-if="column.key === 'contacts'" :href="`mailto:${request.email}`">{{ request.email }}</a>

      <template v-else-if="column.key === 'comment'">
        <p class="rd-comment">{{ request.userComment || '—' }}</p>
        <p v-if="request.rejectReason" class="rd-comment rd-reject">
          <span class="rd-reject__label">Причина отказа:</span> {{ request.rejectReason }}
        </p>
      </template>
    </template>
  </a-table>
</template>

<style scoped>
/* отступ слева не переопределяем: ant сдвигает вложенную таблицу на ширину колонки раскрытия,
   и колонка «ТМЦ» встаёт ровно под первым столбцом основной таблицы */
.rd-nested :deep(.ant-table-thead > tr > th) {
  font-weight: 600;
}

.rd-nested :deep(.ant-table-tbody > tr:last-child > td) {
  border-bottom: 0;
}

/* объединённые ячейки контактов и комментариев — сверху, а не по центру */
.rd-nested :deep(.ant-table-tbody > tr > td) {
  vertical-align: top;
}

.rd-unit {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.rd-unit__name {
  font-weight: 600;
}

.rd-code {
  margin-top: 2px;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 12px;
  color: var(--tmc-text-tertiary);
}

.rd-comment {
  margin: 0;
  color: var(--tmc-text);
  white-space: pre-wrap;
}

.rd-mobile {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rd-title {
  margin: 0 0 4px;
  font-size: 13px;
  font-weight: 700;
  color: var(--tmc-text);
}

.rd-units {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.rd-reject {
  margin-top: 8px;
}

.rd-reject__label {
  color: var(--tmc-text-tertiary, rgba(0, 0, 0, 0.45));
}
</style>
