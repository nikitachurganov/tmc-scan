<script setup lang="ts">
import { DownloadOutlined } from '@ant-design/icons-vue'
import { message, type TableColumnsType } from 'ant-design-vue'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import TmcDesktopLayout from '@/components/warehouse/TmcDesktopLayout.vue'
import TmcStatusTag from '@/components/warehouse/TmcStatusTag.vue'
import { useWarehouse } from '@/composables/useWarehouse'
import { equipmentOriginLabels, equipmentStatusLabels, problemTypeLabels, type UsageLogEntry } from '@/mocks/tmc'
import { downloadCsv } from '@/utils/csv'

const props = defineProps<{ id: string }>()

const { unitById, kitForUnit, logEntriesFor, resolveProblem } = useWarehouse()

function resolve() {
  if (resolveProblem(Number(props.id))) message.success('Проблема устранена, оборудование снова в обороте')
}

const unit = computed(() => unitById(Number(props.id)))
const kit = computed(() => kitForUnit(Number(props.id)))
const log = computed(() => logEntriesFor(Number(props.id)))

const logColumns: TableColumnsType = [
  { title: '№ заявки', dataIndex: 'requestNumber', width: 140 },
  { title: 'Пользователь', dataIndex: 'userFullName' },
  { title: 'Выдано', dataIndex: 'issuedAt', width: 110 },
  { title: 'Срок возврата', dataIndex: 'dueAt', width: 130 },
  { title: 'Возвращено', key: 'returnedAt', width: 130 },
  { title: 'Статус', key: 'status', width: 130 },
]

function rowStatus(entry: UsageLogEntry): string {
  if (entry.lost) return 'Утеряно'
  return entry.returnedAt ? 'Возвращено' : 'В пользовании'
}

function exportLog() {
  if (!unit.value) return
  downloadCsv(
    `journal-${unit.value.code}.csv`,
    ['№ заявки', 'Пользователь', 'Email', 'Выдано', 'Срок возврата', 'Возвращено', 'Место'],
    log.value.map((e) => [e.requestNumber, e.userFullName, e.userEmail, e.issuedAt, e.dueAt, e.returnedAt ?? '', e.place]),
  )
}
</script>

<template>
  <TmcDesktopLayout>
    <a-breadcrumb class="ev-breadcrumb">
      <a-breadcrumb-item>Главная</a-breadcrumb-item>
      <a-breadcrumb-item>
        <RouterLink :to="{ name: 'registry' }">Реестр ТМЦ</RouterLink>
      </a-breadcrumb-item>
      <a-breadcrumb-item>Оборудование</a-breadcrumb-item>
    </a-breadcrumb>

    <a-result
      v-if="!unit"
      status="404"
      title="Оборудование не найдено"
      sub-title="Возможно, единица оборудования была удалена из системы."
    >
      <template #extra>
        <RouterLink :to="{ name: 'registry' }">
          <a-button type="primary">К реестру ТМЦ</a-button>
        </RouterLink>
      </template>
    </a-result>

    <template v-else>
      <h1 class="ev-title">{{ unit.name }}</h1>
      <div class="ev-card">
        <a-descriptions :column="1" bordered size="middle">
          <a-descriptions-item label="Категория">{{ unit.category }}</a-descriptions-item>
          <a-descriptions-item label="Инвентарный код">{{ unit.code }}</a-descriptions-item>
          <a-descriptions-item label="Статус">
            <TmcStatusTag :label="equipmentStatusLabels[unit.status]" />
          </a-descriptions-item>
          <a-descriptions-item label="Источник">
            <a-tag v-if="unit.origin === 'adhoc'" color="purple" :bordered="false">
              {{ equipmentOriginLabels.adhoc }}
            </a-tag>
            <span v-else>{{ equipmentOriginLabels.asset }}</span>
          </a-descriptions-item>
          <a-descriptions-item label="В составе ТМЦ">
            {{ kit ? kit.name : 'Не входит в комплект' }}
          </a-descriptions-item>
        </a-descriptions>
      </div>

      <div v-if="unit.problem" class="ev-card ev-problem">
        <header class="ev-problem__head">
          <h2 class="ev-problem__title">Проблема: {{ problemTypeLabels[unit.problem.type] }}</h2>
          <a-popconfirm
            title="Проблема устранена?"
            description="Проблема будет снята, оборудование вернётся в оборот."
            ok-text="Да, устранена"
            cancel-text="Отмена"
            @confirm="resolve"
          >
            <a-button>Проблема устранена</a-button>
          </a-popconfirm>
        </header>
        <p class="ev-problem__meta">{{ unit.problem.reportedAt }} · {{ unit.problem.reportedBy }}</p>
        <p v-if="unit.problem.comment" class="ev-problem__text">{{ unit.problem.comment }}</p>
        <a-image v-if="unit.problem.photo" :src="unit.problem.photo" :width="160" class="ev-problem__photo" />
      </div>

      <div class="ev-log">
        <header class="ev-log__head">
          <h2 class="ev-log__title">Журнал использования</h2>
          <a-button :disabled="!log.length" @click="exportLog">
            <template #icon><DownloadOutlined /></template>
            Экспорт CSV
          </a-button>
        </header>
        <a-table
          :columns="logColumns"
          :data-source="log"
          row-key="id"
          size="small"
          :pagination="{ pageSize: 10, showSizeChanger: false }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'returnedAt'">{{ record.returnedAt ?? '—' }}</template>
            <TmcStatusTag v-else-if="column.key === 'status'" :label="rowStatus(record as UsageLogEntry)" />
          </template>
          <template #emptyText>У этой единицы ещё не было выдач</template>
        </a-table>
      </div>
    </template>
  </TmcDesktopLayout>
</template>

<style scoped>
.ev-breadcrumb :deep(.ant-breadcrumb-link),
.ev-breadcrumb :deep(.ant-breadcrumb-separator) {
  color: var(--tmc-text-tertiary);
}

.ev-title {
  margin: 0;
  font-size: 28px;
  line-height: 36px;
  font-weight: 700;
  color: #0d1321;
}

.ev-card {
  max-width: 720px;
  padding: 16px;
  background: var(--tmc-bg-container);
  border-radius: 12px;
}

.ev-problem {
  border-left: 3px solid #fa8c16;
}

.ev-problem__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ev-problem__title {
  margin: 0;
  font-size: 17px;
  line-height: 24px;
  font-weight: 700;
  color: var(--tmc-text);
}

.ev-problem__meta {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--tmc-text-tertiary);
}

.ev-problem__text {
  margin: 8px 0 0;
  font-size: 14px;
  line-height: 20px;
  white-space: pre-wrap;
}

.ev-problem__photo {
  margin-top: 8px;
  border-radius: 8px;
}

.ev-log {
  max-width: 960px;
  padding: 16px;
  background: var(--tmc-bg-container);
  border-radius: 12px;
}

.ev-log__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.ev-log__title {
  margin: 0;
  font-size: 17px;
  line-height: 24px;
  font-weight: 700;
  color: var(--tmc-text);
}

@media (max-width: 767px) {
  .ev-breadcrumb {
    display: none;
  }

  .ev-title {
    font-size: 20px;
    line-height: 28px;
  }
}
</style>
