// 업무보고서 — Cloudflare Workers 진입점.
// 화면(GET)과 폼 처리(POST)를 모두 이 워커가 맡고, 정해진 시각에 스스로 깨어나 보고서를 만든다.
import { Hono } from 'hono'
import * as db from './lib/db.js'
import { isLoggedIn, makeSessionCookie, clearSessionCookie, checkPassword, checkBriefToken } from './lib/auth.js'
import { driveConfigured, uploadHtml } from './lib/drive.js'
import {
  todayKST, skipReason, generateReport, filenameFor,
} from './lib/reports.js'
import { weekStart } from './lib/report/format.js'
import { soonTasks } from './lib/tasks.js'
import {
  monthOr, monthOf, monthStart, shiftMonth, koreanMonth, summarize, missingRecurring,
} from './lib/cards.js'
import { voucherSheets, voucherFilename, voucherDocument, voucherFile } from './lib/voucher.js'
import { STAGE_KEY } from './lib/series.js'
import { loginPage, FAVICON } from './views/layout.js'
import { privacyPage, termsPage } from './views/legal.js'
import {
  todayPage, tasksPage, dailyPage, weeklyPage, seriesPage, reportsPage, briefPage, cardsPage,
  dailyRow, weeklyRow, cardRow,
} from './views/pages.js'

const app = new Hono()

const html = (c, body) => c.html(body)
/** 처리 후 같은 화면으로 되돌린다. 새로고침해도 같은 요청이 되풀이되지 않는다. */
const back = (c, path, msg) =>
  c.redirect(path + (msg ? (path.includes('?') ? '&' : '?') + 'msg=' + encodeURIComponent(msg) : ''))

const dateOr = (v, fallback) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : fallback)

/* ── 로그인 ─────────────────────────────────────────────── */

// 아이콘과 약관 페이지는 로그인 없이 열린다.
app.get('/favicon.svg', (c) =>
  new Response(FAVICON, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  }))
// 크롬이 직접 찾는 경로. 내용은 없다고 알려 주면 위 <link>를 따른다.
app.get('/favicon.ico', () => new Response(null, { status: 204 }))

// 구글 OAuth 동의 화면 게시에 필요한 공개 페이지. 로그인 없이 열린다.
app.get('/privacy', (c) => html(c, privacyPage(c.env)))
app.get('/terms', (c) => html(c, termsPage(c.env)))

app.get('/login', (c) => html(c, loginPage(c.req.query('e'))))

app.post('/login', async (c) => {
  const form = await c.req.formData()
  if (!c.env.APP_PASSWORD || !c.env.SESSION_SECRET) {
    return html(c, loginPage('APP_PASSWORD와 SESSION_SECRET이 설정되지 않았습니다.'))
  }
  if (!checkPassword(c.env, form.get('password'))) {
    return html(c, loginPage('비밀번호가 맞지 않습니다.'))
  }
  c.header('Set-Cookie', await makeSessionCookie(c.env))
  return c.redirect('/')
})

app.post('/logout', (c) => {
  c.header('Set-Cookie', clearSessionCookie())
  return c.redirect('/login')
})

// 로그인 화면 말고는 전부 확인한다.
const PUBLIC = ['/login', '/privacy', '/terms', '/favicon.svg', '/favicon.ico', '/api/brief']
app.use('*', async (c, next) => {
  if (PUBLIC.includes(c.req.path)) return next()
  if (!(await isLoggedIn(c.req.raw, c.env))) return c.redirect('/login')
  await next()
})

/* ── 오늘 ───────────────────────────────────────────────── */

app.get('/', async (c) => {
  const today = todayKST()
  const [logs, weekly, series, tasks, brief] = await Promise.all([
    db.listLogs(c.env.DB, today),
    db.listWeekly(c.env.DB, weekStart(today)),
    db.listSeries(c.env.DB),
    db.listTasks(c.env.DB),
    db.getBrief(c.env.DB, today),
  ])
  const soon = soonTasks(tasks, today)
  return html(c, todayPage({
    today, logs, series, soon, brief,
    weekly: {
      prev: weekly.filter((w) => w.kind === '전주 실적').length,
      plan: weekly.filter((w) => w.kind === '금주 예정').length,
      // 아침에 훑는 화면이라 앞으로 할 일만 싣는다. 전주 실적은 주간 보고서를
      // 만들 때 /weekly에서 본다.
      planItems: weekly.filter((w) => w.kind === '금주 예정'),
    },
  }))
})

/* ── 업무 ───────────────────────────────────────────────── */

function taskForm(form) {
  return {
    title: form.get('title') || '',
    series: form.get('series') || '',
    work_type: form.get('work_type') || '',
    priority: form.get('priority') || '중간',
    status: form.get('status') || '진행',
    progress: form.get('progress'),
    deadline: form.get('deadline'),
    is_misc: form.get('is_misc') === '1',
  }
}

app.get('/tasks', async (c) => {
  const archived = c.req.query('archived') === '1'
  const [tasks, series, workTypes, archivedList] = await Promise.all([
    db.listTasks(c.env.DB, { archived }),
    db.listSeries(c.env.DB),
    db.listWorkTypes(c.env.DB),
    archived ? Promise.resolve([]) : db.listTasks(c.env.DB, { archived: true }),
  ])
  const editId = c.req.query('edit')
  return html(c, tasksPage({
    tasks, archived,
    // 시리즈와 업무 유형은 화면에서 관리하는 목록을 그대로 쓴다
    seriesNames: series.map((s) => s.name),
    workTypes,
    archivedCount: archivedList.length,
    editing: editId ? await db.getTask(c.env.DB, editId) : null,
  }))
})

/**
 * 업무 유형은 시리즈를 따라간다. 화면에서 걸러 주지만 여기서 한 번 더 본다.
 *
 * 고른 유형이 다른 시리즈에 매여 있으면 그 시리즈의 유형으로 바꿔 놓고, 무엇을
 * 어떻게 바꿨는지 알려 준다. 되돌려 보내면 적어 둔 것이 다 날아가므로 막지 않는다.
 * 시리즈가 없는 공통 유형은 어디서나 그대로 둔다.
 */
async function fitWorkType(env, f) {
  const types = await db.listWorkTypes(env.DB)
  const cur = types.find((t) => t.name === f.work_type)
  if (!f.work_type || !cur || !cur.series || cur.series === f.series) return ''
  const fit = types.find((t) => t.series === f.series) || types.find((t) => !t.series)
  const before = f.work_type
  f.work_type = fit ? fit.name : ''
  return ` 업무 유형은 시리즈에 맞춰 "${before}" → "${f.work_type || '선택 안 함'}"으로 바꿨습니다.`
}

