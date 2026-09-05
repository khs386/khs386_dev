// D1 접근. SQLite에는 배열·불리언 타입이 없어서 여기서 앱이 쓰는 모양으로 바꿔 준다.

import { STAGES, seriesTotal } from './series.js'

const uuid = () => crypto.randomUUID()
const bool = (v) => (v ? 1 : 0)
const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v))
const str = (v) => (v === '' || v === undefined ? null : v)

function parseLines(json) {
  try {
    const v = JSON.parse(json || '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

const rowTask = (r) => ({ ...r, is_misc: !!r.is_misc, archived: !!r.archived })
const rowLog = (r) => ({ ...r, is_misc: !!r.is_misc, detail_lines: parseLines(r.detail_lines) })

/* ── 단위 업무 ─────────────────────────────────────────── */

export async function listTasks(db, { archived = false } = {}) {
  const { results } = await db
    .prepare(
      `select * from tasks where archived = ?
       order by (deadline is null), deadline, created_at`
    )
    .bind(bool(archived))
    .all()
  return (results || []).map(rowTask)
}

export async function getTask(db, id) {
  const r = await db.prepare('select * from tasks where id = ?').bind(id).first()
  return r ? rowTask(r) : null
}

export async function createTask(db, f) {
  const id = uuid()
  await db
    .prepare(
      `insert into tasks (id, title, series, work_type, priority, status, progress, deadline, is_misc)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, f.title.trim(), str(f.series), str(f.work_type), f.priority, f.status,
          num(f.progress), str(f.deadline), bool(f.is_misc))
    .run()
  return id
}

export async function updateTask(db, id, f) {
  await db
    .prepare(
      `update tasks set title = ?, series = ?, work_type = ?, priority = ?,
              status = ?, progress = ?, deadline = ?, is_misc = ? where id = ?`
    )
    .bind(f.title.trim(), str(f.series), str(f.work_type), f.priority, f.status,
          num(f.progress), str(f.deadline), bool(f.is_misc), id)
    .run()
}

export async function setTaskArchived(db, id, archived) {
  await db.prepare('update tasks set archived = ? where id = ?').bind(bool(archived), id).run()
}

export async function deleteTask(db, id) {
  await db.prepare('delete from tasks where id = ?').bind(id).run()
}

/* ── 일별 기록 ─────────────────────────────────────────── */

export async function listLogs(db, date) {
  const { results } = await db
    .prepare('select * from daily_logs where log_date = ? order by sort_order, created_at')
    .bind(date)
    .all()
  return (results || []).map(rowLog)
}

export async function addLogFromTask(db, date, task, order) {
  await db
    .prepare(
      `insert into daily_logs
        (id, log_date, task_id, title, detail_lines, status, priority, progress, deadline, is_misc, sort_order)
       values (?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, ?)`
    )
    .bind(uuid(), date, task.id, task.title, task.status, task.priority,
          task.progress, task.deadline, bool(task.is_misc), order)
    .run()
}

export async function addLogFree(db, date, title, order) {
  await db
    .prepare(
      `insert into daily_logs
        (id, log_date, task_id, title, detail_lines, status, priority, sort_order, is_misc)
       values (?, ?, null, ?, '[]', '진행', '중간', ?, ?)`
    )
    .bind(uuid(), date, title, order, bool(title === '기타 사항'))
    .run()
}

/** 기록을 저장하고, 연결된 단위 업무의 상태·진행률·마감도 함께 맞춘다. */
export async function saveLog(db, id, f) {
  const lines = String(f.detail_text || '')
    .split('\n')
    .map((s) => s.replace(/^[·\-•*\s]+/, '').trim())
    .filter(Boolean)
  await db
    .prepare(
      `update daily_logs set detail_lines = ?, status = ?, priority = ?,
              progress = ?, deadline = ?, is_misc = ? where id = ?`
    )
    .bind(JSON.stringify(lines), f.status, f.priority, num(f.progress),
          str(f.deadline), bool(f.is_misc), id)
    .run()

  const log = await db.prepare('select task_id from daily_logs where id = ?').bind(id).first()
  if (log?.task_id) {
    await db
      .prepare('update tasks set status = ?, priority = ?, progress = ?, deadline = ? where id = ?')
      .bind(f.status, f.priority, num(f.progress), str(f.deadline), log.task_id)
      .run()
  }
}

export async function deleteLog(db, id) {
  await db.prepare('delete from daily_logs where id = ?').bind(id).run()
}

export async function moveLog(db, id, dir) {
  const row = await db.prepare('select * from daily_logs where id = ?').bind(id).first()
  if (!row) return
  const neighbour = await db
    .prepare(
      dir < 0
        ? 'select * from daily_logs where log_date = ? and sort_order < ? order by sort_order desc limit 1'
        : 'select * from daily_logs where log_date = ? and sort_order > ? order by sort_order limit 1'
    )
    .bind(row.log_date, row.sort_order)
    .first()
  if (!neighbour) return
  await db.batch([
    db.prepare('update daily_logs set sort_order = ? where id = ?').bind(neighbour.sort_order, row.id),
    db.prepare('update daily_logs set sort_order = ? where id = ?').bind(row.sort_order, neighbour.id),
  ])
}

/* ── 주간 현황 ─────────────────────────────────────────── */

export async function listWeekly(db, weekStart) {
  const { results } = await db
    .prepare('select * from weekly_items where week_start = ? order by sort_order, created_at')
    .bind(weekStart)
    .all()
  return results || []
}

export async function addWeeklyItem(db, weekStart, kind, item, order) {
  await db
    .prepare(
      `insert into weekly_items
        (id, week_start, kind, task_id, title, work_type, status, progress, due_date, note, output, sort_order)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', ?)`
    )
    .bind(uuid(), weekStart, kind, item.task_id || null, item.title, str(item.work_type),
          str(item.status), num(item.progress), str(item.due_date), order)
    .run()
}

export async function saveWeeklyItem(db, id, f) {
  await db
    .prepare(
      `update weekly_items set title = ?, work_type = ?, status = ?, progress = ?,
              due_date = ?, note = ?, output = ? where id = ?`
    )
    .bind(f.title, str(f.work_type), str(f.status), num(f.progress),
          str(f.due_date), f.note || '', f.output || '', id)
    .run()
}

export async function deleteWeeklyItem(db, id) {
  await db.prepare('delete from weekly_items where id = ?').bind(id).run()
}

/* ── 시리즈 진행률 ─────────────────────────────────────── */

export async function listSeries(db) {
  const { results } = await db
    .prepare('select * from series_progress order by sort_order')
    .all()
  // 총 진행률은 저장된 값이 아니라 단계값으로 매번 계산한다
  return (results || []).map((r) => ({ ...r, total: seriesTotal(r) }))
}

/** 화면에서 고를 수 있는 색. 보고서 막대에 그대로 쓰인다. */
export const SERIES_PALETTE = [
  ['파랑', '#378ADD'], ['주황', '#e67e22'], ['보라', '#9b59b6'],
  ['초록', '#639922'], ['빨강', '#e74c3c'], ['청록', '#0a7c6e'],
  ['남색', '#34495e'], ['분홍', '#e84393'],
]

export async function createSeries(db, name, color) {
  const clean = String(name || '').trim()
  if (!clean) return { error: '시리즈 이름을 입력해 주세요.' }
  const dup = await db.prepare('select name from series_progress where name = ?').bind(clean).first()
  if (dup) return { error: `"${clean}" 은(는) 이미 있습니다.` }
  const last = await db.prepare('select max(sort_order) as m from series_progress').first()
  await db
    .prepare('insert into series_progress (name, total_progress, sort_order, color) values (?, 0, ?, ?)')
    .bind(clean, (last?.m || 0) + 1, color || SERIES_PALETTE[0][1])
    .run()
  return { ok: true, name: clean }
}

export async function deleteSeries(db, name) {
  await db.prepare('delete from series_progress where name = ?').bind(name).run()
}

/** 위아래로 한 칸 옮긴다. */
export async function moveSeries(db, name, dir) {
  const row = await db.prepare('select * from series_progress where name = ?').bind(name).first()
  if (!row) return
  const neighbour = await db
    .prepare(
      dir < 0
        ? 'select * from series_progress where sort_order < ? order by sort_order desc limit 1'
        : 'select * from series_progress where sort_order > ? order by sort_order limit 1'
    )
    .bind(row.sort_order)
    .first()
  if (!neighbour) return
  await db.batch([
    db.prepare('update series_progress set sort_order = ? where name = ?').bind(neighbour.sort_order, row.name),
    db.prepare('update series_progress set sort_order = ? where name = ?').bind(row.sort_order, neighbour.name),
  ])
}

const pct = (v) =>
  v === '' || v === null || v === undefined ? null : Math.max(0, Math.min(100, Number(v) || 0))

export async function saveSeries(db, entries) {
  const now = new Date().toISOString()
  const cols = STAGES.map((s) => s.key)
  const setSql = cols.map((k) => `${k} = ?`).join(', ')
  await db.batch(
    entries.map((e) => {
      const values = cols.map((k) => pct(e[k]))
      const row = Object.fromEntries(cols.map((k, i) => [k, values[i]]))
      return db
        .prepare(
          `update series_progress set ${setSql}, total_progress = ?, color = ?, updated_at = ?
           where name = ?`
        )
        .bind(...values, seriesTotal(row), e.color || null, now, e.name)
    })
  )
}

/* ── 보고서 이력 ───────────────────────────────────────── */

export async function getReport(db, kind, date) {
  return db
    .prepare('select * from reports where kind = ? and report_date = ?')
    .bind(kind, date)
    .first()
}

export async function saveReport(db, kind, date, filename, html) {
  // 다시 만들면 이전 업로드 링크는 더 이상 이 내용을 가리키지 않으므로 함께 지운다.
  await db
    .prepare(
      `insert into reports (id, kind, report_date, filename, html, drive_file_id, drive_link)
       values (?, ?, ?, ?, ?, null, null)
       on conflict (kind, report_date) do update set
         filename = excluded.filename, html = excluded.html,
         drive_file_id = null, drive_link = null, created_at = datetime('now')`
    )
    .bind(uuid(), kind, date, filename, html)
    .run()
}

export async function setReportDrive(db, kind, date, fileId, link) {
  await db
    .prepare('update reports set drive_file_id = ?, drive_link = ? where kind = ? and report_date = ?')
    .bind(fileId, link, kind, date)
    .run()
}

export async function listReports(db, limit = 30) {
  const { results } = await db
    .prepare('select id, kind, report_date, filename, drive_link, created_at from reports order by report_date desc, kind limit ?')
    .bind(limit)
    .all()
  return results || []
}

/* ── 설정 ──────────────────────────────────────────────── */

export async function getSettings(db) {
  const r = await db.prepare('select * from settings where id = 1').first()
  let holidays = []
  try {
    holidays = JSON.parse(r?.holidays || '[]')
  } catch {
    holidays = []
  }
  return { footer: r?.footer || '', holidays }
}

/* ── 업무 유형 ─────────────────────────────────────────── */

export async function listWorkTypes(db) {
  const { results } = await db
    .prepare('select * from work_types order by sort_order, name')
    .all()
  return results || []
}

export async function createWorkType(db, name) {
  const clean = String(name || '').trim()
  if (!clean) return { error: '업무 유형 이름을 입력해 주세요.' }
  const dup = await db.prepare('select name from work_types where name = ?').bind(clean).first()
  if (dup) return { error: `"${clean}" 은(는) 이미 있습니다.` }
  const last = await db.prepare('select max(sort_order) as m from work_types').first()
  await db
    .prepare('insert into work_types (name, sort_order) values (?, ?)')
    .bind(clean, (last?.m || 0) + 1)
    .run()
  return { ok: true, name: clean }
}

/** 이름을 바꾸면 그 유형을 쓰던 업무와 주간 항목도 함께 따라간다. */
export async function renameWorkTypes(db, pairs) {
  const changed = []
  for (const { from, to } of pairs) {
    const next = String(to || '').trim()
    if (!next || next === from) continue
    const dup = await db.prepare('select name from work_types where name = ?').bind(next).first()
    if (dup) return { error: `"${next}" 은(는) 이미 있습니다.` }
    await db.batch([
      db.prepare('update work_types set name = ? where name = ?').bind(next, from),
      db.prepare('update tasks set work_type = ? where work_type = ?').bind(next, from),
      db.prepare('update weekly_items set work_type = ? where work_type = ?').bind(next, from),
    ])
    changed.push(next)
  }
  return { ok: true, changed }
}

export async function deleteWorkType(db, name) {
  await db.prepare('delete from work_types where name = ?').bind(name).run()
}

export async function moveWorkType(db, name, dir) {
  const row = await db.prepare('select * from work_types where name = ?').bind(name).first()
  if (!row) return
  const neighbour = await db
    .prepare(
      dir < 0
        ? 'select * from work_types where sort_order < ? order by sort_order desc limit 1'
        : 'select * from work_types where sort_order > ? order by sort_order limit 1'
    )
    .bind(row.sort_order)
    .first()
  if (!neighbour) return
  await db.batch([
    db.prepare('update work_types set sort_order = ? where name = ?').bind(neighbour.sort_order, row.name),
    db.prepare('update work_types set sort_order = ? where name = ?').bind(row.sort_order, neighbour.name),
  ])
}
