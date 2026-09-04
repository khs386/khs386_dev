// 화면용 색. 보고서 결과물의 색 규칙(lib/report/colors.js)과는 별개다.
// 보고서는 기존 형식을 그대로 지켜야 하므로 그쪽은 건드리지 않는다.
// 여기 값들은 애플 시스템 색을 따른다.

export const UI = {
  blue: '#007aff',
  green: '#34c759',
  orange: '#ff9500',
  red: '#ff3b30',
  purple: '#af52de',
  gray: '#8e8e93',
}

export function statusTint(s) {
  if (['완료', '종결'].includes(s)) return UI.green
  if (['진행', '진행 중', '진행중'].includes(s)) return UI.blue
  if (s === '시작') return UI.purple
  return UI.gray
}

export function priorityTint(p) {
  if (p === '높음') return UI.red
  if (p === '중간' || p === '보통') return UI.orange
  return UI.gray
}

export function ddayTint(d) {
  if (d === null || d === undefined) return UI.gray
  if (d <= 3) return UI.red
  if (d <= 7) return UI.orange
  return UI.gray
}