app.post('/tasks/new', async (c) => {
  const f = taskForm(await c.req.formData())
  if (!f.title.trim()) return back(c, '/tasks', '업무명을 입력해 주세요.')
  const fixed = await fitWorkType(c.env, f)
  await db.createTask(c.env.DB, f)
  return back(c, '/tasks', '추가했습니다.' + fixed)
})

app.post('/tasks/:id/save', async (c) => {
  const f = taskForm(await c.req.formData())
  const fixed = await fitWorkType(c.env, f)
  await db.updateTask(c.env.DB, c.req.param('id'), f)
  return back(c, '/tasks', '수정했습니다.' + fixed)
})

app.post('/tasks/:id/archive', async (c) => {
  const form = await c.req.formData()
  const id = c.req.param('id')
  const toArchive = form.get('archived') === '1'
  const task = await db.getTask(c.env.DB, id)
  await db.setTaskArchived(c.env.DB, id, toArchive)
  // 어디로 갔는지 알 수 있게 이름과 행선지를 함께 알려 준다
  const name = task ? `"${task.title}"을(를) ` : ''
  return back(
    c,
    toArchive ? '/tasks' : '/tasks?archived=1',
    toArchive ? `${name}보관함으로 옮겼습니다.` : `${name}진행 중 목록으로 되돌렸습니다.`
  )
})

app.post('/tasks/archive-done', async (c) => {
  const n = await db.archiveDoneTasks(c.env.DB)
  return back(c, '/tasks', n ? `완료된 업무 ${n}건을 보관했습니다.` : '보관할 완료 업무가 없습니다.')
})

app.post('/tasks/:id/delete', async (c) => {
  await db.deleteTask(c.env.DB, c.req.param('id'))
  return back(c, '/tasks', '삭제했습니다.')
})

/* ── 일일 기록 ──────────────────────────────────────────── */

app.get('/daily', async (c) => {
  const date = dateOr(c.req.query('date'), todayKST())
  const [logs, tasks, settings] = await Promise.all([
    db.listLogs(c.env.DB, date),
    db.listTasks(c.env.DB),
    db.getSettings(c.env.DB),
  ])
  const used = logs.map((l) => l.task_id).filter(Boolean)
  const prev = await db.prevDetails(c.env.DB, used, date)
  return html(c, dailyPage({
    date,
    logs: logs.map((l) => ({ ...l, prev_detail: prev[l.task_id] || '' })),
    tasks,
    hasTasks: tasks.length > 0,
    skip: skipReason(date, settings.holidays),
    today: todayKST(),
  }))
})

/* ── 주간 현황 ──────────────────────────────────────────── */

app.get('/weekly', async (c) => {
  const date = dateOr(c.req.query('date'), todayKST())
  const ws = weekStart(date)
  const [items, tasks, workTypes] = await Promise.all([
    db.listWeekly(c.env.DB, ws),
    db.listTasks(c.env.DB),
    db.listWorkTypes(c.env.DB),
  ])
  return html(c, weeklyPage({ date, weekStart: ws, items, tasks, workTypes, today: todayKST() }))
})

/* ── 표가 부르는 곳 ─────────────────────────────────────── */
//
// 화면의 표는 칸을 벗어날 때마다 그 줄을 통째로 여기로 보낸다. 만들기와 고치기를
// 한 곳에서 받는다 — id가 없으면 새 줄이다. 답으로는 저장된 줄을 그대로 돌려주어
// 화면이 서버가 정한 값(직전 기록에서 가져온 값 같은)으로 다시 그리게 한다.

/** 보내오지 않은 칸은 이미 있는 값을 그대로 둔다. */
const pick = (sent, cur) => (sent === '' || sent === null || sent === undefined ? cur : sent)

app.post('/api/daily/row', async (c) => {
  const b = await c.req.json().catch(() => ({}))
  const date = dateOr(b.date, todayKST())
  const title = String(b.title || '').trim()
  let id = String(b.id || '')
  let note = ''

  if (!id) {
    if (!title) return c.json({ ok: false, error: '업무명이 없습니다.' }, 400)
    const logs = await db.listLogs(c.env.DB, date)
    const task = b.task_id ? await db.getTask(c.env.DB, b.task_id) : null
    if (task) {
      const made = await db.addLogFromTask(c.env.DB, date, task, logs.length)
      id = made.id
      if (made.carried) note = '직전 기록을 가져왔습니다.'
    } else {
      id = await db.addLogFree(c.env.DB, date, title, logs.length)
    }
  }

  // 새로 만든 줄이든 있던 줄이든, 화면이 보낸 값을 지금 값 위에 얹어 저장한다.
  const cur = await db.getLog(c.env.DB, id)
  if (!cur) return c.json({ ok: false, error: '없는 줄입니다.' }, 404)
  await db.saveLog(c.env.DB, id, {
    task_id: b.task_id || null,
    title: title || cur.title,
    detail_text: pick(b.detail_text, (cur.detail_lines || []).join('\n')),
    status: pick(b.status, cur.status) || '진행',
    priority: pick(b.priority, cur.priority) || '중간',
    progress: pick(b.progress, cur.progress),
    deadline: pick(b.deadline, cur.deadline),
    is_misc: b.is_misc === undefined ? !!cur.is_misc : !!b.is_misc,
  })

  const saved = await db.getLog(c.env.DB, id)
  const prev = await db.prevDetails(c.env.DB, saved.task_id ? [saved.task_id] : [], date)
  return c.json({
    ok: true, note,
    row: dailyRow({ ...saved, prev_detail: prev[saved.task_id] || '' }),
  })
})

app.post('/api/daily/delete', async (c) => {
  const b = await c.req.json().catch(() => ({}))
  if (!b.id) return c.json({ ok: false }, 400)
  await db.deleteLog(c.env.DB, b.id)
  return c.json({ ok: true })
})

app.post('/api/daily/move', async (c) => {
  const b = await c.req.json().catch(() => ({}))
  if (!b.id) return c.json({ ok: false }, 400)
  await db.moveLog(c.env.DB, b.id, Number(b.dir) || 1)
  return c.json({ ok: true })
})

