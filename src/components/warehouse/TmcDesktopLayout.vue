<script setup lang="ts">
import TmcBottomNav from '@/components/tmc/TmcBottomNav.vue'
import { useCurrentWarehouse } from '@/composables/useCurrentWarehouse'
import { useIsMobile } from '@/composables/useIsMobile'
import TmcDesktopHeader from './TmcDesktopHeader.vue'
import TmcSectionNav from './TmcSectionNav.vue'
import TmcWarehousePickerModal from './TmcWarehousePickerModal.vue'

defineProps<{
  /** Контент на всю ширину экрана с отступами 20 px вместо колонки 1280 px */
  fluid?: boolean
}>()

const isMobile = useIsMobile()
const { myWarehouses, current, needsPicker, pickerOpen, currentEmployeeId, closePicker, select } =
  useCurrentWarehouse()
</script>

<template>
  <div class="dl" :class="{ 'dl--mobile': isMobile }">
    <TmcDesktopHeader :mobile="isMobile" />
    <TmcSectionNav />
    <main class="dl__content" :class="{ 'dl__content--fluid': fluid }">
      <slot />
    </main>
    <TmcBottomNav v-if="isMobile" class="dl__nav" />

    <TmcWarehousePickerModal
      :open="needsPicker || pickerOpen"
      :closable="!needsPicker"
      :warehouses="myWarehouses"
      :current-id="current?.id ?? null"
      :employee-id="currentEmployeeId"
      @select="select"
      @close="closePicker"
    />
  </div>
</template>

<style scoped>
.dl {
  --tmc-primary: #2d82cf;
  --tmc-bg-layout: #f5f5f5;
  --tmc-bg-container: #ffffff;
  --tmc-border-secondary: #f0f0f0;
  --tmc-text: rgba(0, 0, 0, 0.88);
  --tmc-text-secondary: rgba(0, 0, 0, 0.65);
  --tmc-text-tertiary: rgba(0, 0, 0, 0.45);
  --tmc-icon: rgba(0, 0, 0, 0.45);

  display: flex;
  flex-direction: column;
  min-width: 1280px;
  min-height: 100vh;
  background: var(--tmc-bg-layout);
}

.dl__content {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 1320px;
  margin: 0 auto;
  padding: 18px 20px;
  box-sizing: border-box;
}

.dl__content--fluid {
  max-width: none;
}

.dl--mobile {
  min-width: 0;
}

.dl--mobile .dl__content {
  padding: 16px;
}

.dl__nav {
  position: sticky;
  bottom: 0;
  z-index: 10;
}
</style>
