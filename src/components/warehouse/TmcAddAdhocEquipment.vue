<script setup lang="ts">
import type { FormInstance } from 'ant-design-vue'
import type { Rule } from 'ant-design-vue/es/form'
import { reactive, ref, watch } from 'vue'
import { useWarehouse } from '@/composables/useWarehouse'
import type { EquipmentUnit } from '@/mocks/tmc'

/**
 * Оборудование не из реестра ОС: на учёт как основное средство не ставится, существует только
 * в реестре ТМЦ, чтобы его можно было выдавать. Доступно во всех типах ТМЦ.
 */
const props = defineProps<{
  open: boolean
  categories: string[]
  /** Можно сразу завести несколько одинаковых экземпляров (несколько экземпляров, комплект) */
  allowQuantity?: boolean
  /** Подставить категорию ТМЦ — для нескольких экземпляров она общая */
  defaultCategory?: string
}>()

const emit = defineEmits<{ close: []; created: [units: EquipmentUnit[]] }>()

const { addAdhocUnits } = useWarehouse()

const formRef = ref<FormInstance>()
const form = reactive({ name: '', category: '', quantity: 1 })

const rules: Record<string, Rule[]> = {
  name: [{ required: true, whitespace: true, message: 'Укажите наименование', trigger: 'blur' }],
  category: [{ required: true, whitespace: true, message: 'Укажите категорию', trigger: 'blur' }],
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    form.name = ''
    form.category = props.defaultCategory ?? ''
    form.quantity = 1
    formRef.value?.clearValidate()
  },
)

async function submit() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  const units = addAdhocUnits(
    { name: form.name, category: form.category },
    props.allowQuantity ? form.quantity : 1,
  )
  emit('created', units)
}
</script>

<template>
  <a-modal
    :open="open"
    title="Ручное добавление"
    :width="440"
    destroy-on-close
    @cancel="emit('close')"
  >
    <a-form ref="formRef" :model="form" :rules="rules" layout="vertical" @finish="submit">
      <a-form-item label="Наименование" name="name">
        <a-input v-model:value="form.name" size="large" placeholder="Например, Утюг" autofocus />
      </a-form-item>
      <a-form-item label="Категория" name="category">
        <a-auto-complete
          v-model:value="form.category"
          size="large"
          :options="categories.map((value) => ({ value }))"
          placeholder="Выберите или введите новую"
        />
      </a-form-item>
      <a-form-item v-if="allowQuantity" label="Количество экземпляров" name="quantity">
        <a-input-number v-model:value="form.quantity" size="large" :min="1" :max="50" :precision="0" />
      </a-form-item>
    </a-form>
    <template #footer>
      <a-space>
        <a-button @click="emit('close')">Отмена</a-button>
        <a-button type="primary" @click="submit">Добавить</a-button>
      </a-space>
    </template>
  </a-modal>
</template>
