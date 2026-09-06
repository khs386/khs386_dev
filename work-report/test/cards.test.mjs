// 법인카드 셈 검증. 정산 서류에 그대로 올라가는 숫자라 한 원도 어긋나면 안 된다.
// 아래 값들은 노션 [법인카드 사용 내역]의 실제 기록에서 가져왔다.
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  monthOr, monthOf, shiftMonth, koreanMonth, monthStart, monthEnd, won, summarize,
} from '../src/lib/cards.js'

const DONE = ['지출품의 승인', '자동결제 승인']

/** 노션에 실제로 들어 있는 2026년 8월 6건. */
const AUG = [
  { used_on: '2026-08-31', title: '꼬마생각 편집회의', amount: 31100, account: '회의비', settle: '지출품의 승인' },
  { used_on: '2026-08-25', title: '꼬마생각 부록 그림 계약서 발송', amount: 14400, account: '기타', settle: '지출품의 승인' },
  { used_on: '2026-08-18', title: '꼬마생각 편집회의', amount: 35300, account: '회의비', settle: '지출품의 승인' },
  { used_on: '2026-08-13', title: '야근 식대', amount: 11000, account: '식비', settle: '지출품의 제출' },
  { used_on: '2026-08-12', title: '야근 식대', amount: 23000, account: '식비', settle: '지출품의 승인' },
  { used_on: '2026-08-06', title: '꼬마생각 편집회의', amount: 32900, account: '회의비', settle: '지출품의 승인' },
]

test('달 값을 안전하게 읽는다', () => {
  assert.equal(monthOr('2026-08', '2026-01'), '2026-08')
  assert.equal(monthOr('2026-13', '2026-01'), '2026-01')
  assert.equal(monthOr('2026-00', '2026-01'), '2026-01')
  assert.equal(monthOr('', '2026-01'), '2026-01')
  assert.equal(monthOr(undefined, '2026-01'), '2026-01')
  assert.equal(monthOf('2026-08-13'), '2026-08')
})

test('해를 넘겨도 달이 맞게 옮겨진다', () => {
  assert.equal(shiftMonth('2026-01', -1), '2025-12')
  assert.equal(shiftMonth('2026-12', 1), '2027-01')
  assert.equal(shiftMonth('2026-08', -1), '2026-07')
  assert.equal(shiftMonth('2026-08', 1), '2026-09')
  assert.equal(koreanMonth('2026-08'), '2026년 8월')
})

test('달의 첫날과 마지막 날 — 윤년까지', () => {
  assert.equal(monthStart('2026-08'), '2026-08-01')
  assert.equal(monthEnd('2026-08'), '2026-08-31')
  assert.equal(monthEnd('2026-02'), '2026-02-28')
  assert.equal(monthEnd('2028-02'), '2028-02-29')
  assert.equal(monthEnd('2026-09'), '2026-09-30')
})

test('8월 합계가 노션과 같다', () => {
  const s = summarize(AUG, DONE)
  assert.equal(s.count, 6)
  assert.equal(s.total, 147700)
  assert.equal(won(s.total), '147,700')
})

test('승인되지 않은 것만 따로 셈한다', () => {
  const s = summarize(AUG, DONE)
  assert.equal(s.open.length, 1)
  assert.equal(s.openTotal, 11000)
  assert.equal(s.open[0].title, '야근 식대')
})

test("'정산 끝' 표시를 바꾸면 미승인 셈도 따라간다", () => {
  // 어떤 상태가 끝인지는 사람이 [항목 관리]에서 정한다. 이름을 박아 두지 않는다.
  const none = summarize(AUG, [])
  assert.equal(none.open.length, 6)
  assert.equal(none.openTotal, 147700)

  const all = summarize(AUG, ['지출품의 승인', '자동결제 승인', '지출품의 제출'])
  assert.equal(all.open.length, 0)
  assert.equal(all.openTotal, 0)
})

test('계정별 소계는 많이 쓴 것부터 나오고 총합과 맞는다', () => {
  const s = summarize(AUG, DONE)
  assert.deepEqual(s.byAccount, [
    { name: '회의비', total: 99300 },
    { name: '식비', total: 34000 },
    { name: '기타', total: 14400 },
  ])
  assert.equal(s.byAccount.reduce((a, x) => a + x.total, 0), s.total)
})

test('계정이 비어 있어도 합계에서 빠지지 않는다', () => {
  // 항목 관리에서 계정을 지우면 그 값을 쓰던 지출의 칸만 빈다. 돈은 그대로 남는다.
  const s = summarize([...AUG, { amount: 5000, account: null, settle: '지출품의 승인' }], DONE)
  assert.equal(s.total, 152700)
  assert.equal(s.byAccount.find((a) => a.name === '없음').total, 5000)
})

test('빈 달도 0으로 답한다', () => {
  const s = summarize([], DONE)
  assert.deepEqual(s, { count: 0, total: 0, openTotal: 0, open: [], byAccount: [] })
  assert.equal(won(0), '0')
})
