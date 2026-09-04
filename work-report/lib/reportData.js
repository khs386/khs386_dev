// DB 행 → 렌더러 입력 변환. 화면과 cron이 같은 코드를 쓰도록 여기 한 곳에 모은다.
import { renderDaily } from './report/daily.js'
import { renderWeekly } from './report/weekly.js'
import { weekStart } from './report/format.js'

const DEFAULTS = {
  author: '초등콘텐츠사업부 권호상',
  short_author: '권호상',
  footer: '이 보고서는 Notion 업무 관리 데이터를 기반으로 자동 생성되었습니다.',
  holidays: [
    '01-01', '01-28', '01-29', '01-30', '03-01', '05-05', '05-25', '06-06',
    '08-15', '09-25', '09-26', '09-27', '10-03', '10-09', '12-25',
  ],
}

export async function loadSettings(sb) {
  const { data } = await sb.from('settings').select('*').eq('id', 1).maybeSingle()
  return { ...DEFAULTS, ...(data || {}) }
}

export async function loadSeries(sb) {
  const { data } = await sb
    .from('series_progress')
    .select('name, total_progress, sort_order')
    .order('sort_order')
  return (data || []).map((s) => ({ name: s.name, progress: s.total_progress }))
}

/** 주말·공휴일 판정. 공휴일 목록은 'MM-DD' 문자열. */
export function isSkipDay(iso, holidays) {
  const d = new Date(`${iso}T00:00:00Z`)
  const wd = d.getUTCDay()
  if (wd === 0 || wd === 6) return '주말'
  if ((holidays || DEFAULTS.holidays).includes(iso.slice(5))) return '공휴일'
  return null
}

/** 일일 보고서 입력 데이터를 만든다. */
export async function buildDailyData(sb, date) {
  const [settings, series, logs] = await Promise.all([
    loadSettings(sb),
    loadSeries(sb),
    sb
      .from('daily_logs')
      .select('*')
      .eq('log_date', date)
      .order('sort_order')
      .then(({ data }) => data || []),
  ])
  return {
    date,
    author: settings.author,
    footer: settings.footer,
    tasks: logs.map((l) => ({
      title: l.title,
      status: l.status,
      priority: l.priority,
      progress: l.progress,
      deadline: l.deadline,
      isMisc: l.is_misc,
      details: l.detail_lines || [],
    })),
    series,
  }
}

/** 주간 보고서 입력 데이터를 만든다. date는 보고 기준일(보통 금요일). */
export async function buildWeeklyData(sb, date) {
  const ws = weekStart(date)
  const [settings, series, items] = await Promise.all([
    loadSettings(sb),
    loadSeries(sb),
    sb
      .from('weekly_items')
      .select('*')
      .eq('week_start', ws)
      .order('sort_order')
      .then(({ data }) => data || []),
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
    author: settings.author,
    shortAuthor: settings.short_author,
    footer: settings.footer,
    prev: pick('전주 실적'),
    plan: pick('금주 예정'),
    series,
  }
}

export function filenameFor(kind, date) {
  return kind === 'daily' ? `report_${date}.html` : `weekly_report_${date}.html`
}

/**
 * 저장·전달용 문서로 감싼다.
 * 일일 보고서는 표 조각이라 charset 선언이 없어, 파일로 내려받거나 드라이브에서 열면
 * 한글이 깨진다. 보고서 내용은 그대로 두고 문서 껍데기만 씌운다.
 * 주간 보고서는 이미 완결 문서라 손대지 않는다.
 */
export function wrapDocument(kind, html, date, title) {
  if (kind !== 'daily') return html
  const name = title || `일일 업무 보고서 ${date}`
  return (
    '<!DOCTYPE html>\n<html lang="ko"><head><meta charset="UTF-8">' +
    `<title>${name}</title></head>\n` +
    `<body style="margin:0;padding:40px 0;background:#ffffff;">\n${html}\n</body></html>`
  )
}

/** 보고서를 만들어 reports 테이블에 저장하고 { html, filename }을 돌려준다. */
export async function generateReport(sb, kind, date) {
  const data = kind === 'daily' ? await buildDailyData(sb, date) : await buildWeeklyData(sb, date)
  const empty =
    kind === 'daily'
      ? data.tasks.length === 0
      : data.prev.length === 0 && data.plan.length === 0
  const body = kind === 'daily' ? renderDaily(data) : renderWeekly(data)
  const html = wrapDocument(kind, body, date)
  const filename = filenameFor(kind, date)
  // 다시 만들면 이전 업로드 링크는 더 이상 이 내용을 가리키지 않는다. 같이 지운다.
  await sb.from('reports').upsert(
    { kind, report_date: date, filename, html, drive_file_id: null, drive_link: null },
    { onConflict: 'kind,report_date' }
  )
  return { html, filename, empty, data }
}