app.post('/api/weekly/row', async (c) => {
  const b = await c.req.json().catch(() => ({}))
  const date = dateOr(b.date, todayKST())
  const ws = weekStart(date)
  const kind = b.kind === '금주 예정' ? '금주 예정' : '전주 실적'
  const title = String(b.title || '').trim()
  let id = String(b.id || '')

  const task = b.task_id ? await db.getTask(c.env.DB, b.task_id) : null
  if (!id) {
    if (!title) return c.json({ ok: false, error: '업무명이 없습니다.' }, 400)
    const items = await db.listWeekly(c.env.DB, ws)
    id = await db.addWeeklyItem(c.env.DB, ws, kind, {
      task_id: task ? task.id : null,
      title,
      work_type: pick(b.work_type, task ? task.work_type : ''),
      status: kind === '전주 실적' ? pick(b.status, task ? task.status : '') : null,
      progress: kind === '전주 실적' ? pick(b.progress, task ? task.progress : null) : null,
      due_date: pick(b.due_date, task ? task.deadline : ''),
      note: b.note || '',
      output: b.output || '',
    }, items.filter((i) => i.kind === kind).length)
  } else {
    const cur = await db.getWeeklyItem(c.env.DB, id)
    if (!cur) return c.json({ ok: false, error: '없는 줄입니다.' }, 404)
    await db.saveWeeklyItem(c.env.DB, id, {
      task_id: b.task_id || null,
      title: title || cur.title,
      work_type: b.work_type,
      status: kind === '전주 실적' ? b.status : null,
      progress: kind === '전주 실적' ? b.progress : null,
      due_date: b.due_date,
      note: b.note,
      output: b.output,
    })
  }
  return c.json({ ok: true, row: weeklyRow(await db.getWeeklyItem(c.env.DB, id)) })
})

app.post('/api/weekly/delete', async (c) => {
  const b = await c.req.json().catch(() => ({}))
  if (!b.id) return c.json({ ok: false }, 400)
  await db.deleteWeeklyItem(c.env.DB, b.id)
  return c.json({ ok: true })
})

/** 지난 주 '금주 예정'을 이번 주 '전주 실적'으로 옮겨 온다. 이미 있는 항목은 건너뛴다. */
app.post('/weekly/carry-over', async (c) => {
  const form = await c.req.formData()
  const date = dateOr(form.get('date'), todayKST())
  const ws = weekStart(date)
  const prevWs = new Date(`${ws}T00:00:00Z`)
  prevWs.setUTCDate(prevWs.getUTCDate() - 7)

  const [lastWeek, thisWeek] = await Promise.all([
    db.listWeekly(c.env.DB, prevWs.toISOString().slice(0, 10)),
    db.listWeekly(c.env.DB, ws),
  ])
  const plans = lastWeek.filter((i) => i.kind === '금주 예정')
  if (!plans.length) return back(c, `/weekly?date=${date}`, '지난 주 금주 예정 항목이 없습니다.')

  const already = new Set(thisWeek.filter((i) => i.kind === '전주 실적').map((i) => i.title))
  const fresh = plans.filter((p) => !already.has(p.title))
  if (!fresh.length) return back(c, `/weekly?date=${date}`, '이미 모두 가져온 항목입니다.')

  let order = thisWeek.filter((i) => i.kind === '전주 실적').length
  for (const p of fresh) {
    await db.addWeeklyItem(c.env.DB, ws, '전주 실적', {
      task_id: p.task_id, title: p.title, work_type: p.work_type,
      status: '진행', progress: p.progress, due_date: p.due_date,
    }, order++)
  }
  return back(c, `/weekly?date=${date}`, `${fresh.length}건을 전주 실적으로 가져왔습니다.`)
})

/* ── 업무 유형 ──────────────────────────────────────────── */

app.post('/work-types', async (c) => {
  const form = await c.req.formData()
  const froms = form.getAll('from')
  const tos = form.getAll('to')
  const series = form.getAll('series')
  const { error, changed } = await db.saveWorkTypes(
    c.env.DB,
    froms.map((from, i) => ({ from, to: tos[i], series: series[i] }))
  )
  if (error) return back(c, '/tasks', error)
  return back(c, '/tasks', changed ? `${changed}개를 고쳤습니다.` : '바뀐 것이 없습니다.')
})

app.post('/work-types/new', async (c) => {
  const form = await c.req.formData()
  const { error, name } = await db.createWorkType(c.env.DB, form.get('name'), form.get('series'))
  return back(c, '/tasks', error || `"${name}"을(를) 추가했습니다.`)
})

app.post('/work-types/delete', async (c) => {
  const form = await c.req.formData()
  const name = form.get('remove')
  if (name) await db.deleteWorkType(c.env.DB, name)
  return back(c, '/tasks', name ? `"${name}"을(를) 지웠습니다.` : '')
})

app.post('/work-types/move', async (c) => {
  const form = await c.req.formData()
  const [name, dir] = String(form.get('move') || '').split(':')
  if (name) await db.moveWorkType(c.env.DB, name, Number(dir) || 1)
  return c.redirect('/tasks')
})

/* ── 시리즈 ─────────────────────────────────────────────── */

app.get('/series', async (c) => {
  const [series, presets] = await Promise.all([
    db.listSeries(c.env.DB),
    db.listStagePresets(c.env.DB),
  ])
  return html(c, seriesPage({
    series, presets, palette: db.SERIES_PALETTE, open: c.req.query('open') || '',
  }))
})

/**
 * 폼에서 단계 목록을 읽는다.
 *
 * 칸 이름이 l_<열쇠> / w_<열쇠> / v_<열쇠> 로 되어 있고, 차례는 hidden으로 실려 온
 * key 목록이 정한다. 화면에 그려진 것만 저장되므로, 지운 단계가 되살아나지 않는다.
 */
/** 손보던 패널을 다시 열어 둔 채로 되돌아간다. */
const backOpen = (c, open, msg) =>
  back(c, `/series?open=${encodeURIComponent(open)}`, msg)

function stagesFromForm(form) {
  return form.getAll('key').filter((k) => STAGE_KEY.test(k)).map((key) => ({
    key,
    label: form.get(`l_${key}`),
    weight: form.get(`w_${key}`),
    value: form.get(`v_${key}`),
  }))
}

app.post('/series', async (c) => {
  const form = await c.req.formData()
  const name = String(form.get('name') || '')
  if (!name) return back(c, '/series', '시리즈를 찾지 못했습니다.')
  await db.saveSeries(c.env.DB, name, {
    color: form.get('color'),
    stages: stagesFromForm(form),
  })
  return backOpen(c, name, `"${name}"을(를) 저장했습니다.`)
})

app.post('/series/new', async (c) => {
  const form = await c.req.formData()
  const { error, name } = await db.createSeries(c.env.DB, form.get('name'), form.get('color'))
  return back(c, '/series', error || `"${name}"을(를) 추가했습니다.`)
})

app.post('/series/delete', async (c) => {
  const form = await c.req.formData()
  const name = form.get('remove')
  if (name) await db.deleteSeries(c.env.DB, name)
  return back(c, '/series', name ? `"${name}"을(를) 지웠습니다.` : '')
})

