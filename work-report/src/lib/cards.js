// 법인카드 셈. 화면과 떨어뜨려 두어야 시험할 수 있다.
//
// 달을 다루는 값은 모두 'YYYY-MM' 글자다. Date 객체로 옮기면 시간대에 따라
// 달이 하루 어긋나는 일이 생긴다 — 보고서 렌더러가 날짜를 글자로만 다루는 것과
// 같은 이유다.

/** 'YYYY-MM' 인가. 아니면 fallback. */
export function monthOr(v, fallback) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(v || '') ? v : fallback
}

/** 'YYYY-MM-DD' 에서 달만. */
export const monthOf = (iso) => String(iso || '').slice(0, 7)

/** 달을 n칸 옮긴다. shiftMonth('2026-01', -1) === '2025-12' */
export function shiftMonth(month, n) {
  const [y, m] = month.split('-').map(Number)
  const t = y * 12 + (m - 1) + n
  return `${String(Math.floor(t / 12)).padStart(4, '0')}-${String((t % 12) + 1).padStart(2, '0')}`
}

/** '2026-08' → '2026년 8월' */
export function koreanMonth(month) {
  const [y, m] = month.split('-')
  return `${+y}년 ${+m}월`
}

/** 그 달의 첫날. 목록을 거를 때 쓴다. */
export const monthStart = (month) => `${month}-01`

/** 그 달의 마지막 날. 윤년까지 맞춘다. */
export function monthEnd(month) {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${month}-${String(last).padStart(2, '0')}`
}

/** 1043750 → '1,043,750' */
export const won = (n) => Number(n || 0).toLocaleString('ko-KR')

/**
 * 한 달치 요약.
 *
 * 정산이 끝난 상태의 이름을 doneNames로 받는다. 어떤 상태가 '끝'인지는
 * 사람이 [항목 관리]에서 정하는 값이라 여기서 이름을 박아 두지 않는다.
 */
export function summarize(rows, doneNames = []) {
  const done = new Set(doneNames)
  const list = rows || []
  const open = list.filter((r) => !done.has(r.settle))

  // 계정별 소계는 많이 쓴 것부터 본다. 같은 금액이면 이름 차례로 두어
  // 새로 고칠 때마다 자리가 흔들리지 않게 한다.
  const acc = new Map()
  for (const r of list) {
    const k = r.account || '없음'
    acc.set(k, (acc.get(k) || 0) + Number(r.amount || 0))
  }
  const byAccount = [...acc.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'ko'))

  return {
    count: list.length,
    total: list.reduce((a, r) => a + Number(r.amount || 0), 0),
    openTotal: open.reduce((a, r) => a + Number(r.amount || 0), 0),
    open,
    byAccount,
  }
}

/* ── 반복 결제 ─────────────────────────────────────────── */

/**
 * 그 달에 이 반복 결제를 받는가.
 *
 * from/to는 비워 두면 끝이 없다는 뜻이다. 셔터스톡처럼 "7월~10월만 구독"인
 * 것이 있어 기간을 함께 담는다.
 */
export function inMonthRange(month, from, to) {
  if (from && month < from) return false
  if (to && month > to) return false
  return true
}

/**
 * 그 달에 빠진 반복 결제.
 *
 * 사용처(가맹점)가 같은 지출이 그 달에 하나라도 있으면 들어온 것으로 본다.
 * 세부 내역은 달마다 글이 조금씩 달라지지만("6월 요금", "7월 요금") 가맹점은
 * 그대로이기 때문이다.
 *
 * 자동결제는 영수증이 눈에 띄지 않아 조용히 빠진다. 노션에서 옮겨 온 21건에서도
 * 셔터스톡·Notion이 6월 뒤로 끊겨 있었다.
 */
export function missingRecurring(month, recurring, rows) {
  const paid = new Set(
    (rows || [])
      .filter((r) => monthOf(r.used_on) === month)
      .map((r) => String(r.merchant || '').trim())
      .filter(Boolean)
  )
  return (recurring || [])
    .filter((r) => r.enabled !== 0 && r.enabled !== false)
    .filter((r) => inMonthRange(month, r.from_month, r.to_month))
    .filter((r) => !paid.has(String(r.merchant || '').trim()))
}
