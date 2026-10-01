<script setup lang="ts">
import { EnvironmentOutlined } from '@ant-design/icons-vue'
import { ref, watch } from 'vue'
import { employeeRoleLabels, employeeRoles } from '@/composables/useCurrentWarehouse'
import { pickupPlaceLabel, type WarehouseSettings } from '@/mocks/tmc'

const props = defineProps<{
  open: boolean
  /** Можно ли закрыть без выбора: нельзя при входе, можно при смене склада из шапки */
  closable: boolean
  warehouses: WarehouseSettings[]
  currentId: number | null
  employeeId: number
}>()

const emit = defineEmits<{ select: [id: number]; close: [] }>()

const picked = ref<number | null>(props.currentId)

watch(
  () => props.open,
  (open) => {
    if (open) picked.value = props.currentId
  },
)

function rolesLabel(warehouse: WarehouseSettings): string {
  return employeeRoles(warehouse, props.employeeId)
    .map((role) => employeeRoleLabels[role])
    .join(', ')
}

function confirm() {
  if (picked.value !== null) emit('select', picked.value)
}
</script>

<template>
  <a-modal
    :open="open"
    title="Выберите склад"
    centered
    :closable="closable"
    :mask-closable="closable"
    :keyboard="closable"
    :width="480"
    @cancel="emit('close')"
  >
    <a-radio-group v-model:value="picked" class="wp-list">
      <!-- a-radio сам рендерит label, поэтому карточка — div с кликом по всей площади -->
      <div
        v-for="warehouse in warehouses"
        :key="warehouse.id"
        class="wp-item"
        :class="{ 'wp-item--active': picked === warehouse.id }"
        @click="picked = warehouse.id"
      >
        <a-radio :value="warehouse.id" class="wp-item__radio" />
        <span class="wp-item__body">
          <span class="wp-item__name">{{ warehouse.name }}</span>
          <span class="wp-item__place">
            <EnvironmentOutlined />
            {{ pickupPlaceLabel(warehouse) }}
          </span>
          <span v-if="rolesLabel(warehouse)" class="wp-item__role">{{ rolesLabel(warehouse) }}</span>
        </span>
      </div>
    </a-radio-group>

    <template #footer>
      <a-button v-if="closable" size="large" @click="emit('close')">Отмена</a-button>
      <a-button type="primary" size="large" :disabled="picked === null" @click="confirm">
        Продолжить
      </a-button>
    </template>
  </a-modal>
</template>

<style scoped>
.wp-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.wp-item {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}

.wp-item:hover {
  border-color: #2d82cf;
}

.wp-item--active {
  border-color: #2d82cf;
  background: #f0f7ff;
}

.wp-item__radio {
  margin-top: 2px;
}

.wp-item__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.wp-item__name {
  font-size: 15px;
  line-height: 20px;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.88);
}

.wp-item__place {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.65);
}

.wp-item__role {
  font-size: 12px;
  color: #2d82cf;
}
</style>
