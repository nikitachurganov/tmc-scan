<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Прокручиваемая область с полосой прокрутки поверх содержимого: системная полоса скрыта и не
 * занимает ширину, вместо неё тонкий бегунок появляется при наведении и прокрутке.
 * Высоту задаёт родитель через max-height (или height) на корневом элементе.
 */

const MIN_THUMB = 24

const viewport = ref<HTMLElement | null>(null)
const content = ref<HTMLElement | null>(null)

const thumbTop = ref(0)
const thumbHeight = ref(0)
const scrollable = ref(false)
const active = ref(false)
const dragging = ref(false)

let hideTimer: ReturnType<typeof setTimeout> | undefined
let observer: ResizeObserver | undefined
let dragStartY = 0
let dragStartScroll = 0

function update() {
  const el = viewport.value
  if (!el) return
  const { scrollTop, scrollHeight, clientHeight } = el
  scrollable.value = scrollHeight > clientHeight + 1
  if (!scrollable.value) return
  const height = Math.max(MIN_THUMB, (clientHeight / scrollHeight) * clientHeight)
  thumbHeight.value = height
  thumbTop.value = (scrollTop / (scrollHeight - clientHeight)) * (clientHeight - height)
}

function onScroll() {
  update()
  active.value = true
  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => (active.value = false), 900)
}

function onThumbDown(e: PointerEvent) {
  if (!viewport.value) return
  dragging.value = true
  dragStartY = e.clientY
  dragStartScroll = viewport.value.scrollTop
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onThumbMove(e: PointerEvent) {
  const el = viewport.value
  if (!dragging.value || !el) return
  const track = el.clientHeight - thumbHeight.value
  if (track <= 0) return
  el.scrollTop = dragStartScroll + ((e.clientY - dragStartY) / track) * (el.scrollHeight - el.clientHeight)
}

function onThumbUp() {
  dragging.value = false
}

onMounted(() => {
  observer = new ResizeObserver(update)
  if (viewport.value) observer.observe(viewport.value)
  if (content.value) observer.observe(content.value)
  update()
})

onBeforeUnmount(() => {
  observer?.disconnect()
  clearTimeout(hideTimer)
})
</script>

<template>
  <div class="os" :class="{ 'os--active': active || dragging }">
    <div ref="viewport" class="os__viewport" @scroll.passive="onScroll">
      <div ref="content"><slot /></div>
    </div>
    <div
      v-if="scrollable"
      class="os__thumb"
      :style="{ height: `${thumbHeight}px`, transform: `translateY(${thumbTop}px)` }"
      aria-hidden="true"
      @pointerdown.prevent="onThumbDown"
      @pointermove="onThumbMove"
      @pointerup="onThumbUp"
      @pointercancel="onThumbUp"
    />
  </div>
</template>

<style scoped>
.os {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.os__viewport {
  flex: 1;
  min-height: 0;
  max-height: inherit;
  overflow-y: auto;
  overscroll-behavior: contain;
  /* системная полоса скрыта — её место занимает бегунок поверх содержимого */
  scrollbar-width: none;
}

.os__viewport::-webkit-scrollbar {
  display: none;
}

.os__thumb {
  position: absolute;
  top: 0;
  right: 2px;
  width: 6px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 3px;
  opacity: 0;
  cursor: pointer;
  transition:
    opacity 0.2s,
    width 0.15s;
  touch-action: none;
}

.os:hover .os__thumb,
.os--active .os__thumb {
  opacity: 1;
}

.os__thumb:hover,
.os--active .os__thumb:active {
  width: 8px;
  background: rgba(0, 0, 0, 0.45);
}

@media (prefers-reduced-motion: reduce) {
  .os__thumb {
    transition: none;
  }
}
</style>
