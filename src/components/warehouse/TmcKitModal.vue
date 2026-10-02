<script setup lang="ts">
import { DeleteOutlined, ScanOutlined, UploadOutlined } from '@ant-design/icons-vue'
import { message, Modal, type FormInstance } from 'ant-design-vue'
import type { Rule } from 'ant-design-vue/es/form'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import TmcAddAdhocEquipment from './TmcAddAdhocEquipment.vue'
import TmcDurationInput from './TmcDurationInput.vue'
import TmcEquipmentScanner from './TmcEquipmentScanner.vue'
import TmcOverlayScroll from './TmcOverlayScroll.vue'
import TmcKitComposition from './TmcKitComposition.vue'
import type { ScanResult } from './scan'
import { useCurrentWarehouse } from '@/composables/useCurrentWarehouse'
import { useIsMobile } from '@/composables/useIsMobile'
import { useWarehouse, type KitInput } from '@/composables/useWarehouse'
import type { Employee, EquipmentUnit, TmcKit, TmcType } from '@/mocks/tmc'

const props = defineProps<{
  open: boolean
  /** Редактируемый комплект; null — форма создания */
  kit: TmcKit | null
  categories: string[]
  employees: Employee[]
  /** Единицы оборудования, доступные для этого комплекта */
  availableUnits: EquipmentUnit[]
}>()

const emit = defineEmits<{ close: []; submit: [payload: KitInput] }>()

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const isMobile = useIsMobile()
const { equipment, templates, unitById } = useWarehouse()
const modalBodyStyle = computed(() =>
  isMobile.value
    ? { maxHeight: 'calc(100vh - 128px)', overflowY: 'auto' as const }
    : // ПК: тело окна не прокручивается, каждая колонка скроллится сама (см. .km-col)
      { height: '70vh', overflow: 'hidden' as const },
)

interface FormState {
  type: TmcType
  /** Одна единица в нескольких экземплярах одной категории (иначе — одна уникальная) */
  multiple: boolean
  /** Единица оборудования для уникальной «одной единицы» */
  unitId: number | undefined
  name: string
  category: string | undefined
  description: string
  usageRules: string
  responsibleId: number | undefined
  image: string | undefined
  groups: KitInput['groups']
  /** Мин. и макс. срок аренды в минутах */
  minRental: number | undefined
  maxRental: number | undefined
}

const formRef = ref<FormInstance>()
const form = reactive<FormState>({
  type: 'single',
  multiple: false,
  unitId: undefined,
  name: '',
  category: undefined,
  description: '',
  usageRules: '',
  responsibleId: undefined,
  image: undefined,
  groups: [],
  minRental: undefined,
  maxRental: undefined,
})

const templateOptions = computed(() => templates.value.map((t) => ({ value: t.id, label: t.name })))
/** Селект шаблона — только действие «подставить», после выбора снова пустой */
const templatePick = ref<number>()

/** Шаблон дописывается в правила использования; дальше текст можно править вручную */
function applyTemplate(id: unknown) {
  const template = templates.value.find((t) => t.id === id)
  if (template) {
    const current = form.usageRules.trim()
    if (!current.includes(template.text)) {
      form.usageRules = current ? `${current}\n\n${template.text}` : template.text
    }
  }
  nextTick(() => {
    templatePick.value = undefined
  })
}

const rentalError = computed(() =>
  form.minRental !== undefined && form.maxRental !== undefined && form.minRental > form.maxRental
    ? 'Минимальный срок больше максимального'
    : '',
)
const groupsError = ref('')
const scanning = ref(false)
const unitSearch = ref('')
const addingAdhocUnit = ref(false)

const isEdit = computed(() => props.kit !== null)
const categoryOptions = computed(() => props.categories.map((value) => ({ value })))
/** Ответственным можно выбрать управляющего или старшего администратора текущего склада */
const { current: currentWarehouse } = useCurrentWarehouse()

