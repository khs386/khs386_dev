// 지출결의서 셈 검증. 결재에 올라가는 서류라 금액과 장 나누기가 틀리면 안 된다.
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  koreanMoney, koreanDate, voucherSheets, voucherFilename, voucherFilenames, voucherFile,
  ROWS_PER_SHEET,
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

test('고른 한 건이 곧 한 장이다', () => {
  const rows = [1, 2, 3, 4].map((i) => row('2026-08-0' + i, '발송' + i, 1000 * i, '통신', '권호상'))
  const sheets = voucherSheets(rows)
  // 결재는 건마다 따로 올라간다. 묶으면 한 건이 막혔을 때 나머지도 멈춘다.
  assert.equal(sheets.length, 4)
  assert.deepEqual(sheets.map((x) => x.rows.length), [1, 1, 1, 1])
  assert.deepEqual(sheets.map((x) => x.total), [1000, 2000, 3000, 4000])
  // 서식의 줄 수는 셋 그대로다. 남는 두 줄은 빈 채로 나간다.
  assert.equal(ROWS_PER_SHEET, 3)
  assert.equal((voucherFile(sheets[0]).match(/class="item"/g) || []).length, 3)
})

test('계정과 사용자가 같아도 묶지 않는다', () => {
  const sheets = voucherSheets([
    row('2026-08-01', '계약서 발송', 1800, '통신', '권호상'),
    row('2026-08-02', '야근 식대', 11000, '식비', '권호상'),
    row('2026-08-03', '계약서 발송', 4110, '통신', '권호상'),
  ])
  assert.equal(sheets.length, 3)
  assert.deepEqual(sheets.map((x) => x.account), ['통신', '식비', '통신'])
  assert.deepEqual(sheets.map((x) => x.total), [1800, 11000, 4110])
})

test('장마다 청구자와 발의일은 그 건의 것이다', () => {
  const sheets = voucherSheets([
    row('2026-07-27', '계약서 발송', 10800, '통신', '박누리별'),
    row('2026-09-01', '세이펜 계약서 발송', 4110, '통신', '권호상'),
  ])
  assert.deepEqual(sheets.map((x) => x.claimant), ['박누리별', '권호상'])
  assert.deepEqual(sheets.map((x) => x.issuedOn), ['2026-07-27', '2026-09-01'])
})

test('고른 것이 없으면 장도 없다', () => {
  assert.deepEqual(voucherSheets([]), [])
  assert.deepEqual(voucherSheets(null), [])
})

test('파일 이름은 날짜가 앞에 오고 파일명에 못 쓰는 글자를 뺀다', () => {
  const one = voucherSheets([row('2026-09-01', '세이펜 계약서 발송', 4110, '통신', '권호상')])[0]
  assert.equal(voucherFilename(one), 'voucher_2026-09-01_세이펜_계약서_발송.html')

  const two = voucherSheets([
    row('2026-07-27', '꼬마생각 계약서 발송', 10800, '통신', '박누리별'),
    row('2026-07-28', '꼬마생각 계약서 발송', 1800, '통신', '박누리별'),
  ])
  assert.deepEqual(two.map(voucherFilename), [
    'voucher_2026-07-27_꼬마생각_계약서_발송.html',
    'voucher_2026-07-28_꼬마생각_계약서_발송.html',
  ])

  const odd = voucherSheets([row('2026-06-01', 'A/B: "c"?', 100, '기타', '권호상')])[0]
  assert.match(voucherFilename(odd), /^voucher_2026-06-01_[^\\/:*?"<>|]+\.html$/)
})

test('날짜 표기는 결의서 서식을 따른다', () => {
  assert.equal(koreanDate('2026-09-01'), '2026년 9월 1일')
  assert.equal(koreanDate('2026-12-25'), '2026년 12월 25일')
})

test('내역 줄의 비고를 서식에 담는다', () => {
  const sheet = voucherSheets([
    { ...row('2026-08-31', '꼬마생각 편집회의', 31100, '회의비', '권호상'),
      note: '회의실 예약으로 외부 진행' },
    { ...row('2026-08-18', '꼬마생각 편집회의', 35300, '회의비', '권호상'), note: '' },
  ])[0]
  const html = voucherFile(sheet)
  assert.match(html, /회의실 예약으로 외부 진행/)
  // 비고가 없는 줄과 빈 줄은 빈 칸으로 남는다. 세 줄 서식이라 줄 수는 늘 셋이다.
  assert.equal((html.match(/class="memo"/g) || []).length, ROWS_PER_SHEET)
})

test('비고에 든 홑화살괄호는 글자로 나간다', () => {
  // 세부 내역에 '<인공지능>' 같은 제목을 적는 사람이다. 서식이 깨지면 안 된다.
  const sheet = voucherSheets([
    { ...row('2026-09-01', '검수', 1000, '기타', '권호상'), note: '<발레> 건' },
  ])[0]
  const html = voucherFile(sheet)
  assert.match(html, /&lt;발레&gt; 건/)
  assert.doesNotMatch(html, /<발레>/)
})

test('같은 날 같은 이름은 뒤엣것에 번호를 붙인다', () => {
  // 드라이브는 같은 이름을 덮어쓴다. 번호가 없으면 앞엣것이 사라진다.
  const sheets = voucherSheets([
    row('2026-08-13', '야근 식대', 11000, '식비', '권호상'),
    row('2026-08-13', '야근 식대', 23000, '식비', '권호상'),
    row('2026-08-13', '야근 식대', 9000, '식비', '권호상'),
    row('2026-08-14', '야근 식대', 9000, '식비', '권호상'),
  ])
  assert.deepEqual(voucherFilenames(sheets), [
    'voucher_2026-08-13_야근_식대.html',
    'voucher_2026-08-13_야근_식대_2.html',
    'voucher_2026-08-13_야근_식대_3.html',
    'voucher_2026-08-14_야근_식대.html',
  ])
  // 겹치지 않으면 멀쩡한 이름 그대로다.
  assert.equal(new Set(voucherFilenames(sheets)).size, 4)
})
