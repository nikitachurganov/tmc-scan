<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ label: string }>()

const colors: Record<string, string> = {
  // заявки
  Новая: 'blue',
  'На модерации': 'gold',
  Подготовка: 'gold',
  'Готово к выдаче': 'green',
  'В пользовании': 'blue',
  Возвращено: 'default',
  Невозвращено: 'red',
  Отклонена: 'red',
  // ТМЦ («В пользовании» — общий для заявки и ТМЦ)
  Доступно: 'green',
  Забронировано: 'gold',
  Повреждено: 'orange',
  Утеряно: 'red',
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
