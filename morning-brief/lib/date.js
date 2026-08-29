// 로컬(사용자) 시간대 기준 YYYY-MM-DD
export function ymd(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

// 해당 날짜의 로컬 자정을 ISO(UTC) 문자열로
export function startOfDayISO(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function formatKorean(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  })
}
