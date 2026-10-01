<script setup lang="ts">
import {
  BarcodeOutlined,
  CheckCircleFilled,
  CloseOutlined,
  ExclamationCircleFilled,
  ScanOutlined,
} from '@ant-design/icons-vue'
import { message, type TableColumnsType } from 'ant-design-vue'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import TmcBottomNav from '@/components/tmc/TmcBottomNav.vue'
import TmcDesktopLayout from '@/components/warehouse/TmcDesktopLayout.vue'
import TmcIssueSummary from '@/components/warehouse/TmcIssueSummary.vue'
import { useIsMobile } from '@/composables/useIsMobile'
import TmcCodeSheet from '@/components/tmc/TmcCodeSheet.vue'
import TmcScanCompleteModal from '@/components/tmc/TmcScanCompleteModal.vue'
import TmcScanner from '@/components/tmc/TmcScanner.vue'
import TmcItemRow from '@/components/tmc/TmcItemRow.vue'
import TmcRequestCard from '@/components/tmc/TmcRequestCard.vue'
import TmcProblemModal from '@/components/warehouse/TmcProblemModal.vue'
import { useWarehouse, type ProblemInput } from '@/composables/useWarehouse'
import { problemTypeLabels, RETURN_DEADLINE_TIME, type IssueRequest } from '@/mocks/tmc'

/** Один экран на выдачу и возврат: сверка каждой единицы сканом или вводом кода */
const props = withDefaults(defineProps<{ id: string; mode?: 'issue' | 'return' }>(), { mode: 'issue' })

const isReturn = props.mode === 'return'
const router = useRouter()
const isMobile = useIsMobile()
const { requestById, requestItems, unitsOnHand, issueRequest, returnRequest, reportProblem } = useWarehouse()

const source = requestById(Number(props.id))
// выдать можно только готовую заявку, принять возврат — только с ТМЦ на руках
const ready = isReturn ? source !== undefined && unitsOnHand(source).length > 0 : source?.status === 'Готово'
const exitRoute = { name: isReturn ? 'requests' : 'warehouse' }
if (!ready) router.replace(exitRoute)

function buildRequest(): IssueRequest {
  if (!source || !ready) {
    return { id: 0, status: '', fullName: '', email: '', pickup: '', returnUntil: '', place: '', items: [] }
  }
  const units = isReturn ? unitsOnHand(source) : requestItems(source)
  return {
    id: source.id,
    number: source.number,
    status: isReturn ? 'Возврат' : 'К выдаче',
    fullName: source.fullName,
    email: source.email,
    pickup: isReturn ? `выдано ${source.pickupActualAt ?? ''}` : `сегодня, ${source.time ?? ''}`,
    returnUntil: `до ${RETURN_DEADLINE_TIME}, ${source.returnUntil}`,
    place: source.place,
    items: units.map((unit) => ({
      id: unit.id,
      name: unit.name,
      category: unit.category,
      code: unit.code,
      scanned: false,
      problem: unit.problem ? problemTypeLabels[unit.problem.type] : undefined,
    })),
  }
}

const request = reactive(buildRequest())

/** Позиции с проблемой не сканируют: при выдаче они не выдаются, при возврате уходят на обслуживание */
const scannableItems = computed(() => request.items.filter((i) => !i.problem))
const pendingItems = computed(() => scannableItems.value.filter((i) => !i.scanned))
const scannedCount = computed(() => scannableItems.value.filter((i) => i.scanned).length)
const problemCount = computed(() => request.items.length - scannableItems.value.length)
const allDone = computed(() => request.items.length > 0 && pendingItems.value.length === 0)
// выдать можно и часть (с подтверждением), вернуть — только всё
const canSubmit = computed(() => (isReturn ? allDone.value : scannedCount.value > 0))

const sheetItemId = ref<number | null>(null)
const scannerItemId = ref<number | null>(null)

const sheetItem = computed(() => request.items.find((i) => i.id === sheetItemId.value) ?? null)

function confirmItem(id: number) {
  const item = request.items.find((i) => i.id === id)
  if (item) item.scanned = true
  sheetItemId.value = null
}

// ПК: общее поле кода — ручной сканер штрихкодов вводит код и жмёт Enter
const codeInput = ref('')
const codeInputRef = ref<{ focus: () => void }>()

const desktopColumns: TableColumnsType = [
  { title: 'ТМЦ', key: 'item' },
  { title: 'Статус', key: 'state', width: 260 },
  { title: '', key: 'actions', width: 200 },
]

function confirmByCode() {
  const code = codeInput.value.trim()
  if (!code) return
  const item = request.items.find((i) => i.code === code)
  if (!item) message.error(`ТМЦ с кодом ${code} нет в этой заявке`)
  else if (item.problem) message.warning(`${item.name}: отмечена проблема, сверять не нужно`)
  else if (item.scanned) message.info(`${item.name} уже подтверждён`)
  else {
    confirmItem(item.id)
    message.success(`${item.name}: код верный`)
  }
  codeInput.value = ''
  codeInputRef.value?.focus()
}

