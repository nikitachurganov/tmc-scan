<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ label: string }>()

const colors: Record<string, string> = {
  Новая: 'blue',
  'В обработке': 'gold',
  Подготовка: 'gold',
  Готово: 'green',
  'На руках': 'blue',
  'Частично выдана': 'orange',
  Доступен: 'green',
  Выдан: 'blue',
  'На обслуживании': 'gold',
  Возвращена: 'default',
  Отклонена: 'red',
}

const color = computed(() => colors[props.label] ?? 'default')
</script>

<template>
  <a-tag :color="color" :bordered="false" class="status-tag">{{ label }}</a-tag>
</template>

<style scoped>
.status-tag {
  margin: 0;
}
</style>
