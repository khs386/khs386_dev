// DB 행 → 렌더러 입력 → 저장. 화면과 자동 실행이 같은 코드를 쓴다.
import { renderDaily } from './report/daily.js'
import { renderWeekly } from './report/weekly.js'
import { weekStart } from './report/format.js'
import * as db from './db.js'

const DEFAULT_HOLIDAYS = [
  '01-01', '01-28', '01-29', '01-30', '03-01', '05-05', '05-25', '06-06',
  '08-15', '09-25', '09-26', '09-27', '10-03', '10-09', '12-25',
]

/** 한국 시각 기준 오늘 날짜. 워커스는 UTC로 돌아간다. */
export function todayKST() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
}

/** 주말·공휴일이면 그 이유를, 아니면 null을 돌려준다. */
export function skipReason(iso, holidays) {
  const wd = new Date(`${iso}T00:00:00Z`).getUTCDay()
  if (wd === 0 || wd === 6) return '주말'
  return (holidays?.length ? holidays : DEFAULT_HOLIDAYS).includes(iso.slice(5)) ? '공휴일' : null
}

export function filenameFor(kind, date) {
  return kind === 'daily' ? `report_${date}.html` : `weekly_report_${date}.html`
}

/**
 * 저장·전달용 문서로 감싼다.
 * 일일 보고서는 표 조각이라 문자 인코딩 선언이 없어, 파일로 받거나 드라이브에서 열면
 * 한글이 깨진다. 내용은 그대로 두고 문서 껍데기만 씌운다.
 */
export function wrapDocument(kind, html, date) {
  if (kind !== 'daily') return html
  return (
    '<!DOCTYPE html>\n<html lang="ko"><head><meta charset="UTF-8">' +
    `<title>일일 업무 보고서 ${date}</title></head>\n` +
    `<body style="margin:0;padding:40px 0;background:#ffffff;">\n${html}\n</body></html>`
  )
}

async function common(env, database) {
  const [settings, series] = await Promise.all([
    db.getSettings(database),
    db.listSeries(database),
  ])
  return {
    settings,
    series: series.map((s) => ({ name: s.name, progress: s.total_progress })),
  }
}

export async function buildDailyData(env, database, date) {
  const [{ settings, series }, logs] = await Promise.all([
    common(env, database),
    db.listLogs(database, date),
  ])
  return {
    date,
    author: env.AUTHOR || '',
    footer: settings.footer,
    tasks: logs.map((l) => ({
      title: l.title,
      status: l.status,
      priority: l.priority,
      progress: l.progress,
      deadline: l.deadline,
      isMisc: l.is_misc,
      details: l.detail_lines,
    })),
    series,
  }
}

export async function buildWeeklyData(env, database, date) {
  const [{ settings, series }, items] = await Promise.all([
    common(env, database),
    db.listWeekly(database, weekStart(date)),
  ])
  const pick = (kind) =>
    items
      .filter((i) => i.kind === kind)
      .map((i) => ({
        workType: i.work_type,
        title: i.title,
        status: i.status,
        progress: i.progress,
        dueDate: i.due_date,
        note: i.note,
        output: i.output,
      }))
  return {
    date,
    author: env.AUTHOR || '',
    shortAuthor: env.SHORT_AUTHOR || '',
    footer: settings.footer,
    prev: pick('전주 실적'),
    plan: pick('금주 예정'),
    series,
  }
}

/** 보고서를 만들어 이력에 저장하고 { html, filename, empty }를 돌려준다. */
export async function generateReport(env, database, kind, date) {
  const data =
    kind === 'daily'
      ? await buildDailyData(env, database, date)
      : await buildWeeklyData(env, database, date)
  const empty =
    kind === 'daily' ? data.tasks.length === 0 : data.prev.length === 0 && data.plan.length === 0
  const body = kind === 'daily' ? renderDaily(data) : renderWeekly(data)
  const html = wrapDocument(kind, body, date)
  const filename = filenameFor(kind, date)
  await db.saveReport(database, kind, date, filename, html)
  return { html, filename, empty }
}