onMounted(() => {
  if (!isMobile.value) nextTick(() => codeInputRef.value?.focus())
})

// Итог сверки — когда всё отсканировано и сканер/шторка уже закрыты
const completeOpen = ref(false)
let completeShown = false
watch([allDone, scannerItemId, sheetItemId], ([done, scanner, sheet]) => {
  if (!done) {
    completeShown = false
    return
  }
  if (scanner === null && sheet === null && !completeShown && scannedCount.value > 0) {
    completeShown = true
    completeOpen.value = true
  }
})

const problemOpen = ref(false)
const problemUnitId = ref<number | null>(null)
const problemUnits = computed(() => request.items.map(({ id, name, code }) => ({ id, name, code })))

function openProblem(unitId: number | null) {
  problemUnitId.value = unitId
  problemOpen.value = true
}

function submitProblem(unitId: number, input: ProblemInput) {
  if (!source || !reportProblem(unitId, input, source.id)) return
  const item = request.items.find((i) => i.id === unitId)
  if (item) {
    item.problem = problemTypeLabels[input.type]
    item.scanned = false
  }
  problemOpen.value = false
  message.warning('Проблема отмечена, ТМЦ отправлено на обслуживание')
}

const partialOpen = ref(false)
const partialReason = ref('')
const partialReasonError = ref(false)
const notIssuedItems = computed(() => request.items.filter((i) => i.problem || !i.scanned))

function close() {
  router.push(exitRoute)
}

function submit() {
  if (!source || !canSubmit.value) return
  if (isReturn) {
    if (!returnRequest(source.id)) return
    message.success('Возврат принят')
    router.push(exitRoute)
    return
  }
  if (scannedCount.value < request.items.length) {
    partialReason.value = ''
    partialReasonError.value = false
    partialOpen.value = true
    return
  }
  if (!issueRequest(source.id)) return
  message.success('Выдача оформлена')
  router.push(exitRoute)
}

/** Неполная выдача: причина обязательна, если что-то просто не отсканировали (у проблемных она уже есть) */
function confirmPartial() {
  if (!source) return
  const reason = partialReason.value.trim()
  if (pendingItems.value.length > 0 && !reason) {
    partialReasonError.value = true
    return
  }
  const problems = request.items.filter((i) => i.problem).map((i) => `${i.name} — ${i.problem}`)
  const fullReason = [reason, problems.length ? `проблема: ${problems.join('; ')}` : '']
    .filter(Boolean)
    .join('; ')
  const issuedIds = scannableItems.value.filter((i) => i.scanned).map((i) => i.id)
  if (!issueRequest(source.id, issuedIds, fullReason)) return
  partialOpen.value = false
  message.success('Выдан неполный комплект')
  router.push(exitRoute)
}
</script>

