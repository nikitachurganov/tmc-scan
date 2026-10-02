import { addDaysRu, datePart, formatRuDate } from '@/utils/date'

export interface TmcItem {
  id: number
  name: string
  category: string
  /** Инвентарный код ТМЦ, с которым сверяется введённый или отсканированный код */
  code: string
  scanned: boolean
  /** Подпись типа отмеченной проблемы; такую позицию не сканируют */
  problem?: string
}

export interface IssueRequest {
  id: number
  /** Человекочитаемый номер заявки (ZK-2024-0007); если не задан, показывается id */
  number?: string
  status: string
  fullName: string
  email: string
  pickup: string
  returnUntil: string
  place: string
  items: TmcItem[]
}

/**
 * Статус единицы оборудования. Основной путь: available → booked → in_use → available.
 * damaged и lost — исключения: проблема при возврате или единицу не вернули.
 */
export type EquipmentStatus = 'available' | 'booked' | 'in_use' | 'damaged' | 'lost'

/**
 * Источник единицы оборудования:
 * `asset` — заведена в реестре основных средств (штатный инвентарный учёт);
 * `adhoc` — добавлена кладовщиком «по месту», в реестре ОС её нет (например, утюг).
 */
export type EquipmentOrigin = 'asset' | 'adhoc'

/** Тип проблемы, которую кладовщик отмечает у единицы при выдаче или возврате */
export type ProblemType = 'damage' | 'malfunction' | 'missing_parts' | 'lost' | 'other'

export const problemTypeLabels: Record<ProblemType, string> = {
  damage: 'Механическое повреждение',
  malfunction: 'Неисправность',
  missing_parts: 'Не хватает комплектующих',
  lost: 'Утеряно',
  other: 'Другое',
}

/** Отметка проблемы: единица повреждена или утеряна, пока проблему не устранят */
export interface UnitProblem {
  type: ProblemType
  comment?: string
  /** Фото как data URL */
  photo?: string
  reportedAt: string
  reportedBy: string
}

/** Единица оборудования: уже есть в системе, код присвоен заранее */
export interface EquipmentUnit {
  id: number
  name: string
  category: string
  code: string
  status: EquipmentStatus
  origin: EquipmentOrigin
  problem?: UnitProblem
}

export interface Employee {
  id: number
  name: string
}

/** Сотрудник, от имени которого работает панель склада (сквозная авторизация не реализована) */
export const CURRENT_EMPLOYEE_ID = 2

/** Группа внутри комплекта: единицы оборудования, объединённые под одним именем */
export interface TmcGroup {
  id: number
  name: string
  unitIds: number[]
}

/** Канал связи склада: ссылка на группу или чат; в карточку ТМЦ у пользователя подтягивается со склада */
export interface TmcChannel {
  id: number
  title: string
  url: string
}

/**
 * ТМЦ бывает двух видов:
 * `single` — одна единица: уникальная (ровно одно оборудование) или в нескольких экземплярах
 *   (`multiple`: N взаимозаменяемых единиц одной категории, например утюги — при брони
 *   пользователь указывает только количество, конкретный экземпляр кладовщик выбирает при выдаче);
 * `kit` — комплект из разных групп оборудования.
 * В любом виде может быть оборудование не из реестра ОС (`EquipmentUnit.origin: 'adhoc'`).
 */
export type TmcType = 'single' | 'kit'

export const tmcTypeLabels: Record<TmcType, string> = {
  // «Оборудование» — а не «Одна единица»: такой ТМЦ бывает и в нескольких экземплярах
  single: 'Оборудование',
  kit: 'Комплект',
}

/** «Одна единица» / «Несколько экземпляров» / «Комплект» — для реестра */
export function tmcKindLabel(kit: Pick<TmcKit, 'type' | 'multiple'>): string {
  if (kit.type === 'kit') return tmcTypeLabels.kit
  return kit.multiple ? 'Несколько экземпляров' : tmcTypeLabels.single
}

/** ТМЦ — одна единица (уникальная или в нескольких экземплярах) или комплект из групп оборудования */
export interface TmcKit {
  id: number
  /** У одной единицы ровно одна группа: с одной единицей или, при `multiple`, с N экземплярами */
  type: TmcType
  /** Одна единица в нескольких взаимозаменяемых экземплярах одной категории */
  multiple?: boolean
  name: string
  category: string
  description: string
  /** Правила использования: отдельно от описания, заполняются вручную или из шаблона склада */
  usageRules: string
  responsibleId: number
  /** Изображение как data URL (загружено в модале) */
  image?: string
  groups: TmcGroup[]
  /** Минимальный и максимальный срок аренды в минутах; только хранится, бронь здесь не создаётся */
  minRentalMinutes?: number
  maxRentalMinutes?: number
}

