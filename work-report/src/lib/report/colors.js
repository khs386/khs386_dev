// 보고서 색상 규칙. 두 스킬(daily-work-report-sungwoobook, weekly-work-report)의
// 색상 정의를 그대로 옮긴 것으로, 값을 임의로 바꾸면 결과물이 달라진다.

/** 진행률 바 색 (0 / 1~24 / 25~49 / 50~74 / 75~100) */
export function barColor(p) {
  if (p === 0) return '#ddd'
  if (p < 25) return '#e74c3c' // 빨강: 시작
  if (p < 50) return '#e67e22' // 주황: 초반
  if (p < 75) return '#3498db' // 파랑: 중반
  return '#639922' // 초록: 마무리
}

/** 진행률 바 옆 D-day 글자색 */
export function ddayColor(d) {
  if (d === null || d === undefined) return '#888'
  if (d <= 3) return '#e74c3c'
  if (d <= 7) return '#e67e22'
  return '#888'
}

/** 업무 상세 카드의 마감 줄 색 (D-8 이상은 파랑) */
export function deadlineColor(d) {
  if (d === null || d === undefined) return '#378ADD'
  if (d <= 3) return '#e74c3c'
  if (d <= 7) return '#e67e22'
  return '#378ADD'
}

/** 진행 상태 배지색 */
export function statusColor(s) {
  if (!s) return null
  if (['완료', '종결', 'Done', '완료됨'].includes(s)) return '#639922'
  if (['진행', '진행 중', '진행중', 'In progress'].includes(s)) return '#378ADD'
  if (s === '시작') return '#8e44ad'
  return '#888'
}

/** 업무 상세 카드 왼쪽 세로선 색 (완료/진행/그 외) */
export function cardAccentColor(s) {
  if (['완료', '종결', 'Done', '완료됨'].includes(s)) return '#639922'
  if (['진행', '진행 중', '진행중', 'In progress'].includes(s)) return '#378ADD'
  return '#aaa'
}

/** 우선순위 배지색 */
export function priorityColor(p) {
  if (p === '높음') return '#e74c3c'
  if (p === '중간' || p === '보통') return '#e67e22'
  return '#888'
}

/** 시리즈 세로 막대 고정색 (진행률과 무관) */
export const SERIES_COLOR = {
  꼬마생각뒤집기: '#378ADD',
  꼬마역사뒤집기: '#e67e22',
  '꼬마 일력': '#9b59b6',
}

export const SERIES_ORDER = ['꼬마생각뒤집기', '꼬마역사뒤집기', '꼬마 일력']

/** 노션 상태 원본값 → 화면 표기 ("진행 중"은 "진행"으로 줄여 쓴다) */
export function displayStatus(s) {
  if (s === '진행 중' || s === '진행중') return '진행'
  return s || ''
}

export function isDone(s) {
  return ['완료', '종결', 'Done', '완료됨'].includes(s)
}

export function isGoing(s) {
  return ['진행', '진행 중', '진행중', 'In progress'].includes(s)
}
