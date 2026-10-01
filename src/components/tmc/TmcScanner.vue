<script setup lang="ts">
import { CheckCircleFilled, CloseOutlined } from '@ant-design/icons-vue'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { TmcItem } from '@/mocks/tmc'

const MAX_VISIBLE = 4

const props = defineProps<{ items: TmcItem[]; startId?: number }>()
const emit = defineEmits<{ close: []; detect: [id: number] }>()

const video = ref<HTMLVideoElement | null>(null)
const error = ref('')
const banner = ref<{ kind: 'ok' | 'wrong' | 'dup'; text: string } | null>(null)
const lastScannedId = ref<number | null>(null)

const doneCount = computed(() => props.items.filter((i) => i.scanned).length)

// В списке не больше MAX_VISIBLE строк: сначала ещё не отсканированные, остальное — счётчиком
const visibleItems = computed(() => {
  const pending = props.items.filter((i) => !i.scanned)
  const done = props.items.filter((i) => i.scanned)
  const picked = [...pending, ...done].slice(0, MAX_VISIBLE)
  return props.items.filter((i) => picked.includes(i))
})
const hiddenCount = computed(() => props.items.length - visibleItems.value.length)

let controls: IScannerControls | undefined
let timer: number | undefined
let busy = false

// Временно: пока нет API для сверки кодов, любой незнакомый код засчитывается
// следующему неотсканированному ТМЦ. Чтобы требовать точное совпадение, поставьте false.
const ACCEPT_ANY_CODE = true

function showBanner(kind: 'ok' | 'wrong' | 'dup', text: string, ms: number, after?: () => void) {
  busy = true
  banner.value = { kind, text }
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    banner.value = null
    busy = false
    after?.()
  }, ms)
}

function onResult(raw: string) {
  // Камера читает код непрерывно: пока показана плашка, повторные срабатывания игнорируем
  if (busy) return
  const text = raw.trim()

  const already = props.items.find((i) => i.code === text && i.scanned)
  if (already) {
    showBanner('dup', `${already.name} уже отсканирован`, 1500)
    return
  }

  let target = props.items.find((i) => i.code === text && !i.scanned)
  if (!target && ACCEPT_ANY_CODE) {
    const start = props.items.find((i) => i.id === props.startId && !i.scanned)
    target = start ?? props.items.find((i) => !i.scanned)
  }
  if (!target) {
    showBanner('wrong', 'Этого ТМЦ нет в списке', 2000)
    return
  }

  lastScannedId.value = target.id
  emit('detect', target.id)

  const left = props.items.filter((i) => !i.scanned).length
  showBanner(
    'ok',
    left > 0 ? `${target.name}: код верный. Можно сканировать следующий` : 'Все ТМЦ отсканированы',
    left > 0 ? 1800 : 1200,
    left > 0 ? undefined : () => emit('close'),
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
    <div class="scanner">
      <video ref="video" class="scanner__video" muted playsinline />

      <header class="scanner__top">
        <div>
          <div class="scanner__title">Сканирование ТМЦ</div>
          <div class="scanner__hint">
            Наведите камеру на код · отсканировано {{ doneCount }} из {{ items.length }}
          </div>
        </div>
        <a-button type="text" class="scanner__close" aria-label="Закрыть" @click="emit('close')">
          <template #icon><CloseOutlined /></template>
        </a-button>
      </header>

      <div
        class="scanner__frame"
        :class="{
          'scanner__frame--ok': banner?.kind === 'ok',
          'scanner__frame--wrong': banner?.kind === 'wrong',
        }"
      />

      <div class="scanner__bottom">
        <div v-if="error" class="scanner__msg">{{ error }}</div>
        <div v-else-if="banner" class="scanner__msg" :class="`scanner__msg--${banner.kind}`">
          <CheckCircleFilled v-if="banner.kind === 'ok'" />
          <span>{{ banner.text }}</span>
        </div>

        <ul class="scanner__list">
          <li
            v-for="item in visibleItems"
            :key="item.id"
            class="scan-item"
            :class="{
              'scan-item--done': item.scanned,
              'scan-item--just': item.id === lastScannedId && item.scanned,
            }"
          >
            <div class="scan-item__desc">
              <div class="scan-item__name">{{ item.name }}</div>
              <div class="scan-item__cat">{{ item.category }}</div>
            </div>
            <CheckCircleFilled v-if="item.scanned" class="scan-item__check" />
            <span v-else class="scan-item__todo">Ждёт скана</span>
          </li>
          <li v-if="hiddenCount > 0" class="scanner__more">и ещё {{ hiddenCount }}</li>
        </ul>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.scanner {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
}

.scanner__video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.scanner__top {
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

.scanner__title {
  font-size: 20px;
  line-height: 28px;
  font-weight: 700;
  color: #fff;
}

.scanner__hint {
  font-size: 13px;
  line-height: 16px;
  color: rgba(255, 255, 255, 0.9);
}

.scanner__close {
  width: 32px;
  height: 32px;
  color: #fff;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
}

.scanner__close:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.3);
}

.scanner__frame {
  position: relative;
  width: 220px;
  height: 220px;
  margin-bottom: 240px;
  border: 3px solid #fff;
  border-radius: 16px;
  box-shadow: 0 0 0 100vmax rgba(0, 0, 0, 0.45);
  transition: border-color 0.2s;
}

.scanner__frame--ok {
  border-color: #52c41a;
}

.scanner__frame--wrong {
  border-color: #ff4d4f;
}

.scanner__bottom {
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

.scanner__msg {
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

.scanner__msg--ok {
  background: #52c41a;
}

.scanner__msg--wrong {
  background: #ff4d4f;
}

.scanner__msg--dup {
  background: #faad14;
}

.scanner__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 8px;
  list-style: none;
  border-radius: 16px;
  background: #fff;
}

.scan-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 48px;
  padding: 6px 12px;
  border-radius: 12px;
  background: #fafbff;
  transition: background 0.3s;
}

.scan-item--done {
  background: #f6ffed;
}

.scan-item--just {
  background: #d9f7be;
}

.scan-item__name {
  font-size: 15px;
  line-height: 20px;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.88);
}

.scan-item__cat {
  font-size: 11px;
  line-height: 12px;
  color: rgba(0, 0, 0, 0.45);
}

.scan-item__check {
  font-size: 22px;
  color: #52c41a;
}

.scan-item__todo {
  font-size: 12px;
  line-height: 16px;
  color: rgba(0, 0, 0, 0.45);
}

.scanner__more {
  padding: 2px 0;
  font-size: 12px;
  text-align: center;
  color: rgba(0, 0, 0, 0.45);
}
</style>
