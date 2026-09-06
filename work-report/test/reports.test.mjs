// DB 행 → 렌더러까지 이어지는 배선 검증.
// 실제 D1 테이블과 같은 모양의 행을 가짜 데이터베이스에 넣고,
// 최종 HTML이 첨부받은 결과물과 같은지 확인한다.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import {
  buildDailyData, buildWeeklyData, skipReason, filenameFor, wrapDocument,
} from '../src/lib/reports.js'
import { renderDaily } from '../src/lib/report/daily.js'
import { renderWeekly } from '../src/lib/report/weekly.js'

const here = dirname(fileURLToPath(import.meta.url))
const read = (p) => readFileSync(join(here, p), 'utf8')

/**
 * D1의 prepare().bind().all()/first() 를 흉내 낸다.
 * 어떤 표를 묻는지는 SQL 문자열에서 알아낸다.
 */
function fakeD1(tables) {
  return {
    prepare(sql) {
      let binds = []
      const which = () => {
        for (const name of Object.keys(tables)) if (sql.includes(name)) return tables[name]
        return []
      }
      const filtered = () => {
        const rows = which()
        if (sql.includes('log_date = ?')) return rows.filter((r) => r.log_date === binds[0])
        if (sql.includes('week_start = ?')) return rows.filter((r) => r.week_start === binds[0])
        return rows
      }
      const chain = {
        bind: (...a) => { binds = a; return chain },
        all: async () => ({ results: filtered() }),
        first: async () => filtered()[0] || null,
        run: async () => ({}),
      }
      return chain
    },
    batch: async () => [],
  }
}

const ENV = { AUTHOR: '초등콘텐츠사업부 권호상', SHORT_AUTHOR: '권호상' }
const SETTINGS = [{
  id: 1,
  footer: '이 보고서는 Notion 업무 관리 데이터를 기반으로 자동 생성되었습니다.',
  holidays: '["01-01","03-01","05-05","06-06","08-15","10-03","10-09","12-25"]',
}]
const SERIES = [
  { name: '꼬마생각뒤집기', total_progress: 79, sort_order: 1 },
  { name: '꼬마역사뒤집기', total_progress: 40, sort_order: 2 },
  { name: '꼬마 일력', total_progress: 62, sort_order: 3 },
]

test('daily_logs 행에서 첨부와 같은 일일 보고서가 나온다', async () => {
  const mk = (title, progress, deadline, order, lines) => ({
    log_date: '2026-09-04', title, status: '진행', priority: '높음',
    progress, deadline, is_misc: 0, sort_order: order,
    detail_lines: JSON.stringify(lines),
  })
  const db = fakeD1({
    settings: SETTINGS,
    series_progress: SERIES,
    daily_logs: [
      mk('꼬마생각 샘플권 감수본 확인', 30, '2026-09-07', 0, [
        '<개미> <발레> <인공지능> 감수 내용 수령',
        '담당자 전달 및 내용 확인',
        '09.07 반영 및 수정 종결 예정']),
      mk('꼬마생각 샘플권 준비 작업', 90, '2026-09-08', 1, [
        '<인공지능> <발레> 영역확인지 수령',
        '내용 대조 및 확인 : 세이펜 진행 요청',
        '음원 수정 파일 확인 및 재전달']),
      mk('꼬마생각 그림 피드백', 95, '2026-09-11', 2, [
        '최종 본문 채색 / 인포그래픽 / 부록 스케치 및 채색 진행',
        '작업 결과물 수령 : 담당별 확인 내역 검토',
        '진행 상황 점검 및 일정 확인']),
      // 다른 날짜 행이 섞여 있어도 걸러져야 한다
      { ...mk('들어가면 안 되는 업무', 10, null, 0, ['어제 일']), log_date: '2026-09-03' },
    ],
  })
  const html = renderDaily(await buildDailyData(ENV, db, '2026-09-04'))
  assert.equal(html, read('golden/report_2026-09-04.html'))
})