/** Заготовленные правила использования: подставляются в правила использования при добавлении ТМЦ */
export interface UsageRuleTemplate {
  id: number
  name: string
  text: string
}

export const usageRuleTemplates: UsageRuleTemplate[] = [
  {
    id: 1,
    name: 'Электроника',
    text:
      'Использовать только по назначению и не передавать третьим лицам. Не оставлять включённым без присмотра. ' +
      'При неисправности сразу сообщить на склад, самостоятельно не ремонтировать. ' +
      'Вернуть в исходной комплектации — с зарядными устройствами и кабелями.',
  },
  {
    id: 2,
    name: 'Бытовая техника',
    text:
      'Использовать только в жилых комнатах общежития. Выключать из сети после использования. ' +
      'Перед возвратом очистить от загрязнений.',
  },
  {
    id: 3,
    name: 'Инструменты',
    text:
      'Работать в защитных очках и перчатках. Работы с несущими конструкциями — только по согласованию с комендантом. ' +
      'Вернуть с полным набором насадок и оснастки.',
  },
]

export const employees: Employee[] = [
  { id: 1, name: 'Петров Андрей Сергеевич' },
  { id: 2, name: 'Иванов Иван Иванович' },
  { id: 3, name: 'Смирнова Ольга Петровна' },
  { id: 4, name: 'Кузнецов Дмитрий Алексеевич' },
  { id: 5, name: 'Николаева Мария Викторовна' },
]

/** Комментарий к заявке или к ТМЦ внутри заявки: автор, дата, текст */
export interface RequestComment {
  id: number
  author: string
  createdAt: string
  text: string
}

/**
 * Статус заявки: Новая → На модерации → Подготовка → Готово к выдаче → В пользовании → Возвращено.
 * Невозвращено — ТМЦ так и не вернули; Отклонена — заявку отклонили до выдачи.
 */
export type RequestStatus =
  | 'Новая'
  | 'На модерации'
  | 'Подготовка'
  | 'Готово к выдаче'
  | 'В пользовании'
  | 'Возвращено'
  | 'Невозвращено'
  | 'Отклонена'

/** Статусы, с которыми заявка завершена и уходит из активных в журнал выдачи */
export const FINISHED_REQUEST_STATUSES: RequestStatus[] = ['Возвращено', 'Невозвращено', 'Отклонена']

/** Статусы до выдачи: единицы заявки забронированы */
export const PRE_ISSUE_REQUEST_STATUSES: RequestStatus[] = ['Новая', 'На модерации', 'Подготовка', 'Готово к выдаче']

/** Заявка/бронь виртуального склада. Список, в котором она показана, определяется статусом */
export interface WarehouseRequest {
  id: number
  number: string
  status: RequestStatus
  fullName: string
  email: string
  /** Время получения сегодня, «11:00» — для заявок к выдаче */
  time?: string
  /** Плановое начало пользования, «дд.мм.гггг чч:мм» */
  pickupPlannedAt: string
  /** Фактическая выдача, «дд.мм.гггг чч:мм»; null — ещё не выдана */
  pickupActualAt: string | null
  /** Плановое окончание (срок возврата), «дд.мм.гггг»; возврат до RETURN_DEADLINE_TIME */
  returnUntil: string
  /** Фактический возврат, «дд.мм.гггг чч:мм»; null — ещё не возвращена */
  returnActualAt: string | null
  place: string
  itemIds: number[]
  /** Позиции, которые не выдали при частичной выдаче; они свободны для других заявок */
  notIssuedIds: number[]
  /** Комментарий пользователя, оставленный при бронировании; склад его не редактирует */
  userComment?: string
  /** Причина отказа, которую указал склад при отклонении заявки */
  rejectReason?: string
  /** Обсуждение самой заявки: согласование, договорённости с пользователем */
  requestComments: RequestComment[]
  /** Заметки про состояние/особенности выдаваемого ТМЦ */
  itemComments: RequestComment[]
}

export const equipmentStatusLabels: Record<EquipmentStatus, string> = {
  available: 'Доступно',
  booked: 'Забронировано',
  in_use: 'В пользовании',
  damaged: 'Повреждено',
  lost: 'Утеряно',
}

export const equipmentOriginLabels: Record<EquipmentOrigin, string> = {
  asset: 'Основные средства',
  adhoc: 'Не в реестре ОС',
}

export const warehousePlace = 'Общежитие №7 · 101'

/** Время, до которого нужно вернуть ТМЦ в день срока возврата */
export const RETURN_DEADLINE_TIME = '18:00'