const responsibleOptions = computed(() => {
  const warehouse = currentWarehouse.value
  const nameOf = (id: number) => props.employees.find((e) => e.id === id)?.name ?? '—'
  const managers = warehouse?.managerIds ?? []
  // сотрудник с обеими ролями показан один раз — среди управляющих
  const seniors = (warehouse?.seniorAdminIds ?? []).filter((id) => !managers.includes(id))
  const groups = [
    { label: 'Управляющие', options: managers.map((id) => ({ value: id, label: nameOf(id) })) },
    { label: 'Старшие администраторы', options: seniors.map((id) => ({ value: id, label: nameOf(id) })) },
  ].filter((group) => group.options.length)
  // ответственный, сохранённый раньше и уже не входящий в роли склада, остаётся в списке
  const saved = props.kit?.responsibleId
  const listed = [...managers, ...seniors]
  if (saved !== undefined && !listed.includes(saved)) {
    groups.push({ label: 'Назначен ранее', options: [{ value: saved, label: nameOf(saved) }] })
  }
  return groups
})
const unitOptions = computed(() =>
  // label — для поиска и выбранного значения, name и code — для двух строк в выпадающем списке
  props.availableUnits.map((u) => ({ value: u.id, label: `${u.name} · ${u.code}`, name: u.name, code: u.code })),
)

const rules: Record<string, Rule[]> = {
  name: [{ required: true, whitespace: true, message: 'Укажите наименование', trigger: 'blur' }],
  category: [{ required: true, message: 'Выберите категорию', trigger: 'change' }],
  responsibleId: [{ required: true, type: 'number', message: 'Выберите ответственного', trigger: 'change' }],
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    form.type = props.kit?.type ?? 'single'
    form.multiple = props.kit?.type === 'single' && !!props.kit.multiple
    form.unitId =
      props.kit?.type === 'single' && !props.kit.multiple ? props.kit.groups[0]?.unitIds[0] : undefined
    form.name = props.kit?.name ?? ''
    form.category = props.kit?.category
    form.description = props.kit?.description ?? ''
    form.usageRules = props.kit?.usageRules ?? ''
    form.responsibleId = props.kit?.responsibleId
    form.image = props.kit?.image
    form.groups = props.kit
      ? props.kit.groups.map((g) => ({ id: g.id, name: g.name, unitIds: [...g.unitIds] }))
      : []
    form.minRental = props.kit?.minRentalMinutes
    form.maxRental = props.kit?.maxRentalMinutes
    groupsError.value = ''
    scanning.value = false
    unitSearch.value = ''
    formRef.value?.clearValidate()
    initialState = formState()
  },
)

/**
 * Снимок заполненных полей: пустые группы не считаем — в режиме комплекта и экземпляров форма
 * сама заводит одну пустую группу, а это ещё не ввод пользователя.
 */
function formState(): string {
  return JSON.stringify({
    type: form.type,
    multiple: form.multiple,
    unitId: form.unitId,
    name: form.name,
    category: form.category,
    description: form.description,
    usageRules: form.usageRules,
    responsibleId: form.responsibleId,
    image: form.image,
    groups: form.groups.filter((g) => g.name.trim() || g.unitIds.length).map((g) => [g.name, g.unitIds]),
    minRental: form.minRental,
    maxRental: form.maxRental,
  })
}

let initialState = ''

/** Закрытие окна: если в форме есть несохранённые изменения, сначала спрашиваем */
function requestClose() {
  if (formState() === initialState) {
    emit('close')
    return
  }
  Modal.confirm({
    title: 'Закрыть без сохранения?',
    okText: 'Закрыть',
    cancelText: 'Продолжить',
    centered: true,
    onOk: () => emit('close'),
  })
}
watch(
  () => [form.groups, form.type, form.multiple, form.unitId],
  () => {
    groupsError.value = ''
  },
  { deep: true },
)

/** Несколько экземпляров одной единицы: состав — одна группа взаимозаменяемых единиц */
const copiesMode = computed(() => form.type === 'single' && form.multiple)