test('weekly_items 행에서 첨부와 같은 주간 보고서가 나온다', async () => {
  const mk = (kind, title, status, progress, due, order) => ({
    week_start: '2026-08-31', kind, title, work_type: '꼬마시리즈 개발',
    status, progress, due_date: due, note: '', output: '', sort_order: order,
  })
  const db = fakeD1({
    settings: SETTINGS,
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
  const html = renderWeekly(await buildWeeklyData(ENV, db, '2026-09-04'))
  assert.equal(html, read('golden/weekly_report_2026-09-04.html'))
})

test('세부내용은 JSON 문자열로 저장돼도 줄 목록으로 되살아난다', async () => {
  const db = fakeD1({
    settings: SETTINGS,
    series_progress: [],
    daily_logs: [{
      log_date: '2026-09-04', title: '가', status: '진행', priority: '중간',
      progress: 50, deadline: null, is_misc: 0, sort_order: 0,
      detail_lines: '["첫 줄","둘째 줄"]',
    }],
  })
  const data = await buildDailyData(ENV, db, '2026-09-04')
  assert.deepEqual(data.tasks[0].details, ['첫 줄', '둘째 줄'])
})

test('주말과 공휴일은 자동 실행에서 건너뛴다', () => {
  const h = ['01-01', '03-01', '10-09']
  assert.equal(skipReason('2026-09-05', h), '주말')
  assert.equal(skipReason('2026-09-06', h), '주말')
  assert.equal(skipReason('2026-10-09', h), '공휴일')
  assert.equal(skipReason('2026-09-04', h), null)
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
  assert.ok(doc.includes(body), '보고서 내용은 한 글자도 바뀌지 않아야 한다')
})

test('주간 보고서는 이미 완결 문서라 감싸지 않는다', () => {
  const doc = read('golden/weekly_report_2026-09-04.html')
  assert.equal(wrapDocument('weekly', doc, '2026-09-04'), doc)
})

/* ── 시리즈 총 진행률 ─────────────────────────────────────── */

// 단계와 몫은 이제 시리즈마다 DB에 담긴다. 여기서는 기본 목록
// (migrations/0014_stage_presets_seed.sql)과 같은 값을 놓고 검산한다.
const PRESET = [
  ['plan', 5], ['topic', 10], ['volume', 10], ['text', 15], ['art', 25],
  ['appendix', 10], ['appendix_art', 10], ['audio', 5], ['review', 5], ['saypen', 5],
]
const withValues = (vals, weights) =>
  PRESET.map(([key, w], i) => ({
    key, label: key, weight: weights ? weights[i] : w, value: vals[i],
  }))

test('기본 가중치가 노션 수식과 같은 값을 낸다', async () => {
  const { seriesTotal, weightSum } = await import('../src/lib/series.js')

  // 기본 목록의 몫 합은 100이어야 한다
  assert.equal(weightSum(withValues([])), 100)

  // 노션 [시리즈별 개발 현황] 실제 값으로 검산
  //                        기획 주제 권별 본문 그림 부록 부록그림 음원 감수 세이펜
  assert.equal(seriesTotal(withValues([100, 100, 100, 100, 100, 100, 20, 10, 10, 10])), 79)
  assert.equal(seriesTotal(withValues([100, 100, 100, 100, null, null, null, null, null, null])), 40)
  assert.equal(seriesTotal(withValues([100, 100, 100, 15, null, 100, 100, 100, 100, 100])), 62)
  assert.equal(seriesTotal(withValues([100, 100, 100, 100, 100, 100, 100, 100, 100, 100])), 100)
  assert.equal(seriesTotal(withValues([0, 0, 0, 0, 0, 0, 0, 0, 0, 0])), 0)
})

test('몫을 고치면 총 진행률도 따라 움직인다', async () => {
  const { seriesTotal } = await import('../src/lib/series.js')
  const vals = [100, 100, 100, 15, null, 100, 100, 100, 100, 100]   // 꼬마 일력
  assert.equal(seriesTotal(withValues(vals)), 62)
  // 본문 그림(25)을 빼서 합이 75가 되면 남은 단계의 비중이 커진다
  const lighter = [5, 10, 10, 15, 0, 10, 10, 5, 5, 5]
  assert.equal(seriesTotal(withValues(vals, lighter)), 83)
})

test('몫의 합이 100이 아니어도 0~100 안에 머문다', async () => {
  const { seriesTotal } = await import('../src/lib/series.js')
  const full = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100]
  // 다 채웠으면 합이 얼마든 100이다. 실제 합으로 나누기 때문이다.
  assert.equal(seriesTotal(withValues(full, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1])), 100)
  assert.equal(seriesTotal(withValues(full, [9, 9, 9, 9, 9, 9, 9, 9, 9, 9])), 100)
  const half = [100, 100, 100, 100, 100, null, null, null, null, null]
  const w = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10]
  assert.equal(seriesTotal(withValues(half, w)), 50)
})

test('몫이 0인 단계는 셈에 들지 않는다', async () => {
  const { seriesTotal } = await import('../src/lib/series.js')
  // 그 단계에 100을 넣어 두어도 몫이 0이면 총 진행률이 움직이지 않는다.
  const w = [50, 50, 0, 0, 0, 0, 0, 0, 0, 0]
  assert.equal(seriesTotal(withValues([100, 0, 100, 100, 100, null, null, null, null, null], w)), 50)
})

test('몫의 합이 0이면 0을 낸다', async () => {
  const { seriesTotal } = await import('../src/lib/series.js')
  const w = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  // 0으로 나누지 않는다. 예전에 적어 둔 값이 있으면 그것을 쓴다.
  assert.equal(seriesTotal(withValues([100, 100, 100, 100, 100, 100, 100, 100, 100, 100], w)), 0)
  assert.equal(seriesTotal(withValues([100, 100, 100, 100, 100, 100, 100, 100, 100, 100], w), 62), 62)
})

test('단계를 하나도 넣지 않으면 예전에 직접 넣은 값을 쓴다', async () => {
  const { seriesTotal } = await import('../src/lib/series.js')
  const empty = withValues([null, null, null, null, null, null, null, null, null, null])
  assert.equal(seriesTotal(empty, 62), 62)
  assert.equal(seriesTotal([], 62), 62)
  assert.equal(seriesTotal(null, 62), 62)
  // 하나라도 넣었으면 그때부터는 단계값으로 셈한다.
  assert.equal(seriesTotal(withValues([100, null, null, null, null, null, null, null, null, null]), 62), 5)
})

test('단계 열쇠는 폼 칸 이름으로 쓸 수 있는 글자만 받는다', async () => {
  const { STAGE_KEY, newStageKey, clampPct, clampWeight } =
    await import('../src/lib/series.js')
  assert.ok(STAGE_KEY.test('plan'))
  assert.ok(STAGE_KEY.test('appendix_art'))
  assert.ok(STAGE_KEY.test(newStageKey()))
  assert.ok(!STAGE_KEY.test('a b'))
  assert.ok(!STAGE_KEY.test('a-b'))
  assert.ok(!STAGE_KEY.test(''))

  // 진행률은 안 넣은 것(null)과 0을 구별한다. 몫은 그런 구별이 없다.
  assert.equal(clampPct(''), null)
  assert.equal(clampPct(null), null)
  assert.equal(clampPct(0), 0)
  assert.equal(clampPct(140), 100)
  assert.equal(clampPct(-5), 0)
  assert.equal(clampWeight(''), 0)
  assert.equal(clampWeight(-3), 0)
  assert.equal(clampWeight(140), 100)
})

