// DB 행 → 렌더러까지 이어지는 배선 검증.
// 가짜 Supabase 클라이언트에 실제 테이블과 같은 모양의 행을 넣고,
// 최종 HTML이 첨부 결과물과 같은지 확인한다.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { buildDailyData, buildWeeklyData, isSkipDay, filenameFor, wrapDocument } from '../lib/reportData.js'
import { renderDaily } from '../lib/report/daily.js'
import { renderWeekly } from '../lib/report/weekly.js'

const here = dirname(fileURLToPath(import.meta.url))
const read = (p) => readFileSync(join(here, p), 'utf8')

/** 체이닝 가능한 최소 Supabase 흉내. tables는 { 테이블명: 행배열 }. */
function fakeClient(tables) {
  return {
    from(name) {
      let rows = (tables[name] || []).slice()
      const chain = {
        select: () => chain,
        order: () => chain,
        upsert: async () => ({ data: null, error: null }),
        update: () => chain,
        eq(col, val) {
          rows = rows.filter((r) => r[col] === val)
          return chain
        },
        maybeSingle: async () => ({ data: rows[0] || null, error: null }),
        then: (resolve) => resolve({ data: rows, error: null }),
      }
      return chain
    },
  }
}

const SETTINGS = {
  id: 1,
  author: '초등콘텐츠사업부 권호상',
  short_author: '권호상',
  footer: '이 보고서는 Notion 업무 관리 데이터를 기반으로 자동 생성되었습니다.',
  holidays: ['01-01', '03-01', '05-05', '06-06', '08-15', '10-03', '10-09', '12-25'],
}

const SERIES = [
  { name: '꼬마생각뒤집기', total_progress: 79, sort_order: 1 },
  { name: '꼬마역사뒤집기', total_progress: 40, sort_order: 2 },
  { name: '꼬마 일력', total_progress: 62, sort_order: 3 },
]

test('daily_logs 행에서 첨부와 같은 일일 보고서가 나온다', async () => {
  const sb = fakeClient({
    settings: [SETTINGS],
    series_progress: SERIES,
    daily_logs: [
      {
        log_date: '2026-09-04', title: '꼬마생각 샘플권 감수본 확인',
        status: '진행', priority: '높음', progress: 30, deadline: '2026-09-07',
        is_misc: false, sort_order: 0,
        detail_lines: [
          '<개미> <발레> <인공지능> 감수 내용 수령',
          '담당자 전달 및 내용 확인',
          '09.07 반영 및 수정 종결 예정',
        ],
      },
      {
        log_date: '2026-09-04', title: '꼬마생각 샘플권 준비 작업',
        status: '진행', priority: '높음', progress: 90, deadline: '2026-09-08',
        is_misc: false, sort_order: 1,
        detail_lines: [
          '<인공지능> <발레> 영역확인지 수령',
          '내용 대조 및 확인 : 세이펜 진행 요청',
          '음원 수정 파일 확인 및 재전달',
        ],
      },
      {
        log_date: '2026-09-04', title: '꼬마생각 그림 피드백',
        status: '진행', priority: '높음', progress: 95, deadline: '2026-09-11',
        is_misc: false, sort_order: 2,
        detail_lines: [
          '최종 본문 채색 / 인포그래픽 / 부록 스케치 및 채색 진행',
          '작업 결과물 수령 : 담당별 확인 내역 검토',
          '진행 상황 점검 및 일정 확인',
        ],
      },
      // 다른 날짜 행은 섞여 있어도 걸러져야 한다
      {
        log_date: '2026-09-03', title: '들어가면 안 되는 업무',
        status: '진행', priority: '중간', progress: 10, deadline: null,
        is_misc: false, sort_order: 0, detail_lines: ['어제 일'],
      },
    ],
  })
  const html = renderDaily(await buildDailyData(sb, '2026-09-04'))
  assert.equal(html, read('golden/report_2026-09-04.html'))
})

