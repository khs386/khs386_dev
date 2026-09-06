// D1 접근. SQLite에는 배열·불리언 타입이 없어서 여기서 앱이 쓰는 모양으로 바꿔 준다.

import { seriesTotal, clampPct, clampWeight, newStageKey } from './series.js'

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

/**
 * 단위업무 목록.
 *
 * 먼저 시리즈로 묶는다. 시리즈끼리의 차례는 개발현황 화면에서 매긴 순서를
 * 그대로 따르고, 딸린 시리즈가 없는 업무는 맨 뒤에 둔다.
 *
 * 묶음 안에서는, 마감일만으로 줄을 세우면 끝난 지 오래된 업무가 맨 위에 온다.
 * 시간이 갈수록 나빠지므로 완료·보류를 먼저 아래로 내리고, 그 안에서 마감일
 * 순으로 둔다.
 */
export async function listTasks(db, { archived = false } = {}) {
  const { results } = await db
    .prepare(
      `select t.* from tasks t
       left join series_progress s on s.name = t.series
       where t.archived = ?
       order by (t.series is null or t.series = ''),
                coalesce(s.sort_order, 999999), t.series,
                case when t.status in ('완료', '보류') then 1 else 0 end,
                (t.deadline is null), t.deadline, t.created_at`
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

/**
 * 단위업무를 지운다. 지난 기록은 남는다.
 *
 * daily_logs는 제목·세부내용·상태를 제 안에 갖고 있어 단위업무가 없어도 기록으로
 * 완결된다. 그런데 외래키가 on delete cascade라 함께 지워졌다. 지운 날이 지난
 * 사실까지 지울 이유는 없다. 연결만 먼저 끊어 두면 cascade가 걸리지 않는다.
 * 주간 항목은 원래 set null이라 남는다 — 이제 규칙이 같아졌다.
 */
export async function deleteTask(db, id) {
  await db.batch([
    db.prepare('update daily_logs set task_id = null where task_id = ?').bind(id),
    db.prepare('delete from tasks where id = ?').bind(id),
  ])
}

/** 완료된 업무를 한꺼번에 보관함으로 옮긴다. 옮긴 건수를 돌려준다. */
export async function archiveDoneTasks(db) {
  const r = await db
    .prepare("update tasks set archived = 1 where archived = 0 and status = '완료'")
    .run()
  return r?.meta?.changes || 0
}

/* ── 일별 기록 ─────────────────────────────────────────── */

export async function listLogs(db, date) {
  const { results } = await db
    .prepare('select * from daily_logs where log_date = ? order by sort_order, created_at')
    .bind(date)
    .all()
  return (results || []).map(rowLog)
}

/**
 * 그 업무를 마지막으로 적은 날의 기록. 없으면 null.
 * 오늘 것은 보지 않는다 — 오늘 넣는 줄의 바탕이 될 값을 찾는 것이다.
 */
export async function lastLogForTask(db, taskId, before) {
  if (!taskId) return null
  return await db
    .prepare(
      `select * from daily_logs where task_id = ? and log_date < ?
       order by log_date desc, created_at desc limit 1`
    )
    .bind(taskId, before)
    .first()
}

/**
 * 목록에서 고른 업무를 그 날짜에 넣는다.
 *
 * 같은 업무를 이어서 적는 날이 많다. 어제 적어 둔 상태·우선순위·진행률·마감·
 * 기타 여부를 오늘 다시 채우게 하지 않고 그대로 가져와 바탕으로 삼는다.
 * 처음 넣는 업무면 단위업무에 적힌 값을 쓴다.
 *
 * 세부내용은 가져오지 않는다. 그날 한 일은 날마다 다르고, 지운 자리에 다시
 * 쓰는 것보다 빈 칸에서 시작하는 편이 낫다. 필요하면 화면의 [직전 내용
 * 가져오기]로 불러온다.
 */
/**
 * 화면에 있는 줄들의 "직전 세부내용". 업무 하나에 한 줄씩, {업무 id: 여러 줄 글}.
 *
 * 줄마다 따로 물어보면 질의가 줄 수만큼 늘어난다. 한 번에 읽어 와서 업무별로
 * 가장 최근 것만 남긴다.
 */
export async function prevDetails(db, taskIds, before) {
  const ids = [...new Set((taskIds || []).filter(Boolean))]
  if (!ids.length) return {}
  const { results } = await db
    .prepare(
      `select task_id, detail_lines from daily_logs
       where log_date < ? and task_id in (${ids.map(() => '?').join(',')})
       order by log_date desc, created_at desc`
    )
    .bind(before, ...ids)
    .all()
  const out = {}
  for (const r of results || []) {
    if (out[r.task_id]) continue
    const lines = parseLines(r.detail_lines)
    if (lines.length) out[r.task_id] = lines.join('\n')
  }
  return out
}

export async function addLogFromTask(db, date, task, order) {
  const prev = await lastLogForTask(db, task.id, date)
  const src = prev || task
  const id = uuid()
  await db
    .prepare(
      `insert into daily_logs
        (id, log_date, task_id, title, detail_lines, status, priority, progress, deadline, is_misc, sort_order)
       values (?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, date, task.id, task.title,
          src.status, src.priority, src.progress, src.deadline, bool(src.is_misc), order)
    .run()
  return { id, carried: !!prev }
}

/** 딸린 단위업무 없이 그 자리에서 적어 넣은 줄. 만든 id를 돌려준다. */
export async function addLogFree(db, date, title, order) {
  const id = uuid()
  await db
    .prepare(
      `insert into daily_logs
        (id, log_date, task_id, title, detail_lines, status, priority, sort_order, is_misc)
       values (?, ?, null, ?, '[]', '진행', '중간', ?, ?)`
    )
    .bind(id, date, title, order, bool(title === '기타 사항'))
    .run()
  return id
}

/** 기록을 저장하고, 연결된 단위 업무의 상태·진행률·마감도 함께 맞춘다. */
/**
 * 일일 기록 한 줄을 통째로 저장한다.
 *
 * 표에서는 업무명 칸도 고칠 수 있다. 목록에 있는 이름을 넣으면 그 단위업무에 붙고
 * (task_id), 아무 말이나 적으면 딸린 업무가 없는 줄이 된다.
 */
export async function saveLog(db, id, f) {
  const lines = String(f.detail_text || '')
    .split('\n')
    .map((s) => s.replace(/^[·\-•*\s]+/, '').trim())
    .filter(Boolean)
  await db
    .prepare(
      `update daily_logs set task_id = ?, title = ?, detail_lines = ?, status = ?, priority = ?,
              progress = ?, deadline = ?, is_misc = ? where id = ?`
    )
    .bind(str(f.task_id), f.title, JSON.stringify(lines), f.status, f.priority, num(f.progress),
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

export async function getLog(db, id) {
  const r = await db.prepare('select * from daily_logs where id = ?').bind(id).first()
  return r ? rowLog(r) : null
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
  const id = uuid()
  await db
    .prepare(
      `insert into weekly_items
        (id, week_start, kind, task_id, title, work_type, status, progress, due_date, note, output, sort_order)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, weekStart, kind, item.task_id || null, item.title, str(item.work_type),
          str(item.status), num(item.progress), str(item.due_date),
          item.note || '', item.output || '', order)
    .run()
  return id
}

export async function saveWeeklyItem(db, id, f) {
  await db
    .prepare(
      `update weekly_items set task_id = ?, title = ?, work_type = ?, status = ?, progress = ?,
              due_date = ?, note = ?, output = ? where id = ?`
    )
    .bind(str(f.task_id), f.title, str(f.work_type), str(f.status), num(f.progress),
          str(f.due_date), f.note || '', f.output || '', id)
    .run()
}

export async function getWeeklyItem(db, id) {
  return await db.prepare('select * from weekly_items where id = ?').bind(id).first()
}

export async function deleteWeeklyItem(db, id) {
  await db.prepare('delete from weekly_items where id = ?').bind(id).run()
}

/**
 * 주간 항목의 줄을 위아래로 옮긴다.
 *
 * 전주 실적과 금주 예정은 표가 따로라 sort_order도 0부터 따로 매겨진다.
 * 같은 kind 안에서만 이웃을 찾아야 두 표가 서로 자리를 바꾸지 않는다.
 *
 * 이웃과 값만 맞바꾸지 않고 그 kind를 통째로 다시 매긴다. 줄을 지우고 새로
 * 넣으면 sort_order가 겹치는 일이 생기는데, 겹친 둘을 맞바꾸면 아무 일도
 * 일어나지 않아 '눌러도 안 움직인다'가 된다.
 */
export async function moveWeeklyItem(db, id, dir) {
  const row = await db.prepare('select * from weekly_items where id = ?').bind(id).first()
  if (!row) return
  const { results } = await db
    .prepare(
      `select id from weekly_items where week_start = ? and kind = ?
        order by sort_order, created_at`
    )
    .bind(row.week_start, row.kind)
    .all()
  const list = (results || []).map((r) => r.id)
  const at = list.indexOf(id)
  const to = at + (dir < 0 ? -1 : 1)
  if (at < 0 || to < 0 || to >= list.length) return
  list[at] = list[to]
  list[to] = id
  await db.batch(
    list.map((x, i) =>
      db.prepare('update weekly_items set sort_order = ? where id = ?').bind(i, x))
  )
}

/* ── 시리즈 진행률 ─────────────────────────────────────── */

/**
 * 시리즈 목록. 각자의 단계를 함께 싣는다.
 *
 * 총 진행률은 저장된 값이 아니라 단계값으로 매번 계산한다. 몫을 고치면 다시
 * 저장하지 않아도 바로 반영된다.
 */
export async function listSeries(db) {
  const [{ results: rows }, { results: stages }] = await Promise.all([
    db.prepare('select * from series_progress order by sort_order').all(),
    db.prepare('select * from series_stages order by series_name, sort_order').all(),
  ])
  const byName = new Map()
  for (const st of stages || []) {
    if (!byName.has(st.series_name)) byName.set(st.series_name, [])
    byName.get(st.series_name).push(st)
  }
  return (rows || []).map((r) => {
    const own = byName.get(r.name) || []
    return { ...r, stages: own, total: seriesTotal(own, r.total_progress) }
  })
}

/* 기본 단계 목록 — 새 시리즈가 물려받는 본 */

export const listStagePresets = (db) =>
  db.prepare('select * from stage_presets order by sort_order, label').all()
    .then((r) => r.results || [])

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
  // 단계 목록은 기본 목록을 그대로 물려받는다. 이후로는 이 시리즈만의 것이라
  // 기본 목록을 고쳐도 따라오지 않는다.
  const presets = await listStagePresets(db)
  if (presets.length) await putStages(db, clean, presets)
  return { ok: true, name: clean }
}

/** 시리즈의 단계 목록을 통째로 갈아 끼운다. 없던 단계는 지워진다. */
async function putStages(db, name, stages) {
  const stmts = [db.prepare('delete from series_stages where series_name = ?').bind(name)]
  stages.forEach((st, i) => {
    stmts.push(
      db
        .prepare(
          `insert into series_stages (series_name, key, label, weight, value, sort_order)
           values (?, ?, ?, ?, ?, ?)`
        )
        .bind(name, st.key, String(st.label || '').trim() || st.key,
              clampWeight(st.weight), clampPct(st.value), i + 1)
    )
  })
  await db.batch(stmts)
}

export async function deleteSeries(db, name) {
  await db.batch([
    db.prepare('delete from series_stages where series_name = ?').bind(name),
    db.prepare('delete from series_progress where name = ?').bind(name),
  ])
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

/**
 * 시리즈 하나를 저장한다. 진행률·이름표·몫을 한꺼번에 받는다.
 *
 * total_progress에도 셈한 값을 넣어 둔다. 화면은 늘 단계값으로 다시 계산하므로
 * 읽는 쪽에서 쓰이지는 않지만, 단계를 하나도 안 쓰던 시절의 값과 자리를 맞춰
 * 두면 나중에 DB만 들여다볼 때 덜 헷갈린다.
 */
export async function saveSeries(db, name, { color, stages }) {
  await putStages(db, name, stages)
  await db
    .prepare('update series_progress set total_progress = ?, color = ?, updated_at = ? where name = ?')
    .bind(seriesTotal(stages), color || null, new Date().toISOString(), name)
    .run()
}

/** 이 시리즈에만 단계를 더한다. 몫 0으로 들어가 지금 숫자를 흔들지 않는다. */
export async function addSeriesStage(db, name, label) {
  const clean = String(label || '').trim()
  if (!clean) return { error: '단계 이름을 입력해 주세요.' }
  const last = await db
    .prepare('select max(sort_order) as m from series_stages where series_name = ?')
    .bind(name)
    .first()
  await db
    .prepare(
      `insert into series_stages (series_name, key, label, weight, value, sort_order)
       values (?, ?, ?, 0, null, ?)`
    )
    .bind(name, newStageKey(), clean, (last?.m || 0) + 1)
    .run()
  return { ok: true, label: clean }
}

export async function deleteSeriesStage(db, name, key) {
  await db
    .prepare('delete from series_stages where series_name = ? and key = ?')
    .bind(name, key)
    .run()
}

export async function moveSeriesStage(db, name, key, dir) {
  const { results } = await db
    .prepare('select key, sort_order from series_stages where series_name = ? order by sort_order')
    .bind(name)
    .all()
  const list = results || []
  const at = list.findIndex((x) => x.key === key)
  const to = at + (dir < 0 ? -1 : 1)
  if (at < 0 || to < 0 || to >= list.length) return
  await db.batch([
    db.prepare('update series_stages set sort_order = ? where series_name = ? and key = ?')
      .bind(list[to].sort_order, name, list[at].key),
    db.prepare('update series_stages set sort_order = ? where series_name = ? and key = ?')
      .bind(list[at].sort_order, name, list[to].key),
  ])
}

/** 이 시리즈의 단계를 기본 목록으로 갈아 끼운다. 이미 넣은 진행률은 살린다. */
export async function resetSeriesStages(db, name) {
  const [presets, { results }] = await Promise.all([
    listStagePresets(db),
    db.prepare('select key, value from series_stages where series_name = ?').bind(name).all(),
  ])
  const had = new Map((results || []).map((r) => [r.key, r.value]))
  await putStages(db, name, presets.map((p) => ({ ...p, value: had.get(p.key) ?? null })))
}

/* 기본 단계 목록 손보기 — 이미 있는 시리즈는 건드리지 않는다 */

export async function savePresets(db, rows) {
  const stmts = [db.prepare('delete from stage_presets')]
  rows.forEach((r, i) => {
    stmts.push(
      db
        .prepare('insert into stage_presets (key, label, weight, sort_order) values (?, ?, ?, ?)')
        .bind(r.key, String(r.label || '').trim() || r.key, clampWeight(r.weight), i + 1)
    )
  })
  await db.batch(stmts)
}

export async function addPreset(db, label) {
  const clean = String(label || '').trim()
  if (!clean) return { error: '단계 이름을 입력해 주세요.' }
  const last = await db.prepare('select max(sort_order) as m from stage_presets').first()
  await db
    .prepare('insert into stage_presets (key, label, weight, sort_order) values (?, ?, 0, ?)')
    .bind(newStageKey(), clean, (last?.m || 0) + 1)
    .run()
  return { ok: true, label: clean }
}

export async function deletePreset(db, key) {
  await db.prepare('delete from stage_presets where key = ?').bind(key).run()
}

export async function movePreset(db, key, dir) {
  const { results } = await db.prepare('select key, sort_order from stage_presets order by sort_order').all()
  const list = results || []
  const at = list.findIndex((x) => x.key === key)
  const to = at + (dir < 0 ? -1 : 1)
  if (at < 0 || to < 0 || to >= list.length) return
  await db.batch([
    db.prepare('update stage_presets set sort_order = ? where key = ?').bind(list[to].sort_order, list[at].key),
    db.prepare('update stage_presets set sort_order = ? where key = ?').bind(list[at].sort_order, list[to].key),
  ])
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

export async function countReports(db) {
  const r = await db.prepare('select count(*) n from reports').first()
  return r?.n || 0
}

/**
 * 보고서 한 건을 지운다. 앱에 담아 둔 것만 지우고 드라이브에 올라간 파일은
 * 건드리지 않는다 — 되돌릴 수 없는 범위를 좁게 둔다.
 */
export async function deleteReport(db, id) {
  const r = await db.prepare('select filename from reports where id = ?').bind(id).first()
  if (!r) return null
  await db.prepare('delete from reports where id = ?').bind(id).run()
  return r.filename
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

export async function createWorkType(db, name, series) {
  const clean = String(name || '').trim()
  if (!clean) return { error: '업무 유형 이름을 입력해 주세요.' }
  const dup = await db.prepare('select name from work_types where name = ?').bind(clean).first()
  if (dup) return { error: `"${clean}" 은(는) 이미 있습니다.` }
  const last = await db.prepare('select max(sort_order) as m from work_types').first()
  await db
    .prepare('insert into work_types (name, sort_order, series) values (?, ?, ?)')
    .bind(clean, (last?.m || 0) + 1, str(series))
    .run()
  return { ok: true, name: clean }
}

/**
 * 업무 유형의 이름과 시리즈를 한꺼번에 고친다.
 *
 * 이름을 바꾸면 그 유형을 쓰던 업무와 주간 항목도 함께 따라간다.
 * 시리즈를 비워 두면 공통 유형 — 어느 시리즈에서나 고를 수 있다.
 */
export async function saveWorkTypes(db, rows) {
  let changed = 0
  for (const { from, to, series } of rows) {
    const next = String(to || '').trim()
    if (!next) continue
    const nextSeries = str(series)
    const cur = await db.prepare('select * from work_types where name = ?').bind(from).first()
    if (!cur) continue
    if (next !== from) {
      const dup = await db.prepare('select name from work_types where name = ?').bind(next).first()
      if (dup) return { error: `"${next}" 은(는) 이미 있습니다.` }
      await db.batch([
        db.prepare('update work_types set name = ? where name = ?').bind(next, from),
        db.prepare('update tasks set work_type = ? where work_type = ?').bind(next, from),
        db.prepare('update weekly_items set work_type = ? where work_type = ?').bind(next, from),
      ])
      changed += 1
    }
    if ((cur.series || null) !== nextSeries) {
      await db.prepare('update work_types set series = ? where name = ?').bind(nextSeries, next).run()
      if (next === from) changed += 1
    }
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

/* ── 모닝브리프 ─────────────────────────────────────────── */

/** 하루에 한 건. 같은 날짜로 다시 오면 덮어쓴다. */
export async function saveBrief(db, b) {
  await db
    .prepare(
      `insert into briefs (brief_date, html, events, todo, done, headline, source, items, created_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       on conflict(brief_date) do update set
         html = excluded.html, events = excluded.events, todo = excluded.todo,
         done = excluded.done, headline = excluded.headline, source = excluded.source,
         items = excluded.items, created_at = datetime('now')`
    )
    .bind(
      b.date, b.html, num(b.events), num(b.todo), num(b.done),
      str(b.headline), str(b.source), b.items ? JSON.stringify(b.items) : null
    )
    .run()
}

/** items는 JSON 한 덩어리로 넣어 두었으니 읽을 때 풀어 준다. */
export async function getBrief(db, date) {
  const r = await db.prepare('select * from briefs where brief_date = ?').bind(date).first()
  if (!r) return r
  let items = {}
  try {
    const v = JSON.parse(r.items || '{}')
    if (v && typeof v === 'object' && !Array.isArray(v)) items = v
  } catch {
    items = {}
  }
  const list = (k) => (Array.isArray(items[k]) ? items[k].filter((x) => typeof x === 'string') : [])
  return { ...r, items: { events: list('events'), todo: list('todo'), done: list('done') } }
}

/** 목록에서는 html을 빼고 읽는다. 한 건이 수백 KB라 다 읽으면 느리다. */
export const listBriefs = (db, limit = 30) =>
  db
    .prepare(
      `select brief_date, events, todo, done, headline, created_at
         from briefs order by brief_date desc limit ?`
    )
    .bind(limit)
    .all()
    .then((r) => r.results || [])

/* ── 법인카드 ──────────────────────────────────────────── */

/**
 * 한 달치 사용 내역. 최근에 쓴 것이 위로 온다.
 *
 * 같은 날 여러 건이면 나중에 넣은 것을 아래에 둔다. 카드 명세서를 위에서부터
 * 옮겨 적는 순서 그대로 쌓이게 하려는 것이다.
 */
export async function listExpenses(db, month) {
  const { results } = await db
    .prepare(
      `select * from card_expenses
        where used_on >= ? and used_on <= ?
        order by used_on desc, created_at`
    )
    .bind(`${month}-01`, `${month}-31`)
    .all()
  return results || []
}

export async function getExpense(db, id) {
  return db.prepare('select * from card_expenses where id = ?').bind(id).first()
}

export async function createExpense(db, f) {
  const id = uuid()
  await db
    .prepare(
      `insert into card_expenses (id, used_on, title, spender, merchant, amount, account, settle, note)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, f.used_on, String(f.title || '').trim(), str(f.spender), str(f.merchant),
          Number(f.amount) || 0, str(f.account), f.settle || '지출품의 예정', f.note || '')
    .run()
  return id
}

export async function saveExpense(db, id, f) {
  await db
    .prepare(
      `update card_expenses set used_on = ?, title = ?, spender = ?, merchant = ?,
              amount = ?, account = ?, settle = ?, note = ? where id = ?`
    )
    .bind(f.used_on, String(f.title || '').trim(), str(f.spender), str(f.merchant),
          Number(f.amount) || 0, str(f.account), f.settle || '지출품의 예정', f.note || '', id)
    .run()
}

export async function deleteExpense(db, id) {
  await db.prepare('delete from card_expenses where id = ?').bind(id).run()
}

/* 고르는 칸에 나오는 값들 */

const listNamed = (db, table) =>
  db
    .prepare(`select * from ${table} order by sort_order, name`)
    .all()
    .then((r) => r.results || [])

export const listCardAccounts = (db) => listNamed(db, 'card_accounts')
export const listCardUsers = (db) => listNamed(db, 'card_users')
export const listCardSettles = (db) =>
  listNamed(db, 'card_settles').then((rows) => rows.map((r) => ({ ...r, done: !!r.done })))

export const listCardPresets = (db) =>
  db
    .prepare('select * from card_presets order by sort_order, title')
    .all()
    .then((r) => r.results || [])

/** 항목 관리에서 쓰는 세 표는 이름이 열쇠라 손보는 방식이 같다. */
const CARD_LISTS = {
  account: { table: 'card_accounts', label: '처리 계정', used: 'account' },
  user: { table: 'card_users', label: '사용자', used: 'spender' },
  settle: { table: 'card_settles', label: '정산상태', used: 'settle' },
}

export const cardList = (kind) => CARD_LISTS[kind] || null

export async function createCardItem(db, kind, name) {
  const t = CARD_LISTS[kind]
  if (!t) return { error: '알 수 없는 항목입니다.' }
  const clean = String(name || '').trim()
  if (!clean) return { error: `${t.label} 이름을 입력해 주세요.` }
  const dup = await db.prepare(`select name from ${t.table} where name = ?`).bind(clean).first()
  if (dup) return { error: `"${clean}" 은(는) 이미 있습니다.` }
  const last = await db.prepare(`select max(sort_order) as m from ${t.table}`).first()
  const order = (last?.m || 0) + 1
  await db
    .prepare(
      kind === 'settle'
        ? `insert into ${t.table} (name, color, done, sort_order) values (?, '회색', 0, ?)`
        : `insert into ${t.table} (name, sort_order) values (?, ?)`
    )
    .bind(clean, order)
    .run()
  return { ok: true, name: clean }
}

/**
 * 이름·색·'정산 끝'을 한꺼번에 고친다.
 *
 * 이름을 바꾸면 그 값을 쓰던 지출도 함께 따라간다. 업무 유형을 고칠 때와
 * 같은 규칙이다 — 이름만 바꿨는데 지난 기록이 떨어져 나가면 안 된다.
 */
export async function saveCardItems(db, kind, rows) {
  const t = CARD_LISTS[kind]
  if (!t) return { error: '알 수 없는 항목입니다.' }
  let changed = 0
  for (const { from, to, color, done } of rows) {
    const next = String(to || '').trim()
    if (!next) continue
    const cur = await db.prepare(`select * from ${t.table} where name = ?`).bind(from).first()
    if (!cur) continue
    if (next !== from) {
      const dup = await db.prepare(`select name from ${t.table} where name = ?`).bind(next).first()
      if (dup) return { error: `"${next}" 은(는) 이미 있습니다.` }
      await db.batch([
        db.prepare(`update ${t.table} set name = ? where name = ?`).bind(next, from),
        db
          .prepare(`update card_expenses set ${t.used} = ? where ${t.used} = ?`)
          .bind(next, from),
      ])
      changed += 1
    }
    if (kind === 'settle') {
      const nextDone = done ? 1 : 0
      if ((cur.color || '') !== color || cur.done !== nextDone) {
        await db
          .prepare('update card_settles set color = ?, done = ? where name = ?')
          .bind(color || '회색', nextDone, next)
          .run()
        if (next === from) changed += 1
      }
    }
  }
  return { ok: true, changed }
}

/**
 * 항목을 지운다. 그 값을 쓰던 지출은 남고 그 칸만 빈다 — 돈을 쓴 사실까지
 * 사라지면 정산이 맞지 않는다. 다만 정산상태는 비울 수 없으므로 처음 상태로
 * 되돌린다.
 */
export async function deleteCardItem(db, kind, name) {
  const t = CARD_LISTS[kind]
  if (!t) return
  const back = kind === 'settle' ? '지출품의 예정' : null
  await db.batch([
    db.prepare(`delete from ${t.table} where name = ?`).bind(name),
    db.prepare(`update card_expenses set ${t.used} = ? where ${t.used} = ?`).bind(back, name),
  ])
}

export async function moveCardItem(db, kind, name, dir) {
  const t = CARD_LISTS[kind]
  if (!t) return
  const row = await db.prepare(`select * from ${t.table} where name = ?`).bind(name).first()
  if (!row) return
  const neighbour = await db
    .prepare(
      dir < 0
        ? `select * from ${t.table} where sort_order < ? order by sort_order desc limit 1`
        : `select * from ${t.table} where sort_order > ? order by sort_order limit 1`
    )
    .bind(row.sort_order)
    .first()
  if (!neighbour) return
  await db.batch([
    db.prepare(`update ${t.table} set sort_order = ? where name = ?`).bind(neighbour.sort_order, row.name),
    db.prepare(`update ${t.table} set sort_order = ? where name = ?`).bind(row.sort_order, neighbour.name),
  ])
}

/* 반복 결제 — 달마다 빠짐없이 나가야 하는 지출 */

export const listRecurring = (db) =>
  db.prepare('select * from card_recurring order by sort_order, title').all()
    .then((r) => (r.results || []).map((x) => ({ ...x, enabled: !!x.enabled })))

export async function addRecurring(db, f) {
  const title = String(f.title || '').trim()
  const merchant = String(f.merchant || '').trim()
  if (!title) return { error: '이름을 입력해 주세요.' }
  if (!merchant) return { error: '사용처를 입력해 주세요. 이 이름으로 결제가 들어왔는지 가립니다.' }
  const last = await db.prepare('select max(sort_order) as m from card_recurring').first()
  await db
    .prepare(
      `insert into card_recurring
         (id, title, merchant, amount, account, spender, from_month, to_month, sort_order)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(uuid(), title, merchant, Number(f.amount) || 0, str(f.account), str(f.spender),
          str(f.from_month), str(f.to_month), (last?.m || 0) + 1)
    .run()
  return { ok: true, title }
}

/** 줄마다 한꺼번에 저장한다. 화면에 그려진 것만 오므로 지운 줄은 되살아나지 않는다. */
export async function saveRecurring(db, rows) {
  if (!rows.length) return { ok: true, changed: 0 }
  await db.batch(
    rows.map((r) =>
      db
        .prepare(
          `update card_recurring set title = ?, merchant = ?, amount = ?, account = ?,
                  spender = ?, from_month = ?, to_month = ?, enabled = ? where id = ?`
        )
        .bind(String(r.title || '').trim(), String(r.merchant || '').trim(),
              Number(r.amount) || 0, str(r.account), str(r.spender),
              str(r.from_month), str(r.to_month), bool(r.enabled), r.id)
    )
  )
  return { ok: true, changed: rows.length }
}

export async function deleteRecurring(db, id) {
  await db.prepare('delete from card_recurring where id = ?').bind(id).run()
}
