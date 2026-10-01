<script setup lang="ts">
import {
  CheckCircleFilled,
  ExclamationCircleFilled,
  ScanOutlined,
  WarningOutlined,
} from '@ant-design/icons-vue'
import type { TmcItem } from '@/mocks/tmc'

defineProps<{ item: TmcItem }>()
defineEmits<{ scan: [id: number]; enter: [id: number]; problem: [id: number] }>()
</script>

<template>
  <div class="item-row">
    <div class="item-row__desc">
      <div class="item-row__name">{{ item.name }}</div>
      <div class="item-row__category">{{ item.category }}</div>
    </div>
    <a-tooltip title="Проблема с ТМЦ">
      <a-button
        type="text"
        class="item-row__problem-btn"
        aria-label="Проблема с ТМЦ"
        @click="$emit('problem', item.id)"
      >
        <template #icon><WarningOutlined /></template>
      </a-button>
    </a-tooltip>
    <div v-if="item.problem" class="item-row__problem">
      <ExclamationCircleFilled />
      <span>{{ item.problem }}</span>
    </div>
    <div v-else-if="item.scanned" class="item-row__done">
      <CheckCircleFilled />
      <span>Подтверждено</span>
    </div>
    <div v-else class="item-row__actions">
      <a-button class="item-row__code" @click="$emit('enter', item.id)">Ввести код</a-button>
      <a-button
        type="primary"
        class="item-row__scan"
        aria-label="Сканировать"
        @click="$emit('scan', item.id)"
      >
        <template #icon><ScanOutlined /></template>
      </a-button>
    </div>
  </div>
</template>

<style scoped>
.item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 60px;
  padding: 12px;
  background: var(--tmc-bg-row);
  border-radius: 12px;
}

.item-row__desc {
  min-width: 0;
  flex: 1;
}

.item-row__name {
  font-size: 15px;
  line-height: 20px;
  font-weight: 700;
  color: var(--tmc-text);
}

.item-row__category {
  margin-top: 4px;
  font-size: 11px;
  line-height: 12px;
  color: var(--tmc-text-tertiary);
}

.item-row__actions {
  display: flex;
  flex: none;
  gap: 4px;
}

.item-row__done {
  display: flex;
  flex: none;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  line-height: 16px;
  color: #52c41a;
}

.item-row__problem {
  display: flex;
  flex: none;
  align-items: center;
  gap: 6px;
  max-width: 140px;
  font-size: 13px;
  line-height: 16px;
  color: #fa8c16;
}

.item-row__problem-btn {
  flex: none;
  width: 32px;
  padding: 0;
  color: var(--tmc-icon);
}

.item-row__code {
  width: 107px;
  padding-inline: 0;
}

.item-row__scan {
  width: 32px;
  padding: 0;
}
</style>
