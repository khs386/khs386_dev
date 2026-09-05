// 업무보고서 — Cloudflare Workers 진입점.
// 화면(GET)과 폼 처리(POST)를 모두 이 워커가 맡고, 정해진 시각에 스스로 깨어나 보고서를 만든다.
import { Hono } from 'hono'
import * as db from './lib/db.js'
import { isLoggedIn, makeSessionCookie, clearSessionCookie, checkPassword } from './lib/auth.js'
import { driveConfigured, uploadHtml } from './lib/drive.js'
import {
  todayKST, skipReason, generateReport, filenameFor,
} from './lib/reports.js'
import { weekStart, dday } from './lib/report/format.js'
import { STAGES } from './lib/series.js'
import { loginPage, FAVICON } from './views/layout.js'
import { privacyPage, termsPage } from './views/legal.js'
import {
  todayPage, tasksPage, dailyPage, weeklyPage, seriesPage, reportsPage,
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
const PUBLIC = ['/login', '/privacy', '/terms', '/favicon.svg', '/favicon.ico']
app.use('*', async (c, next) => {
  if (PUBLIC.includes(c.req.path)) return next()
  if (!(await isLoggedIn(c.req.raw, c.env))) return c.redirect('/login')
  await next()
})

/* ── 오늘 ───────────────────────────────────────────────── */

app.get('/', async (c) => {
  const today = todayKST()
  const [logs, weekly, series, tasks, settings] = await Promise.all([
    db.listLogs(c.env.DB, today),
    db.listWeekly(c.env.DB, weekStart(today)),
    db.listSeries(c.env.DB),
    db.listTasks(c.env.DB),
    db.getSettings(c.env.DB),
  ])
  const soon = tasks.filter((t) => t.deadline).slice(0, 5)
  return html(c, todayPage({
    today, logs, series, soon,
    weekly: {
      prev: weekly.filter((w) => w.kind === '전주 실적').length,
      plan: weekly.filter((w) => w.kind === '금주 예정').length,
    },
    skip: skipReason(today, settings.holidays),
    msg: c.req.query('msg'),
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
    msg: c.req.query('msg'),
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
    msg: c.req.query('msg'),
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
    msg: c.req.query('msg'), saved: c.req.query('saved'),
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
    msg: c.req.query('msg'),
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
    msg: c.req.query('msg'),
    msgKind: c.req.query('t'),
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
    const up = await uploadHtml(c.env, report.filename, report.html)
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

/* ── 정해진 시각에 스스로 실행 ──────────────────────────── */

/**
 * cron이 부를 때 도는 부분. 주말·공휴일이면 아무것도 만들지 않는다.
 * 어느 보고서를 만들지는 요일로 정한다 — 금요일 UTC 08시는 주간, 나머지는 일일.
 */
async function runScheduled(event, env) {
  const date = todayKST()
  const settings = await db.getSettings(env.DB)
  const skip = skipReason(date, settings.holidays)
  if (skip) return { skipped: skip, date }

  const hour = new Date(event.scheduledTime).getUTCHours()
  const kind = hour === 8 ? 'weekly' : 'daily'

  const { empty, filename } = await generateReport(env, env.DB, kind, date)
  if (empty) return { skipped: '기록된 업무 없음', date, kind }

  if (driveConfigured(env)) {
    const report = await db.getReport(env.DB, kind, date)
    const up = await uploadHtml(env, report.filename, report.html)
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