<template>
  <template v-if="ready">
    <TmcDesktopLayout v-if="!isMobile">
      <div class="td-intro">
        <a-breadcrumb class="td-breadcrumb">
          <a-breadcrumb-item>Главная</a-breadcrumb-item>
          <a-breadcrumb-item>
            <RouterLink :to="{ name: 'warehouse' }">Виртуальный склад</RouterLink>
          </a-breadcrumb-item>
          <a-breadcrumb-item>
            <RouterLink :to="{ name: 'requests' }">Активные заявки</RouterLink>
          </a-breadcrumb-item>
          <a-breadcrumb-item>{{ isReturn ? 'Возврат' : 'Выдача' }} {{ request.number }}</a-breadcrumb-item>
        </a-breadcrumb>
        <h1 class="td-title">{{ isReturn ? 'Возврат ТМЦ' : 'Выдача ТМЦ' }}</h1>
      </div>

      <!-- список ТМЦ — основная работа слева, сводка заявки справа и прилипает при прокрутке -->
      <div class="td-grid">
        <section class="td-card">
          <header class="td-card__head">
            <h2 class="td-card__title">
              Список ТМЦ
              <span class="td-card__count">{{ scannedCount }} из {{ request.items.length }}</span>
            </h2>
          </header>

          <div class="td-toolbar">
            <a-input
              ref="codeInputRef"
              v-model:value="codeInput"
              size="large"
              allow-clear
              :placeholder="
                isReturn
                  ? 'Введите или отсканируйте код возвращаемой ТМЦ'
                  : 'Введите или отсканируйте код ТМЦ сканером штрихкодов'
              "
              class="td-toolbar__input"
              @press-enter="confirmByCode"
            >
              <template #prefix><BarcodeOutlined class="td-toolbar__icon" /></template>
            </a-input>
            <a-button size="large" @click="confirmByCode">Подтвердить</a-button>
            <a-button
              size="large"
              :disabled="!pendingItems.length"
              @click="scannerItemId = pendingItems[0]?.id ?? null"
            >
              <template #icon><ScanOutlined /></template>
              Сканировать камерой
            </a-button>
          </div>

          <a-table :columns="desktopColumns" :data-source="request.items" :pagination="false" row-key="id">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'item'">
                <div class="td-item__name">{{ record.name }}</div>
                <div class="td-item__category">{{ record.category }}</div>
              </template>
              <template v-else-if="column.key === 'state'">
                <span v-if="record.problem" class="td-state td-state--problem">
                  <ExclamationCircleFilled />
                  {{ record.problem }}
                </span>
                <span v-else-if="record.scanned" class="td-state td-state--done">
                  <CheckCircleFilled />
                  Подтверждено
                </span>
                <span v-else class="td-state">Ждёт кода</span>
              </template>
              <a-space v-else-if="column.key === 'actions'" :size="4">
                <a-button
                  v-if="!record.scanned && !record.problem"
                  type="link"
                  size="small"
                  @click="sheetItemId = record.id"
                >
                  Ввести код
                </a-button>
                <a-button type="link" size="small" danger @click="openProblem(record.id)">
                  Проблема
                </a-button>
              </a-space>
            </template>
          </a-table>

          <footer class="td-footer">
            <a-button size="large" @click="close">Отмена</a-button>
            <a-button size="large" @click="openProblem(null)">Проблема с ТМЦ</a-button>
            <a-button size="large" type="primary" :disabled="!canSubmit" @click="submit">
              {{ isReturn ? 'Принять возврат' : 'Выдать' }}
            </a-button>
          </footer>
        </section>

        <TmcIssueSummary
          v-if="source"
          :request="source"
          :mode="mode"
          :scanned="scannedCount"
          :total="request.items.length"
          :problems="problemCount"
          class="td-summary"
        />
      </div>
    </TmcDesktopLayout>

    <div v-else class="tmc-screen">
      <header class="tmc-header">
        <div>
          <h1 class="tmc-header__title">{{ isReturn ? 'Возврат ТМЦ' : 'Выдача ТМЦ' }}</h1>
          <p class="tmc-header__subtitle">
            {{ isReturn ? 'Отсканируйте все возвращаемые ТМЦ' : 'Укажите все коды для выдачи' }}
          </p>
        </div>
        <a-button type="text" class="tmc-header__close" aria-label="Закрыть" @click="close">
          <template #icon><CloseOutlined /></template>
        </a-button>
      </header>

      <main class="tmc-body">
        <TmcRequestCard :request="request" />

        <section class="tmc-list">
          <h2 class="tmc-list__title">
            Список ТМЦ
            <span class="tmc-list__count">{{ scannedCount }} из {{ request.items.length }}</span>
          </h2>
          <div class="tmc-list__items">
            <TmcItemRow
              v-for="item in request.items"
              :key="item.id"
              :item="item"
              @enter="sheetItemId = $event"
              @scan="scannerItemId = $event"
              @problem="openProblem"
            />
          </div>
        </section>
      </main>

      <footer class="tmc-footer">
        <a-button size="large" block @click="openProblem(null)">Проблема с ТМЦ</a-button>
        <a-button size="large" block type="primary" :disabled="!canSubmit" @click="submit">
          {{ isReturn ? 'Принять возврат' : 'Выдать' }}
        </a-button>
      </footer>

      <TmcBottomNav />
    </div>

    <!-- общие для ПК и телефона: шторка кода, камера, итог сверки, проблема, неполная выдача -->
    <TmcCodeSheet
      :open="sheetItem !== null"
      :item="sheetItem"
      @close="sheetItemId = null"
      @confirm="confirmItem"
    />
    <TmcScanner
      v-if="scannerItemId !== null"
      :items="scannableItems"
      :start-id="scannerItemId ?? undefined"
      @close="scannerItemId = null"
      @detect="confirmItem"
    />

    <TmcScanCompleteModal
      :open="completeOpen"
      :items="request.items"
      :mode="mode"
      @close="completeOpen = false"
    />

    <TmcProblemModal
      :open="problemOpen"
      :units="problemUnits"
      :unit-id="problemUnitId"
      @close="problemOpen = false"
      @submit="submitProblem"
    />

    <a-modal
      v-model:open="partialOpen"
      title="Выдать неполный комплект?"
      centered
      ok-text="Выдать неполный комплект"
      cancel-text="Отмена"
      @ok="confirmPartial"
    >
      <p class="tmc-partial__text">
        Будет выдано {{ scannedCount }} из {{ request.items.length }}. Невыданные ТМЦ освободятся для
        других заявок и по этой заявке выдаваться не будут.
      </p>
      <ul class="tmc-partial__list">
        <li v-for="item in notIssuedItems" :key="item.id" class="tmc-partial__item">
          <span class="tmc-partial__name">{{ item.name }}</span>
          <span v-if="item.problem" class="tmc-partial__problem">
            <ExclamationCircleFilled />
            {{ item.problem }}
          </span>
          <span v-else class="tmc-partial__pending">Не отсканировано</span>
        </li>
      </ul>
      <a-form layout="vertical">
        <a-form-item
          label="Почему выдаётся не всё"
          :required="pendingItems.length > 0"
          :validate-status="partialReasonError ? 'error' : undefined"
          :help="partialReasonError ? 'Укажите причину' : undefined"
          class="tmc-partial__reason"
        >
          <a-textarea
            v-model:value="partialReason"
            :rows="3"
            :maxlength="500"
            placeholder="Например, нет на складе, пользователь отказался"
            @change="partialReasonError = false"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </template>
