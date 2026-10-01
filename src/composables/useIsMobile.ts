import { ref, type Ref } from 'vue'

/** Ширина, до которой склад показывается в мобильной раскладке */
const MOBILE_QUERY = '(max-width: 767px)'

let query: MediaQueryList | null = null
const isMobile = ref(false)

/** Общий для всего приложения реактивный признак мобильной ширины экрана */
export function useIsMobile(): Ref<boolean> {
  if (!query && typeof window !== 'undefined') {
    // один слушатель на приложение живёт всё время
    query = window.matchMedia(MOBILE_QUERY)
    isMobile.value = query.matches
    query.addEventListener('change', (event) => {
      isMobile.value = event.matches
    })
  }
  return isMobile
}