/** Запись журнала: одна выдача одной единицы оборудования, от выдачи до возврата */
export interface UsageLogEntry {
  id: number
  unitId: number
  unitName: string
  unitCode: string
  kitId: number | null
  kitName: string | null
  requestNumber: string
  userFullName: string
  userEmail: string
  issuedAt: string
  dueAt: string
  returnedAt: string | null
  /** Единицу не вернули: запись закрыта, но ТМЦ утеряно */
  lost?: boolean
  place: string
}

/**
 * Склад и его настройки. Роли — справочные списки сотрудников, права по ним не проверяются.
 * Старший администратор закреплён только за одним складом.
 */
export interface WarehouseSettings {
  id: number
  name: string
  managerIds: number[]
  seniorAdminIds: number[]
  moderatorIds: number[]
  /** Место выдачи: корпус и кабинет из `campusBuildings` */
  pickupBuilding: string
  pickupRoom: string
  phone: string
  email: string
  /** Каналы связи склада — общие для всех его ТМЦ, показываются пользователю в карточке ТМЦ */
  channels: TmcChannel[]
}

let itemSeq = 0

function makeItem(
  name: string,
  category: string,
  status: EquipmentStatus = 'available',
  origin: EquipmentOrigin = 'asset',
): EquipmentUnit {
  itemSeq += 1
  return {
    id: itemSeq,
    name,
    category,
    code: `12345678909876${String(itemSeq).padStart(3, '0')}`,
    status,
    origin,
  }
}

const CAT_ELECTRONICS = 'Электроника'
const CAT_HOUSEHOLD = 'Бытовой инвентарь'
const CAT_ELECTRIC = 'Электрика'
const CAT_MEDIA = 'Фото и видео'
const CAT_TOOLS = 'Инструменты'

type RequestSeed = {
  id: number
  status: RequestStatus
  fullName: string
  email: string
  time?: string
  returnUntil: string
  /** Даты «дд.мм.гггг чч:мм»; без них план и факт выводятся из статуса и срока возврата */
  plannedStart?: string
  actualStart?: string
  actualEnd?: string
  /** Комментарий пользователя к брони */
  userComment?: string
  /** Причина отказа для отклонённых заявок */
  rejectReason?: string
  items: [name: string, category: string][]
  /** [автор, дата, текст] */
  requestComments?: [author: string, createdAt: string, text: string][]
  itemComments?: [author: string, createdAt: string, text: string][]
}