app.post('/series/move', async (c) => {
  const form = await c.req.formData()
  const [name, dir] = String(form.get('move') || '').split(':')
  if (name) await db.moveSeries(c.env.DB, name, Number(dir) || 1)
  return c.redirect('/series')
})

/* 시리즈 안의 단계 — 이 시리즈에만 닿는다 */

app.post('/series/stage/new', async (c) => {
  const form = await c.req.formData()
  const name = String(form.get('name') || '')
  const { error, label } = await db.addSeriesStage(c.env.DB, name, form.get('label'))
  return backOpen(c, name, error || `"${label}" 단계를 더했습니다.`)
})

app.post('/series/stage/delete', async (c) => {
  const form = await c.req.formData()
  const name = String(form.get('name') || '')
  const key = String(form.get('remove') || '')
  if (name && STAGE_KEY.test(key)) await db.deleteSeriesStage(c.env.DB, name, key)
  return backOpen(c, name, '단계를 지웠습니다.')
})

app.post('/series/stage/move', async (c) => {
  const form = await c.req.formData()
  const name = String(form.get('name') || '')
  const [key, dir] = String(form.get('move') || '').split(':')
  if (name && STAGE_KEY.test(key)) await db.moveSeriesStage(c.env.DB, name, key, Number(dir) || 1)
  return c.redirect(`/series?open=${encodeURIComponent(name)}`)
})

app.post('/series/stage/reset', async (c) => {
  const form = await c.req.formData()
  const name = String(form.get('name') || '')
  if (name) await db.resetSeriesStages(c.env.DB, name)
  return backOpen(c, name, '기본 목록을 불러왔습니다.')
})

/* 기본 단계 목록 — 새 시리즈가 물려받을 본. 이미 있는 시리즈는 건드리지 않는다 */

app.post('/series/preset', async (c) => {
  const form = await c.req.formData()
  await db.savePresets(c.env.DB, stagesFromForm(form))
  return backOpen(c, '_p', '기본 목록을 저장했습니다.')
})

app.post('/series/preset/new', async (c) => {
  const form = await c.req.formData()
  const { error, label } = await db.addPreset(c.env.DB, form.get('label'))
  return backOpen(c, '_p', error || `"${label}"을(를) 기본 목록에 더했습니다.`)
})

app.post('/series/preset/delete', async (c) => {
  const form = await c.req.formData()
  const key = String(form.get('remove') || '')
  if (STAGE_KEY.test(key)) await db.deletePreset(c.env.DB, key)
  return backOpen(c, '_p', '기본 목록에서 지웠습니다.')
})

app.post('/series/preset/move', async (c) => {
  const form = await c.req.formData()
  const [key, dir] = String(form.get('move') || '').split(':')
  if (STAGE_KEY.test(key)) await db.movePreset(c.env.DB, key, Number(dir) || 1)
  return c.redirect('/series?open=_p')
})

/* ── 법인카드 ───────────────────────────────────────────── */

/** 보고 있는 달 안의 날짜를 고른다. 이번 달이면 오늘, 아니면 그 달 첫날. */
function dayInMonth(month, today) {
  return monthOf(today) === month ? today : monthStart(month)
}

app.get('/cards', async (c) => {
  const today = todayKST()
  const month = monthOr(c.req.query('month'), monthOf(today))
  const [rows, accounts, users, settles, presets, recurring] = await Promise.all([
    db.listExpenses(c.env.DB, month),
    db.listCardAccounts(c.env.DB),
    db.listCardUsers(c.env.DB),
    db.listCardSettles(c.env.DB),
    db.listCardPresets(c.env.DB),
    db.listRecurring(c.env.DB),
  ])
  return html(c, cardsPage({
    month,
    monthLabel: koreanMonth(month),
    prev: shiftMonth(month, -1),
    next: shiftMonth(month, 1),
    rows,
    summary: summarize(rows, settles.filter((s) => s.done).map((s) => s.name)),
    accounts, users, settles, presets, recurring,
    missing: missingRecurring(month, recurring, rows),
    defaultDay: dayInMonth(month, today),
  }))
})

app.post('/api/cards/row', async (c) => {
  const b = await c.req.json().catch(() => ({}))
  const month = monthOr(b.date, monthOf(todayKST()))
  const title = String(b.title || '').trim()
  let id = String(b.id || '')

  if (!id) {
    // 금액 없는 지출은 정산에 쓸 수 없다. 화면도 그때까지는 보내지 않는다.
    if (!title) return c.json({ ok: false, error: '세부 내역이 없습니다.' }, 400)
    id = await db.createExpense(c.env.DB, {
      used_on: dateOr(b.used_on, dayInMonth(month, todayKST())),
      title,
      spender: b.spender, merchant: b.merchant, amount: b.amount,
      account: b.account, settle: b.settle, note: b.note,
    })
  }

  const cur = await db.getExpense(c.env.DB, id)
  if (!cur) return c.json({ ok: false, error: '없는 줄입니다.' }, 404)
  await db.saveExpense(c.env.DB, id, {
    used_on: dateOr(pick(b.used_on, cur.used_on), cur.used_on),
    title: title || cur.title,
    spender: pick(b.spender, cur.spender),
    merchant: pick(b.merchant, cur.merchant),
    // 0원은 값이 없는 것이 아니라 0이다. pick에 맡기면 지난 값으로 되돌아간다.
    amount: b.amount === '' || b.amount === undefined ? cur.amount : Number(b.amount) || 0,
    account: pick(b.account, cur.account),
    settle: pick(b.settle, cur.settle) || '지출품의 예정',
    note: b.note === undefined ? cur.note : b.note,
  })

  return c.json({ ok: true, row: cardRow(await db.getExpense(c.env.DB, id)) })
})

app.post('/api/cards/delete', async (c) => {
  const b = await c.req.json().catch(() => ({}))
  if (!b.id) return c.json({ ok: false }, 400)
  await db.deleteExpense(c.env.DB, b.id)
  return c.json({ ok: true })
})

/* 반복 결제 — 달마다 빠짐없이 나가야 하는 지출 */

app.post('/cards/recurring', async (c) => {
  const form = await c.req.formData()
  // 체크 안 한 상자는 아예 오지 않는다. 온 것만 '씀'으로 본다.
  const on = new Set(form.getAll('on').map(String))
  const rows = form.getAll('id').map((id) => ({
    id,
    title: form.get(`t_${id}`),
    merchant: form.get(`m_${id}`),
    amount: String(form.get(`a_${id}`) || '').replace(/[^0-9]/g, ''),
    account: form.get(`c_${id}`),
    spender: form.get(`s_${id}`),
    from_month: form.get(`f_${id}`),
    to_month: form.get(`e_${id}`),
    enabled: on.has(String(id)),
  }))
  const { changed } = await db.saveRecurring(c.env.DB, rows)
  return back(c, '/cards', `반복 결제 ${changed}건을 저장했습니다.`)
})

