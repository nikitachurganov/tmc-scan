<script setup lang="ts">
import { EditOutlined } from '@ant-design/icons-vue'
import { message, type FormInstance } from 'ant-design-vue'
import type { Rule } from 'ant-design-vue/es/form'
import { computed, reactive, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import TmcDesktopLayout from '@/components/warehouse/TmcDesktopLayout.vue'
import TmcRuleTemplates from '@/components/warehouse/TmcRuleTemplates.vue'
import TmcWarehouseChannels from '@/components/warehouse/TmcWarehouseChannels.vue'
import { useCurrentWarehouse } from '@/composables/useCurrentWarehouse'
import { useWarehouse } from '@/composables/useWarehouse'
import { campusBuildings, pickupPlaceLabel, type WarehouseSettings } from '@/mocks/tmc'

const { warehouses, employees, updateWarehouse } = useWarehouse()
const { current } = useCurrentWarehouse()

/** В форме корпус и кабинет могут быть не выбраны — тогда в селекте виден плейсхолдер */
type SettingsForm = Omit<WarehouseSettings, 'pickupBuilding' | 'pickupRoom'> & {
  pickupBuilding?: string
  pickupRoom?: string
}

const form = reactive<SettingsForm>({
  id: 0,
  name: '',
  managerIds: [],
  seniorAdminIds: [],
  moderatorIds: [],
  channels: [],
  pickupBuilding: undefined,
  pickupRoom: undefined,
  phone: '',
  email: '',
})

/** Страница открывается в просмотре; «Редактировать» включает форму */
const editing = ref(false)

function resetForm() {
  const warehouse = current.value
  if (!warehouse) return
  Object.assign(form, {
    ...warehouse,
    managerIds: [...warehouse.managerIds],
    seniorAdminIds: [...warehouse.seniorAdminIds],
    moderatorIds: [...warehouse.moderatorIds],
    pickupBuilding: warehouse.pickupBuilding || undefined,
    pickupRoom: warehouse.pickupRoom || undefined,
  })
}

// при смене склада — его настройки и снова режим просмотра
watch(
  current,
  () => {
    resetForm()
    editing.value = false
  },
  { immediate: true },
)

function startEdit() {
  resetForm()
  editing.value = true
}

function cancelEdit() {
  resetForm()
  editing.value = false
}

/** «Петров А.С., Иванов И.И.» или «Не назначены» */
function namesLabel(ids: number[]): string {
  if (!ids.length) return 'Не назначены'
  return ids.map((id) => employees.find((e) => e.id === id)?.name ?? '—').join(', ')
}

const employeeOptions = employees.map((e) => ({ value: e.id, label: e.name }))

const buildingOptions = campusBuildings.map((b) => ({ value: b.name, label: b.name }))

/** Кабинеты только выбранного корпуса; без корпуса список пуст и поле заблокировано */
const roomOptions = computed(() =>
  (campusBuildings.find((b) => b.name === form.pickupBuilding)?.rooms ?? []).map((room) => ({
    value: room,
    label: room,
  })),
)

/** Сменили корпус — кабинет прежнего корпуса сбрасывается */
function onBuildingChange() {
  if (!roomOptions.value.some((o) => o.value === form.pickupRoom)) form.pickupRoom = undefined
}

const rules: Record<string, Rule[]> = {
  pickupBuilding: [{ required: true, message: 'Выберите корпус', trigger: 'change' }],
  pickupRoom: [{ required: true, message: 'Выберите кабинет', trigger: 'change' }],
}

/** Старший админ закреплён за одним складом: занятые другими складами — недоступны */
const seniorAdminOptions = computed(() =>
  employees.map((e) => {
    const elsewhere = warehouses.value.find((w) => w.id !== form.id && w.seniorAdminIds.includes(e.id))
    return {
      value: e.id,
      label: elsewhere ? `${e.name} — старший админ: ${elsewhere.name}` : e.name,
      disabled: elsewhere !== undefined,
    }
  }),
)

const formRef = ref<FormInstance>()

/** «Сохранить» в шапке блока — вне формы, поэтому валидацию запускаем сами */
async function submit() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  // корпус и кабинет обязательны — после валидации они выбраны
  updateWarehouse({
    ...form,
    pickupBuilding: form.pickupBuilding ?? '',
    pickupRoom: form.pickupRoom ?? '',
    // каналы редактируются своим блоком — берём актуальные, а не снимок на момент открытия формы
    channels: current.value?.channels ?? [],
  })
  editing.value = false
  message.success('Настройки склада сохранены')
}
</script>

