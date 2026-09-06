// 지출결의서 셈 검증. 결재에 올라가는 서류라 금액과 장 나누기가 틀리면 안 된다.
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  koreanMoney, koreanDate, voucherSheets, voucherFilename, ROWS_PER_SHEET,
} from '../src/lib/voucher.js'

const row = (used_on, title, amount, account, spender) =>
  ({ id: title + amount, used_on, title, amount, account, spender })

test('한글 금액은 1을 생략하지 않는다', () => {
  // 실제 결의서에 '사천일백일십원정'으로 적혀 있었다. '사천백십'이 아니다.
  assert.equal(koreanMoney(4110), '사천일백일십원정')
  assert.equal(koreanMoney(100), '일백원정')
  assert.equal(koreanMoney(10), '일십원정')
  assert.equal(koreanMoney(10000), '일만원정')
})

test('한글 금액 — 자리와 묶음', () => {
  assert.equal(koreanMoney(12600), '일만이천육백원정')
  assert.equal(koreanMoney(342100), '삼십사만이천일백원정')
  assert.equal(koreanMoney(1043750), '일백사만삼천칠백오십원정')
  assert.equal(koreanMoney(305), '삼백오원정')
  assert.equal(koreanMoney(20000000), '이천만원정')
  // 빈 자리는 건너뛴다. 100000000 은 '일억'이지 '일억영만'이 아니다.
  assert.equal(koreanMoney(100000000), '일억원정')
  assert.equal(koreanMoney(100000001), '일억일원정')
})

test('한글 금액 — 0과 잘못된 값', () => {
  assert.equal(koreanMoney(0), '영원정')
  assert.equal(koreanMoney(null), '영원정')
  assert.equal(koreanMoney('abc'), '영원정')
  // 소수점은 버린다. 원 단위 아래는 결의서에 올라가지 않는다.
  assert.equal(koreanMoney(4110.9), '사천일백일십원정')
})

test('한 장에 세 줄까지 담고 넘치면 장을 나눈다', () => {
  const rows = [1, 2, 3, 4].map((i) => row('2026-08-0' + i, '발송' + i, 1000 * i, '통신', '권호상'))
  const sheets = voucherSheets(rows)
  assert.equal(ROWS_PER_SHEET, 3)
  assert.equal(sheets.length, 2)
  assert.equal(sheets[0].rows.length, 3)
  assert.equal(sheets[1].rows.length, 1)
  assert.equal(sheets[0].total, 6000)
  assert.equal(sheets[1].total, 4000)
})

test('처리 계정이 다르면 장을 나눈다', () => {
  const sheets = voucherSheets([
    row('2026-08-01', '계약서 발송', 1800, '통신', '권호상'),
    row('2026-08-02', '야근 식대', 11000, '식비', '권호상'),
    row('2026-08-03', '계약서 발송', 4110, '통신', '권호상'),
  ])
  assert.equal(sheets.length, 2)
  assert.equal(sheets[0].account, '통신')
  assert.equal(sheets[0].rows.length, 2)
  assert.equal(sheets[0].total, 5910)
  assert.equal(sheets[1].account, '식비')
  assert.equal(sheets[1].total, 11000)
})

test('사용자가 다르면 장을 나눈다', () => {
  // 결의서 맨 아래 청구자는 한 사람이다. 남이 쓴 돈을 내 이름으로 올릴 수 없다.
  const sheets = voucherSheets([
    row('2026-07-27', '계약서 발송', 10800, '통신', '박누리별'),
    row('2026-09-01', '세이펜 계약서 발송', 4110, '통신', '권호상'),
  ])
  assert.equal(sheets.length, 2)
  assert.equal(sheets[0].claimant, '박누리별')
  assert.equal(sheets[1].claimant, '권호상')
})

test('발의일은 그 장에서 가장 이른 사용일이다', () => {
  // 아직 쓰지 않은 돈을 청구한 것처럼 보이면 안 된다.
  const sheets = voucherSheets([
    row('2026-07-28', '계약서 발송', 1800, '통신', '박누리별'),
    row('2026-07-27', '계약서 발송', 10800, '통신', '박누리별'),
  ])
  assert.equal(sheets.length, 1)
  assert.equal(sheets[0].issuedOn, '2026-07-27')
  assert.equal(sheets[0].total, 12600)
  assert.equal(koreanMoney(sheets[0].total), '일만이천육백원정')
})

test('고른 것이 없으면 장도 없다', () => {
  assert.deepEqual(voucherSheets([]), [])
  assert.deepEqual(voucherSheets(null), [])
})

test('파일 이름은 날짜가 앞에 오고 파일명에 못 쓰는 글자를 뺀다', () => {
  const one = voucherSheets([row('2026-09-01', '세이펜 계약서 발송', 4110, '통신', '권호상')])[0]
  assert.equal(voucherFilename(one), 'voucher_2026-09-01_세이펜_계약서_발송.html')

  const many = voucherSheets([
    row('2026-07-27', '꼬마생각 계약서 발송', 10800, '통신', '박누리별'),
    row('2026-07-28', '꼬마생각 계약서 발송', 1800, '통신', '박누리별'),
  ])[0]
  assert.equal(voucherFilename(many), 'voucher_2026-07-27_꼬마생각_계약서_발송_외1건.html')

  const odd = voucherSheets([row('2026-06-01', 'A/B: "c"?', 100, '기타', '권호상')])[0]
  assert.match(voucherFilename(odd), /^voucher_2026-06-01_[^\\/:*?"<>|]+\.html$/)
})

test('날짜 표기는 결의서 서식을 따른다', () => {
  assert.equal(koreanDate('2026-09-01'), '2026년 9월 1일')
  assert.equal(koreanDate('2026-12-25'), '2026년 12월 25일')
})
