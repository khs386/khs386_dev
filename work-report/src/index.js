// 업무보고서 — Cloudflare Workers 진입점.
// 화면(GET)과 폼 처리(POST)를 모두 이 워커가 맡고, 정해진 시각에 스스로 깨어나 보고서를 만든다.
import { Hono } from 'hono'
import * as db from './lib/db.js'
import { isLoggedIn, makeSessionCookie, clearSessionCookie, checkPassword, checkBriefToken } from './lib/auth.js'
import { driveConfigured, uploadHtml } from './lib/drive.js'
import {
  todayKST, skipReason, generateReport, filenameFor,
} from './lib/reports.js'
import { weekStart, dday } from './lib/report/format.js'
import { STAGES } from './lib/series.js'
import { loginPage, FAVICON } from './views/layout.js'
import { privacyPage, termsPage } from './views/legal.js'
import {
  todayPage, tasksPage, dailyPage, weeklyPage, seriesPage, reportsPage, briefPage,
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
  const [logs, weekly, series, tasks, settings, brief] = await Promise.all([
    db.listLogs(c.env.DB, today),
    db.listWeekly(c.env.DB, weekStart(today)),
    db.listSeries(c.env.DB),
    db.listTasks(c.env.DB),
    db.getSettings(c.env.DB),
    db.getBrief(c.env.DB, today),
  ])
  const soon = tasks.filter((t) => t.deadline).slice(0, 5)
  return html(c, todayPage({
    today, logs, series, soon, brief,
    weekly: {
      prev: weekly.filter((w) => w.kind === '전주 실적').length,
      plan: weekly.filter((w) => w.kind === '금주 예정').length,
    },
    skip: skipReason(today, settings.holidays),
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
    workTypes: workTypes.map((t) => t.name),
    archivedCount: archivedList.length,
    editing: editId ? await db.getTask(c.env.DB, editId) : null,
  }))
})

app.post('/tasks/new', async (c) => {
  const f = taskForm(await c.req.formData())
  if (!f.title.trim()) return back(c, '/tasks', '업무명을 입력해 주세요.')
  await db.createTask(c.env.DB, f)
  return back(c, '/tasks', '추가했습니다.')
})

app.post('/tasks/:id/save', async (c) => {
  await db.updateTask(c.env.DB, c.req.param('id'), taskForm(await c.req.formData()))
  return back(c, '/tasks', '수정했습니다.')
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
  const used = new Set(logs.map((l) => l.task_id).filter(Boolean))
  return html(c, dailyPage({
    date, logs,
    available: tasks.filter((t) => !used.has(t.id)),
    hasTasks: tasks.length > 0,
    skip: skipReason(date, settings.holidays),
    saved: c.req.query('saved'),
  }))
})

app.post('/daily/add', async (c) => {
  const form = await c.req.formData()
  const date = dateOr(form.get('date'), todayKST())
  const task = await db.getTask(c.env.DB, form.get('task_id'))
  if (!task) return back(c, `/daily?date=${date}`, '업무를 고르지 않았습니다.')
  const logs = await db.listLogs(c.env.DB, date)
  await db.addLogFromTask(c.env.DB, date, task, logs.length)
  return back(c, `/daily?date=${date}`, `"${task.title}"을(를) 넣었습니다.`)
})

app.post('/daily/add-free', async (c) => {
  const form = await c.req.formData()
  const date = dateOr(form.get('date'), todayKST())
  const title = (form.get('title') || '').trim()
  if (!title) return back(c, `/daily?date=${date}`, '업무명을 입력해 주세요.')
  const logs = await db.listLogs(c.env.DB, date)
  await db.addLogFree(c.env.DB, date, title, logs.length)
  return back(c, `/daily?date=${date}`, `"${title}"을(를) 넣었습니다.`)
})

app.post('/daily/:id/save', async (c) => {
  const form = await c.req.formData()
  const date = dateOr(form.get('date'), todayKST())
  await db.saveLog(c.env.DB, c.req.param('id'), {
    detail_text: form.get('detail_text') || '',
    status: form.get('status') || '진행',
    priority: form.get('priority') || '중간',
    progress: form.get('progress'),
    deadline: form.get('deadline'),
    is_misc: form.get('is_misc') === '1',
  })
  const id = c.req.param('id')
  return c.redirect(`/daily?date=${date}&saved=${id}#log-${id}`)
})

app.post('/daily/:id/delete', async (c) => {
  const form = await c.req.formData()
  await db.deleteLog(c.env.DB, c.req.param('id'))
  return back(c, `/daily?date=${dateOr(form.get('date'), todayKST())}`, '뺐습니다.')
})

app.post('/daily/:id/move', async (c) => {
  const form = await c.req.formData()
  await db.moveLog(c.env.DB, c.req.param('id'), Number(form.get('dir')) || 1)
  return c.redirect(`/daily?date=${dateOr(form.get('date'), todayKST())}`)
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
  return html(c, weeklyPage({
    date, weekStart: ws, items, tasks,
    workTypes: workTypes.map((t) => t.name),
    saved: c.req.query('saved'),
  }))
})

