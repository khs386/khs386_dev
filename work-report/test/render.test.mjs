// 골든 테스트: 첨부받은 결과물과 렌더러 출력이 바이트 단위로 같은지 확인한다.
// 렌더링 규칙을 고칠 때 이 테스트가 깨지면 결과물이 달라졌다는 뜻이다.
//   실행: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { renderDaily } from '../lib/report/daily.js'
import { renderWeekly } from '../lib/report/weekly.js'
import { barColor, ddayColor } from '../lib/report/colors.js'
import { koreanDate, koreanWeek, dday, barHeight } from '../lib/report/format.js'

const here = dirname(fileURLToPath(import.meta.url))
const read = (p) => readFileSync(join(here, p), 'utf8')
const json = (p) => JSON.parse(read(p))

function assertSame(actual, expected, label) {
  if (actual === expected) return
  const a = actual.split('\n')
  const b = expected.split('\n')
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      assert.fail(
        `${label}: ${i + 1}번째 줄이 다릅니다.\n--- 생성됨\n${a[i]}\n--- 기대값\n${b[i]}`
      )
    }
  }
  assert.fail(`${label}: 줄 수가 다릅니다 (생성 ${a.length} / 기대 ${b.length})`)
}

test('일일 보고서가 첨부 결과물과 일치한다', () => {
  const out = renderDaily(json('fixtures/daily-2026-09-04.json'))
  assertSame(out, read('golden/report_2026-09-04.html'), '일일 보고서')
})

test('주간 보고서가 첨부 결과물과 일치한다', () => {
  const out = renderWeekly(json('fixtures/weekly-2026-09-04.json'))
  assertSame(out, read('golden/weekly_report_2026-09-04.html'), '주간 보고서')
})

test('진행률 바 색은 5구간으로 나뉜다', () => {
  assert.equal(barColor(0), '#ddd')
  assert.equal(barColor(1), '#e74c3c')
  assert.equal(barColor(24), '#e74c3c')
  assert.equal(barColor(25), '#e67e22')
  assert.equal(barColor(49), '#e67e22')
  assert.equal(barColor(50), '#3498db')
  assert.equal(barColor(74), '#3498db')
  assert.equal(barColor(75), '#639922')
  assert.equal(barColor(100), '#639922')
})

test('D-day 색은 3단계이고 마감 없으면 회색이다', () => {
  assert.equal(ddayColor(0), '#e74c3c')
  assert.equal(ddayColor(3), '#e74c3c')
  assert.equal(ddayColor(4), '#e67e22')
  assert.equal(ddayColor(7), '#e67e22')
  assert.equal(ddayColor(8), '#888')
  assert.equal(ddayColor(null), '#888')
})

test('날짜 표기와 주차 계산이 규칙을 따른다', () => {
  assert.equal(koreanDate('2026-09-04'), '2026년 9월 4일 (금)')
  assert.equal(koreanDate('2026-01-01'), '2026년 1월 1일 (목)')
  assert.equal(koreanWeek('2026-09-04'), '2026년 9월 1주차')
  assert.equal(koreanWeek('2026-09-08'), '2026년 9월 2주차')
  assert.equal(koreanWeek('2026-09-30'), '2026년 9월 5주차')
  assert.equal(dday('2026-09-07', '2026-09-04'), 3)
  assert.equal(dday(null, '2026-09-04'), null)
})

test('시리즈 막대 높이는 진행률의 2.2배를 버림한 값이다', () => {
  assert.equal(barHeight(79), 173)
  assert.equal(barHeight(40), 88)
  assert.equal(barHeight(62), 136)
  assert.equal(barHeight(0), 4)
})

test('마감 없는 업무는 마감 줄과 가장 빠른 마감에서 빠지고 맨 뒤로 간다', () => {
  const html = renderDaily({
    date: '2026-09-04',
    author: '초등콘텐츠사업부 권호상',
    tasks: [
      { title: '마감 없음', status: '진행', priority: '중간', progress: 20, deadline: null, details: ['가'] },
      { title: '마감 있음', status: '완료', priority: '높음', progress: 100, deadline: '2026-09-09', details: ['나'] },
    ],
    series: [],
  })
  assert.ok(html.indexOf('마감 있음') < html.indexOf('마감 없음'), '마감 있는 업무가 먼저 와야 한다')
  assert.equal((html.match(/마감: /g) || []).length, 1)
  assert.ok(html.includes('D-5'))
})

test('기타 사항은 요약 카드에서 빠지고 업무 상세에는 남는다', () => {
  const html = renderDaily({
    date: '2026-09-04',
    author: '초등콘텐츠사업부 권호상',
    tasks: [
      { title: '기타 사항', status: '진행', priority: '낮음', progress: 0, deadline: null, details: ['잡무'] },
      { title: '본 업무', status: '완료', priority: '높음', progress: 100, deadline: '2026-09-05', details: ['가'] },
    ],
    series: [],
  })
  assert.ok(html.includes('기타 사항'), '업무 상세에는 남아야 한다')
  assert.ok(html.includes('>1</p>'), '오늘 업무 건수는 1이어야 한다')
})

test('진행률 0%와 미입력은 진행률 바에서 빠진다', () => {
  const html = renderDaily({
    date: '2026-09-04',
    author: '초등콘텐츠사업부 권호상',
    tasks: [
      { title: '영점', status: '진행', priority: '중간', progress: 0, deadline: '2026-09-05', details: [] },
      { title: '미입력', status: '진행', priority: '중간', progress: null, deadline: '2026-09-06', details: [] },
    ],
    series: [],
  })
  assert.ok(html.includes('진행률 데이터가 없습니다.'))
})

test('금주 예정이 비면 안내 행 한 줄이 들어간다', () => {
  const html = renderWeekly({
    date: '2026-09-04',
    author: '초등콘텐츠사업부 권호상',
    prev: [],
    plan: [],
    series: [],
  })
  assert.ok(html.includes('예정업무 없음'))
  assert.ok(html.includes('시리즈 데이터를 불러오지 못했습니다.'))
})

test('주간 요약 카드는 기타 업무를 세지 않는다', () => {
  const html = renderWeekly({
    date: '2026-09-04',
    author: '초등콘텐츠사업부 권호상',
    prev: [
      { workType: '꼬마시리즈 개발', title: '가', status: '완료', progress: 100, dueDate: '2026-09-04' },
      { workType: '기타 업무', title: '나', status: '진행', progress: 50, dueDate: '2026-09-05' },
    ],
    plan: [{ workType: '꼬마시리즈 개발', title: '다', dueDate: '2026-09-10' }],
    series: [],
  })
  assert.ok(html.includes('나'), '표에는 기타 업무도 나와야 한다')
  const counts = [...html.matchAll(/font-size:54px;font-weight:700;color:#[0-9a-fA-F]{6};">(\d+)</g)].map((m) => m[1])
  assert.deepEqual(counts, ['1', '1', '0', '1'])
})
