<script setup lang="ts">
import { CheckCircleFilled, CloseOutlined } from '@ant-design/icons-vue'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { ScanResult } from './scan'

const props = defineProps<{
  /** Разбирает отсканированный код и возвращает сообщение для плашки */
  handler: (code: string) => ScanResult
  /** Закрыть экран сразу после первого успешного скана (для выбора одной единицы) */
  closeOnOk?: boolean
}>()
const emit = defineEmits<{ close: [] }>()

const video = ref<HTMLVideoElement | null>(null)
const error = ref('')
const banner = ref<ScanResult | null>(null)
const added = ref(0)

let controls: IScannerControls | undefined
let timer: number | undefined
let busy = false

function onResult(raw: string) {
  // Камера читает код непрерывно: пока показана плашка, повторные срабатывания игнорируем
  if (busy) return
  busy = true
  const result = props.handler(raw)
  if (result.kind === 'ok') added.value += 1
  banner.value = result
  window.clearTimeout(timer)
  const closing = result.kind === 'ok' && props.closeOnOk
  timer = window.setTimeout(
    () => {
      banner.value = null
      busy = false
      if (closing) emit('close')
    },
    closing ? 900 : result.kind === 'ok' ? 1500 : 2000,
  )
}

onMounted(async () => {
  if (!navigator.mediaDevices?.getUserMedia) {
    error.value = 'Камера недоступна в этом браузере или на небезопасном соединении (нужен HTTPS).'
    return
  }
  try {
    const reader = new BrowserMultiFormatReader()
    controls = await reader.decodeFromConstraints(
      { video: { facingMode: { ideal: 'environment' } } },
      video.value!,
      (result) => {
        if (result) onResult(result.getText())
      },
    )
  } catch {
    error.value = 'Не удалось получить доступ к камере. Разрешите доступ в настройках браузера.'
  }
})

onBeforeUnmount(() => {
  controls?.stop()
  window.clearTimeout(timer)
})
</script>

<template>
  <Teleport to="body">
    <div class="es">
      <video ref="video" class="es__video" muted playsinline />

      <header class="es__top">
        <div>
          <div class="es__title">Сканирование оборудования</div>
          <div class="es__hint">Наведите камеру на код · добавлено: {{ added }}</div>
        </div>
        <a-button type="text" class="es__close" aria-label="Закрыть" @click="emit('close')">
          <template #icon><CloseOutlined /></template>
        </a-button>
      </header>

      <div
        class="es__frame"
        :class="{
          'es__frame--ok': banner?.kind === 'ok',
          'es__frame--wrong': banner?.kind === 'wrong',
        }"
      />

      <div class="es__bottom">
        <div v-if="error" class="es__msg">{{ error }}</div>
        <div v-else-if="banner" class="es__msg" :class="`es__msg--${banner.kind}`">
          <CheckCircleFilled v-if="banner.kind === 'ok'" />
          <span>{{ banner.text }}</span>
        </div>
        <a-button type="primary" size="large" block @click="emit('close')">Готово</a-button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.es {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
}

.es__video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.es__top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px;
  color: #fff;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(8px);
}

.es__title {
  font-size: 20px;
  line-height: 28px;
  font-weight: 700;
  color: #fff;
}

.es__hint {
  font-size: 13px;
  line-height: 16px;
  color: rgba(255, 255, 255, 0.9);
}

.es__close {
  width: 32px;
  height: 32px;
  color: #fff;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
}

.es__close:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.3);
}

.es__frame {
  position: relative;
  width: 260px;
  height: 260px;
  margin-bottom: 120px;
  border: 3px solid #fff;
  border-radius: 16px;
  box-shadow: 0 0 0 100vmax rgba(0, 0, 0, 0.45);
  transition: border-color 0.2s;
}

.es__frame--ok {
  border-color: #52c41a;
}

.es__frame--wrong {
  border-color: #ff4d4f;
}

.es__bottom {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 402px;
  margin: 0 auto;
  padding: 0 16px 16px;
}

.es__msg {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 20px;
  text-align: center;
  color: #fff;
  background: rgba(0, 0, 0, 0.75);
}

.es__msg--ok {
  background: #52c41a;
}

.es__msg--wrong {
  background: #ff4d4f;
}

.es__msg--dup {
  background: #faad14;
}
</style>