</template>

<style scoped>
/* ПК: в каркасе склада, как остальные страницы (заголовок 28 px, белые блоки radius 12) */
.td-intro {
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
  min-height: 66px;
}

.td-breadcrumb :deep(.ant-breadcrumb-link),
.td-breadcrumb :deep(.ant-breadcrumb-separator) {
  color: var(--tmc-text-tertiary);
}

.td-title {
  margin: 0;
  font-size: 28px;
  line-height: 36px;
  font-weight: 700;
  color: #0d1321;
}

.td-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  align-items: start;
  gap: 12px;
}

.td-summary {
  position: sticky;
  top: 12px;
}

.td-card {
  padding: 16px;
  background: var(--tmc-bg-container);
  border-radius: 12px;
}

.td-card__title {
  margin: 0 0 12px;
  font-size: 19px;
  line-height: 24px;
  font-weight: 700;
  color: var(--tmc-text);
}

.td-card__count {
  margin-left: 6px;
  font-size: 13px;
  font-weight: 400;
  color: var(--tmc-text-tertiary);
}

.td-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.td-toolbar__input {
  flex: 1;
  min-width: 0;
}

.td-toolbar__icon {
  color: var(--tmc-icon);
}

.td-item__name {
  font-weight: 700;
  color: var(--tmc-text);
}

.td-item__category {
  margin-top: 2px;
  font-size: 12px;
  color: var(--tmc-text-tertiary);
}

.td-state {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tmc-text-tertiary);
}

.td-state--done {
  color: #52c41a;
}

.td-state--problem {
  color: #fa8c16;
}

.td-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--tmc-border-secondary);
}

.tmc-screen {
  --tmc-primary: #2d82cf;
  --tmc-bg-layout: #f5f5f5;
  --tmc-bg-container: #ffffff;
  --tmc-bg-row: #fafbff;
  --tmc-border-secondary: #f0f0f0;
  --tmc-text: rgba(0, 0, 0, 0.88);
  --tmc-text-tertiary: rgba(0, 0, 0, 0.45);
  --tmc-icon: rgba(0, 0, 0, 0.45);

  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 402px;
  min-height: 100vh;
  margin: 0 auto;
  background: var(--tmc-bg-layout);
}

.tmc-header {
  position: relative;
  padding: 16px;
  background: var(--tmc-bg-container);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

.tmc-header__title {
  margin: 0;
  font-size: 20px;
  line-height: 28px;
  font-weight: 590;
  color: var(--tmc-text);
}

.tmc-header__subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 16px;
  color: var(--tmc-text-tertiary);
}

.tmc-header__close {
  position: absolute;
  top: 30px;
  right: 16px;
  width: 20px;
  height: 20px;
  padding: 0;
  font-size: 18px;
  color: var(--tmc-icon);
}

.tmc-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

.tmc-list__title {
  margin: 0 0 8px;
  font-size: 19px;
  line-height: 24px;
  font-weight: 700;
  color: var(--tmc-text);
}

.tmc-list__count {
  margin-left: 6px;
  font-size: 13px;
  font-weight: 400;
  color: var(--tmc-text-tertiary);
}

.tmc-list__items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tmc-partial__text {
  margin: 0 0 12px;
  font-size: 14px;
  line-height: 20px;
}

.tmc-partial__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0 0 16px;
  padding: 0;
  list-style: none;
}

.tmc-partial__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  background: #fafbff;
  border-radius: 8px;
}

.tmc-partial__name {
  font-weight: 700;
}

.tmc-partial__problem {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #fa8c16;
}

.tmc-partial__pending {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}

.tmc-partial__reason {
  margin-bottom: 0;
}

.tmc-footer {
  display: flex;
  gap: 8px;
  padding: 16px;
  background: var(--tmc-bg-container);
  box-shadow: 0 -1px 2px rgba(0, 0, 0, 0.06);
}
</style>