test('weekly_items 행에서 첨부와 같은 주간 보고서가 나온다', async () => {
  const mk = (kind, title, status, progress, due, order) => ({
    week_start: '2026-08-31', kind, title, work_type: '꼬마시리즈 개발',
    status, progress, due_date: due, note: '', output: '', sort_order: order,
  })
  const sb = fakeClient({
    settings: [SETTINGS],
    series_progress: SERIES,
    weekly_items: [
      mk('전주 실적', '꼬마생각 샘플권 감수 진행', '완료', 100, '2026-09-04', 0),
      mk('전주 실적', '꼬마생각 샘플권 제작 준비', '진행', 90, '2026-09-07', 1),
      mk('전주 실적', '꼬마일력 월별 콘텐츠 작성', '진행', 50, '2026-09-11', 2),
      mk('전주 실적', '꼬마생각 본문 교정교열', '진행', 10, '2026-09-30', 3),
      mk('금주 예정', '꼬마생각 샘플권 데이터 송고', null, null, '2026-09-08', 0),
      mk('금주 예정', '꼬마생각 샘플권 인쇄 감리', null, null, '2026-09-10', 1),
      mk('금주 예정', '꼬마생각 본문 교정교열', null, null, '2026-09-30', 2),
    ],
  })
  const html = renderWeekly(await buildWeeklyData(sb, '2026-09-04'))
  assert.equal(html, read('golden/weekly_report_2026-09-04.html'))
})

test('입력 순서가 뒤섞여도 규칙대로 정렬된다', async () => {
  const mk = (title, status, progress, due, order) => ({
    week_start: '2026-08-31', kind: '전주 실적', title, work_type: '꼬마시리즈 개발',
    status, progress, due_date: due, note: '', output: '', sort_order: order,
  })
  const sb = fakeClient({
    settings: [SETTINGS],
    series_progress: SERIES,
    weekly_items: [
      mk('꼬마생각 본문 교정교열', '진행', 10, '2026-09-30', 0),
      mk('꼬마일력 월별 콘텐츠 작성', '진행', 50, '2026-09-11', 1),
      mk('꼬마생각 샘플권 감수 진행', '완료', 100, '2026-09-04', 2),
      mk('꼬마생각 샘플권 제작 준비', '진행', 90, '2026-09-07', 3),
      { week_start: '2026-08-31', kind: '금주 예정', title: '꼬마생각 본문 교정교열',
        work_type: '꼬마시리즈 개발', status: null, progress: null,
        due_date: '2026-09-30', note: '', output: '', sort_order: 0 },
      { week_start: '2026-08-31', kind: '금주 예정', title: '꼬마생각 샘플권 인쇄 감리',
        work_type: '꼬마시리즈 개발', status: null, progress: null,
        due_date: '2026-09-10', note: '', output: '', sort_order: 1 },
      { week_start: '2026-08-31', kind: '금주 예정', title: '꼬마생각 샘플권 데이터 송고',
        work_type: '꼬마시리즈 개발', status: null, progress: null,
        due_date: '2026-09-08', note: '', output: '', sort_order: 2 },
    ],
  })
  const html = renderWeekly(await buildWeeklyData(sb, '2026-09-04'))
  assert.equal(html, read('golden/weekly_report_2026-09-04.html'))
})

test('주말과 공휴일은 자동 생성에서 건너뛴다', () => {
  assert.equal(isSkipDay('2026-09-05', SETTINGS.holidays), '주말')  // 토
  assert.equal(isSkipDay('2026-09-06', SETTINGS.holidays), '주말')  // 일
  assert.equal(isSkipDay('2026-10-09', SETTINGS.holidays), '공휴일') // 금요일 한글날
  assert.equal(isSkipDay('2026-09-04', SETTINGS.holidays), null)
})

test('파일 이름 규칙이 기존 스킬과 같다', () => {
  assert.equal(filenameFor('daily', '2026-09-04'), 'report_2026-09-04.html')
  assert.equal(filenameFor('weekly', '2026-09-04'), 'weekly_report_2026-09-04.html')
})

test('저장되는 일일 보고서는 한글이 깨지지 않도록 문서로 감싼다', () => {
  const body = read('golden/report_2026-09-04.html')
  const doc = wrapDocument('daily', body, '2026-09-04')
  assert.ok(doc.startsWith('<!DOCTYPE html>'))
  assert.ok(doc.includes('<meta charset="UTF-8">'))
  assert.ok(doc.includes('<title>일일 업무 보고서 2026-09-04</title>'))
  // 보고서 내용 자체는 한 글자도 손대지 않는다
  assert.ok(doc.includes(body))
})

test('주간 보고서는 이미 완결 문서라 감싸지 않는다', () => {
  const doc = read('golden/weekly_report_2026-09-04.html')
  assert.equal(wrapDocument('weekly', doc, '2026-09-04'), doc)
})
