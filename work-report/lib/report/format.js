// 날짜·문자열 유틸. 렌더러는 시간대에 흔들리면 안 되므로
// Date 객체 대신 'YYYY-MM-DD' 문자열을 UTC 기준으로만 다룬다.

const DOW = ['일', '월', '화', '수', '목', '금', '토']

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 'YYYY-MM-DD' → UTC 자정 Date */
export function toDate(iso) {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso))
  if (!m) return null
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
}

/** 두 날짜의 일수 차. deadline 없으면 null */
export function dday(deadline, today) {
  const a = toDate(deadline)
  const b = toDate(today)
  if (!a || !b) return null
  return Math.round((a - b) / 86400000)
}

/** '2026-09-04' → '2026년 9월 4일 (금)' — 앞 0 없음 */
export function koreanDate(iso) {
  const d = toDate(iso)
  if (!d) return ''
  return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${DOW[d.getUTCDay()]})`
}

/** '2026-09-04' → '2026년 9월 1주차' — 주차 = (일 - 1) // 7 + 1 */
export function koreanWeek(iso) {
  const d = toDate(iso)
  if (!d) return ''
  const week = Math.floor((d.getUTCDate() - 1) / 7) + 1
  return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${week}주차`
}

/** 해당 날짜가 속한 주의 월요일 */
export function weekStart(iso) {
  const d = toDate(iso)
  if (!d) return null
  const wd = (d.getUTCDay() + 6) % 7 // 월=0
  d.setUTCDate(d.getUTCDate() - wd)
  return d.toISOString().slice(0, 10)
}

/** 시리즈 세로 막대 높이 (px) */
export function barHeight(progress) {
  return Math.max(4, Math.trunc(progress * 2.2))
}

/** 정렬 보조: D-day 없는 항목은 맨 뒤 */
export function ddayKey(d) {
  return d === null || d === undefined ? 9999 : d
}

/** 업무명으로 시리즈 순위 판정 (꼬마생각 → 꼬마역사 → 꼬마 일력 → 기타) */
export function seriesRank(title) {
  const t = String(title || '')
  if (t.includes('꼬마생각')) return 0
  if (t.includes('꼬마역사')) return 1
  if (t.includes('꼬마 일력') || t.includes('꼬마일력')) return 2
  return 99
}
