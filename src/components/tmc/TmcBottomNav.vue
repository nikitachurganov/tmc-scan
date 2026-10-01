<script setup lang="ts">
import type { Component } from 'vue'
import IconAlert from '~icons/fluent/alert-20-filled'
import IconDocumentList from '~icons/fluent/document-bullet-list-20-filled'
import IconGrid from '~icons/fluent/grid-20-filled'
import IconHome from '~icons/fluent/home-20-filled'
import IconPerson from '~icons/fluent/person-20-filled'

const items: { key: string; label: string; icon: Component }[] = [
  { key: 'home', label: 'Главная', icon: IconHome },
  { key: 'services', label: 'Сервисы', icon: IconGrid },
  { key: 'requests', label: 'Заявки', icon: IconDocumentList },
  { key: 'notifications', label: 'Уведомления', icon: IconAlert },
  { key: 'profile', label: 'Профиль', icon: IconPerson },
]
</script>

<template>
  <nav class="bottom-nav">
    <button v-for="item in items" :key="item.key" type="button" class="bottom-nav__item">
      <component :is="item.icon" class="bottom-nav__icon" />
      <span class="bottom-nav__label">{{ item.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.bottom-nav {
  display: flex;
  height: 56px;
  background: var(--tmc-bg-container);
  border-top: 1px solid var(--tmc-border-secondary);
}

.bottom-nav__item {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 0 0;
  border: 0;
  background: none;
  cursor: pointer;
  font-family: inherit;
}

.bottom-nav__icon {
  width: 24px;
  height: 24px;
  color: var(--tmc-text);
}

.bottom-nav__label {
  font-size: 11px;
  line-height: 12px;
  color: var(--tmc-text-tertiary);
}
</style>
