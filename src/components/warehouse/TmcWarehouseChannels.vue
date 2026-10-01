<script setup lang="ts">
import { DeleteOutlined, EditOutlined, LinkOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { ref, watch } from 'vue'
import { useWarehouse } from '@/composables/useWarehouse'
import type { TmcChannel, WarehouseSettings } from '@/mocks/tmc'

/**
 * Каналы связи склада: ссылки на группы и чаты. Общие для всех ТМЦ склада — в карточку ТМЦ
 * у пользователя подтягиваются отсюда. Чтение — список ссылок; «Редактировать» открывает черновик,
 * «Сохранить» применяет его разом, «Отменить» — отбрасывает (как у шаблонов).
 */
const props = defineProps<{ warehouse: WarehouseSettings }>()

const { updateWarehouseChannels } = useWarehouse()

const URL_PATTERN = /^https?:\/\/\S+\.\S+$/i

const editable = ref(false)
const draft = ref<TmcChannel[]>([])
const error = ref('')

// сменили склад — показываем его каналы в режиме чтения
watch(
  () => props.warehouse.id,
  () => {
    editable.value = false
  },
)

function startEdit() {
  draft.value = props.warehouse.channels.map((c) => ({ ...c }))
  error.value = ''
  editable.value = true
}

function cancelEdit() {
  draft.value = []
  editable.value = false
}

function addChannel() {
  const id = draft.value.reduce((max, c) => Math.max(max, c.id), 0) + 1
  draft.value = [...draft.value, { id, title: '', url: '' }]
}

function removeChannel(channel: TmcChannel) {
  draft.value = draft.value.filter((c) => c.id !== channel.id)
}

function isInvalid(channel: TmcChannel): boolean {
  return !channel.title.trim() || !URL_PATTERN.test(channel.url.trim())
}

function save() {
  // полностью пустые строки просто отбрасываем
  const filled = draft.value.filter((c) => c.title.trim() || c.url.trim())
  if (filled.some(isInvalid)) {
    error.value = 'У каждого канала укажите название и ссылку, начиная с https://'
    return
  }
  updateWarehouseChannels(props.warehouse.id, filled)
  editable.value = false
  message.success('Каналы связи сохранены')
}
</script>

<template>
  <section class="wc">
    <header class="wc__head">
      <h2 class="wc__title">Каналы связи</h2>
      <div v-if="editable" class="wc__tools">
        <a-button @click="cancelEdit">Отменить</a-button>
        <a-button type="primary" @click="save">Сохранить</a-button>
      </div>
      <a-button v-else @click="startEdit">
        <template #icon><EditOutlined /></template>
        Редактировать
      </a-button>
    </header>

    <template v-if="editable">
      <a-button type="dashed" block class="wc__add" @click="addChannel">
        <template #icon><PlusOutlined /></template>
        Добавить канал
      </a-button>
      <div v-for="channel in draft" :key="channel.id" class="wc__row">
        <a-input
          v-model:value="channel.title"
          placeholder="Название, например «Чат склада»"
          :status="error && !channel.title.trim() ? 'error' : undefined"
          class="wc__name"
          @change="error = ''"
        />
        <a-input
          v-model:value="channel.url"
          placeholder="https://t.me/..."
          :status="error && !URL_PATTERN.test(channel.url.trim()) ? 'error' : undefined"
          class="wc__url"
          @change="error = ''"
        >
          <template #prefix><LinkOutlined class="wc__icon" /></template>
        </a-input>
        <a-button type="text" danger aria-label="Удалить канал" @click="removeChannel(channel)">
          <template #icon><DeleteOutlined /></template>
        </a-button>
      </div>
      <div v-if="error" class="wc__error" role="alert">{{ error }}</div>
    </template>

    <ul v-else-if="warehouse.channels.length" class="wc__list">
      <li v-for="channel in warehouse.channels" :key="channel.id" class="wc__item">
        <LinkOutlined class="wc__icon" />
        <span class="wc__item-name">{{ channel.title }}</span>
        <a :href="channel.url" target="_blank" rel="noopener noreferrer" class="wc__item-url">{{ channel.url }}</a>
      </li>
    </ul>
    <a-empty v-else description="Каналов пока нет" />
  </section>
</template>

<style scoped>
/* шапка как у блоков «Основное» и шаблонов: заголовок слева, кнопки справа */
.wc__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.wc__title {
  margin: 0;
  font-size: 17px;
  line-height: 24px;
  font-weight: 700;
  color: var(--tmc-text);
}

.wc__tools {
  display: flex;
  gap: 8px;
}

/* primary dashed — как «Добавить шаблон» */
.wc__add {
  margin-bottom: 8px;
  color: var(--tmc-primary);
  border-color: var(--tmc-primary);
}

.wc__add:hover,
.wc__add:focus-visible {
  color: var(--tmc-primary);
  border-color: var(--tmc-primary);
  background: #e6f1fb;
}

.wc__row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.wc__row + .wc__row {
  margin-top: 8px;
}

.wc__name {
  flex: 0 0 38%;
}

.wc__url {
  flex: 1;
  min-width: 0;
}

.wc__icon {
  color: var(--tmc-icon);
}

.wc__error {
  margin-top: 8px;
  color: #ff4d4f;
}

.wc__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.wc__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: var(--tmc-bg-layout);
  border-radius: 8px;
}

.wc__item-name {
  flex: none;
  font-weight: 700;
  color: var(--tmc-text);
}

.wc__item-url {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 767px) {
  .wc__head {
    flex-direction: column;
    align-items: flex-start;
  }

  .wc__row {
    flex-wrap: wrap;
  }

  .wc__name,
  .wc__url {
    flex: 1 1 100%;
  }

  .wc__item {
    flex-wrap: wrap;
  }
}
</style>