// Переключение вида не теряет выбранное: уникальная единица становится первым экземпляром и обратно,
// а из комплекта в экземпляры переходит только первая группа
watch(
  () => [form.type, form.multiple] as const,
  ([type, multiple], [prevType, prevMultiple]) => {
    if (!props.open) return
    const wasUnique = prevType === 'single' && !prevMultiple
    if (type === 'single' && multiple) {
      if (wasUnique && form.unitId !== undefined && !form.groups.some((g) => g.unitIds.length)) {
        const unit = unitById(form.unitId)
        form.groups = [{ id: 1, name: unit?.name ?? '', unitIds: [form.unitId] }]
      } else if (form.groups.length > 1) {
        form.groups = form.groups.slice(0, 1)
      }
    } else if (type === 'single' && form.unitId === undefined) {
      form.unitId = form.groups[0]?.unitIds[0]
    } else if (type === 'kit' && wasUnique && form.unitId !== undefined && !form.groups.length) {
      const unit = unitById(form.unitId)
      form.groups = [{ id: 1, name: unit?.name ?? '', unitIds: [form.unitId] }]
    }
  },
)

// первый экземпляр подставляет пустые название и категорию — как выбор уникальной единицы
watch(
  () => form.groups[0]?.unitIds[0],
  (firstId) => {
    if (!copiesMode.value || firstId === undefined) return
    const unit = unitById(firstId)
    if (unit) onUnitChange(unit)
  },
)

function validateGroups(): string {
  if (copiesMode.value) {
    const total = form.groups.reduce((sum, g) => sum + g.unitIds.length, 0)
    return total === 0 ? 'Добавьте хотя бы один экземпляр' : ''
  }
  if (form.type === 'single') return form.unitId === undefined ? 'Выберите оборудование' : ''
  if (form.groups.length === 0) return 'Добавьте в комплект хотя бы одну группу'
  if (form.groups.some((g) => !g.name.trim())) return 'Укажите название каждой группы'
  if (form.groups.some((g) => g.unitIds.length === 0)) return 'В каждой группе выберите оборудование'
  return ''
}

/** Выбрали единицу: пустые название и категория подставляются из неё */
function onUnitChange(unit?: EquipmentUnit) {
  const picked = unit ?? props.availableUnits.find((u) => u.id === form.unitId)
  if (!picked) return
  if (!form.name.trim()) form.name = picked.name
  if (form.category === undefined) form.category = picked.category
}

/** Скан или ввод кода для типа «одна единица»: код должен принадлежать свободному оборудованию */
function pickUnitByCode(raw: string): ScanResult {
  const code = raw.trim()
  const unit = equipment.value.find((u) => u.code === code)
  if (!unit) return { kind: 'wrong', text: `Оборудование с кодом ${code} не найдено` }
  if (!props.availableUnits.some((u) => u.id === unit.id)) {
    return { kind: 'wrong', text: `${unit.name} недоступно: уже в комплекте, заявке или выдано` }
  }
  form.unitId = unit.id
  onUnitChange(unit)
  return { kind: 'ok', text: `Выбрано: ${unit.name} · ${unit.code}` }
}

/** Оборудования нет в реестре ОС: создаём его и сразу выбираем для уникальной единицы */
function onAdhocUnitCreated(units: EquipmentUnit[]) {
  addingAdhocUnit.value = false
  const [unit] = units
  if (!unit) return
  form.unitId = unit.id
  onUnitChange(unit)
}

/** Enter в поиске: ручной сканер штрихкодов вводит код и жмёт Enter */
function onUnitKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter') return
  const code = unitSearch.value.trim()
  if (!props.availableUnits.some((u) => u.code === code)) return
  pickUnitByCode(code)
  unitSearch.value = ''
}

function beforeUpload(file: File) {
  if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
    message.error('Подходят только изображения JPG и PNG')
    return false
  }
  if (file.size > MAX_IMAGE_BYTES) {
    message.error('Размер изображения не должен превышать 5 МБ')
    return false
  }
  const reader = new FileReader()
  reader.onload = () => {
    form.image = typeof reader.result === 'string' ? reader.result : undefined
  }
  reader.readAsDataURL(file)
  return false
}