const requestSeeds: RequestSeed[] = [
  // Новые заявки (12)
  { id: 12, status: 'Новая', fullName: 'Петрова Анна Сергеевна', email: 'petrova.as@dvfu.ru', returnUntil: '10.10.2026', userComment: 'Нужен для курсовой, желательно с зарядкой и мышкой.', items: [['Ноутбук', CAT_ELECTRONICS]] },
  { id: 11, status: 'Новая', fullName: 'Смирнова Елена Владимировна', email: 'smirnova.ev@dvfu.ru', returnUntil: '09.10.2026', userComment: 'Для презентации на семинаре в корпусе D.', items: [['Проектор', CAT_ELECTRONICS]] },
  { id: 10, status: 'На модерации', fullName: 'Кузнецов Максим Игоревич', email: 'kuznetsov.mi@dvfu.ru', returnUntil: '12.10.2026', userComment: 'Собрать шкаф в комнате 512.', items: [['Набор инструментов', CAT_TOOLS]] },
  { id: 9, status: 'Новая', fullName: 'Иванова Дарья Дмитриевна', email: 'ivanova.dd@dvfu.ru', returnUntil: '08.10.2026', items: [['Удлинитель', CAT_ELECTRIC]] },
  { id: 8, status: 'На модерации', fullName: 'Волков Роман Сергеевич', email: 'volkov.rs@dvfu.ru', returnUntil: '11.10.2026', items: [['Пылесос', CAT_HOUSEHOLD]] },
  { id: 13, status: 'Новая', fullName: 'Захарова Полина Андреевна', email: 'zakharova.pa@dvfu.ru', returnUntil: '13.10.2026', items: [['Утюг', CAT_HOUSEHOLD]] },
  { id: 14, status: 'Новая', fullName: 'Лебедев Артём Олегович', email: 'lebedev.ao@dvfu.ru', returnUntil: '14.10.2026', items: [['HDMI-кабель', CAT_ELECTRONICS]] },
  { id: 15, status: 'На модерации', fullName: 'Ефимова Ксения Павловна', email: 'efimova.kp@dvfu.ru', returnUntil: '15.10.2026', items: [['Штатив', CAT_MEDIA]] },
  { id: 16, status: 'Новая', fullName: 'Мельников Глеб Ильич', email: 'melnikov.gi@dvfu.ru', returnUntil: '16.10.2026', items: [['Дрель', CAT_TOOLS]] },
  { id: 17, status: 'Новая', fullName: 'Абрамова Вера Николаевна', email: 'abramova.vn@dvfu.ru', returnUntil: '17.10.2026', items: [['Фен', CAT_HOUSEHOLD]] },
  { id: 18, status: 'На модерации', fullName: 'Соколов Тимур Ринатович', email: 'sokolov.tr@dvfu.ru', returnUntil: '18.10.2026', items: [['Микрофон', CAT_MEDIA]] },
  { id: 19, status: 'Новая', fullName: 'Гусева Алина Романовна', email: 'guseva.ar@dvfu.ru', returnUntil: '19.10.2026', items: [['Планшет', CAT_ELECTRONICS]] },

  // К выдаче сегодня (8)
  {
    id: 7,
    status: 'Готово к выдаче',
    fullName: 'Сидоров Константин Александрович',
    email: 'sidorov.ka@dvfu.ru',
    time: '11:00',
    returnUntil: '05.10.2026',
    userComment: 'Съёмка студенческого концерта, заберу до начала пар.',
    items: [['Фотоаппарат', CAT_MEDIA], ['Штатив', CAT_MEDIA]],
    requestComments: [
      ['Николаева Мария Викторовна', '04.10.2026', 'Пользователь просил выдать пораньше, до 11:00 — договорились.'],
    ],
    itemComments: [
      ['Николаева Мария Викторовна', '04.10.2026', 'На фотоаппарате поцарапан бленда, но объектив исправен. Предупредить при выдаче.'],
    ],
  },
  { id: 6, status: 'Готово к выдаче', fullName: 'Морозова Анастасия Викторовна', email: 'morozova.av@dvfu.ru', time: '12:30', returnUntil: '06.10.2026', userComment: 'Запись подкаста, микрофон нужен с ветрозащитой.', items: [['Штатив', CAT_MEDIA], ['Удлинитель', CAT_ELECTRIC], ['Микрофон', CAT_MEDIA]] },
  { id: 3, status: 'Подготовка', fullName: 'Козлов Иван Петрович', email: 'kozlov.ip@dvfu.ru', time: '14:00', returnUntil: '07.10.2026', items: [['Проектор', CAT_ELECTRONICS]] },
  { id: 1, status: 'Подготовка', fullName: 'Новикова Екатерина Сергеевна', email: 'novikova.es@dvfu.ru', time: '16:00', returnUntil: '08.10.2026', items: [['Ноутбук', CAT_ELECTRONICS]] },
  { id: 20, status: 'Готово к выдаче', fullName: 'Романов Дмитрий Алексеевич', email: 'romanov.da@dvfu.ru', time: '17:00', returnUntil: '09.10.2026', items: [['Дрель', CAT_TOOLS], ['Набор инструментов', CAT_TOOLS]] },
  { id: 21, status: 'Подготовка', fullName: 'Федорова Мария Игоревна', email: 'fedorova.mi@dvfu.ru', time: '17:30', returnUntil: '10.10.2026', items: [['Утюг', CAT_HOUSEHOLD]] },
  { id: 22, status: 'Готово к выдаче', fullName: 'Ким Даниил Сергеевич', email: 'kim.ds@dvfu.ru', time: '18:00', returnUntil: '11.10.2026', items: [['Планшет', CAT_ELECTRONICS]] },
  { id: 23, status: 'Подготовка', fullName: 'Орлов Никита Владимирович', email: 'orlov.nv@dvfu.ru', time: '18:30', returnUntil: '12.10.2026', items: [['Пылесос', CAT_HOUSEHOLD]] },

  // Активные аренды (5)
  {
    id: 5,
    status: 'В пользовании',
    fullName: 'Алексеев Дмитрий Викторович',
    email: 'alekseev.dv@dvfu.ru',
    returnUntil: '27.04.2024',
    // выдали позже плана — факт начала подсвечивается
    actualStart: '24.04.2024 11:20',
    userComment: 'Снимаю видеоролик для конкурса факультета.',
    items: [['Видеокамера', CAT_MEDIA], ['Штатив', CAT_MEDIA]],
    itemComments: [
      ['Петров Андрей Сергеевич', '20.04.2024', 'Аккумулятор держит около часа, лучше выдавать с зарядкой.'],
    ],
  },
  { id: 4, status: 'В пользовании', fullName: 'Орлова Марина Сергеевна', email: 'orlova.ms@dvfu.ru', returnUntil: '26.04.2024', items: [['Набор инструментов', CAT_TOOLS]] },
  { id: 2, status: 'В пользовании', fullName: 'Белов Николай Андреевич', email: 'belov.na@dvfu.ru', returnUntil: '25.04.2024', items: [['Пылесос', CAT_HOUSEHOLD]] },
  { id: 24, status: 'В пользовании', fullName: 'Титова Ольга Юрьевна', email: 'titova.oy@dvfu.ru', returnUntil: '24.04.2024', items: [['Фен', CAT_HOUSEHOLD]] },
  { id: 25, status: 'В пользовании', fullName: 'Зайцев Павел Денисович', email: 'zaytsev.pd@dvfu.ru', returnUntil: '23.04.2024', items: [['Проектор', CAT_ELECTRONICS]] },

  // Возвращено / невозвращено / отклонена — для реестра заявок
  // вернули на два дня позже срока — факт окончания подсвечивается
  { id: 26, status: 'Возвращено', fullName: 'Гончарова Инна Витальевна', email: 'goncharova.iv@dvfu.ru', returnUntil: '20.09.2026', actualStart: '17.09.2026 09:50', actualEnd: '22.09.2026 12:00', items: [['Пылесос', CAT_HOUSEHOLD]] },
  { id: 28, status: 'Возвращено', fullName: 'Павлова Софья Андреевна', email: 'pavlova.sa@dvfu.ru', returnUntil: '25.09.2026', actualStart: '22.09.2026 10:00', actualEnd: '25.09.2026 16:40', items: [['Проектор', CAT_ELECTRONICS], ['HDMI-кабель', CAT_ELECTRONICS]] },
  { id: 29, status: 'Невозвращено', fullName: 'Крылов Станислав Андреевич', email: 'krylov.sa@dvfu.ru', returnUntil: '24.09.2026', actualStart: '21.09.2026 10:00', userComment: 'Нужен на выходные для съёмок.', items: [['Фотоаппарат', CAT_MEDIA]], requestComments: [['Николаева Мария Викторовна', '27.09.2026', 'Пользователь не пришёл на возврат и не отвечает, ТМЦ отмечено как утерянное.']] },
  { id: 27, status: 'Отклонена', fullName: 'Тарасов Егор Максимович', email: 'tarasov.em@dvfu.ru', returnUntil: '21.09.2026', rejectReason: 'Ноутбуки на эти даты уже забронированы другими заявками.', items: [['Ноутбук', CAT_ELECTRONICS]] },
]

