<script setup lang="ts">
import { message } from 'ant-design-vue'
import { ref, watch } from 'vue'
import TmcKitModal, { type UnitStatusChange } from './TmcKitModal.vue'
import { useWarehouse, type KitInput } from '@/composables/useWarehouse'
import type { TmcKit } from '@/mocks/tmc'

/**
 * Карточка ТМЦ в дровере — как из реестра: открывается на просмотр, «Изменить» переводит в правку.
 * Нужна на экранах, где ТМЦ только упоминается (например, заявки), без самого реестра.
 */
const props = defineProps<{ kit: TmcKit | null }>()
const emit = defineEmits<{ close: [] }>()

const { employees, categories, availableUnitsFor, updateKit, setUnitStatus } = useWarehouse()

// держим последнее ТМЦ, чтобы дровер не превращался в окно создания во время анимации закрытия
const shown = ref<TmcKit | null>(props.kit)
watch(
  () => props.kit,
  (kit) => {
    if (kit) shown.value = kit
  },
)

function submit(payload: KitInput, statusChanges: UnitStatusChange[]) {
  if (!shown.value) return
  updateKit(shown.value.id, payload)
  statusChanges.forEach((change) => setUnitStatus(change.unitId, change.status, change.comment))
  message.success('Изменения сохранены')
  emit('close')
}
</script>

<template>
  <TmcKitModal
    :open="kit !== null"
    :kit="shown"
    :categories="categories"
    :employees="employees"
    :available-units="availableUnitsFor(shown?.id)"
    readonly
    @close="emit('close')"
    @submit="submit"
  />
</template>
