import { computed, ref } from 'vue'
import { useWarehouse } from './useWarehouse'
import type { WarehouseSettings } from '@/mocks/tmc'

/** Последний выбранный склад — подставляется в окне выбора при следующем входе */
const LAST_KEY = 'tmc-current-warehouse'
/** Склад подтверждён в этой сессии — окно выбора больше не показывается до нового входа */
const SESSION_KEY = 'tmc-warehouse-confirmed'

function readStorage(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key)
  } catch {
    return null
  }
}

function writeStorage(storage: () => Storage, key: string, value: string) {
  try {
    storage().setItem(key, value)
  } catch {
    // хранилище недоступно (приватный режим) — выбор живёт до перезагрузки
  }
}

const savedId = Number(readStorage(() => localStorage, LAST_KEY))
const selectedId = ref<number | null>(Number.isFinite(savedId) && savedId > 0 ? savedId : null)
const confirmed = ref(readStorage(() => sessionStorage, SESSION_KEY) === '1')
const pickerOpen = ref(false)

export type EmployeeRole = 'manager' | 'seniorAdmin' | 'moderator'

export const employeeRoleLabels: Record<EmployeeRole, string> = {
  manager: 'Управляющий',
  seniorAdmin: 'Старший админ',
  moderator: 'Модератор',
}

/** Роли сотрудника на складе (справочно: права по ним не проверяются) */
export function employeeRoles(warehouse: WarehouseSettings, employeeId: number): EmployeeRole[] {
  const roles: EmployeeRole[] = []
  if (warehouse.managerIds.includes(employeeId)) roles.push('manager')
  if (warehouse.seniorAdminIds.includes(employeeId)) roles.push('seniorAdmin')
  if (warehouse.moderatorIds.includes(employeeId)) roles.push('moderator')
  return roles
}

/**
 * Текущий склад панели. Лёгкий каркас: выбор склада меняет название в шапке и открываемые настройки,
 * ТМЦ, заявки и журнал пока общие для всех складов.
 */
export function useCurrentWarehouse() {
  const { warehouses, currentEmployeeId } = useWarehouse()

  /** Склады, где у текущего сотрудника есть роль; если ролей нигде нет — все склады */
  const myWarehouses = computed(() => {
    const mine = warehouses.value.filter((w) => employeeRoles(w, currentEmployeeId).length > 0)
    return mine.length ? mine : warehouses.value
  })

  const current = computed<WarehouseSettings | null>(
    () => myWarehouses.value.find((w) => w.id === selectedId.value) ?? myWarehouses.value[0] ?? null,
  )

  /** Гейт при входе: складов больше одного, а в этой сессии склад ещё не выбран */
  const needsPicker = computed(
    () =>
      myWarehouses.value.length > 1 &&
      (!confirmed.value || !myWarehouses.value.some((w) => w.id === selectedId.value)),
  )

  function select(id: number) {
    selectedId.value = id
    confirmed.value = true
    pickerOpen.value = false
    writeStorage(() => localStorage, LAST_KEY, String(id))
    writeStorage(() => sessionStorage, SESSION_KEY, '1')
  }

  return {
    myWarehouses,
    current,
    needsPicker,
    pickerOpen,
    currentEmployeeId,
    openPicker: () => {
      pickerOpen.value = true
    },
    closePicker: () => {
      pickerOpen.value = false
    },
    select,
  }
}