app.post('/cards/recurring/new', async (c) => {
  const form = await c.req.formData()
  const { error, title } = await db.addRecurring(c.env.DB, {
    title: form.get('title'),
    merchant: form.get('merchant'),
    amount: String(form.get('amount') || '').replace(/[^0-9]/g, ''),
  })
  return back(c, '/cards', error || `"${title}"을(를) 더했습니다.`)
})

app.post('/cards/recurring/delete', async (c) => {
  const form = await c.req.formData()
  const id = String(form.get('remove') || '')
  if (id) await db.deleteRecurring(c.env.DB, id)
  return back(c, '/cards', '반복 결제에서 뺐습니다.')
})

/** 안 들어온 반복 결제를 그 달의 사용 내역으로 넣는다. */
app.post('/cards/recurring/add', async (c) => {
  const form = await c.req.formData()
  const month = monthOr(form.get('month'), monthOf(todayKST()))
  const all = await db.listRecurring(c.env.DB)
  const r = all.find((x) => x.id === String(form.get('id') || ''))
  if (!r) return back(c, `/cards?month=${month}`, '반복 결제를 찾지 못했습니다.')
  await db.createExpense(c.env.DB, {
    // 자동결제는 며칠에 빠져나갔는지 명세서를 봐야 안다. 일단 그 달 안의
    // 날짜로 넣어 두고, 정확한 날은 표에서 고치면 된다.
    used_on: dayInMonth(month, todayKST()),
    title: r.title, merchant: r.merchant, amount: r.amount,
    account: r.account, spender: r.spender,
    settle: '자동결제 승인', note: '',
  })
  return back(c, `/cards?month=${month}`, `"${r.title}"을(를) 넣었습니다. 날짜와 금액을 확인하세요.`)
})

/* 항목 관리 — 처리 계정·사용자·정산상태 */

app.post('/cards/items', async (c) => {
  const form = await c.req.formData()
  const kind = String(form.get('kind') || '')
  const froms = form.getAll('from')
  const tos = form.getAll('to')
  const colors = form.getAll('color')
  // 체크 안 한 상자는 아예 오지 않는다. 온 이름만 '정산 끝'으로 본다.
  const done = new Set(form.getAll('done').map(String))
  const { error, changed } = await db.saveCardItems(
    c.env.DB,
    kind,
    froms.map((from, i) => ({ from, to: tos[i], color: colors[i], done: done.has(String(from)) }))
  )
  if (error) return back(c, '/cards', error)
  return back(c, '/cards', changed ? `${changed}개를 고쳤습니다.` : '바뀐 것이 없습니다.')
})

app.post('/cards/items/new', async (c) => {
  const form = await c.req.formData()
  const { error, name } = await db.createCardItem(c.env.DB, form.get('kind'), form.get('name'))
  return back(c, '/cards', error || `"${name}"을(를) 추가했습니다.`)
})

app.post('/cards/items/delete', async (c) => {
  const form = await c.req.formData()
  const [kind, name] = String(form.get('remove') || '').split(':')
  if (kind && name) await db.deleteCardItem(c.env.DB, kind, name)
  return back(c, '/cards', name ? `"${name}"을(를) 지웠습니다.` : '')
})

app.post('/cards/items/move', async (c) => {
  const form = await c.req.formData()
  const [kind, name, dir] = String(form.get('move') || '').split(':')
  if (kind && name) await db.moveCardItem(c.env.DB, kind, name, Number(dir) || 1)
  return c.redirect('/cards')
})

/* 지출결의서 — 고른 사용 내역을 결재에 올릴 서식으로 */

/** ids=a,b,c 를 그 달 화면에 보이던 차례 그대로 읽는다. */
async function pickedExpenses(env, raw) {
  const want = String(raw || '').split(',').map((x) => x.trim()).filter(Boolean)
  if (!want.length) return []
  const rows = await Promise.all(want.map((id) => db.getExpense(env.DB, id)))
  return rows.filter(Boolean)
}

app.get('/cards/voucher', async (c) => {
  const ids = c.req.query('ids') || ''
  const rows = await pickedExpenses(c.env, ids)
  if (!rows.length) return c.redirect('/cards?t=err&msg=' + encodeURIComponent('고른 내역이 없습니다.'))
  return html(c, voucherDocument(voucherSheets(rows), {
    ids,
    message: c.req.query('msg') || '',
    error: c.req.query('t') === 'err',
  }))
})

app.post('/cards/voucher/drive', async (c) => {
  const form = await c.req.formData()
  const ids = String(form.get('ids') || '')
  const to = '/cards/voucher?ids=' + encodeURIComponent(ids)
  try {
    if (!driveConfigured(c.env)) throw new Error('구글 드라이브 설정이 없습니다.')
    const rows = await pickedExpenses(c.env, ids)
    if (!rows.length) throw new Error('고른 내역이 없습니다.')
    const sheets = voucherSheets(rows)
    // 장마다 파일 하나로 올린다. 결재는 장 단위로 올라가므로 한 파일에 여러
    // 장을 담으면 나눠 낼 수가 없다.
    const names = []
    for (const sheet of sheets) {
      const filename = voucherFilename(sheet)
      await uploadHtml(c.env, {
        filename, html: voucherFile(sheet), kind: 'voucher', date: sheet.issuedOn,
      })
      names.push(filename)
    }
    return back(c, to, `드라이브에 ${names.length}장을 저장했습니다.`)
  } catch (e) {
    return c.redirect(`${to}&t=err&msg=${encodeURIComponent(e.message)}`)
  }
})

/* ── 보고서 ─────────────────────────────────────────────── */

const kindOr = (v) => (v === 'weekly' ? 'weekly' : 'daily')

/** 이력은 30건씩 보여 주고 '더 보기'로 늘린다. 한 번에 다 싣지 않는다. */
const HISTORY_STEP = 30
const limitOr = (v) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), 500) : HISTORY_STEP
}

app.get('/reports', async (c) => {
  const kind = kindOr(c.req.query('kind'))
  const date = dateOr(c.req.query('date'), todayKST())
  const limit = limitOr(c.req.query('limit'))
  const [report, history, total] = await Promise.all([
    db.getReport(c.env.DB, kind, date),
    db.listReports(c.env.DB, limit),
    db.countReports(c.env.DB),
  ])
  return html(c, reportsPage({
    kind, date, report, history, total, limit, step: HISTORY_STEP,
    driveReady: driveConfigured(c.env),
  }))
})