<template>
  <TmcDesktopLayout>
    <div class="ws-intro">
      <a-breadcrumb class="ws-breadcrumb">
        <a-breadcrumb-item>Главная</a-breadcrumb-item>
        <a-breadcrumb-item>
          <RouterLink :to="{ name: 'warehouse' }">Виртуальный склад</RouterLink>
        </a-breadcrumb-item>
        <a-breadcrumb-item>Настройки склада</a-breadcrumb-item>
      </a-breadcrumb>
      <h1 class="ws-title">Настройки склада</h1>
    </div>

    <div class="ws-card">
      <header class="ws-card__head">
        <h2 class="ws-card__title">Основное</h2>
        <div v-if="editing" class="ws-card__tools">
          <a-button @click="cancelEdit">Отменить</a-button>
          <a-button type="primary" @click="submit">Сохранить</a-button>
        </div>
        <a-button v-else @click="startEdit">
          <template #icon><EditOutlined /></template>
          Редактировать
        </a-button>
      </header>

      <!-- чтение: компактный список «подпись — значение» -->
      <a-descriptions
        v-if="!editing && current"
        :column="{ xs: 1, sm: 1, md: 2, lg: 2, xl: 2, xxl: 2 }"
        :label-style="{ width: '160px', color: 'rgba(0, 0, 0, 0.45)' }"
        class="ws-read"
      >
        <a-descriptions-item label="Название склада">{{ current.name }}</a-descriptions-item>
        <a-descriptions-item label="Место выдачи">{{ pickupPlaceLabel(current) || '—' }}</a-descriptions-item>
        <a-descriptions-item label="Номер телефона">{{ current.phone || '—' }}</a-descriptions-item>
        <a-descriptions-item label="Почта">{{ current.email || '—' }}</a-descriptions-item>
        <a-descriptions-item label="Управляющие">{{ namesLabel(current.managerIds) }}</a-descriptions-item>
        <a-descriptions-item label="Старшие админы">{{ namesLabel(current.seniorAdminIds) }}</a-descriptions-item>
        <a-descriptions-item label="Модераторы">{{ namesLabel(current.moderatorIds) }}</a-descriptions-item>
      </a-descriptions>

      <a-form v-else ref="formRef" layout="vertical" :model="form" :rules="rules">
        <a-form-item label="Название склада" name="name">
          <a-input v-model:value="form.name" size="large" placeholder="Например, Общежитие №7" />
        </a-form-item>

        <!-- место выдачи: сначала корпус, затем кабинет этого корпуса -->
        <div class="ws-row">
          <a-form-item label="Корпус" name="pickupBuilding" class="ws-row__item">
            <a-select
              v-model:value="form.pickupBuilding"
              size="large"
              show-search
              allow-clear
              placeholder="Выберите корпус"
              option-filter-prop="label"
              :options="buildingOptions"
              @change="onBuildingChange"
            >
              <template #notFoundContent>Корпус не найден</template>
            </a-select>
          </a-form-item>
          <a-form-item label="Кабинет" name="pickupRoom" class="ws-row__item">
            <a-select
              v-model:value="form.pickupRoom"
              size="large"
              show-search
              :disabled="!form.pickupBuilding"
              :placeholder="form.pickupBuilding ? 'Выберите кабинет' : 'Сначала выберите корпус'"
              option-filter-prop="label"
              :options="roomOptions"
            >
              <template #notFoundContent>Кабинет не найден</template>
            </a-select>
          </a-form-item>
        </div>

        <div class="ws-row ws-row--3">
          <a-form-item label="Управляющие" name="managerIds" class="ws-row__item">
            <a-select
              v-model:value="form.managerIds"
              mode="multiple"
              size="large"
              placeholder="Выберите сотрудников"
              option-filter-prop="label"
              :options="employeeOptions"
            />
          </a-form-item>
          <a-form-item label="Старшие админы" name="seniorAdminIds" class="ws-row__item">
            <a-select
              v-model:value="form.seniorAdminIds"
              mode="multiple"
              size="large"
              placeholder="Выберите сотрудников"
              option-filter-prop="label"
              :options="seniorAdminOptions"
            />
          </a-form-item>
          <a-form-item label="Модераторы" name="moderatorIds" class="ws-row__item">
            <a-select
              v-model:value="form.moderatorIds"
              mode="multiple"
              size="large"
              placeholder="Выберите сотрудников"
              option-filter-prop="label"
              :options="employeeOptions"
            />
          </a-form-item>
        </div>

        <!-- контакты — отдельная группа, отбита отступом от ролей -->
        <div class="ws-row ws-row--contacts">
          <a-form-item label="Номер телефона" name="phone" class="ws-row__item">
            <a-input v-model:value="form.phone" size="large" placeholder="+7 (___) ___-__-__" />
          </a-form-item>
          <a-form-item label="Почта" name="email" class="ws-row__item">
            <a-input v-model:value="form.email" size="large" type="email" placeholder="sklad@dvfu.ru" />
          </a-form-item>
        </div>
      </a-form>
    </div>

    <div v-if="current" class="ws-card">
      <TmcWarehouseChannels :warehouse="current" />
    </div>

    <div class="ws-card">
      <TmcRuleTemplates />
    </div>
  </TmcDesktopLayout>
</template>

<style scoped>
.ws-intro {
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
  min-height: 66px;
}

.ws-breadcrumb :deep(.ant-breadcrumb-link),
.ws-breadcrumb :deep(.ant-breadcrumb-separator) {
  color: var(--tmc-text-tertiary);
}

.ws-title {
  margin: 0;
  font-size: 28px;
  line-height: 36px;
  font-weight: 700;
  color: #0d1321;
}

/* шапка блока: заголовок слева, своя кнопка редактирования справа (как у шаблонов) */
.ws-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.ws-card__title {
  margin: 0;
  font-size: 17px;
  line-height: 24px;
  font-weight: 700;
  color: var(--tmc-text);
}

/* в чтении строки плотнее стандартных 16 px отступа Descriptions */
.ws-read :deep(.ant-descriptions-row > td) {
  padding-bottom: 12px;
}

.ws-card__tools {
  display: flex;
  gap: 8px;
}

/* на всю ширину контента, как остальные белые блоки склада */
.ws-card {
  padding: 20px 24px;
  background: var(--tmc-bg-container);
  border-radius: 12px;
}

.ws-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.ws-row--3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.ws-row--contacts {
  margin-top: 16px;
}

.ws-row__item {
  min-width: 0;
}

@media (max-width: 767px) {
  .ws-breadcrumb {
    display: none;
  }

  .ws-title {
    font-size: 20px;
    line-height: 28px;
  }

  .ws-card {
    padding: 16px;
  }

  .ws-row,
  .ws-row--3 {
    grid-template-columns: 1fr;
    gap: 0;
  }

  .ws-row--contacts {
    margin-top: 0;
  }
}
</style>