/** Одна единица — единственная группа: из одной единицы или, в режиме экземпляров, из N */
function buildGroups(): KitInput['groups'] {
  if (form.type === 'kit') return form.groups
  if (copiesMode.value) {
    return form.groups.slice(0, 1).map((g) => ({ ...g, name: g.name.trim() || form.name }))
  }
  const unit = props.availableUnits.find((u) => u.id === form.unitId)
  const id = props.kit?.groups[0]?.id ?? 1
  return [{ id, name: unit?.name ?? form.name, unitIds: form.unitId === undefined ? [] : [form.unitId] }]
}

async function submit() {
  let formValid = true
  try {
    await formRef.value?.validate()
  } catch {
    formValid = false
  }
  groupsError.value = validateGroups()
  if (
    !formValid ||
    groupsError.value ||
    rentalError.value ||
    form.category === undefined ||
    form.responsibleId === undefined
  ) {
    return
  }
  emit('submit', {
    type: form.type,
    multiple: form.type === 'single' ? form.multiple : undefined,
    name: form.name,
    category: form.category,
    description: form.description,
    usageRules: form.usageRules,
    responsibleId: form.responsibleId,
    image: form.image,
    groups: buildGroups(),
    minRentalMinutes: form.minRental,
    maxRentalMinutes: form.maxRental,
  })
}
</script>

