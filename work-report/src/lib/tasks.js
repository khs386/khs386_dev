// 단위업무를 골라내는 셈. 화면과 떨어뜨려 두어야 시험할 수 있다.

import { dday } from './report/format.js'

/** 데일리 브리프의 [마감이 가까운 업무]가 보는 날수. */
export const SOON_DAYS = 7

/**
 * 마감이 가까운 업무.
 *
 * 예전에는 단위업무 목록 차례대로 앞에서 다섯을 잘랐다. 그 차례는 시리즈가
 * 먼저라, 뒤 시리즈는 아무리 마감이 급해도 잘려 나갔다 — 이름과 다르게 굴었다.
 * 여기서는 마감일만 본다.
 *
 * 지난 마감(D+)도 남긴다. 마감이 지났는데 아직 완료가 아니면 그것이 가장 급하다.
 * 완료한 것은 뺀다. 보류는 남긴다 — 세워 둔 사이에 마감이 닥칠 수 있고, 그때
 * 다시 굴릴지 정하는 것도 일이다.
 *
 * 개수는 자르지 않는다. 날수로 이미 좁혀 놓았고, 급한 것을 말없이 숨기느니
 * 줄이 길어지는 편이 낫다.
 */
export function soonTasks(tasks, today, within = SOON_DAYS) {
  return (tasks || [])
    .filter((t) => t.deadline && t.status !== '완료')
    .map((t) => ({ ...t, d: dday(t.deadline, today) }))
    .filter((t) => t.d !== null && t.d <= within)
    .sort((a, b) => a.d - b.d || String(a.title).localeCompare(String(b.title), 'ko'))
}