/** Всего доступных ТМЦ на складе в начале сессии — число из макета */
const AVAILABLE_TOTAL = 124

const fillerCatalog: [name: string, category: string][] = [
  ['Ноутбук', CAT_ELECTRONICS],
  ['Проектор', CAT_ELECTRONICS],
  ['Планшет', CAT_ELECTRONICS],
  ['HDMI-кабель', CAT_ELECTRONICS],
  ['Утюг', CAT_HOUSEHOLD],
  ['Пылесос', CAT_HOUSEHOLD],
  ['Фен', CAT_HOUSEHOLD],
  ['Удлинитель', CAT_ELECTRIC],
  ['Сетевой фильтр', CAT_ELECTRIC],
  ['Фотоаппарат', CAT_MEDIA],
  ['Штатив', CAT_MEDIA],
  ['Микрофон', CAT_MEDIA],
  ['Дрель', CAT_TOOLS],
  ['Набор инструментов', CAT_TOOLS],
]

type KitSeed = {
  type?: TmcType
  /** Одна единица в нескольких экземплярах */
  multiple?: boolean
  name: string
  category: string
  description: string
  /** Название шаблона правил использования, текст которого подставлен в ТМЦ */
  rulesTemplate?: string
  responsibleId: number
  /** [имя группы и оборудования, число единиц] */
  groups: [name: string, count: number][]
  /** Мин. и макс. срок аренды в минутах */
  rental?: [min: number | undefined, max: number | undefined]
}