<template>
  <a-modal
    :open="open"
    :title="isEdit ? 'Редактировать ТМЦ' : 'Добавить ТМЦ'"
    :width="isMobile ? '100%' : 1100"
    :centered="!isMobile"
    :wrap-class-name="isMobile ? 'km km-mobile' : 'km'"
    destroy-on-close
    :body-style="modalBodyStyle"
    @cancel="requestClose"
  >
    <div class="km-columns">
      <section class="km-col">
        <h3 class="km-col__title">Основная информация</h3>
        <TmcOverlayScroll class="km-col__scroll">
        <a-form ref="formRef" :model="form" :rules="rules" layout="vertical" @finish="submit">
          <a-form-item label="Наименование ТМЦ" name="name">
            <a-input v-model:value="form.name" placeholder="Например, Набор для презентаций" />
          </a-form-item>
          <a-form-item label="Категория" name="category">
            <a-select
              v-model:value="form.category"
              placeholder="Выберите категорию"
              :options="categoryOptions"
            />
          </a-form-item>
          <a-form-item label="Описание" name="description">
            <a-textarea
              v-model:value="form.description"
              :rows="3"
              :maxlength="1000"
              show-count
              placeholder="Кратко опишите ТМЦ: что входит, для чего подходит"
            />
          </a-form-item>
          <a-form-item label="Правила использования" name="usageRules">
            <a-form-item-rest>
              <a-select
                v-model:value="templatePick"
                placeholder="Подставить шаблон правил использования"
                :options="templateOptions"
                :not-found-content="'Шаблонов нет — добавьте их в настройках склада'"
                class="km-template"
                @change="applyTemplate"
              />
            </a-form-item-rest>
            <a-textarea
              v-model:value="form.usageRules"
              :rows="4"
              :maxlength="2000"
              show-count
              placeholder="Как пользоваться ТМЦ, что запрещено, в каком виде вернуть"
            />
          </a-form-item>
          <a-form-item label="Ответственный" name="responsibleId">
            <a-select
              v-model:value="form.responsibleId"
              allow-clear
              placeholder="Выберите ответственного"
              :options="responsibleOptions"
            />
          </a-form-item>
          <a-form-item
            label="Срок аренды"
            :validate-status="rentalError ? 'error' : undefined"
            :help="rentalError || undefined"
          >
            <a-form-item-rest>
              <div class="km-rental">
                <span class="km-rental__label">Минимальный</span>
                <TmcDurationInput v-model:value="form.minRental" :status="rentalError ? 'error' : undefined" />
                <span class="km-rental__label">Максимальный</span>
                <TmcDurationInput v-model:value="form.maxRental" :status="rentalError ? 'error' : undefined" />
              </div>
            </a-form-item-rest>
          </a-form-item>
          <a-form-item label="Изображение" name="image">
            <div class="km-image">
              <div v-if="form.image" class="km-image__preview">
                <img :src="form.image" alt="Изображение ТМЦ" class="km-image__img" />
                <a-button
                  type="primary"
                  shape="circle"
                  size="small"
                  danger
                  class="km-image__remove"
                  aria-label="Удалить изображение"
                  @click="form.image = undefined"
                >
                  <template #icon><DeleteOutlined /></template>
                </a-button>
              </div>
              <div class="km-image__upload">
                <a-upload
                  accept="image/png,image/jpeg"
                  :show-upload-list="false"
                  :multiple="false"
                  :before-upload="beforeUpload"
                >
                  <a-button>
                    <template #icon><UploadOutlined /></template>
                    {{ form.image ? 'Заменить изображение' : 'Загрузить изображение' }}
                  </a-button>
                </a-upload>
                <span class="km-image__hint">JPG, PNG до 5 МБ</span>
              </div>
            </div>
          </a-form-item>
        </a-form>
        </TmcOverlayScroll>
      </section>

      <a-divider type="vertical" class="km-divider" />

      <section class="km-col">
        <!-- тип определяет, что ниже: оборудование, экземпляры или состав комплекта; правил нет — отдельная форма для подписи -->
        <h3 class="km-col__title">{{ form.type === 'kit' ? 'Состав комплекта' : 'Оборудование' }}</h3>
        <TmcOverlayScroll class="km-col__scroll">
        <a-form layout="vertical">
          <a-form-item label="Тип">
            <a-radio-group v-model:value="form.type" button-style="solid" class="km-type">
              <a-radio-button value="single">Одно ТМЦ</a-radio-button>
              <a-radio-button value="kit">Комплект ТМЦ</a-radio-button>
            </a-radio-group>
          </a-form-item>
          <a-form-item v-if="form.type === 'single'" label="Количество">
            <a-radio-group v-model:value="form.multiple">
              <a-radio :value="false">Один экземпляр</a-radio>
              <a-radio :value="true">Несколько экземпляров</a-radio>
            </a-radio-group>
          </a-form-item>
        </a-form>

        <template v-if="form.type === 'kit' || copiesMode">
          <TmcKitComposition
            v-model:groups="form.groups"
            :available-units="availableUnits"
            :categories="props.categories"
            :error="groupsError"
            :copies-mode="copiesMode"
            :copies-category="form.category"
          />
        </template>
        <template v-else>
          <div class="km-unit-row">
            <a-select
              v-model:value="form.unitId"
              show-search
              allow-clear
              option-filter-prop="label"
              placeholder="Найдите по названию или коду"
              :options="unitOptions"
              :list-item-height="52"
              dropdown-class-name="km-unit-dropdown"
              :status="groupsError ? 'error' : undefined"
              class="km-unit"
              @change="() => onUnitChange()"
              @search="unitSearch = $event"
              @input-key-down="onUnitKeydown"
            >
              <template #option="{ name, code }">
                <div class="km-unit-option__name">{{ name }}</div>
                <div class="km-unit-option__code">{{ code }}</div>
              </template>
              <template #notFoundContent>Нет свободного оборудования</template>
            </a-select>
            <a-button @click="scanning = true">
              <template #icon><ScanOutlined /></template>
              Сканировать
            </a-button>
          </div>
          <div v-if="groupsError" class="km-unit__error" role="alert">{{ groupsError }}</div>
          <div class="km-adhoc">
            <span class="km-adhoc__text">Оборудование не стоит на учёте?</span>
            <a-button type="link" class="km-adhoc__link" @click="addingAdhocUnit = true">Добавить</a-button>
          </div>
          <TmcEquipmentScanner
            v-if="scanning"
            close-on-ok
            :handler="pickUnitByCode"
            @close="scanning = false"
          />
          <TmcAddAdhocEquipment
            :open="addingAdhocUnit"
            :categories="props.categories"
            @close="addingAdhocUnit = false"
            @created="onAdhocUnitCreated"
          />
        </template>
        </TmcOverlayScroll>
      </section>
    </div>

    <template #footer>
      <div class="km-footer">
        <a-button :block="isMobile" @click="requestClose">Отмена</a-button>
        <a-button type="primary" :block="isMobile" @click="submit">
          {{ isEdit ? 'Сохранить' : 'Создать ТМЦ' }}
        </a-button>
      </div>
    </template>
  </a-modal>
