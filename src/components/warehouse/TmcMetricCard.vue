<script setup lang="ts">
import { RightOutlined } from '@ant-design/icons-vue'
import type { Component } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

defineProps<{
  icon: Component
  value: number
  label: string
  tone: 'primary' | 'success' | 'warning' | 'purple'
  /** Куда ведёт карточка; без него карточка не кликабельна и без стрелки */
  to?: RouteLocationRaw
}>()
</script>

<template>
  <!-- с `to` вся карточка — ссылка: клик и Enter по любой её части -->
  <component
    :is="to ? RouterLink : 'div'"
    :to="to"
    class="metric"
    :class="{ 'metric--link': to }"
  >
    <div class="metric__icon" :class="`metric__icon--${tone}`">
      <component :is="icon" />
    </div>
    <div class="metric__text">
      <div class="metric__value">{{ value }}</div>
      <div class="metric__label">{{ label }}</div>
    </div>
    <RightOutlined v-if="to" class="metric__go" aria-hidden="true" />
  </component>
</template>

<style scoped>
.metric {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 12px 12px 12px 16px;
  background: var(--tmc-bg-container);
  border-radius: 8px;
}

/* ссылка, но выглядит как карточка: без подчёркивания и цвета ссылки из глобальных стилей */
.metric--link,
.metric--link:hover {
  color: inherit;
  text-decoration: none;
}

.metric--link {
  cursor: pointer;
  transition: box-shadow 0.2s, background-color 0.2s;
}

.metric--link:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.metric--link:hover .metric__go {
  color: var(--tmc-primary);
}

.metric--link:focus-visible {
  outline: 2px solid var(--tmc-primary);
  outline-offset: 2px;
}

.metric__icon {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 4px;
  font-size: 20px;
}

.metric__icon--primary {
  background: #e8f3ff;
  color: var(--tmc-primary);
}

.metric__icon--success {
  background: #f6ffed;
  color: #52c41a;
}

.metric__icon--warning {
  background: #fefbe6;
  color: #faad14;
}

.metric__icon--purple {
  background: #f9f0ff;
  color: #722ed1;
}

.metric__text {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
}

.metric__value {
  font-size: 19px;
  line-height: 24px;
  font-weight: 700;
  color: var(--tmc-text);
}

.metric__label {
  font-size: 13px;
  line-height: 16px;
  color: var(--tmc-text-secondary);
}

.metric__go {
  flex: none;
  width: 24px;
  font-size: 14px;
  color: var(--tmc-icon);
  transition: color 0.2s;
}

@media (max-width: 767px) {
  .metric {
    gap: 8px;
    padding: 10px 8px 10px 12px;
  }

  .metric__icon {
    width: 36px;
    height: 36px;
    font-size: 18px;
  }

  .metric__text {
    white-space: normal;
  }
}
</style>
