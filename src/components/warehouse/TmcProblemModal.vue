<script setup lang="ts">
import { DeleteOutlined, UploadOutlined } from '@ant-design/icons-vue'
import { message, type FormInstance } from 'ant-design-vue'
import type { Rule } from 'ant-design-vue/es/form'
import { computed, reactive, ref, watch } from 'vue'
import type { ProblemInput } from '@/composables/useWarehouse'
import { problemTypeLabels, type ProblemType } from '@/mocks/tmc'

/** Позиция, у которой можно отметить проблему */
export interface ProblemUnitOption {
  id: number
  name: string
  code: string
}

const props = defineProps<{
  open: boolean
  units: ProblemUnitOption[]
  /** Единица, выбранная заранее (кнопка на строке ТМЦ); null — выбрать в окне */
  unitId: number | null
}>()

const emit = defineEmits<{ close: []; submit: [unitId: number, input: ProblemInput] }>()

const MAX_PHOTO_BYTES = 5 * 1024 * 1024

interface FormState {
  unitId: number | undefined
  type: ProblemType | undefined
  comment: string
  photo: string | undefined
}

const formRef = ref<FormInstance>()
const form = reactive<FormState>({ unitId: undefined, type: undefined, comment: '', photo: undefined })

const unitOptions = computed(() =>
  props.units.map((u) => ({ value: u.id, label: `${u.name} · ${u.code}` })),
)
const typeOptions = (Object.keys(problemTypeLabels) as ProblemType[]).map((value) => ({
  value,
  label: problemTypeLabels[value],
}))

const rules: Record<string, Rule[]> = {
  unitId: [{ required: true, type: 'number', message: 'Выберите ТМЦ', trigger: 'change' }],
  type: [{ required: true, message: 'Выберите тип проблемы', trigger: 'change' }],
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    form.unitId = props.unitId ?? (props.units.length === 1 ? props.units[0]!.id : undefined)
    form.type = undefined
    form.comment = ''
    form.photo = undefined
    formRef.value?.clearValidate()
  },
)

function beforeUpload(file: File) {
  if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
    message.error('Подходят только изображения JPG и PNG')
    return false
  }
  if (file.size > MAX_PHOTO_BYTES) {
    message.error('Размер изображения не должен превышать 5 МБ')
    return false
  }
  const reader = new FileReader()
  reader.onload = () => {
    form.photo = typeof reader.result === 'string' ? reader.result : undefined
  }
  reader.readAsDataURL(file)
  return false
}

async function submit() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  if (form.unitId === undefined || form.type === undefined) return
  emit('submit', form.unitId, { type: form.type, comment: form.comment, photo: form.photo })
}
</script>

<template>
  <a-modal :open="open" title="Проблема с ТМЦ" destroy-on-close centered @cancel="emit('close')">
    <p class="pm-hint">ТМЦ с отмеченной проблемой уходит на обслуживание, пока проблему не устранят.</p>
    <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
      <a-form-item label="ТМЦ" name="unitId">
        <a-select
          v-model:value="form.unitId"
          size="large"
          show-search
          option-filter-prop="label"
          placeholder="Выберите ТМЦ из заявки"
          :options="unitOptions"
        />
      </a-form-item>
      <a-form-item label="Тип проблемы" name="type">
        <a-select v-model:value="form.type" size="large" placeholder="Выберите тип" :options="typeOptions" />
      </a-form-item>
      <a-form-item label="Комментарий" name="comment">
        <a-textarea
          v-model:value="form.comment"
          :rows="3"
          :maxlength="500"
          show-count
          placeholder="Что именно случилось: где повреждение, чего не хватает"
        />
      </a-form-item>
      <a-form-item label="Фото" name="photo">
        <div v-if="form.photo" class="pm-photo">
          <img :src="form.photo" alt="Фото проблемы" class="pm-photo__img" />
          <a-button
            type="primary"
            shape="circle"
            size="small"
            danger
            class="pm-photo__remove"
            aria-label="Удалить фото"
            @click="form.photo = undefined"
          >
            <template #icon><DeleteOutlined /></template>
          </a-button>
        </div>
        <a-upload-dragger
          v-else
          accept="image/png,image/jpeg"
          :show-upload-list="false"
          :multiple="false"
          :before-upload="beforeUpload"
        >
          <p class="pm-drop__icon"><UploadOutlined /></p>
          <p class="pm-drop__text">Загрузить фото</p>
          <p class="pm-drop__hint">JPG, PNG до 5 МБ</p>
        </a-upload-dragger>
      </a-form-item>
    </a-form>

    <template #footer>
      <a-button size="large" @click="emit('close')">Отмена</a-button>
      <a-button type="primary" size="large" danger @click="submit">Отметить проблему</a-button>
    </template>
  </a-modal>
</template>

<style scoped>
.pm-hint {
  margin: 0 0 16px;
  font-size: 13px;
  line-height: 18px;
  color: rgba(0, 0, 0, 0.45);
}

.pm-photo {
  position: relative;
  height: 160px;
  overflow: hidden;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
}

.pm-photo__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pm-photo__remove {
  position: absolute;
  top: 6px;
  right: 6px;
}

.pm-drop__icon {
  margin: 0;
  font-size: 24px;
  color: #2d82cf;
}

.pm-drop__text {
  margin: 4px 0 0;
  color: #2d82cf;
}

.pm-drop__hint {
  margin: 0;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}
</style>