const kitSeeds: KitSeed[] = [
  {
    name: 'Набор для презентаций',
    category: CAT_ELECTRONICS,
    description: 'Проектор с кабелями для показа материалов в аудитории.',
    rulesTemplate: 'Электроника',
    responsibleId: 1,
    groups: [['Проектор', 1], ['HDMI-кабель', 3], ['Удлинитель', 1]],
    rental: [60, 3 * 24 * 60],
  },
  {
    name: 'Фотостудия',
    category: CAT_MEDIA,
    description: 'Камера, штатив и микрофон для съёмки мероприятий.',
    rulesTemplate: 'Электроника',
    responsibleId: 3,
    groups: [['Фотоаппарат', 1], ['Штатив', 1], ['Микрофон', 1]],
    rental: [2 * 60, 7 * 24 * 60],
  },
  {
    name: 'Набор мастера',
    category: CAT_TOOLS,
    description: 'Инструменты для мелкого ремонта в комнатах общежития.',
    rulesTemplate: 'Инструменты',
    responsibleId: 4,
    groups: [['Дрель', 1], ['Набор инструментов', 2]],
  },
  {
    name: 'Уборка комнаты',
    category: CAT_HOUSEHOLD,
    description: 'Пылесос с удлинителем для уборки.',
    rulesTemplate: 'Бытовая техника',
    responsibleId: 5,
    groups: [['Пылесос', 1], ['Удлинитель', 1]],
  },
  {
    name: 'Гладильный набор',
    category: CAT_HOUSEHOLD,
    description: 'Бытовой утюг и фен для повседневного использования.',
    responsibleId: 1,
    groups: [['Утюг', 1], ['Фен', 1]],
  },
  {
    // одна единица в нескольких экземплярах — из реестра ОС
    type: 'single',
    multiple: true,
    name: 'Планшеты для занятий',
    category: CAT_ELECTRONICS,
    description: 'Три одинаковых планшета для работы в группе.',
    responsibleId: 2,
    groups: [['Планшет', 3]],
  },
  {
    name: 'Ноутбук с аксессуарами',
    category: CAT_ELECTRONICS,
    description: 'Ноутбук с сетевым фильтром и HDMI-кабелем.',
    responsibleId: 2,
    groups: [['Ноутбук', 1], ['Сетевой фильтр', 1], ['HDMI-кабель', 1]],
  },
  {
    type: 'single',
    name: 'Пылесос Karcher',
    category: CAT_HOUSEHOLD,
    description: 'Моющий пылесос для генеральной уборки.',
    responsibleId: 5,
    groups: [['Пылесос', 1]],
  },
  {
    type: 'single',
    name: 'Дрель-шуруповёрт',
    category: CAT_TOOLS,
    description: 'Аккумуляторная дрель.',
    responsibleId: 4,
    groups: [['Дрель', 1]],
  },
  {
    name: 'Караоке-набор',
    category: CAT_MEDIA,
    description: 'Два микрофона, штатив и удлинитель для вечеринки.',
    responsibleId: 3,
    groups: [['Микрофон', 2], ['Штатив', 1], ['Удлинитель', 1]],
  },
  {
    // Одна единица в нескольких экземплярах; утюги не заведены в реестре основных средств
    type: 'single',
    multiple: true,
    name: 'Утюг',
    category: CAT_HOUSEHOLD,
    description:
      'Общий фонд бытовых утюгов. При бронировании пользователь указывает нужное количество, конкретный экземпляр выдаётся кладовщиком при выдаче.',
    rulesTemplate: 'Бытовая техника',
    responsibleId: 5,
    groups: [['Утюг', 6]],
    rental: [undefined, 3 * 60],
  },
]

/** Оборудование, которого нет в реестре основных средств: заводится «по месту», у пула утюгов */
const adhocUnitNames = new Set(['Утюг'])

function buildKits(items: EquipmentUnit[], reservedIds: Set<number>): TmcKit[] {
  const used = new Set(reservedIds)
  let groupSeq = 0
  return kitSeeds.map((seed, index) => ({
    id: index + 1,
    type: seed.type ?? 'kit',
    multiple: seed.multiple,
    name: seed.name,
    category: seed.category,
    description: seed.description,
    usageRules: usageRuleTemplates.find((t) => t.name === seed.rulesTemplate)?.text ?? '',
    responsibleId: seed.responsibleId,
    minRentalMinutes: seed.rental?.[0],
    maxRentalMinutes: seed.rental?.[1],
    groups: seed.groups.map(([name, count]) => {
      const unitIds = items
        .filter((i) => i.name === name && i.status === 'available' && !used.has(i.id))
        .slice(0, count)
        .map((i) => i.id)
      unitIds.forEach((id) => used.add(id))
      groupSeq += 1
      return { id: groupSeq, name, unitIds }
    }),
  }))
}

