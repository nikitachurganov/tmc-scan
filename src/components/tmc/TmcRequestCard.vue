<script setup lang="ts">
import {
  DownloadOutlined,
  EnvironmentOutlined,
  UploadOutlined,
  UserOutlined,
} from '@ant-design/icons-vue'
import type { IssueRequest } from '@/mocks/tmc'

defineProps<{ request: IssueRequest }>()
</script>

<template>
  <section class="request-card">
    <header class="request-card__head">
      <h2 class="request-card__title">Заявка {{ request.number ?? `#${request.id}` }}</h2>
      <a-tag color="gold" :bordered="false" class="request-card__tag">{{ request.status }}</a-tag>
    </header>

    <ul class="request-card__info">
      <li class="info-row">
        <UserOutlined class="info-row__icon" />
        <div>
          <div class="info-row__value">{{ request.fullName }}</div>
          <div class="info-row__hint">{{ request.email }}</div>
        </div>
      </li>
      <li class="info-row">
        <UploadOutlined class="info-row__icon" />
        <span><span class="info-row__label">Получение: </span>{{ request.pickup }}</span>
      </li>
      <li class="info-row">
        <DownloadOutlined class="info-row__icon" />
        <span><span class="info-row__label">Возврат: </span>{{ request.returnUntil }}</span>
      </li>
      <li class="info-row">
        <EnvironmentOutlined class="info-row__icon" />
        <span>{{ request.place }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.request-card {
  padding: 12px 16px;
  background: var(--tmc-bg-container);
  border-radius: 12px;
}

.request-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.request-card__title {
  margin: 0;
  font-size: 19px;
  line-height: 27px;
  font-weight: 700;
  color: var(--tmc-text);
}

.request-card__tag {
  margin: 0;
}

.request-card__info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

.info-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  line-height: 16px;
  color: var(--tmc-text);
}

.info-row__icon {
  flex: none;
  font-size: 16px;
  color: var(--tmc-icon);
}

.info-row__label {
  color: var(--tmc-text-tertiary);
}

.info-row__hint {
  margin-top: 4px;
  font-size: 11px;
  line-height: 12px;
  color: var(--tmc-text-tertiary);
}
</style>
