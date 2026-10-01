<script setup lang="ts">
import {
  BellOutlined,
  DownOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
} from '@ant-design/icons-vue'
import { computed } from 'vue'
import { useCurrentWarehouse } from '@/composables/useCurrentWarehouse'

defineProps<{ mobile?: boolean }>()

const { current, openPicker } = useCurrentWarehouse()
const warehouseLabel = computed(() => `Склад: ${current.value?.name ?? '—'}`)
</script>

<template>
  <header v-if="mobile" class="dh dh--mobile">
    <img class="dh__logo-img" src="/fefu-logo.png" alt="FEFU One" width="32" height="32" />
    <a-button type="text" class="dh__trigger dh__trigger--mobile" @click="openPicker">
      <span class="dh__trigger-text">{{ warehouseLabel }}</span>
      <DownOutlined class="dh__trigger-icon" />
    </a-button>
    <a-button type="text" aria-label="Уведомления">
      <template #icon><BellOutlined /></template>
    </a-button>
    <a-avatar shape="square" :size="32" class="dh__avatar dh__avatar--mobile">U</a-avatar>
  </header>

  <header v-else class="dh">
    <div class="dh__left">
      <div class="dh__logo">
        <img class="dh__logo-img" src="/fefu-logo.png" alt="" width="36" height="36" />
        <span class="dh__logo-text">FEFU One</span>
      </div>
      <a-divider type="vertical" class="dh__divider" />
      <a-input :bordered="false" placeholder="Поиск по сервису" class="dh__search">
        <template #prefix><SearchOutlined class="dh__search-icon" /></template>
      </a-input>
    </div>

    <div class="dh__right">
      <div class="dh__tools">
        <a-button type="text" class="dh__trigger" @click="openPicker">
          {{ warehouseLabel }}
          <DownOutlined class="dh__trigger-icon" />
        </a-button>
        <a-divider type="vertical" class="dh__divider" />
        <div class="dh__icons">
          <a-button type="text" size="large" aria-label="Помощь">
            <template #icon><QuestionCircleOutlined /></template>
          </a-button>
          <a-button type="text" size="large" aria-label="Уведомления">
            <template #icon><BellOutlined /></template>
          </a-button>
        </div>
        <a-divider type="vertical" class="dh__divider" />
      </div>

      <div class="dh__profile">
        <a-avatar shape="square" :size="40" class="dh__avatar">U</a-avatar>
        <div>
          <div class="dh__name">Иванов Иван Иванович</div>
          <div class="dh__email">ivanov.ii@dvfu.ru</div>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.dh {
  display: flex;
  align-items: center;
  gap: 28px;
  height: 64px;
  padding: 7px 16px;
  box-sizing: border-box;
  background: var(--tmc-bg-container);
  border-bottom: 1px solid var(--tmc-border-secondary);
}

.dh__left {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.dh--mobile {
  gap: 8px;
  height: 56px;
  padding: 8px 12px;
}

.dh__trigger--mobile {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: flex-start;
  min-width: 0;
}

.dh__trigger-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dh__avatar--mobile {
  flex: none;
  font-size: 14px;
}

.dh__logo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-right: 12px;
}

.dh__logo-img {
  border-radius: 4px;
  object-fit: cover;
}

.dh__logo-text {
  font-size: 19px;
  line-height: 24px;
  font-weight: 700;
  color: #000;
  white-space: nowrap;
}

.dh__divider {
  height: 14px;
  margin: 0;
}

.dh__search {
  width: 280px;
  height: 32px;
}

.dh__search-icon {
  font-size: 14px;
  color: var(--tmc-icon);
}

.dh__right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dh__tools {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-left: 8px;
}

.dh__trigger {
  padding: 0 5px;
  color: var(--tmc-text);
}

.dh__trigger-icon {
  margin-left: 4px;
  font-size: 12px;
}

.dh__icons {
  display: flex;
  gap: 2px;
}

.dh__profile {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 256px;
  height: 56px;
  padding: 4px 12px 4px 8px;
  box-sizing: border-box;
  border-radius: 14px 14px 8px 8px;
  box-shadow:
    0 1px 1px rgba(0, 0, 0, 0.03),
    0 1px 3px rgba(0, 0, 0, 0.02),
    0 2px 2px rgba(0, 0, 0, 0.02);
}

.dh__avatar {
  flex: none;
  font-size: 18px;
}

.dh__name {
  font-size: 15px;
  line-height: 20px;
  color: var(--tmc-text);
}

.dh__email {
  margin-top: 2px;
  font-size: 13px;
  line-height: 16px;
  color: var(--tmc-text-tertiary);
}
</style>
