<script setup lang="ts">
import { CheckCircleFilled, ExclamationCircleFilled } from '@ant-design/icons-vue'
import { computed } from 'vue'
import type { TmcItem } from '@/mocks/tmc'

const props = defineProps<{ open: boolean; items: TmcItem[]; mode: 'issue' | 'return' }>()
const emit = defineEmits<{ close: [] }>()

const problemCount = computed(() => props.items.filter((i) => i.problem).length)

const title = computed(() =>
  problemCount.value ? 'Сверка завершена' : 'Все ТМЦ успешно отсканированы',
)

const subtitle = computed(() => {
  const action = props.mode === 'issue' ? '«Выдать»' : '«Принять возврат»'
  const problems = problemCount.value ? ` С проблемой: ${problemCount.value}.` : ''
  return `Отсканировано ${props.items.length - problemCount.value} из ${props.items.length}.${problems} Чтобы завершить, нажмите ${action}.`
})
</script>

<template>
  <a-modal :open="open" :closable="false" centered :width="400" @cancel="emit('close')">
    <a-result :status="problemCount ? 'warning' : 'success'" :title="title" :sub-title="subtitle" class="sc-result">
      <template #extra>
        <ul class="sc-list">
          <li v-for="item in items" :key="item.id" class="sc-item">
            <span class="sc-item__name">{{ item.name }}</span>
            <span v-if="item.problem" class="sc-item__problem">
              <ExclamationCircleFilled />
              {{ item.problem }}
            </span>
            <CheckCircleFilled v-else class="sc-item__check" />
          </li>
        </ul>
      </template>
    </a-result>
    <template #footer>
      <a-button type="primary" size="large" block @click="emit('close')">Понятно</a-button>
    </template>
  </a-modal>
</template>

<style scoped>
.sc-result {
  padding: 8px 0 0;
}

.sc-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
  text-align: left;
}

.sc-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  background: #fafbff;
  border-radius: 8px;
}

.sc-item__name {
  font-size: 14px;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.88);
}

.sc-item__check {
  font-size: 18px;
  color: #52c41a;
}

.sc-item__problem {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #fa8c16;
}
</style>
