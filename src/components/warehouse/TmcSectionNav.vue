<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const items = [
  { name: 'warehouse', label: 'Обзор' },
  { name: 'registry', label: 'Реестр ТМЦ' },
  { name: 'requests', label: 'Активные заявки' },
  { name: 'journal', label: 'Журнал выдачи' },
  { name: 'warehouse-settings', label: 'Настройки склада' },
]

const activeKey = computed(() => String(route.name ?? ''))

function open(key: unknown) {
  router.push({ name: String(key) })
}
</script>

<template>
  <nav class="sn">
    <a-tabs :active-key="activeKey" @change="open">
      <a-tab-pane v-for="item in items" :key="item.name" :tab="item.label" />
    </a-tabs>
  </nav>
</template>

<style scoped>
/* только подложка и отступы контейнера — сами табы из коробки */
.sn {
  padding: 0 20px;
  background: var(--tmc-bg-container);
}

.sn :deep(.ant-tabs-nav) {
  margin: 0;
}

@media (max-width: 767px) {
  .sn {
    padding: 0 12px;
  }
}
</style>