app.post('/reports/delete', async (c) => {
  const form = await c.req.formData()
  const kind = kindOr(form.get('kind'))
  const date = dateOr(form.get('date'), todayKST())
  const limit = limitOr(form.get('limit'))
  const name = await db.deleteReport(c.env.DB, form.get('id'))
  const to = `/reports?kind=${kind}&date=${date}` + (limit === HISTORY_STEP ? '' : `&limit=${limit}`)
  return back(c, to, name ? `"${name}"을(를) 지웠습니다.` : '이미 지워진 보고서입니다.')
})

app.post('/reports/generate', async (c) => {
  const form = await c.req.formData()
  const kind = kindOr(form.get('kind'))
  const date = dateOr(form.get('date'), todayKST())
  const { empty } = await generateReport(c.env, c.env.DB, kind, date)
  const to = `/reports?kind=${kind}&date=${date}`
  return empty
    ? c.redirect(`${to}&t=warn&msg=${encodeURIComponent('기록된 업무가 없어 빈 보고서가 만들어졌습니다.')}`)
    : back(c, to, '보고서를 만들었습니다.')
})

app.post('/reports/drive', async (c) => {
  const form = await c.req.formData()
  const kind = kindOr(form.get('kind'))
  const date = dateOr(form.get('date'), todayKST())
  const to = `/reports?kind=${kind}&date=${date}`
  try {
    if (!driveConfigured(c.env)) throw new Error('구글 드라이브 설정이 없습니다.')
    const report = await db.getReport(c.env.DB, kind, date)
    if (!report) throw new Error('먼저 보고서를 만들어 주세요.')
    const up = await uploadHtml(c.env, { filename: report.filename, html: report.html, kind, date })
    await db.setReportDrive(c.env.DB, kind, date, up.id, up.link)
    return back(c, to, `드라이브에 ${up.updated ? '덮어썼습니다' : '저장했습니다'}: ${report.filename}`)
  } catch (e) {
    return c.redirect(`${to}&t=err&msg=${encodeURIComponent(e.message)}`)
  }
})

app.get('/reports/preview', async (c) => {
  const report = await db.getReport(c.env.DB, kindOr(c.req.query('kind')),
    dateOr(c.req.query('date'), todayKST()))
  if (!report) return c.notFound()
  return c.html(report.html)
})

app.get('/reports/download', async (c) => {
  const kind = kindOr(c.req.query('kind'))
  const date = dateOr(c.req.query('date'), todayKST())
  const report = await db.getReport(c.env.DB, kind, date)
  if (!report) return c.notFound()
  return new Response(report.html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filenameFor(kind, date)}"`,
    },
  })
})

/* ── 모닝브리프 ─────────────────────────────────────────── */

// 아침마다 클라우드의 Claude가 캘린더·메일을 읽고 브리프를 써서 이리로 보낸다.
// 앱은 받아서 보여주기만 한다. 앱 비밀번호가 아니라 전용 열쇠로 확인하는데,
// 이 문으로 할 수 있는 일은 브리프를 넣는 것 하나뿐이다.
/**
 * 브리프 항목 제목만 골라 낸다. 요약 칸에 그대로 그려지는 값이라 길이와 개수를 자른다.
 * 화면에는 esc를 거쳐 들어가므로 여기서는 모양만 다듬는다.
 */
function cleanItems(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const pick = (k) =>
    (Array.isArray(v[k]) ? v[k] : [])
      .filter((x) => typeof x === 'string' && x.trim())
      .slice(0, 12)
      .map((x) => x.trim().slice(0, 120))
  const out = { events: pick('events'), todo: pick('todo'), done: pick('done') }
  return out.events.length || out.todo.length || out.done.length ? out : null
}

app.post('/api/brief', async (c) => {
  if (!c.env.BRIEF_TOKEN) return c.json({ error: 'BRIEF_TOKEN이 설정되지 않았습니다.' }, 503)
  const given = (c.req.header('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!checkBriefToken(c.env, given)) return c.json({ error: '열쇠가 맞지 않습니다.' }, 401)

  let body
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'JSON이 아닙니다.' }, 400)
  }

  const date = dateOr(body.date, todayKST())
  const html = typeof body.html === 'string' ? body.html : ''
  if (!html.trim()) return c.json({ error: 'html이 비었습니다.' }, 400)
  // D1의 한 값 상한이 1MB다. 브리프 한 장은 보통 30~80KB.
  if (html.length > 900_000) return c.json({ error: 'html이 너무 큽니다(900KB 넘음).' }, 413)

  await db.saveBrief(c.env.DB, {
    date, html,
    events: body.events, todo: body.todo, done: body.done,
    headline: typeof body.headline === 'string' ? body.headline.slice(0, 200) : null,
    source: typeof body.source === 'string' ? body.source.slice(0, 60) : 'cloud',
    items: cleanItems(body.items),
  })
  return c.json({ ok: true, date, bytes: html.length })
})

app.get('/brief', async (c) => {
  const date = dateOr(c.req.query('date'), todayKST())
  const [brief, history] = await Promise.all([
    db.getBrief(c.env.DB, date),
    db.listBriefs(c.env.DB, 30),
  ])
  return html(c, briefPage({ date, brief, history, today: todayKST() }))
})

/**
 * 브리프 서식 바로잡기. 문서를 만드는 쪽이 옛 서식으로 되돌아가도 화면은 맞게 나온다.
 *
 * 여섯 가지를 한다.
 *   1. 버튼 글자의 "초안 잡기"를 "초안잡기"로 붙인다.
 *   2. btn-reply / btn-remind 클래스가 없으면 글자를 보고 붙인다. 그래야 앱이
 *      정한 색과 밑줄 없는 모양이 걸린다. 문서가 직접 넣은 style은 걷어 낸다.
 *   3. 항목마다 버튼을 하나만 남긴다. 리마인드가 있으면 리마인드를, 없으면
 *      회신메일을 두고 나머지는 지운다. 둘을 겹쳐 두면 어느 쪽을 눌러야 할지
 *      알 수 없다.
 *   4. 남은 버튼을 문장 아래에서 항목 오른쪽으로 옮긴다. 항목은 버튼 글자를 뺀
 *      본문이 열 자 넘게 담긴 가장 작은 조상으로 찾고, 그 안에 절대 위치로 세워
 *      원래 짜임새는 건드리지 않는다. 옮기고 나서 글 칸에 300px이 안 남으면
 *      되돌려 아래에 둔다 — 휴대폰에서 제목이 한 자씩 끊기는 것보다 낫다.
 *      폭을 보는 것은 이 마지막 단계뿐이다. 앞의 손질은 화면이 좁아도 다 한다.
 *      자리 잡기는 따로 떼어 두고 여러 번 다시 부른다. 액자가 폭을 갖기 전에
 *      재면 0이 나오고, 창 크기가 바뀌면 답도 달라지기 때문이다.
 *   5. 다크 모드 단추를 지운다. 액자 안에서는 앱 화면의 밝기를 따라야 해서
 *      문서 혼자 어두워지면 오히려 어긋난다.
 *   6. 맨 위 여백을 잰 뒤 20px만 남기고 깎는다. 문서는 저 혼자 열릴 때를 생각해
 *      위를 넓게 비우는데, 액자 안에서는 카드 테두리와 제목 사이가 허전하다.
 *      여백이 body에 있는지 바깥 상자에 있는지 문서마다 다르므로, 재서 그만큼만
 *      덜어 낸다. 테두리나 바탕색이 있는 상자를 만나면 거기서 멈춘다 — 그건
 *      여백이 아니라 카드다.
 */