/** История выдач: несколько текущих (по заявкам «В пользовании») и завершённых записей для примера */
function buildLog(items: EquipmentUnit[], requests: WarehouseRequest[], kits: TmcKit[]): UsageLogEntry[] {
  const kitByUnit = new Map<number, TmcKit>()
  for (const kit of kits) {
    for (const group of kit.groups) {
      for (const unitId of group.unitIds) kitByUnit.set(unitId, kit)
    }
  }
  const entries: UsageLogEntry[] = []
  let seq = 0

  for (const request of requests) {
    if (!request.pickupActualAt) continue
    for (const itemId of request.itemIds) {
      const unit = items.find((i) => i.id === itemId)
      if (!unit) continue
      seq += 1
      const kit = kitByUnit.get(unit.id) ?? null
      entries.push({
        id: seq,
        unitId: unit.id,
        unitName: unit.name,
        unitCode: unit.code,
        kitId: kit?.id ?? null,
        kitName: kit?.name ?? null,
        requestNumber: request.number,
        userFullName: request.fullName,
        userEmail: request.email,
        issuedAt: datePart(request.pickupActualAt),
        dueAt: request.returnUntil,
        returnedAt: request.returnActualAt ? datePart(request.returnActualAt) : unit.status === 'lost' ? request.returnUntil : null,
        lost: unit.status === 'lost' ? true : undefined,
        place: request.place,
      })
    }
  }

  // несколько исторических записей для наглядности журнала склада
  const historic: [name: string, requestNumber: string, user: string, email: string, issuedAt: string, dueAt: string, returnedAt: string][] = [
    ['Утюг', 'ZK-2024-0090', 'Реброва Анна Юрьевна', 'rebrova.ay@dvfu.ru', '01.09.2026', '03.09.2026', '03.09.2026'],
    ['Проектор', 'ZK-2024-0091', 'Мельник Олег Сергеевич', 'melnik.os@dvfu.ru', '05.09.2026', '07.09.2026', '06.09.2026'],
    ['Пылесос', 'ZK-2024-0092', 'Юдина Кристина Игоревна', 'yudina.ki@dvfu.ru', '10.09.2026', '12.09.2026', '13.09.2026'],
  ]
  for (const [name, requestNumber, user, email, issuedAt, dueAt, returnedAt] of historic) {
    const unit = items.find((i) => i.name === name)
    if (!unit) continue
    seq += 1
    const kit = kitByUnit.get(unit.id) ?? null
    entries.push({
      id: seq,
      unitId: unit.id,
      unitName: unit.name,
      unitCode: unit.code,
      kitId: kit?.id ?? null,
      kitName: kit?.name ?? null,
      requestNumber,
      userFullName: user,
      userEmail: email,
      issuedAt,
      dueAt,
      returnedAt,
      place: warehousePlace,
    })
  }

  return entries
}

/** Справочник корпусов и кабинетов кампуса — место выдачи склада выбирается из него */
export interface CampusBuilding {
  name: string
  rooms: string[]
}

export const campusBuildings: CampusBuilding[] = [
  { name: 'Общежитие №7', rooms: ['101', 'Вахта, 1 этаж', 'Кладовая, цокольный этаж'] },
  { name: 'Общежитие №10', rooms: ['12', 'Вахта, 1 этаж'] },
  { name: 'Корпус A', rooms: ['Пункт выдачи, 2 этаж', 'A-310'] },
  { name: 'Корпус B', rooms: ['Кафедра, B-205', 'B-112'] },
  { name: 'Корпус D', rooms: ['Абонемент, 1 этаж', 'D-412', 'D-735'] },
  { name: 'Корпус G', rooms: ['Медиацентр, 3 этаж', 'G-401'] },
  { name: 'Спорткомплекс', rooms: ['Инвентарная', 'Тренерская'] },
]

/** «Корпус D · Абонемент, 1 этаж» — место выдачи склада одной строкой */
export function pickupPlaceLabel(warehouse: Pick<WarehouseSettings, 'pickupBuilding' | 'pickupRoom'>): string {
  return [warehouse.pickupBuilding, warehouse.pickupRoom].filter(Boolean).join(' · ')
}

/** Склады. Текущий сотрудник (CURRENT_EMPLOYEE_ID) состоит в двух из них — при входе выбирает склад */
export const warehouseSettingsList: WarehouseSettings[] = [
  {
    id: 1,
    name: 'Общежитие №7',
    managerIds: [1, 2],
    seniorAdminIds: [3],
    moderatorIds: [5],
    pickupBuilding: 'Общежитие №7',
    pickupRoom: '101',
    phone: '+7 (423) 265-24-29',
    email: 'sklad-obsh7@dvfu.ru',
    channels: [
      { id: 1, title: 'Чат склада', url: 'https://t.me/dvfu_obsh7_sklad' },
      { id: 2, title: 'Группа ВКонтакте', url: 'https://vk.com/dvfu_inventory' },
    ],
  },
  {
    id: 2,
    name: 'Общежитие №10',
    managerIds: [4],
    seniorAdminIds: [1],
    moderatorIds: [2],
    pickupBuilding: 'Общежитие №10',
    pickupRoom: '12',
    phone: '+7 (423) 265-24-31',
    email: 'sklad-obsh10@dvfu.ru',
    channels: [{ id: 1, title: 'Чат склада', url: 'https://t.me/dvfu_obsh10_sklad' }],
  },
  {
    id: 3,
    name: 'Корпус D · библиотека',
    managerIds: [4],
    seniorAdminIds: [5],
    moderatorIds: [3],
    pickupBuilding: 'Корпус D',
    pickupRoom: 'Абонемент, 1 этаж',
    phone: '+7 (423) 265-24-40',
    email: 'library-d@dvfu.ru',
    channels: [],
  },
]

