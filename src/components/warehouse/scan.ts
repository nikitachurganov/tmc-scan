/** Результат разбора отсканированного кода: вид плашки и текст сообщения */
export interface ScanResult {
  kind: 'ok' | 'wrong' | 'dup'
  text: string
}