const BRIEF_FIXUP = `<script>(function(){
var S='a[href^="https://claude.ai/new"]';
function W(n){return n.textContent.replace(/\\s+/g,'').length}
function body(n){var b=0;[].forEach.call(n.querySelectorAll(S),function(x){b+=W(x)});
  return W(n)-b}
function owner(a){var n=a.parentElement,g=0,t=0;
  while(n&&n!==document.body&&g++<8){
    t=body(n); if(t>=10)break; n=n.parentElement}
  if(!n||n===document.body||t<10)return null;
  if(t>400||n.querySelectorAll(S).length>2)return null;
  var k=n.querySelectorAll(S).length;
  while(n.parentElement&&n.parentElement!==document.body){
    var up=n.parentElement;
    if(body(up)>t+3||up.querySelectorAll(S).length!==k)break;
    if(up.clientHeight>n.clientHeight+60)break;
    n=up}
  return n}
var COLS=[];
function host(it,col){
  if(getComputedStyle(it).display.indexOf('flex')<0)return it;
  var best=it,bl=-1;
  for(var i=0;i<it.children.length;i++){var c=it.children[i]; if(c===col)continue;
    var l=W(c); if(l>bl){bl=l;best=c}}
  return best}
function place(it,col){
  var vw=document.documentElement.clientWidth; if(!vw)return;
  it.style.paddingRight='';
  col.style.cssText='display:inline-flex;flex-direction:column;gap:7px;align-items:flex-start';
  if(col.parentElement!==it)it.appendChild(col);
  var w=col.getBoundingClientRect().width;
  if(vw>=620&&it.getBoundingClientRect().width-w>=300){
    if(getComputedStyle(it).position==='static')it.style.position='relative';
    col.style.cssText='position:absolute;right:0;top:50%;transform:translateY(-50%);'
      +'display:flex;flex-direction:column;gap:7px;align-items:stretch';
    it.style.paddingRight=(w+18)+'px'; return}
  // 좁을 때는 글 칸 안으로 되돌린다. 옆 칸으로 두면 제목이 한 자씩 끊긴다.
  var h=host(it,col); if(h!==col.parentElement)h.appendChild(col);
  col.style.marginTop='9px'}
function relayout(){COLS.forEach(function(c){place(c[0],c[1])})}
function run(){
  var A=[].slice.call(document.querySelectorAll(S)); if(!A.length)return;
  var keys=[],grp=[];
  A.forEach(function(a){
    if(!a.hasAttribute('data-fx')){
      a.setAttribute('data-fx','1');
      var t=(a.textContent||'').replace(/초안\\s+잡기/g,'초안잡기').trim();
      a.textContent=t;
      if(!/btn-(reply|remind)/.test(a.className||'')){
        a.removeAttribute('style');
        a.className=/회신/.test(t)?'btn-reply':'btn-remind'}}
    var it=owner(a); if(!it||it.hasAttribute('data-fxcol'))return;
    var i=keys.indexOf(it); if(i<0){keys.push(it);grp.push([a])}else grp[i].push(a)});
  keys.forEach(function(it,i){
    it.setAttribute('data-fxcol','1');
    var col=document.createElement('div');
    col.style.cssText='display:inline-flex;flex-direction:column;gap:7px;align-items:flex-start';
    var rem=[],rep=[];
    grp[i].forEach(function(a){(/회신/.test(a.textContent)?rep:rem).push(a)});
    var keep=(rem.length?rem:rep)[0];
    grp[i].forEach(function(a){
      var h=a.parentElement;
      if(a===keep)col.appendChild(a);else h.removeChild(a);
      while(h&&h!==it&&!h.textContent.trim()&&!h.querySelector('img,svg')){
        var up=h.parentElement; up.removeChild(h); h=up}});
    it.appendChild(col);
    COLS.push([it,col])})}
function nodark(){
  var L=document.querySelectorAll('div,p,button,a,span');
  for(var i=0;i<L.length;i++){
    var e=L[i],t=(e.textContent||'').replace(/\\s+/g,'');
    if(!/^(다크모드|라이트모드|어두운모드|밝은모드)$/.test(t))continue;
    var h=e.parentElement; if(!h)return;
    h.removeChild(e);
    while(h&&h!==document.body&&!h.textContent.trim()&&!h.querySelector('img,svg')){
      var u=h.parentElement; u.removeChild(h); h=u}
    return}}
function bare(n){var c=getComputedStyle(n);
  return c.borderTopWidth==='0px'&&c.backgroundColor==='rgba(0, 0, 0, 0)'}
function trim(){
  var el=document.body,g=0;
  while(el&&g++<4){
    var f=el.firstElementChild; if(!f)return;
    var ex=f.getBoundingClientRect().top-20;
    if(ex>1){
      var pt=parseFloat(getComputedStyle(el).paddingTop)||0,c=Math.min(pt,ex);
      if(c>0){el.style.paddingTop=(pt-c)+'px';ex-=c}
      if(ex>1){var mt=parseFloat(getComputedStyle(f).marginTop)||0,d=Math.min(mt,ex);
        if(d>0){f.style.marginTop=(mt-d)+'px';ex-=d}}
      if(ex<=1)return}
    if(!bare(f)||!f.firstElementChild)return;
    if(f.firstElementChild.getBoundingClientRect().top-20<=1)return;
    el=f}}
function all(){nodark();run();relayout();trim()}
addEventListener('load',all);addEventListener('resize',relayout);
setTimeout(all,200);setTimeout(all,900);setTimeout(all,2000);
})()<\/script>`