let commentSeq = 0

function buildComments(seed?: [author: string, createdAt: string, text: string][]): RequestComment[] {
  return (seed ?? []).map(([author, createdAt, text]) => {
    commentSeq += 1
    return { id: commentSeq, author, createdAt, text }
  })
}

function buildWarehouseData() {
  itemSeq = 0
  commentSeq = 0
  const items: EquipmentUnit[] = []
  const today = formatRuDate(new Date())
  const requests: WarehouseRequest[] = requestSeeds.map((seed) => {
    const itemStatus: EquipmentStatus =
      seed.status === 'В пользовании'
        ? 'in_use'
        : seed.status === 'Невозвращено'
          ? 'lost'
          : PRE_ISSUE_REQUEST_STATUSES.includes(seed.status)
            ? 'booked'
            : 'available'
    const itemIds = seed.items.map(([name, category]) => {
      const item = makeItem(name, category, itemStatus, adhocUnitNames.has(name) ? 'adhoc' : 'asset')
      items.push(item)
      return item.id
    })
    // к выдаче сегодня — план на сегодняшнее время, остальные — за три дня до срока возврата
    const pickupPlannedAt =
      seed.plannedStart ?? (seed.time ? `${today} ${seed.time}` : addDaysRu(seed.returnUntil, -3, '10:00'))
    const issued = ['В пользовании', 'Возвращено', 'Невозвращено'].includes(seed.status)
    return {
      id: seed.id,
      number: `ZK-2024-${String(seed.id).padStart(4, '0')}`,
      status: seed.status,
      fullName: seed.fullName,
      email: seed.email,
      time: seed.time,
      pickupPlannedAt,
      pickupActualAt: seed.actualStart ?? (issued ? pickupPlannedAt : null),
      returnUntil: seed.returnUntil,
      returnActualAt: seed.actualEnd ?? (seed.status === 'Возвращено' ? `${seed.returnUntil} 12:00` : null),
      place: warehousePlace,
      itemIds,
      notIssuedIds: [],
      userComment: seed.userComment,
      rejectReason: seed.rejectReason,
      requestComments: buildComments(seed.requestComments),
      itemComments: buildComments(seed.itemComments),
    }
  })

  // не вернули — единица утеряна, причина в карточке оборудования
  for (const item of items.filter((i) => i.status === 'lost')) {
    item.problem = { type: 'lost', comment: 'Не вернули после аренды', reportedAt: today, reportedBy: 'Николаева Мария Викторовна' }
  }

  const availableNow = items.filter((i) => i.status === 'available').length
  for (let n = 0; n < AVAILABLE_TOTAL - availableNow; n += 1) {
    const [name, category] = fillerCatalog[n % fillerCatalog.length]!
    items.push(makeItem(name, category, 'available', adhocUnitNames.has(name) ? 'adhoc' : 'asset'))
  }
  items.push(makeItem('Проектор', CAT_ELECTRONICS, 'damaged'))
  items.push(makeItem('Дрель', CAT_TOOLS, 'damaged'))
  // запас утюгов для пула — часть без учёта в реестре ОС
  for (let n = 0; n < 4; n += 1) items.push(makeItem('Утюг', CAT_HOUSEHOLD, 'available', 'adhoc'))

  // единицы заявок и аренд в комплекты не входят
  const reservedIds = new Set(requests.flatMap((r) => r.itemIds))
  const kits = buildKits(items, reservedIds)
  const log = buildLog(items, requests, kits)

  return {
    items,
    requests,
    kits,
    log,
    warehouses: warehouseSettingsList.map((w) => ({
      ...w,
      managerIds: [...w.managerIds],
      seniorAdminIds: [...w.seniorAdminIds],
      moderatorIds: [...w.moderatorIds],
      channels: w.channels.map((c) => ({ ...c })),
    })),
    templates: usageRuleTemplates.map((t) => ({ ...t })),
  }
}

export function createWarehouseData() {
  return buildWarehouseData()
}
