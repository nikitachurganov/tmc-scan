<script setup lang="ts">
import { ExclamationCircleOutlined } from '@ant-design/icons-vue'
import { computed, ref, watch } from 'vue'
import type { TmcItem } from '@/mocks/tmc'

const props = defineProps<{ open: boolean; item: TmcItem | null }>()
const emit = defineEmits<{ close: []; confirm: [id: number] }>()

const code = ref('')

// Держим последнюю позицию, чтобы заголовок не пропадал во время анимации закрытия
const shownItem = ref<TmcItem | null>(props.item)
watch(
  () => props.item,
  (item) => {
    if (item) shownItem.value = item
  },
)

watch(
  () => props.open,
  (open) => {
    if (open) code.value = ''
  },
)

const state = computed<'idle' | 'valid' | 'invalid'>(() => {
  const expected = props.item?.code
  const value = code.value.trim()
  if (!expected || !value) return 'idle'
  if (value === expected) return 'valid'
  return value.length >= expected.length ? 'invalid' : 'idle'
})

function confirm() {
  if (props.item && state.value === 'valid') emit('confirm', props.item.id)
}
</script>

<template>
  <a-drawer
    :open="open"
    placement="bottom"
    height="auto"
    :closable="false"
    :body-style="{ padding: 0 }"
    root-class-name="tmc-sheet"
    @close="emit('close')"
  >
    <div class="sheet">
      <div class="sheet__handle" />
      <h3 class="sheet__title">{{ shownItem?.name }}</h3>
      <p class="sheet__text">Введите инвентарный код ТМЦ<br />для подтверждения наличия</p>

      <a-input
        v-model:value="code"
        size="large"
        placeholder="Инвентарный код"
        :status="state === 'invalid' ? 'error' : ''"
        @press-enter="confirm"
      >
        <template #suffix>
          <span v-if="state === 'valid'" class="sheet__ok">Верно</span>
          <ExclamationCircleOutlined v-else-if="state === 'invalid'" class="sheet__err-icon" />
          <span v-else />
        </template>
      </a-input>
      <div v-if="state === 'invalid'" class="sheet__err">Введен неверный код</div>

      <a-button
        type="primary"
        size="large"
        block
        class="sheet__confirm"
        :disabled="state !== 'valid'"
        @click="confirm"
      >
        Подтвердить
      </a-button>
      <a-button type="text" size="large" block class="sheet__close" @click="emit('close')">
        Закрыть
      </a-button>
    </div>
  </a-drawer>
</template>

<style>
.tmc-sheet {
  --tmc-sheet-max: 402px;
}

.tmc-sheet .ant-drawer-content-wrapper {
  left: 0;
  right: 0;
  max-width: var(--tmc-sheet-max);
  margin: 0 auto;
}

.tmc-sheet .ant-drawer-content {
  border-radius: 16px 16px 0 0;
}
</style>

<style scoped>
.sheet {
  padding: 8px 16px 24px;
}

.sheet__handle {
  width: 38px;
  height: 4px;
  margin: 0 auto 12px;
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.15);
}

.sheet__title {
  margin: 0;
  font-size: 20px;
  line-height: 28px;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.88);
}

.sheet__text {
  margin: 4px 0 24px;
  font-size: 13px;
  line-height: 20px;
  color: rgba(0, 0, 0, 0.45);
}

.sheet__ok {
  color: #52c41a;
}

.sheet__err-icon {
  color: #ff4d4f;
}

.sheet__err {
  margin-top: 4px;
  font-size: 13px;
  line-height: 16px;
  color: #ff4d4f;
}

.sheet__confirm {
  margin-top: 16px;
}

.sheet__close {
  margin-top: 8px;
  color: rgba(0, 0, 0, 0.65);
}
</style>