app.post('/weekly/add', async (c) => {
  const form = await c.req.formData()
  const date = dateOr(form.get('date'), todayKST())
  const kind = form.get('kind')
  const task = await db.getTask(c.env.DB, form.get('task_id'))
  if (!task) return back(c, `/weekly?date=${date}`, '업무를 고르지 않았습니다.')
  const items = await db.listWeekly(c.env.DB, weekStart(date))
  await db.addWeeklyItem(c.env.DB, weekStart(date), kind, {
    task_id: task.id, title: task.title, work_type: task.work_type,
    status: kind === '전주 실적' ? task.status : null,
    progress: kind === '전주 실적' ? task.progress : null,
    due_date: task.deadline,
  }, items.filter((i) => i.kind === kind).length)
  return back(c, `/weekly?date=${date}`, '넣었습니다.')
})

app.post('/weekly/add-free', async (c) => {
  const form = await c.req.formData()
  const date = dateOr(form.get('date'), todayKST())
  const kind = form.get('kind')
  const title = (form.get('title') || '').trim()
  if (!title) return back(c, `/weekly?date=${date}`, '업무명을 입력해 주세요.')
  const items = await db.listWeekly(c.env.DB, weekStart(date))
  await db.addWeeklyItem(c.env.DB, weekStart(date), kind, {
    title, work_type: '꼬마시리즈 개발',
    status: kind === '전주 실적' ? '진행' : null,
    progress: null, due_date: null,
  }, items.filter((i) => i.kind === kind).length)
  return back(c, `/weekly?date=${date}`, '넣었습니다.')
})

app.post('/weekly/:id/save', async (c) => {
  const form = await c.req.formData()
  const date = dateOr(form.get('date'), todayKST())
  await db.saveWeeklyItem(c.env.DB, c.req.param('id'), {
    title: form.get('title') || '',
    work_type: form.get('work_type'),
    status: form.get('status'),
    progress: form.get('progress'),
    due_date: form.get('due_date'),
    note: form.get('note'),
    output: form.get('output'),
  })
  const id = c.req.param('id')
  return c.redirect(`/weekly?date=${date}&saved=${id}#item-${id}`)
})

app.post('/weekly/:id/delete', async (c) => {
  const form = await c.req.formData()
  await db.deleteWeeklyItem(c.env.DB, c.req.param('id'))
  return back(c, `/weekly?date=${dateOr(form.get('date'), todayKST())}`, '뺐습니다.')
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
  const { error, changed } = await db.renameWorkTypes(
    c.env.DB,
    froms.map((from, i) => ({ from, to: tos[i] }))
  )
  if (error) return back(c, '/tasks', error)
  return back(c, '/tasks', changed.length ? `${changed.length}개 이름을 바꿨습니다.` : '바뀐 이름이 없습니다.')
})

app.post('/work-types/new', async (c) => {
  const form = await c.req.formData()
  const { error, name } = await db.createWorkType(c.env.DB, form.get('name'))
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

app.get('/series', async (c) =>
  html(c, seriesPage({
    series: await db.listSeries(c.env.DB),
    palette: db.SERIES_PALETTE,
  })))

app.post('/series', async (c) => {
  const form = await c.req.formData()
  const names = form.getAll('name')
  const colors = form.getAll('color')
  const stages = Object.fromEntries(STAGES.map((s) => [s.key, form.getAll(s.key)]))
  await db.saveSeries(
    c.env.DB,
    names.map((name, i) => ({
      name,
      color: colors[i],
      ...Object.fromEntries(STAGES.map((s) => [s.key, stages[s.key][i]])),
    }))
  )
  return back(c, '/series', '저장했습니다.')
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

/* ── 보고서 ─────────────────────────────────────────────── */

const kindOr = (v) => (v === 'weekly' ? 'weekly' : 'daily')

app.get('/reports', async (c) => {
  const kind = kindOr(c.req.query('kind'))
  const date = dateOr(c.req.query('date'), todayKST())
  const [report, history] = await Promise.all([
    db.getReport(c.env.DB, kind, date),
    db.listReports(c.env.DB),
  ])
  return html(c, reportsPage({
    kind, date, report, history,
    driveReady: driveConfigured(c.env),
  }))
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
    '<style>a[href^="https://claude.ai/new"]' +
    '{color:#ffffff !important;text-decoration:none !important}</style>' +
    // 액자 안에서도 스크롤이 생기면 세로 막대가 둘이 된다. 문서가 자기 높이를
    // 알려 주면 바깥에서 액자를 그만큼 늘려, 페이지 스크롤 하나만 남는다.
    '<script>(function(){function s(){try{parent.postMessage({briefHeight:' +
    'Math.max(document.documentElement.scrollHeight,(document.body||{}).scrollHeight||0)' +
    '},"*")}catch(e){}}addEventListener("load",s);addEventListener("resize",s);' +
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
