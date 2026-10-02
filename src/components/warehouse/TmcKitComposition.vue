<script setup lang="ts">
import { CloseOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { computed, ref, watch } from 'vue'
import TmcEquipmentPicker from './TmcEquipmentPicker.vue'
import { useWarehouse } from '@/composables/useWarehouse'
import type { EquipmentUnit, TmcGroup } from '@/mocks/tmc'

const props = defineProps<{
  /** Единицы оборудования, доступные для добавления в этот комплект */
  availableUnits: EquipmentUnit[]
  categories: string[]
  /** Сообщение об ошибке состава, показывается под списком групп */
  error?: string
  /**
   * Одна единица в нескольких экземплярах: ровно одна группа без возможности удалить/добавить
   * группу — только набор взаимозаменяемых единиц одной категории.
   */
  copiesMode?: boolean
  /** Категория ТМЦ: в режиме экземпляров подбираются только единицы этой категории */
  copiesCategory?: string
}>()

// группы — объекты из реактивного состояния модала, поля правятся на месте
const groups = defineModel<TmcGroup[]>('groups', { required: true })

const { unitById } = useWarehouse()

/** Единицы, не занятые в группах этого комплекта, — их можно добавить */
const freeUnits = computed(() => {
  const taken = new Set(groups.value.flatMap((g) => g.unitIds))
  return props.availableUnits.filter((u) => !taken.has(u.id))
})

const pickerGroupId = ref<number | null>(null)
const pickerGroup = computed(() => groups.value.find((g) => g.id === pickerGroupId.value) ?? null)

// в режиме экземпляров ровно одна группа существует всегда, имя — по первому экземпляру
// и в режиме комплекта форма стартует с одной пустой группой; удалили последнюю — появляется новая пустая
watch(
  () => [props.copiesMode, groups.value.length] as const,
  () => {
    if (groups.value.length === 0) groups.value = [{ id: 1, name: '', unitIds: [] }]
  },
  { immediate: true },
)

function unitsOf(group: TmcGroup): EquipmentUnit[] {
  return group.unitIds.map(unitById).filter((u): u is EquipmentUnit => u !== undefined)
}

function addGroup() {
  const id = groups.value.reduce((max, g) => Math.max(max, g.id), 0) + 1
  // новая группа — сверху списка, под кнопкой «Добавить группу»
  groups.value = [{ id, name: '', unitIds: [] }, ...groups.value]
}

function removeGroup(group: TmcGroup) {
  groups.value = groups.value.filter((g) => g.id !== group.id)
}

function addUnit(unitId: number) {
  const group = pickerGroup.value
  if (!group || group.unitIds.includes(unitId)) return
  group.unitIds.push(unitId)
  // пустое имя группы подставляется по первой добавленной единице
  if (!group.name.trim()) group.name = unitById(unitId)?.name ?? ''
}

function removeUnit(group: TmcGroup, unitId: number) {
  group.unitIds = group.unitIds.filter((id) => id !== unitId)
}

function openPicker(group: TmcGroup) {
  pickerGroupId.value = group.id
}

/** Категория экземпляров: категория ТМЦ, а если она ещё не выбрана — категория первого экземпляра */
const copiesCategory = computed(() => {
  if (props.copiesCategory) return props.copiesCategory
  const firstId = groups.value[0]?.unitIds[0]
  return firstId !== undefined ? unitById(firstId)?.category : undefined
})

/** В режиме экземпляров добавлять можно только оборудование той же категории */
const copiesFreeUnits = computed(() => {
  if (!props.copiesMode || !copiesCategory.value) return freeUnits.value
  return freeUnits.value.filter((u) => u.category === copiesCategory.value)
})
</script>

<template>
  <div class="kc">
    <!-- комплект: «Добавить группу» сверху, под выбором типа -->
    <div v-if="!copiesMode" class="kc__foot">
      <a-button type="dashed" block @click="addGroup">
        <template #icon><PlusOutlined /></template>
        Добавить группу
      </a-button>
    </div>

    <article v-for="group in groups" :key="group.id" class="kc__group">
      <!-- комплект: название группы и удаление, сразу под ними — добавление оборудования -->
      <div v-if="!copiesMode" class="kc__group-head">
        <a-input
          v-model:value="group.name"
          placeholder="Название группы, например «HDMI-кабель»"
          class="kc__name"
        />
        <!-- пустую группу удаляем сразу, а если в ней есть ТМЦ — после подтверждения -->
        <a-popconfirm
          v-if="group.unitIds.length"
          placement="topRight"
          title="Удалить группу?"
          ok-text="Удалить"
          cancel-text="Отмена"
          @confirm="removeGroup(group)"
        >
          <a-button type="text" danger aria-label="Удалить группу" class="kc__remove">
            <template #icon><DeleteOutlined /></template>
          </a-button>
        </a-popconfirm>
        <a-button v-else type="text" danger aria-label="Удалить группу" class="kc__remove" @click="removeGroup(group)">
          <template #icon><DeleteOutlined /></template>
        </a-button>
      </div>

      <a-button type="dashed" block class="kc__add-unit" @click="openPicker(group)">
        <template #icon><PlusOutlined /></template>
        {{ copiesMode ? 'Добавить экземпляры' : 'Добавить оборудование' }}
      </a-button>

      <ul v-if="group.unitIds.length" class="kc__units">
        <li v-for="unit in unitsOf(group)" :key="unit.id" class="kc__unit">
          <div class="kc__unit-text">
            <div class="kc__unit-name">{{ unit.name }}</div>
            <div class="kc__unit-code">{{ unit.code }}</div>
          </div>
          <!-- место для статуса единицы (в дровере редактирования) -->
          <slot name="unit-extra" :unit="unit" />
          <a-button
            type="text"
            size="small"
            aria-label="Убрать оборудование"
            class="kc__unit-remove"
            @click="removeUnit(group, unit.id)"
          >
            <template #icon><CloseOutlined /></template>
          </a-button>
          <!-- строка под единицей, например комментарий к статусу; пустая не занимает места -->
          <div class="kc__unit-below"><slot name="unit-below" :unit="unit" /></div>
        </li>
      </ul>

      <div v-if="copiesMode" class="kc__total">Количество: {{ group.unitIds.length }} шт.</div>
    </article>
    <div v-if="error" class="kc__error" role="alert">{{ error }}</div>

    <TmcEquipmentPicker
      :open="pickerGroup !== null"
      :group-name="pickerGroup?.name ?? ''"
      :units="copiesMode ? copiesFreeUnits : freeUnits"
      :selected-ids="pickerGroup?.unitIds ?? []"
      :categories="categories"
      :default-category="copiesMode ? copiesCategory : undefined"
      @add="addUnit"
      @close="pickerGroupId = null"
    />
  </div>
</template>

<style scoped>
.kc {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.kc__group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
}

.kc__group-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.kc__name {
  flex: 1;
  min-width: 0;
}

.kc__remove {
  flex: none;
}

.kc__units {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.kc__unit {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 12px;
  padding: 4px 4px 4px 12px;
  /* фон страницы (bg layout); модал вне каркаса склада, поэтому с запасным значением */
  background: var(--tmc-bg-layout, #f5f5f5);
  border-radius: 6px;
}

/* название и код друг под другом: названия бывают длинными */
.kc__unit-text {
  flex: 1;
  min-width: 0;
}

.kc__unit-name {
  font-weight: 600;
  line-height: 20px;
  color: var(--tmc-text);
  overflow-wrap: anywhere;
}

.kc__unit-code {
  font-size: 13px;
  line-height: 18px;
  color: var(--tmc-text-tertiary, rgba(0, 0, 0, 0.45));
  word-break: break-all;
}

.kc__unit-remove {
  flex: none;
  color: var(--tmc-icon);
}

.kc__unit-below {
  flex-basis: 100%;
  padding: 4px 8px 4px 0;
}

.kc__unit-below:empty {
  display: none;
}

.kc__add-unit {
  align-self: flex-start;
}

.kc__add-unit.ant-btn-block {
  align-self: stretch;
}

/* primary dashed: в ant-design-vue 4.2 нет color="primary" у dashed — красим токеном проекта;
   модал вне каркаса склада, поэтому с запасным значением */
.kc__add-unit.ant-btn-dashed,
.kc__add-unit.ant-btn-dashed:hover,
.kc__add-unit.ant-btn-dashed:focus-visible {
  color: var(--tmc-primary, #2d82cf);
  border-color: var(--tmc-primary, #2d82cf);
}

.kc__add-unit.ant-btn-dashed:hover,
.kc__add-unit.ant-btn-dashed:focus-visible {
  background: #e6f1fb;
}

.kc__total {
  color: var(--tmc-text-tertiary, rgba(0, 0, 0, 0.45));
}

.kc__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}




.kc__error {
  color: #ff4d4f;
}

@media (max-width: 767px) {
  .kc__add-unit {
    align-self: stretch;
  }
}
</style>
