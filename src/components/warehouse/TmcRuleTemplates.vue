<script setup lang="ts">
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { message, type FormInstance } from 'ant-design-vue'
import type { Rule } from 'ant-design-vue/es/form'
import { computed, reactive, ref } from 'vue'
import { useWarehouse, type TemplateInput } from '@/composables/useWarehouse'
import type { UsageRuleTemplate } from '@/mocks/tmc'

/**
 * Шаблоны правил использования. Сначала только список; «Редактировать» открывает черновик:
 * добавление, правка и удаление меняют только его, «Сохранить» применяет всё разом, «Отменить» — отбрасывает.
 */
const { templates, addTemplate, updateTemplate, removeTemplate } = useWarehouse()

const editable = ref(false)
/** Черновик списка; у новых шаблонов отрицательный id, пока их не сохранили */
const draft = ref<UsageRuleTemplate[]>([])
let draftSeq = 0

const shown = computed(() => (editable.value ? draft.value : templates.value))

function startEdit() {
  draft.value = templates.value.map((t) => ({ ...t }))
  editable.value = true
}

function cancelEdit() {
  draft.value = []
  editable.value = false
}

function saveAll() {
  const keptIds = new Set(draft.value.map((t) => t.id))
  for (const t of [...templates.value]) {
    if (!keptIds.has(t.id)) removeTemplate(t.id)
  }
  for (const t of draft.value) {
    if (t.id < 0) {
      addTemplate(t)
      continue
    }
    const saved = templates.value.find((s) => s.id === t.id)
    if (saved && (saved.name !== t.name || saved.text !== t.text)) updateTemplate(t.id, t)
  }
  editable.value = false
  message.success('Шаблоны сохранены')
}

const modalOpen = ref(false)
const editing = ref<UsageRuleTemplate | null>(null)
const formRef = ref<FormInstance>()
const form = reactive<TemplateInput>({ name: '', text: '' })

const rules: Record<string, Rule[]> = {
  name: [{ required: true, whitespace: true, message: 'Укажите название шаблона', trigger: 'blur' }],
  text: [{ required: true, whitespace: true, message: 'Опишите правила использования', trigger: 'blur' }],
}

function openAdd() {
  editing.value = null
  form.name = ''
  form.text = ''
  modalOpen.value = true
  formRef.value?.clearValidate()
}

function openEdit(template: UsageRuleTemplate) {
  editing.value = template
  form.name = template.name
  form.text = template.text
  modalOpen.value = true
  formRef.value?.clearValidate()
}

async function save() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  const name = form.name.trim()
  const text = form.text.trim()
  if (editing.value) {
    Object.assign(editing.value, { name, text })
  } else {
    draftSeq -= 1
    draft.value.push({ id: draftSeq, name, text })
  }
  modalOpen.value = false
}

function remove(template: UsageRuleTemplate) {
  draft.value = draft.value.filter((t) => t.id !== template.id)
}
</script>

<template>
  <section class="rt">
    <header class="rt__head">
      <h2 class="rt__title">Шаблоны правил использования</h2>
      <div v-if="editable" class="rt__tools">
        <a-button @click="cancelEdit">Отменить</a-button>
        <a-button type="primary" @click="saveAll">Сохранить</a-button>
      </div>
      <a-button v-else @click="startEdit">
        <template #icon><EditOutlined /></template>
        Редактировать
      </a-button>
    </header>

    <a-button v-if="editable" type="dashed" block class="rt__add" @click="openAdd">
      <template #icon><PlusOutlined /></template>
      Добавить шаблон
    </a-button>

    <ul v-if="shown.length" class="rt__list">
      <li v-for="template in shown" :key="template.id" class="rt__item">
        <div class="rt__body">
          <div class="rt__name">{{ template.name }}</div>
          <p class="rt__text">{{ template.text }}</p>
        </div>
        <div v-if="editable" class="rt__actions">
          <a-button type="text" aria-label="Изменить шаблон" @click="openEdit(template)">
            <template #icon><EditOutlined /></template>
          </a-button>
          <!-- удаление в черновике обратимо «Отменить», поэтому без подтверждения -->
          <a-button type="text" danger aria-label="Удалить шаблон" @click="remove(template)">
            <template #icon><DeleteOutlined /></template>
          </a-button>
        </div>
      </li>
    </ul>
    <a-empty v-else description="Шаблонов пока нет" />

    <a-modal
      v-model:open="modalOpen"
      :title="editing ? 'Изменить шаблон' : 'Новый шаблон'"
      centered
      :ok-text="editing ? 'Изменить' : 'Добавить'"
      cancel-text="Отмена"
      @ok="save"
    >
      <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
        <a-form-item label="Название" name="name">
          <a-input v-model:value="form.name" size="large" placeholder="Например, Электроника" />
        </a-form-item>
        <a-form-item label="Правила использования" name="text">
          <a-textarea
            v-model:value="form.text"
            :rows="6"
            :maxlength="1000"
            show-count
            placeholder="Как пользоваться ТМЦ, что запрещено, в каком виде вернуть"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </section>
</template>

<style scoped>
/* шапка как у блока «Основное»: заголовок слева, кнопки справа */
.rt__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.rt__title {
  margin: 0;
  font-size: 17px;
  line-height: 24px;
  font-weight: 700;
  color: var(--tmc-text);
}

.rt__tools {
  display: flex;
  gap: 8px;
}

/* primary dashed: в ant-design-vue 4.2 нет color="primary" у dashed — красим токеном проекта */
.rt__add {
  margin-bottom: 8px;
  color: var(--tmc-primary);
  border-color: var(--tmc-primary);
}

.rt__add:hover,
.rt__add:focus-visible {
  color: var(--tmc-primary);
  border-color: var(--tmc-primary);
  background: #e6f1fb;
}

.rt__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rt__item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px;
  background: var(--tmc-bg-layout);
  border-radius: 8px;
}

.rt__body {
  flex: 1;
  min-width: 0;
}

.rt__name {
  font-size: 14px;
  font-weight: 700;
  color: var(--tmc-text);
}

.rt__text {
  display: -webkit-box;
  margin: 4px 0 0;
  overflow: hidden;
  font-size: 13px;
  line-height: 18px;
  color: var(--tmc-text-secondary);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.rt__actions {
  display: flex;
  flex: none;
}

@media (max-width: 767px) {
  .rt__head {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
