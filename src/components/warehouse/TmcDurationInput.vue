<script setup lang="ts">
import { reactive, watch } from 'vue'
import { joinDuration, splitDuration } from '@/utils/duration'

/** Длительность в минутах, вводится днями, часами и минутами; пусто — undefined */
const props = defineProps<{ value: number | undefined; status?: 'error' }>()
const emit = defineEmits<{ 'update:value': [value: number | undefined] }>()

// a-input-number при очистке присылает null, поэтому пустое поле проверяем через `== null`
const parts = reactive<{ days?: number; hours?: number; minutes?: number }>({})

function total(): number | undefined {
  if (parts.days == null && parts.hours == null && parts.minutes == null) return undefined
  const value = joinDuration({ days: parts.days ?? 0, hours: parts.hours ?? 0, minutes: parts.minutes ?? 0 })
  return value > 0 ? value : undefined
}

watch(
  () => props.value,
  (value) => {
    // своё же значение вернулось через v-model — не перетираем то, что сейчас вводят
    if (value === total()) return
    if (value === undefined) {
      Object.assign(parts, { days: undefined, hours: undefined, minutes: undefined })
      return
    }
    const { days, hours, minutes } = splitDuration(value)
    Object.assign(parts, { days: days || undefined, hours: hours || undefined, minutes: minutes || undefined })
  },
  { immediate: true },
)

function onChange() {
  emit('update:value', total())
}
</script>

<template>
  <div class="di">
    <a-input-number
      v-model:value="parts.days"
      :min="0"
      :max="365"
      :precision="0"
      placeholder="0"
      :status="status"
      class="di__field"
      @change="onChange"
    >
      <template #addonAfter>д</template>
    </a-input-number>
    <a-input-number
      v-model:value="parts.hours"
      :min="0"
      :max="23"
      :precision="0"
      placeholder="0"
      :status="status"
      class="di__field"
      @change="onChange"
    >
      <template #addonAfter>ч</template>
    </a-input-number>
    <a-input-number
      v-model:value="parts.minutes"
      :min="0"
      :max="59"
      :precision="0"
      placeholder="0"
      :status="status"
      class="di__field"
      @change="onChange"
    >
      <template #addonAfter>мин</template>
    </a-input-number>
  </div>
</template>

<style scoped>
.di {
  display: flex;
  gap: 8px;
}

.di__field {
  flex: 1;
  min-width: 0;
}
</style>