/**
 * 브리프 안의 링크가 액자 안에서 열리지 않도록 <base target="_blank">를 끼운다.
 *
 * 브리프에는 Gmail 스레드나 claude.ai로 가는 링크가 들어 있다. 그대로 두면 액자
 * 안에서 열리려 하는데, 그 사이트들은 남의 액자에 담기는 것을 거부해서 "연결을
 * 거부했습니다"만 뜬다. 새 탭에서 열리게 하면 정상으로 열린다.
 */
function prepareBriefHtml(html) {
  const base =
    '<base target="_blank">' +
    // [리마인드 초안 잡기] 버튼은 파란 바탕인데, 만드는 쪽에서 글자색을 빠뜨리면
    // 브라우저 기본색(검정)과 밑줄이 나와 읽히지 않는다. 그 링크 주소는 늘 같으니
    // 주소로 집어서 바로잡는다. 어떻게 꾸며져 있든 이 한 곳만 손댄다.
    // 브리프 안의 버튼 두 개는 모양을 앱이 책임진다. 문서는 클래스 이름만 붙이면
    // 되고, 색을 빠뜨려도 여기서 잡힌다. 클래스 없는 옛 브리프의 버튼도 흰 글자로.
    '<style>a.btn-reply,a.btn-remind{display:inline-block;border-radius:8px;' +
    'padding:8px 13px;font-size:13px;font-weight:500;line-height:1.25;' +
    'white-space:nowrap;text-decoration:none !important}' +
    'a.btn-reply{background:#3B6FE8 !important;color:#ffffff !important;' +
    'border:1.5px solid #3B6FE8 !important}' +
    'a.btn-remind{background:#ffffff !important;color:#3B6FE8 !important;' +
    'border:1.5px solid #3B6FE8 !important}' +
    'a[href^="https://claude.ai/new"]:not(.btn-remind)' +
    '{color:#ffffff !important;text-decoration:none !important}' +
    // 브리프가 앱보다 굵고 커 보인다. 서체·다듬기에 더해 본문과 제목의 크기·굵기까지
    // 앱과 같은 값으로 맞춘다. 여백과 배치는 문서 것을 그대로 둔다.
    'html,body{font-family:-apple-system,BlinkMacSystemFont,\'SF Pro Text\',' +
    "'Apple SD Gothic Neo','Helvetica Neue','Malgun Gothic',sans-serif !important;" +
    '-webkit-font-smoothing:antialiased !important;' +
    '-moz-osx-font-smoothing:grayscale !important;' +
    'font-size:15px !important;line-height:1.55 !important;letter-spacing:-.01em !important}' +
    'h1{font-size:28px !important;font-weight:600 !important;' +
    'letter-spacing:-.028em !important;line-height:1.2 !important}' +
    'h2{font-size:17px !important;font-weight:700 !important;letter-spacing:-.02em !important}' +
    'h3,h4{font-size:15px !important;font-weight:600 !important;letter-spacing:-.018em !important}' +
    'b,strong{font-weight:600 !important}' +
    'body{margin-top:0 !important}' +
    '</style>' +
    BRIEF_FIXUP +
    // 액자 안에서도 스크롤이 생기면 세로 막대가 둘이 된다. 문서가 자기 높이를
    // 알려 주면 바깥에서 액자를 그만큼 늘려, 페이지 스크롤 하나만 남는다.
    // 높이는 본문 상자의 아래끝으로 잰다. scrollHeight는 액자가 늘어난 만큼
    // 따라 늘어나서, 한 번 커지면 다시 줄지 않는다.
    '<script>(function(){function h(){var b=document.body;if(!b)return 0;' +
    'var r=b.getBoundingClientRect(),m=parseFloat(getComputedStyle(b).marginBottom)||0;' +
    'var v=Math.ceil(r.bottom+m);return v>80?v:document.documentElement.scrollHeight}' +
    'function s(){try{parent.postMessage({briefHeight:h()},"*")}catch(e){}}' +
    'addEventListener("load",s);addEventListener("resize",s);' +
    'if(window.ResizeObserver)new ResizeObserver(s).observe(document.documentElement);' +
    'setTimeout(s,300);setTimeout(s,1200)})()<\/script>'
  const head = /<head[^>]*>/i.exec(html)
  if (head) return html.slice(0, head.index + head[0].length) + base + html.slice(head.index + head[0].length)
  return base + html
}

// 브리프 원본. 화면에는 iframe 안에 갇힌 채로 뜬다 — 받아 온 문서가 앱 화면을
// 건드리지 못하게 하려는 것이다. 검색엔진·캐시에도 남기지 않는다.
app.get('/brief/raw', async (c) => {
  const brief = await db.getBrief(c.env.DB, dateOr(c.req.query('date'), todayKST()))
  if (!brief) return c.notFound()
  return new Response(prepareBriefHtml(brief.html), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  })
})

/* ── 정해진 시각에 스스로 실행 ──────────────────────────── */

/** cron 문자열의 다섯째 칸(요일)이 금요일 하나로 못 박혀 있으면 주간 보고서다. */
function weeklyCron(cron) {
  return String(cron || '').trim().split(/\s+/)[4] === '5'
}

/**
 * cron이 부를 때 도는 부분. 주말·공휴일이면 아무것도 만들지 않는다.
 *
 * 일일과 주간이 같은 시각(16:00 KST)에 돌기 때문에 시각으로는 둘을 가릴 수 없다.
 * 대신 부른 cron 문자열의 요일 칸을 본다. 금요일만 도는 "0 7 * * 5"가 주간이고,
 * 날마다 도는 "0 7 * * *"가 일일이다. 금요일에는 둘 다 따로 한 번씩 불린다.
 */
async function runScheduled(event, env) {
  const date = todayKST()
  const settings = await db.getSettings(env.DB)
  const skip = skipReason(date, settings.holidays)
  if (skip) return { skipped: skip, date }

  const kind = weeklyCron(event.cron) ? 'weekly' : 'daily'

  const { empty, filename } = await generateReport(env, env.DB, kind, date)
  if (empty) return { skipped: '기록된 업무 없음', date, kind }

  if (driveConfigured(env)) {
    const report = await db.getReport(env.DB, kind, date)
    const up = await uploadHtml(env, { filename: report.filename, html: report.html, kind, date })
    await db.setReportDrive(env.DB, kind, date, up.id, up.link)
    return { ok: true, kind, date, filename, drive: up.link }
  }
  return { ok: true, kind, date, filename, drive: null }
}

export default {
  fetch: app.fetch,
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      runScheduled(event, env).then(
        (r) => console.log('scheduled', JSON.stringify(r)),
        (e) => console.error('scheduled failed', e.message)
      )
    )
  },
}
