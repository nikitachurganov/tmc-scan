<script setup lang="ts">
import { ExclamationCircleOutlined } from '@ant-design/icons-vue'
import { computed } from 'vue'
import { parseRuDate } from '@/utils/date'
import { formatDuration } from '@/utils/duration'
import { requestDates } from '@/utils/requestDates'
import type { WarehouseRequest } from '@/mocks/tmc'

/**
 * Сводка заявки на ПК-экране выдачи и возврата (правая колонка):
 * прогресс сверки, пользователь, сроки план/факт, место, комментарий пользователя, заметки склада к ТМЦ.
 */
const props = defineProps<{
  request: WarehouseRequest
  mode: 'issue' | 'return'
  /** Сверено позиций (без проблемных) */
  scanned: number
  total: number
  problems: number
}>()

const dates = computed(() => requestDates(props.request))

/** Плановая длительность пользования: от плана начала до срока возврата */
const plannedDuration = computed(() => {
  const start = parseRuDate(dates.value.plannedStart.text)
  const end = parseRuDate(dates.value.plannedEnd.text)
  if (!start || !end || end <= start) return null
  return formatDuration(Math.round((end.getTime() - start.getTime()) / 60000))
})

const done = computed(() => props.scanned + props.problems)
const percent = computed(() => (props.total ? Math.round((done.value / props.total) * 100) : 0))

</script>

<template>
  <aside class="is">
    <header class="is__head">
      <div>
        <div class="is__eyebrow">{{ mode === 'issue' ? 'Выдача по заявке' : 'Возврат по заявке' }}</div>
        <h2 class="is__number">{{ request.number }}</h2>
      </div>

    </header>

    <section class="is__progress" aria-live="polite">
      <div class="is__progress-row">
        <span class="is__progress-label">Отсканировано ТМЦ</span>
        <span class="is__progress-value">{{ scanned }} из {{ total }}</span>
      </div>
      <a-progress
        :percent="percent"
        :show-info="false"
        :status="done === total ? 'success' : 'active'"
        size="small"
      />
      <div v-if="problems" class="is__progress-problems">
        <ExclamationCircleOutlined />
        С проблемой: {{ problems }}
      </div>
    </section>

    <section class="is__section">
      <h3 class="is__title">Пользователь</h3>
      <div class="is__user-name">{{ request.fullName }}</div>
      <div class="is__user-email">{{ request.email }}</div>
    </section>

    <section class="is__section">
      <h3 class="is__title">Сроки</h3>
      <div class="is__dates">
        <span />
        <span class="is__dates-head">План</span>
        <span class="is__dates-head">Факт</span>

        <span class="is__dates-label">Получение</span>
        <span>{{ dates.plannedStart.text }}</span>
        <span :class="{ 'is__late': dates.actualStart.late }">{{ dates.actualStart.text }}</span>

        <span class="is__dates-label">Возврат</span>
        <span>{{ dates.plannedEnd.text }}</span>
        <span :class="{ 'is__late': dates.actualEnd.late }">{{ dates.actualEnd.text }}</span>
      </div>
      <div v-if="plannedDuration" class="is__duration">Срок пользования: {{ plannedDuration }}</div>
    </section>

    <section class="is__section">
      <h3 class="is__title">Место выдачи</h3>
      <p class="is__text">{{ request.place }}</p>
    </section>

    <section v-if="request.userComment" class="is__section">
      <h3 class="is__title">Комментарий пользователя</h3>
      <p class="is__text is__comment">{{ request.userComment }}</p>
    </section>

    <section v-if="request.itemComments.length" class="is__section">
      <h3 class="is__title">Заметки склада к ТМЦ</h3>
      <ul class="is__notes">
        <li v-for="note in request.itemComments" :key="note.id" class="is__note">
          <p class="is__note-text">{{ note.text }}</p>
          <div class="is__note-meta">{{ note.author }} · {{ note.createdAt }}</div>
        </li>
      </ul>
    </section>
  </aside>
</template>

<style scoped>
.is {
  display: flex;
  flex-direction: column;
  padding: 16px;
  background: var(--tmc-bg-container);
  border-radius: 12px;
}

.is__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.is__eyebrow {
  font-size: 12px;
  line-height: 16px;
  color: var(--tmc-text-tertiary);
}

.is__number {
  margin: 2px 0 0;
  font-size: 19px;
  line-height: 24px;
  font-weight: 700;
  color: var(--tmc-text);
}

.is__progress {
  margin-top: 16px;
  padding: 12px;
  background: var(--tmc-bg-layout);
  border-radius: 8px;
}

.is__progress-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.is__progress-label {
  font-size: 13px;
  color: var(--tmc-text-secondary);
}

.is__progress-value {
  font-size: 15px;
  font-weight: 700;
  color: var(--tmc-text);
}

.is__progress :deep(.ant-progress) {
  margin: 4px 0 0;
}

.is__progress-problems {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  font-size: 13px;
  /* orange-8: на сером фоне блока прогресса контраст выше 4.5:1 */
  color: #ad4e00;
}

.is__section {
  padding-top: 16px;
  margin-top: 16px;
  border-top: 1px solid var(--tmc-border-secondary);
}

.is__title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 8px;
  font-size: 13px;
  line-height: 18px;
  font-weight: 600;
  color: var(--tmc-text-secondary);
}


.is__user-name {
  font-size: 15px;
  line-height: 20px;
  font-weight: 600;
  color: var(--tmc-text);
}

.is__user-email {
  font-size: 13px;
  line-height: 18px;
  color: var(--tmc-text-tertiary);
  word-break: break-all;
}

.is__dates {
  display: grid;
  grid-template-columns: auto 1fr 1fr;
  gap: 6px 12px;
  font-size: 13px;
  line-height: 18px;
  color: var(--tmc-text);
}

.is__dates-head {
  font-size: 12px;
  color: var(--tmc-text-tertiary);
}

.is__dates-label {
  color: var(--tmc-text-secondary);
}

.is__late {
  font-weight: 600;
  color: #ff4d4f;
}

.is__duration {
  margin-top: 8px;
  font-size: 13px;
  color: var(--tmc-text-secondary);
}

.is__text {
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  color: var(--tmc-text);
}

.is__comment {
  white-space: pre-wrap;
}

.is__notes {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.is__note {
  padding: 8px 12px;
  background: #fff7e6;
  border-radius: 8px;
}

.is__note-text {
  margin: 0;
  font-size: 13px;
  line-height: 18px;
  color: var(--tmc-text);
  white-space: pre-wrap;
}

.is__note-meta {
  margin-top: 4px;
  font-size: 12px;
  color: var(--tmc-text-tertiary);
}
</style>