</template>

<style scoped>
.km-columns {
  display: flex;
  align-items: stretch;
  gap: 16px;
  height: 100%;
}

/* левая и правая части прокручиваются независимо друг от друга */
.km-col {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  height: 100%;
}

/* заголовок колонки зафиксирован, прокручивается только содержимое под ним */
.km-col__scroll {
  flex: 1;
  min-height: 0;
}

/* полоса прокрутки занимает свою дорожку справа и не заходит на поля и подписи */
.km-col__scroll :deep(.os__viewport > div) {
  padding-right: 14px;
}

/* второй уровень: подзаголовки колонок ниже заголовка окна */
.km-col__title {
  margin: 0 0 12px;
  font-size: 16px;
  line-height: 24px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
}

.km-type {
  display: flex;
}

.km-type :deep(.ant-radio-button-wrapper) {
  flex: 1;
  text-align: center;
}

.km-template {
  width: 100%;
  margin-bottom: 8px;
}

.km-rental {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 8px 12px;
}

.km-rental__label {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.65);
}

.km-unit-row {
  display: flex;
  gap: 8px;
}

.km-unit {
  flex: 1;
  min-width: 0;
}

.km-unit__error {
  margin-top: 4px;
  color: #ff4d4f;
}

/* «Оборудование не стоит на учёте?» + «Добавить» — заводит оборудование не из реестра ОС */
.km-adhoc {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}

.km-adhoc__text {
  color: rgba(0, 0, 0, 0.65);
}

/* ссылка вплотную к вопросу, без собственных отступов кнопки */
.km-adhoc__link {
  height: auto;
  padding: 0;
}

.km-divider {
  height: auto;
  margin: 0;
}

.km-image {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.km-image__preview {
  position: relative;
  flex: none;
  width: 130px;
  height: 130px;
  overflow: hidden;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
}

.km-image__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.km-image__remove {
  position: absolute;
  top: 6px;
  right: 6px;
}

/* загрузка кнопкой, без перетаскивания: кнопка и ограничения формата под ней */
.km-image__upload {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.km-image__hint {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}

.km-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 767px) {
  .km-columns {
    flex-direction: column;
    gap: 8px;
  }

  .km-divider {
    display: none;
  }

  /* на телефоне колонки друг под другом, прокручивается всё окно целиком */
  .km-columns,
  .km-col {
    height: auto;
  }

  .km-col__scroll {
    flex: none;
  }

  .km-col__scroll :deep(.os__viewport > div) {
    padding-right: 0;
  }

  .km-image {
    flex-direction: column;
  }

  .km-rental {
    grid-template-columns: 1fr;
  }

  .km-image__preview {
    width: 100%;
    height: 180px;
  }
}
</style>

<style>
/* выбор оборудования: название и код на разных строках (выпадающий список вне scoped-области) */
.km-unit-dropdown .ant-select-item-option-content {
  white-space: normal;
}

.km-unit-option__name {
  line-height: 22px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
}

.km-unit-option__code {
  font-size: 13px;
  line-height: 18px;
  color: rgba(0, 0, 0, 0.45);
}

/* первый уровень заголовков: название окна крупнее подзаголовков колонок (16px) */
.km .ant-modal-title {
  font-size: 20px;
  line-height: 28px;
  font-weight: 700;
}

/* модал — на весь экран на телефоне; порталы вне scoped-области */
.km-mobile .ant-modal {
  top: 0;
  max-width: 100%;
  margin: 0;
  padding-bottom: 0;
}

.km-mobile .ant-modal-content {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  border-radius: 0;
}

.km-mobile .ant-modal-body {
  flex: 1;
}
</style>
