<script setup lang="ts">
import type { TableColumnsType } from 'ant-design-vue'
import { computed } from 'vue'
import { useIsMobile } from '@/composables/useIsMobile'
import {
  problemTypeLabels,
  type EquipmentOrigin,
  type EquipmentStatus,
  type TmcKit,
  type UnitProblem,
  type WarehouseRequest,
} from '@/mocks/tmc'

/** Единица оборудования в составе заказанного ТМЦ */
export interface RequestDetailUnit {
  id: number
  name: string
  code: string
  status: EquipmentStatus
  origin: EquipmentOrigin
  problem?: UnitProblem
  /** Не выдана при частичной выдаче */
  notIssued: boolean
}

/** ТМЦ реестра, заказанное в заявке, и его единицы: на комплект — весь комплект целиком */
export interface RequestDetailItem {
  id: number
  kit: TmcKit
  units: RequestDetailUnit[]
}

/**
 * Раскрытая строка заявки — вложенная таблица: строка на каждое заказанное ТМЦ с перечнем его единиц,
 * «Контакты» и «Комментарий к заявке» (текст пользователя из брони) общие для заявки и объединены на все строки.
 */
const props = defineProps<{
  request: WarehouseRequest
  items: RequestDetailItem[]
}>()

const emit = defineEmits<{ 'open-kit': [kit: TmcKit] }>()

const isMobile = useIsMobile()

/** Объединённая на все строки ячейка: первая строка тянется на весь состав, остальные скрыты */
function spanAll(_: unknown, index?: number) {
  return { rowSpan: index === 0 ? Math.max(props.items.length, 1) : 0 }
}

/** Всегда четыре столбца: название ТМЦ, его оборудование (название и инвентарный номер), контакты, комментарий */
const columns = computed<TableColumnsType>(() => [
  { title: 'ТМЦ', key: 'item', width: '22%' },
  { title: 'Оборудование', key: 'equipment', width: '30%' },
  { title: 'Контакты', key: 'contacts', width: '20%', customCell: spanAll },
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
            <a-button type="link" class="rd-unit__name rd-kit-link" @click="emit('open-kit', item.kit)">
              {{ item.kit.name }}
            </a-button>
          </div>
          <ul class="rd-parts">
            <li v-for="unit in item.units" :key="unit.id" class="rd-part">
              <div class="rd-part__head">
                <span>{{ unit.name }}</span>
                <a-tag v-if="unit.notIssued" :bordered="false">Не выдано</a-tag>
                <a-tag v-if="unit.problem" color="orange" :bordered="false">
                  {{ problemTypeLabels[unit.problem.type] }}
                </a-tag>
              </div>
              <div class="rd-code">{{ unit.code }}</div>
            </li>
          </ul>
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
          <a-button type="link" class="rd-unit__name rd-kit-link" @click="emit('open-kit', (record as RequestDetailItem).kit)">
            {{ (record as RequestDetailItem).kit.name }}
          </a-button>
        </div>
      </template>

      <!-- столбец «Оборудование»: весь состав заказанного ТМЦ построчно, не одна случайная единица -->
      <ul v-else-if="column.key === 'equipment'" class="rd-parts rd-parts--column">
        <li v-for="unit in (record as RequestDetailItem).units" :key="unit.id" class="rd-part">
          <div class="rd-part__head">
            <span>{{ unit.name }}</span>
            <a-tag v-if="unit.notIssued" :bordered="false">Не выдано</a-tag>
            <a-tag v-if="unit.problem" color="orange" :bordered="false">
              {{ problemTypeLabels[unit.problem.type] }}
            </a-tag>
          </div>
          <div class="rd-code">{{ unit.code }}</div>
        </li>
      </ul>

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
.rd-parts {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
}

.rd-parts--column {
  margin-top: 0;
}

.rd-part {
  font-size: 13px;
  line-height: 20px;
}

/* название оборудования, а инвентарный номер — строкой ниже */
.rd-part__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}
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
/* название ТМЦ — ссылка на карточку: без внутренних отступов кнопки */
.rd-kit-link {
  height: auto;
  padding: 0;
  text-align: left;
  white-space: normal;
}
</style>
