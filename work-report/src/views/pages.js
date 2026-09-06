// 화면 일곱 개. 서버에서 HTML을 그려 보내고, 폼을 제출하면 처리 후 되돌아온다.
import { page, esc, jsq, pill, tag, field, optionalSelect } from './layout.js'
import { SHEET_JS, SHEET_HELP, sheetBox, jsonBlock } from './sheet.js'
import { dday, koreanDate, koreanWeek, barHeight } from '../lib/report/format.js'
import { SERIES_COLOR, displayStatus } from '../lib/report/colors.js'
import { statusTint, priorityTint, ddayTint } from './ui.js'
import { STAGES } from '../lib/series.js'

export const STATUSES = ['예정', '시작', '진행', '완료', '보류']
export const PRIORITIES = ['높음', '중간', '낮음']

const ddayTag = (d) =>
  d === null
    ? '<span class="tag">마감 없음</span>'
    : `<span class="dday" style="color:${ddayTint(d)}">D-${d}</span>`

const notice = (msg, kind) =>
  msg ? `<p class="note${kind ? ' ' + kind : ''}">${msg}</p>` : ''

/* ── 오늘 ───────────────────────────────────────────────── */

export function todayPage({ today, logs, weekly, series, soon, brief }) {
  const stale = series.filter((s) => !s.updated_at)
  // 주간 항목이 아예 없을 때와, 지난주 것만 있고 이번 주가 빈 때는 말이 다르다.
  const weekNote =
    weekly.prev + weekly.plan === 0
      ? '<p class="empty">이번 주 항목이 없습니다. <a href="/weekly">주간업무</a>에서 입력하세요.</p>'
      : weekly.plan
        ? ''
        : '<p class="count">금주 예정 업무가 없습니다. <a href="/weekly">주간업무</a>에서 입력하세요.</p>'
  const body = `
<div class="head">
  <div><h1>데일리 브리프</h1><p>${koreanDate(today)} · ${koreanWeek(today)}</p></div>
  <div class="row">
    <a class="btn" href="/daily">일일업무</a>
    <a class="btn ghost" href="/weekly">주간업무</a>
  </div>
</div>
<!-- 주말·공휴일 알림은 여기 두지 않는다. 그 말은 보고서 자동 생성에 관한
     것인데, 모닝브리프는 주말에도 오므로 이 화면에서는 어긋나 보인다.
     보고서를 쓰는 일일업무 화면에만 둔다. -->
${stale.length ? notice('시리즈 진행률이 아직 입력되지 않았습니다. <a href="/series">지금 입력하기</a>', 'warn') : ''}

${briefCard(brief, today)}

<div class="card">
  <div class="chead"><h2>오늘 기록한 업무</h2><span class="count">${logs.length}건</span></div>
  ${
    logs.length
      ? logs.map((l) => `<div class="item cols mine">
          <span class="t">${esc(l.title)}</span>
          <span class="c">${pill(displayStatus(l.status), statusTint(l.status))}</span>
          <span class="c">${tag(l.progress === null ? '진행률 없음' : l.progress + '%')}</span>
          <span class="c">${ddayTag(dday(l.deadline, today))}</span>
        </div>`).join('')
      : `<p class="empty">아직 기록이 없습니다. <a href="/daily">일일업무</a>에서 오늘 진행한 업무를 입력하세요.</p>`
  }
</div>

<div class="card">
  <!-- 채울 말이 없으면 제목 줄 아래 여백까지 지운다. 빈 자리만 남기지 않는다. -->
  <div class="chead"${weekNote ? '' : ' style="margin-bottom:0"'}><h2>이번 주 현황</h2>
    <span class="count">전주 실적 ${weekly.prev}건 · 금주 예정 ${weekly.plan}건</span></div>
  ${weekNote}
</div>

<div class="card">
  <div class="chead"><h2>마감이 가까운 업무</h2></div>
  ${
    soon.length
      ? soon.map((t) => {
          const d = dday(t.deadline, today)
          return `<div class="item cols due"><span class="t">${esc(t.title)}</span>
            <span class="c">${tag(t.deadline)}</span>
            <span class="c"><span class="pill"
              style="background:${ddayTint(d)}">D-${d}</span></span></div>`
        }).join('')
      : '<p class="empty">마감이 정해진 업무가 없습니다.</p>'
  }
</div>`
  return page({ title: '데일리 브리프', path: '/', body })
}

/* ── 업무 ───────────────────────────────────────────────── */

export function tasksPage({ tasks, editing, archived, seriesNames, workTypes, archivedCount }) {
  // 업무 유형은 시리즈를 따라간다. 그 시리즈에 매인 유형과 공통 유형만 고를 수 있다.
  const forSeries = (name, keep) => {
    const list = workTypes.filter((t) => !t.series || t.series === name)
    // 이미 어긋나게 저장된 업무를 수정할 때, 지금 값이 목록에서 사라지면
    // 무엇이 들어 있었는지 알 수 없다. 그 값만 남겨 둔다.
    if (keep && !list.some((t) => t.name === keep)) {
      const cur = workTypes.find((t) => t.name === keep)
      if (cur) list.push(cur)
    }
    return list
  }
  const doneCount = tasks.filter((t) => t.status === '완료').length
  const f = editing || {
    title: '', series: seriesNames[0] || '',
    work_type: (forSeries(seriesNames[0] || '')[0] || {}).name || '',
    priority: '중간', status: '진행', progress: '', deadline: '', is_misc: false,
  }
  const form = `
<div class="card">
  <div class="chead"><h2>${editing ? '단위업무 수정' : '단위업무 추가'}</h2></div>
  <form method="post" action="${editing ? `/tasks/${editing.id}/save` : '/tasks/new'}">
    <div class="row bottom" style="margin-bottom:12px">
      <div class="fld grow"><label>단위업무명</label>
        <input name="title" value="${esc(f.title)}" placeholder="예: 꼬마생각 샘플권 감수본 확인" required></div>
      <label class="chk">
        <input type="checkbox" name="is_misc" value="1"${f.is_misc ? ' checked' : ''}>
        <span>기타 사항으로 표시 (요약 카드 집계에서 제외)</span></label>
      <button class="btn">${editing ? '수정 저장' : '추가'}</button>
      ${editing ? '<a class="btn ghost" href="/tasks">취소</a>' : ''}
    </div>
    <div class="grid one-line">
      ${optionalSelect('시리즈', 'series', f.series, seriesNames)}
      ${optionalSelect('업무 유형', 'work_type', f.work_type, forSeries(f.series, f.work_type).map((t) => t.name))}
      ${field('진행 상태', 'status', f.status, { options: STATUSES })}
      ${field('우선순위', 'priority', f.priority, { options: PRIORITIES })}
      ${field('진행률 (%)', 'progress', f.progress, { type: 'number', min: 0, max: 100 })}
      ${field('마감 시한', 'deadline', f.deadline, { type: 'date' })}
    </div>
  </form>
</div>
<script>
// 시리즈를 바꾸면 업무 유형 목록을 그 시리즈 것으로 다시 그린다. 서버도 같은
// 규칙으로 한 번 더 본다 — 이 스크립트가 돌지 않아도 어긋난 짝은 저장되지 않는다.
;(function () {
  var ALL = ${JSON.stringify(workTypes.map((t) => ({ n: t.name, s: t.series || '' })))}
  var form = document.querySelector('form[action$="/tasks/new"], form[action*="/tasks/"][action$="/save"]')
  if (!form) return
  var series = form.querySelector('select[name=series]')
  var type = form.querySelector('select[name=work_type]')
  if (!series || !type) return
  series.addEventListener('change', function () {
    var keep = type.value
    var list = ALL.filter(function (t) { return !t.s || t.s === series.value })
    type.innerHTML = '<option value="">선택 안 함</option>' +
      list.map(function (t) {
        return '<option' + (t.n === keep ? ' selected' : '') + '>' +
          t.n.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</option>'
      }).join('')
    if (type.value !== keep) type.selectedIndex = list.length ? 1 : 0
  })
})()
<\/script>`

  const body = `
<div class="head">
  <div><h1>단위업무</h1><p>보고서에 들어가는 업무 목록입니다. 여기서 상태와 진행률을 관리합니다.</p></div>
  <div class="row">
    ${
      // 저절로 보관하지는 않는다. 다시 손댈 업무가 말없이 사라지면 더 불편하다.
      !archived && doneCount
        ? `<form method="post" action="/tasks/archive-done" class="inline"
                 onsubmit="return confirm('완료된 업무 ${doneCount}건을 보관함으로 옮길까요? 기록은 그대로 남습니다.')">
             <button class="btn ghost sm">완료 업무 보관 (${doneCount})</button></form>`
        : ''
    }
    <a class="btn ghost sm" href="/tasks${archived ? '' : '?archived=1'}">
      ${archived ? '진행 중 목록 보기' : `보관함 보기${archivedCount ? ` (${archivedCount})` : ''}`}</a>
  </div>
</div>
${archived ? '' : form}
<div class="card">
  <div class="chead"><h2>${archived ? '보관함' : '단위업무 목록'}</h2>
    <span class="count" data-count>${tasks.length}건</span></div>
  ${
    // 목록은 시간이 갈수록 길어진다. 이름·시리즈·상태로 좁혀 볼 수 있게 한다.
    // 화면에서 거르므로 다시 불러오지 않는다.
    tasks.length > 5
      ? `<div class="row filters">
    <input class="grow" data-q placeholder="업무명으로 찾기" aria-label="업무명으로 찾기">
    <select data-fs aria-label="시리즈로 거르기"><option value="">모든 시리즈</option>
      ${seriesNames.map((n) => `<option>${esc(n)}</option>`).join('')}</select>
    <select data-ft aria-label="진행 상태로 거르기"><option value="">모든 상태</option>
      ${STATUSES.map((n) => `<option>${esc(n)}</option>`).join('')}</select>
  </div>`
      : ''
  }
  ${
    tasks.length
      ? tasks.map((t) => `<div class="item cols" data-row
          data-title="${esc(t.title)}" data-series="${esc(t.series || '')}"
          data-status="${esc(t.status || '')}">
          <span class="t">${esc(t.title)}${t.is_misc ? ' <span class="tag">기타</span>' : ''}</span>
          <span class="c">${t.work_type ? tag(t.work_type) : ''}</span>
          <span class="c">${pill(displayStatus(t.status), statusTint(t.status))}</span>
          <span class="c">${pill(t.priority, priorityTint(t.priority))}</span>
          <!-- 칸 이름이 이미 진행률이라 값에 그 말을 되풀이하지 않는다. 그만큼을
               날짜 칸에 준다 — 날짜가 잘리면 무슨 날인지 알 수 없다. -->
          <span class="c">${tag(t.progress === null ? '없음' : t.progress + '%')}</span>
          <span class="c">${tag(t.deadline || '마감 없음')}</span>
          <span class="acts">
            <a class="btn ghost sm" href="/tasks?edit=${t.id}">수정</a>
            <form method="post" action="/tasks/${t.id}/archive" class="inline">
              <input type="hidden" name="archived" value="${t.archived ? '0' : '1'}">
              <button class="btn ghost sm">${t.archived ? '복구' : '보관'}</button></form>
            <form method="post" action="/tasks/${t.id}/delete" class="inline"
                  onsubmit="return confirm('&quot;${jsq(t.title)}&quot; 을(를) 목록에서 지웁니다. 지난 일일·주간 기록은 그대로 남습니다. 계속할까요?')">
              <button class="btn danger sm">삭제</button></form>
          </span>
        </div>`).join('')
      : '<p class="empty">업무가 없습니다.</p>'
  }
  <p class="empty" data-none hidden>찾는 업무가 없습니다.</p>
</div>
${archived ? '' : workTypeCard(workTypes, seriesNames)}
<script>
// 목록 거르개. 이름·시리즈·상태 세 가지를 함께 본다.
;(function () {
  var box = document.querySelector('.filters')
  if (!box) return
  var card = box.closest('.card')
  var q = box.querySelector('[data-q]')
  var fs = box.querySelector('[data-fs]')
  var ft = box.querySelector('[data-ft]')
  var rows = [].slice.call(card.querySelectorAll('[data-row]'))
  var count = card.querySelector('[data-count]')
  var none = card.querySelector('[data-none]')
  function run() {
    var t = q.value.trim().toLowerCase()
    var n = 0
    rows.forEach(function (r) {
      var ok =
        (!t || r.getAttribute('data-title').toLowerCase().indexOf(t) >= 0) &&
        (!fs.value || r.getAttribute('data-series') === fs.value) &&
        (!ft.value || r.getAttribute('data-status') === ft.value)
      r.hidden = !ok
      if (ok) n++
    })
    count.textContent = n === rows.length ? rows.length + '건' : n + ' / ' + rows.length + '건'
    none.hidden = n > 0
  }
  q.addEventListener('input', run)
  fs.addEventListener('change', run)
  ft.addEventListener('change', run)
})()
<\/script>`
  return page({ title: '단위업무', path: '/tasks', body })
}

/* ── 모닝브리프 ─────────────────────────────────────────── */

/** D1은 UTC로 적는다. 화면에는 한국 시각으로 보여 준다. */
function kstTime(stamp) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(stamp || ''))
  if (!m) return ''
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) + 9 * 3600 * 1000
  const d = new Date(t)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

/**
 * 요약 칸 하나. 숫자만 있으면 무슨 일인지 알 수 없으므로 항목 제목을 함께 적는다.
 * 다섯 개까지만 보이고 나머지는 "외 N건"으로 접는다.
 */
const briefCount = (n, label, items = []) => {
  const shown = items.slice(0, 5)
  const rest = items.length - shown.length
  return (
    `<div class="bnum">` +
    `<span class="bl">${label}</span>` +
    `<span class="bn">${n === null || n === undefined ? '–' : n}</span>` +
    (shown.length
      ? `<ul>${shown.map((t) => `<li>${esc(t)}</li>`).join('')}` +
        (rest > 0 ? `<li class="more">외 ${rest}건</li>` : '') +
        `</ul>`
      : '') +
    `</div>`
  )
}

/** 데일리 브리프 맨 위 칸. 아침에 온 브리프의 숫자만 보여주고 본문은 /brief 에서 연다. */
function briefCard(brief, today) {
  if (!brief) {
    return `
<div class="card">
  <div class="chead"><h2>모닝브리프</h2><span class="count">${koreanDate(today)}</span></div>
  <p class="empty">오늘 브리프가 아직 오지 않았습니다.
    <a href="/brief">지난 브리프 보기</a></p>
</div>`
  }
  return `
<div class="card">
  <div class="chead">
    <h2>모닝브리프 <span class="count">${kstTime(brief.created_at)} 도착</span></h2>
    <div class="row">
      <a class="btn" href="/brief">모닝브리프 열기</a>
      <a class="btn ghost" href="/brief/raw?date=${brief.brief_date}"
         target="_blank" rel="noreferrer">새 탭에서 크게 보기</a>
    </div>
  </div>
  ${brief.headline ? `<p class="bhead">${esc(brief.headline)}</p>` : ''}
  <div class="brow">
    ${briefCount(brief.events, '오늘 일정', brief.items?.events)}
    ${briefCount(brief.todo, '해야 할 일', brief.items?.todo)}
    ${briefCount(brief.done, '정리된 일', brief.items?.done)}
  </div>
</div>`
}

/** 브리프 보는 화면. 받아 온 문서는 iframe 안에 가둬서 띄운다. */
export function briefPage({ date, brief, history, today }) {
  const body = `
<!-- 브리프 문서 자체가 제목과 요약 카드를 이미 갖고 있다. 앱에서 또 그리면 두 번씩
     나오므로, 이 화면은 날짜를 고르는 줄만 두고 문서를 그대로 보여 준다. -->
<div class="row" style="margin:26px 0 16px">
  <form method="get" action="/brief" class="row">
    <input type="date" name="date" value="${date}" max="${today}"
           style="width:170px" onchange="this.form.submit()">
  </form>
  ${brief ? `<span class="count">${kstTime(brief.created_at)} 도착</span>` : ''}
  <span class="spacer"></span>
  <a class="btn" href="/">돌아가기</a>
  ${brief ? `<a class="btn ghost" href="/brief/raw?date=${date}"
     target="_blank" rel="noreferrer">새 탭에서 크게 보기</a>` : ''}
</div>

${
  brief
    ? `<div class="card" style="padding:0;overflow:hidden">
        <iframe class="brief" title="모닝브리프" src="/brief/raw?date=${date}"
                sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"></iframe>
      </div>
      <script>
      // 브리프가 자기 높이를 알려 오면 액자를 그만큼 늘린다. 그래야 세로 막대가
      // 페이지 하나만 남는다. 액자 안에서 온 말인지 보낸 창으로 확인한다.
      addEventListener('message', function (e) {
        var f = document.querySelector('iframe.brief')
        if (!f || e.source !== f.contentWindow) return
        var h = e.data && e.data.briefHeight
        if (typeof h === 'number' && h > 200 && h < 40000) f.style.height = h + 'px'
      })
      <\/script>`
    : `<p class="empty">${koreanDate(date)} 브리프가 없습니다.
        아침마다 클라우드의 Claude가 만들어 보냅니다.</p>`
}

<div class="card">
  <div class="chead"><h2>지난 브리프</h2><span class="count">최근 30일</span></div>
  ${
    history.length
      ? history.map((b) => `<div class="item">
          ${tag(b.brief_date)}
          <span class="t">${b.headline ? esc(b.headline) : '브리프'}</span>
          ${tag(`일정 ${b.events ?? '–'}`)}
          ${tag(`해야 할 일 ${b.todo ?? '–'}`)}
          <span class="spacer"></span>
          <a class="btn ghost sm" href="/brief?date=${b.brief_date}">열기</a>
        </div>`).join('')
      : '<p class="empty">아직 받은 브리프가 없습니다.</p>'
  }
</div>`
  return page({ title: '모닝브리프', path: '/brief', body })
}

/** 업무 유형 관리. 이름을 바꾸면 그 유형을 쓰던 업무도 함께 따라간다. */
/** 유형이 속한 시리즈를 고르는 상자. 비워 두면 어느 시리즈에서나 고를 수 있다. */
const seriesPick = (value, seriesNames, label) =>
  `<select name="series" class="wtseries" aria-label="${esc(label)}의 시리즈">` +
  `<option value=""${value ? '' : ' selected'}>공통 (모든 시리즈)</option>` +
  seriesNames
    .map((n) => `<option${n === value ? ' selected' : ''}>${esc(n)}</option>`)
    .join('') +
  `</select>`

function workTypeCard(workTypes, seriesNames) {
  return `
<div class="card">
  <div class="chead"><h2>업무 유형 관리</h2>
    <span class="count">${workTypes.length}개</span></div>
  ${
    workTypes.length
      ? `<form method="post" action="/work-types">
    ${workTypes.map((t, i) => `
    <div class="item">
      <input type="hidden" name="from" value="${esc(t.name)}">
      <input name="to" value="${esc(t.name)}" class="wtname" aria-label="업무 유형 이름">
      ${seriesPick(t.series || '', seriesNames, t.name)}
      <span class="spacer"></span>
      <button class="btn ghost sm" formaction="/work-types/move" name="move" value="${esc(t.name)}:-1"
              formnovalidate${i === 0 ? ' disabled' : ''}>↑</button>
      <button class="btn ghost sm" formaction="/work-types/move" name="move" value="${esc(t.name)}:1"
              formnovalidate${i === workTypes.length - 1 ? ' disabled' : ''}>↓</button>
      <button class="btn plain sm">수정</button>
      <button class="btn danger sm" formaction="/work-types/delete" name="remove" value="${esc(t.name)}"
              formnovalidate
              onclick="return confirm('&quot;${jsq(t.name)}&quot; 을(를) 지울까요? 이 유형을 쓰던 업무는 유형이 비워집니다.')">삭제</button>
    </div>`).join('')}
  </form>`
      : '<p class="empty">업무 유형이 없습니다. 아래에서 추가하세요.</p>'
  }
  <div class="addrow">
    <span class="lbl">새 업무 유형 추가</span>
    <form method="post" action="/work-types/new" class="row">
      <input name="name" class="wtname" placeholder="예: 세이펜 제작" required>
      ${seriesPick('', seriesNames, '새 업무 유형')}
      <button class="btn ghost">추가</button>
    </form>
  </div>
</div>`
}

/* ── 일일업무 ──────────────────────────────────────────── */

/** 표가 쓰는 모양으로 바꾼다. 빈 값은 null이 아니라 ''로 보낸다. */
const sheetTask = (t) => ({
  id: t.id, title: t.title, series: t.series || '', work_type: t.work_type || '',
})
const nz = (v) => (v === null || v === undefined ? '' : v)

export const dailyRow = (l) => ({
  id: l.id,
  task_id: l.task_id || null,
  title: l.title,
  status: nz(l.status),
  priority: nz(l.priority),
  progress: nz(l.progress),
  deadline: nz(l.deadline),
  is_misc: !!l.is_misc,
  detail_text: (l.detail_lines || []).join('\n'),
  prev_detail: l.prev_detail || '',
})

export function dailyPage({ date, logs, tasks, hasTasks, skip, today }) {
  const data = {
    date, today,
    statuses: STATUSES,
    statusesW: [...STATUSES, '종결'],
    priorities: PRIORITIES,
    tasks: tasks.map(sheetTask),
    types: [],
    grids: [{
      id: 'daily', api: '/api/daily', kind: '', move: true, oncePerDay: true,
      cols: ['task', 'status', 'prio', 'pct', 'due', 'detail', 'misc'],
      rows: logs.map(dailyRow),
    }],
  }
  const body = `
<div class="head">
  <div><h1>일일업무</h1><p>${koreanDate(date)} 에 진행한 업무와 세부내용을 적습니다.</p></div>
  <form method="get" action="/daily" class="row">
    <input type="date" name="date" value="${date}" style="width:170px" onchange="this.form.submit()">
    <a class="btn" href="/reports?kind=daily&date=${date}">보고서 만들기</a>
  </form>
</div>
${skip ? notice(`${date === today ? '오늘' : '이 날'}은 <b>${skip}</b>입니다. 자동 생성은 건너뜁니다.`, 'warn') : ''}
${hasTasks ? '' : notice('아직 단위업무가 없습니다. <a href="/tasks">단위업무</a>에서 먼저 등록하면 목록에서 고를 수 있습니다.', 'warn')}
${sheetBox('daily', '업무 추가')}
${SHEET_HELP}
<noscript><p class="note err">이 화면은 자바스크립트가 켜져 있어야 씁니다.</p></noscript>
${jsonBlock('sheet-data', data)}
${SHEET_JS}`
  return page({ title: '일일업무', path: '/daily', body, wide: true })
}

/* ── 주간업무 ──────────────────────────────────────────── */

export const weeklyRow = (it) => ({
  id: it.id,
  task_id: it.task_id || null,
  title: it.title,
  work_type: nz(it.work_type),
  status: nz(it.status),
  progress: nz(it.progress),
  due_date: nz(it.due_date),
  output: nz(it.output),
  note: nz(it.note),
})

export function weeklyPage({ date, weekStart, items, tasks, workTypes, today }) {
  const byKind = (k) => items.filter((i) => i.kind === k).map(weeklyRow)
  const data = {
    date, today,
    statuses: STATUSES,
    statusesW: [...STATUSES, '종결'],
    priorities: PRIORITIES,
    tasks: tasks.map(sheetTask),
    types: workTypes.map((t) => ({ name: t.name, series: t.series || '' })),
    grids: [
      {
        id: 'prev', api: '/api/weekly', kind: '전주 실적', move: false, oncePerDay: false,
        cols: ['type', 'wtitle', 'statusw', 'pct', 'duew', 'output', 'note'],
        rows: byKind('전주 실적'),
      },
      {
        id: 'plan', api: '/api/weekly', kind: '금주 예정', move: false, oncePerDay: false,
        cols: ['type', 'wtitle', 'duew', 'note'],
        rows: byKind('금주 예정'),
      },
    ],
  }
  const carry = `<form method="post" action="/weekly/carry-over" class="inline">
    <input type="hidden" name="date" value="${date}">
    <button class="btn ghost sm">지난 주 예정 가져오기</button></form>`

  const body = `
<div class="head">
  <div><h1>주간업무</h1><p>${koreanWeek(date)} · 주 시작 ${weekStart}</p></div>
  <form method="get" action="/weekly" class="row">
    <input type="date" name="date" value="${date}" style="width:170px" onchange="this.form.submit()">
    <a class="btn alt" href="/reports?kind=weekly&date=${date}">보고서 만들기</a>
  </form>
</div>
${sheetBox('prev', '전주 실적', carry)}
${sheetBox('plan', '금주 예정')}
${SHEET_HELP}
<noscript><p class="note err">이 화면은 자바스크립트가 켜져 있어야 씁니다.</p></noscript>
${jsonBlock('sheet-data', data)}
${SHEET_JS}`
  return page({ title: '주간업무', path: '/weekly', body, wide: true })
}

/* ── 개발현황 ─────────────────────────────────────────────── */

export function seriesPage({ series, palette }) {
  const colorSelect = (name, value) =>
    `<select name="color" style="width:104px" aria-label="${esc(name)} 색">` +
    palette
      .map(([label, hex]) =>
        `<option value="${hex}"${hex === value ? ' selected' : ''}>${label}</option>`)
      .join('') +
    `</select>`

  // 단계별 값을 넣으면 총 진행률이 가중치대로 계산된다.
  const stageInputs = (s) =>
    STAGES.map((st) => `
      <div class="fld">
        <label>${st.label} <span style="opacity:.6">${Math.round(st.weight * 100)}%</span></label>
        <input type="number" min="0" max="100" name="${st.key}"
               value="${s[st.key] === null || s[st.key] === undefined ? '' : s[st.key]}"
               data-w="${st.weight}" aria-label="${esc(s.name)} ${st.label}">
      </div>`).join('')

  const body = `
<div class="head"><div><h1>개발현황</h1>
  <p>단계별 진행률을 넣으면 총 진행률이 가중치대로 계산됩니다.</p></div></div>

${
  series.length
    ? `<form method="post" action="/series">
  ${series.map((s, i) => `
  <div class="card" data-series>
    <div class="chead">
      <h2>${esc(s.name)}</h2>
      <div class="row">
        <span class="pill" data-total style="background:${s.color || '#8e8e93'}">${s.total}%</span>
        <input type="hidden" name="name" value="${esc(s.name)}">
        ${colorSelect(s.name, s.color)}
        <button class="btn ghost sm" formaction="/series/move" name="move" value="${esc(s.name)}:-1"
                formnovalidate${i === 0 ? ' disabled' : ''}>↑</button>
        <button class="btn ghost sm" formaction="/series/move" name="move" value="${esc(s.name)}:1"
                formnovalidate${i === series.length - 1 ? ' disabled' : ''}>↓</button>
        <button class="btn plain sm">저장</button>
        <button class="btn danger sm" formaction="/series/delete" name="remove" value="${esc(s.name)}"
                formnovalidate
                onclick="return confirm('&quot;${jsq(s.name)}&quot; 을(를) 지울까요? 보고서 막대에서 빠집니다.')">삭제</button>
      </div>
    </div>
    <div class="grid">${stageInputs(s)}</div>
    <p class="count" style="margin:0">${s.updated_at ? s.updated_at.slice(0, 10) + ' 갱신' : '아직 저장 전'}</p>
  </div>`).join('')}
</form>`
    : '<p class="empty">시리즈가 없습니다. 아래 [시리즈 추가]에서 입력하세요.</p>'
}

<div class="card">
  <div class="chead"><h2>미리보기</h2>
    <span class="count">보고서에 이렇게 들어갑니다</span></div>
  ${
    series.length
      ? `<div class="bars">
    ${series.map((s) => {
      const c = s.color || SERIES_COLOR[s.name] || '#378ADD'
      return `<div class="bar">
        <div class="v" style="color:${c}">${s.total}%</div>
        <div class="stem" style="background:${c};height:${barHeight(s.total)}px"></div>
        <div class="n">${esc(s.name)}</div></div>`
    }).join('')}
  </div>`
      : '<p class="empty">표시할 시리즈가 없습니다.</p>'
  }
</div>

<div class="card">
  <div class="chead"><h2>시리즈 추가</h2></div>
  <form method="post" action="/series/new" class="row">
    <input name="name" class="grow" placeholder="예: 꼬마과학뒤집기" required>
    ${colorSelect('새 시리즈', palette[0][1])}
    <button class="btn">추가</button>
  </form>
</div>

<script>
// 저장하기 전에도 총 진행률이 바로 보이도록 화면에서 같은 식으로 계산한다.
document.querySelectorAll('[data-series]').forEach(function (card) {
  var badge = card.querySelector('[data-total]')
  var inputs = card.querySelectorAll('input[data-w]')
  function paint() {
    var sum = 0
    inputs.forEach(function (el) { sum += (Number(el.value) || 0) * Number(el.dataset.w) })
    badge.textContent = Math.round(sum) + '%'
  }
  inputs.forEach(function (el) { el.addEventListener('input', paint) })
})
</script>`
  return page({ title: '개발현황', path: '/series', body })
}

/* ── 보고서 ─────────────────────────────────────────────── */

export function reportsPage({ kind, date, report, history, total, limit, step, driveReady }) {
  /** 보고서 한 건을 지우는 폼. 지운 뒤에는 보던 자리로 되돌아온다. */
  const delForm = (r, cls) => `<form method="post" action="/reports/delete" class="inline"
    onsubmit="return confirm('&quot;${jsq(r.filename)}&quot; 을(를) 지웁니다.\\n구글 드라이브에 저장된 파일은 그대로 남습니다. 계속할까요?')">
    <input type="hidden" name="id" value="${esc(r.id)}">
    <input type="hidden" name="kind" value="${kind}">
    <input type="hidden" name="date" value="${date}">
    <input type="hidden" name="limit" value="${limit}">
    <button class="btn danger ${cls}">삭제</button></form>`

  const body = `
<div class="head"><div><h1>보고서</h1>
  <p>${kind === 'daily' ? koreanDate(date) : koreanWeek(date)}</p></div></div>

<div class="card">
  <div class="tabs">
    <a class="${kind === 'daily' ? 'on' : ''}" href="/reports?kind=daily&date=${date}">일일</a>
    <a class="${kind === 'weekly' ? 'on' : ''}" href="/reports?kind=weekly&date=${date}">주간</a>
  </div>
  <div class="row">
    <form method="get" action="/reports" class="inline">
      <input type="hidden" name="kind" value="${kind}">
      <input type="date" name="date" value="${date}" style="width:170px" onchange="this.form.submit()">
    </form>
    <form method="post" action="/reports/generate" class="inline">
      <input type="hidden" name="kind" value="${kind}"><input type="hidden" name="date" value="${date}">
      <button class="btn">보고서 만들기</button></form>
    <form method="post" action="/reports/drive" class="inline">
      <input type="hidden" name="kind" value="${kind}"><input type="hidden" name="date" value="${date}">
      <button class="btn ghost"${report && driveReady ? '' : ' disabled'}>구글 드라이브에 저장</button></form>
    ${report
      ? `<a class="btn ghost" href="/reports/download?kind=${kind}&date=${date}">HTML 내려받기</a>`
      : '<button class="btn ghost" disabled>HTML 내려받기</button>'}
  </div>
  ${driveReady ? '' : '<p class="count" style="margin-top:9px">구글 드라이브 설정이 아직 없습니다. README의 드라이브 설정을 참고하세요.</p>'}
</div>

${
  report
    ? `<div class="card">
        <div class="chead">
          <div class="row"><h2>미리보기</h2>
            <a href="/reports/preview?kind=${kind}&date=${date}"
               target="_blank" rel="noreferrer">새 탭에서 크게 보기</a></div>
          <div class="row"><span class="count mono">${esc(report.filename)}</span>
            ${delForm(report, 'sm')}</div></div>
        <!-- 보고서 문서는 920~960px로 폭이 정해져 있다. 좁은 자리에 그대로 넣으면
             가로 막대가 생겨 오른쪽이 잘린다. 원래 폭으로 그린 뒤 자리에 맞춰 줄인다. -->
        <div class="previewbox">
          <iframe class="preview" title="보고서 미리보기"
                  src="/reports/preview?kind=${kind}&date=${date}"></iframe>
        </div>
        ${report.drive_link ? `<p class="count" style="margin-top:10px">드라이브에 저장됨 ·
          <a href="${esc(report.drive_link)}" target="_blank" rel="noreferrer">파일 열기</a></p>` : ''}
      </div>`
    : '<p class="empty">아직 만들어진 보고서가 없습니다. 날짜를 고르고 "보고서 만들기"를 누르세요.</p>'
}

<script>
// 미리보기를 자리 폭에 맞춰 줄인다. 줄인 만큼 액자를 세로로 늘려, 보이는
// 높이는 그대로 두면서 문서 전체 폭이 한눈에 들어오게 한다.
;(function () {
  var W = 980
  function fit() {
    var box = document.querySelector('.previewbox')
    if (!box) return
    var f = box.querySelector('iframe.preview')
    if (!f || !box.clientWidth) return
    var k = Math.min(1, box.clientWidth / W)
    f.style.width = W + 'px'
    f.style.height = Math.round(box.clientHeight / k) + 'px'
    f.style.transform = 'scale(' + k + ')'
  }
  addEventListener('load', fit)
  addEventListener('resize', fit)
  fit()
})()
<\/script>

<div class="card">
  <div class="chead"><h2>생성 이력</h2>
    <span class="count">${total}건 중 ${history.length}건<span data-rshown></span></span></div>
  ${
    history.length
      ? `<div class="filters row">
    <input class="grow" data-rq placeholder="파일명·날짜로 찾기 (예: 20260812)" aria-label="보고서 찾기">
    <select data-rk aria-label="종류로 거르기">
      <option value="">모든 종류</option><option value="daily">일일</option>
      <option value="weekly">주간</option></select>
  </div>` + history.map((r) => `<div class="item" data-rrow
          data-name="${esc(r.filename)} ${esc(r.report_date)}" data-kind="${r.kind}">
          ${tag(r.kind === 'daily' ? '일일' : '주간')}
          <span class="t mono" style="font-size:13px">${esc(r.filename)}</span>
          ${tag(r.report_date)}
          <a class="tag" href="/reports/preview?kind=${r.kind}&date=${r.report_date}"
             target="_blank" rel="noreferrer">열기</a>
          ${r.drive_link ? `<a class="tag" href="${esc(r.drive_link)}" target="_blank" rel="noreferrer">드라이브</a>` : ''}
          <span class="spacer"></span>
          <a class="btn ghost sm" href="/reports?kind=${r.kind}&date=${r.report_date}">보기</a>
          ${delForm(r, 'sm')}
        </div>`).join('') +
        `<p class="empty" data-rnone hidden>찾는 보고서가 없습니다.</p>` +
        (history.length < total
          ? `<div class="row" style="justify-content:center;margin-top:14px">
              <a class="btn ghost sm"
                 href="/reports?kind=${kind}&date=${date}&limit=${limit + step}">${
                   Math.min(step, total - history.length)}건 더 보기</a></div>`
          : '')
      : '<p class="empty">이력이 없습니다.</p>'
  }
</div>
<script>
;(function () {
  var q = document.querySelector('[data-rq]'), k = document.querySelector('[data-rk]')
  if (!q || !k) return
  var rows = [].slice.call(document.querySelectorAll('[data-rrow]'))
  var none = document.querySelector('[data-rnone]')
  var shown = document.querySelector('[data-rshown]')
  function run() {
    var t = q.value.trim().toLowerCase(), kk = k.value, n = 0
    rows.forEach(function (r) {
      var ok = (!t || r.getAttribute('data-name').toLowerCase().indexOf(t) >= 0) &&
               (!kk || r.getAttribute('data-kind') === kk)
      r.hidden = !ok
      if (ok) n++
    })
    if (none) none.hidden = n > 0
    if (shown) shown.textContent = n === rows.length ? '' : ' · ' + n + '건 보임'
  }
  q.addEventListener('input', run)
  k.addEventListener('change', run)
})()
<\/script>`
  return page({ title: '보고서', path: '/reports', body })
}

/* ── 법인카드 ──────────────────────────────────────────── */

/** 표가 쓰는 모양. 빈 값은 null이 아니라 ''로 보낸다. */
export const cardRow = (e) => ({
  id: e.id,
  used_on: e.used_on,
  title: e.title,
  spender: nz(e.spender),
  merchant: nz(e.merchant),
  amount: e.amount === null || e.amount === undefined ? '' : Number(e.amount),
  account: nz(e.account),
  settle: nz(e.settle),
  note: nz(e.note),
})

/** 항목 관리에서 고르는 색 이름과 실제 색. sheet.js의 딱지가 이 이름을 받는다. */
export const CARD_COLORS = {
  회색: '--gray', 초록: '--green', 주황: '--orange',
  빨강: '--red', 파랑: '--accent', 보라: '--purple',
}

const money = (n) => Number(n || 0).toLocaleString('ko-KR')

/** '2026-08-13' → '8월 13일'. 한 달 안에서만 보는 목록이라 해와 요일은 군더더기다. */
const koreanDay = (iso) => {
  const p = String(iso || '').split('-')
  return p.length === 3 ? `${+p[1]}월 ${+p[2]}일` : iso
}

/** 이름 하나만 고치는 줄. 업무 유형 관리와 같은 모양이다. */
const itemRow = (kind, r, i, n, extra) => `
    <div class="item">
      <input type="hidden" name="from" value="${esc(r.name)}">
      <input name="to" value="${esc(r.name)}" class="wtname" aria-label="${esc(r.name)} 이름">
      ${extra || ''}
      <span class="spacer"></span>
      <button class="btn ghost sm" formaction="/cards/items/move" name="move"
              value="${kind}:${esc(r.name)}:-1" formnovalidate${i === 0 ? ' disabled' : ''}>↑</button>
      <button class="btn ghost sm" formaction="/cards/items/move" name="move"
              value="${kind}:${esc(r.name)}:1" formnovalidate${i === n - 1 ? ' disabled' : ''}>↓</button>
      <button class="btn plain sm">수정</button>
      <button class="btn danger sm" formaction="/cards/items/delete" name="remove"
              value="${kind}:${esc(r.name)}" formnovalidate
              onclick="return confirm('&quot;${jsq(r.name)}&quot; 을(를) 지울까요? 이 값을 쓰던 사용 내역은 남고 그 칸만 비워집니다.')">삭제</button>
    </div>`

const itemPanel = (kind, label, rows, hidden) => `
    <div data-p="${kind}"${hidden ? ' hidden' : ''}>
      <form method="post" action="/cards/items">
        <input type="hidden" name="kind" value="${kind}">
        ${rows.map((r, i) => itemRow(kind, r, i, rows.length,
          kind !== 'settle' ? '' : `
      <select name="color" class="mcolor" aria-label="${esc(r.name)} 색">${
        Object.keys(CARD_COLORS)
          .map((c) => `<option${c === r.color ? ' selected' : ''}>${c}</option>`).join('')}</select>
      <label class="chk flat"><input type="checkbox" name="done" value="${esc(r.name)}"${
        r.done ? ' checked' : ''}> 정산 끝</label>`)).join('')}
      </form>
      <div class="addrow">
        <span class="lbl">새 ${label} 추가</span>
        <form method="post" action="/cards/items/new" class="row">
          <input type="hidden" name="kind" value="${kind}">
          <input name="name" class="wtname" placeholder="예: ${
            kind === 'account' ? '회의비' : kind === 'user' ? '차영미' : '지출품의 반려'}" required>
          <button class="btn ghost">추가</button>
        </form>
      </div>
    </div>`

/**
 * 항목 관리.
 *
 * 계정이나 사람을 손볼 일은 몇 달에 한 번이라 화면을 늘 차지할 이유가 없다.
 * [표 쓰는 법]과 같은 글자 토글로 접어 둔다.
 */
function manageBox({ accounts, users, settles }) {
  return `
<details class="shhelp manage">
  <summary>항목 관리</summary>
  <div class="mbox">
    <p class="mlead">고르는 칸에 나오는 값을 여기서 늘리고 줄입니다.</p>
    <div class="tabs" data-mtabs>
      <a href="#acc" data-t="account" class="on">처리 계정 <span class="count">${accounts.length}</span></a>
      <a href="#user" data-t="user">사용자 <span class="count">${users.length}</span></a>
      <a href="#settle" data-t="settle">정산상태 <span class="count">${settles.length}</span></a>
    </div>
    ${itemPanel('account', '처리 계정', accounts, false)}
    ${itemPanel('user', '사용자', users, true)}
    ${itemPanel('settle', '정산상태', settles, true)}
  </div>
</details>
<script>
(function () {
  var tabs = document.querySelector('[data-mtabs]')
  if (!tabs) return
  tabs.addEventListener('click', function (ev) {
    var a = ev.target.closest('a'); if (!a) return
    ev.preventDefault()
    tabs.querySelectorAll('a').forEach(function (x) { x.classList.toggle('on', x === a) })
    document.querySelectorAll('[data-p]').forEach(function (p) {
      p.hidden = p.dataset.p !== a.dataset.t
    })
  })
})()
<\/script>`
}

export function cardsPage({ month, monthLabel, prev, next, rows, summary,
                            accounts, users, settles, presets, defaultDay }) {
  const settleNames = settles.map((s) => s.name)
  const tints = {}
  for (const s of settles) tints[s.name] = CARD_COLORS[s.color] || '--gray'

  const data = {
    date: month, today: defaultDay,
    statuses: STATUSES, statusesW: STATUSES, priorities: PRIORITIES,
    tasks: [], types: [],
    users: users.map((u) => u.name),
    accounts: accounts.map((a) => a.name),
    settles: settleNames,
    tints,
    presets,
    grids: [{
      id: 'cards', api: '/api/cards', kind: '', move: false, sum: 'amount',
      needs: [['title', '세부 내역'], ['amount', '금액']],
      cols: ['cday', 'ctitle', 'cuser', 'cshop', 'cwon', 'cacc', 'csettle', 'cnote'],
      rows: rows.map(cardRow),
    }],
  }

  const opts = (list, sel) =>
    list.map((o) => `<option${o === sel ? ' selected' : ''}>${esc(o)}</option>`).join('')

  const body = `
<div class="head">
  <div>
    <h1>법인카드</h1>
    <p>법인카드로 쓴 돈을 달마다 모아 정산 상태까지 함께 관리합니다.</p>
  </div>
  <form method="get" action="/cards" class="row">
    <a class="btn ghost sm" href="/cards?month=${prev}">‹ ${+prev.slice(5)}월</a>
    <input type="month" name="month" value="${month}" style="width:158px"
           onchange="this.form.submit()" aria-label="달">
    <a class="btn ghost sm" href="/cards?month=${next}">${+next.slice(5)}월 ›</a>
  </form>
</div>

<div class="card">
  <div class="chead"><h2>${monthLabel}<span class="count">${summary.count}건</span></h2></div>
  <div class="brow">
    <div class="bnum">
      <span class="bl">이 달 합계</span>
      <span class="bn">${money(summary.total)}원</span>
    </div>
    <div class="bnum">
      <span class="bl">아직 승인되지 않음</span>
      <span class="bn">${money(summary.openTotal)}원</span>
      <ul>${
        summary.open.length
          ? summary.open.slice(0, 4).map((r) =>
              `<li>${esc(koreanDay(r.used_on))} ${esc(r.title)} · ${esc(r.settle)}</li>`).join('') +
            (summary.open.length > 4
              ? `<li class="more">외 ${summary.open.length - 4}건</li>` : '')
          : '<li class="more">모두 처리되었습니다</li>'
      }</ul>
    </div>
    <div class="bnum">
      <span class="bl">처리 계정별</span>
      <div class="accs">${
        summary.byAccount.length
          ? summary.byAccount.map((a) =>
              `<span class="tag">${esc(a.name)} <b>${money(a.total)}</b></span>`).join('')
          : '<span class="count">아직 없습니다</span>'
      }</div>
    </div>
  </div>
</div>

<div class="card" data-addcard="cards">
  <div class="chead">
    <h2>사용 내역 추가</h2>
    <div class="row">
      <span class="count" data-count="cards">0건</span>
      <span class="shsave" data-save="cards"><span class="dot"></span><span class="txt">저장됨</span></span>
      <button type="button" class="shretry" data-save-now="cards" hidden>다시 저장</button>
    </div>
  </div>
  <div class="fld">
    <label class="lblrow">자주 쓰는 항목<span class="muted">고르면 아래 칸이 함께 채워집니다</span></label>
    <select data-preset aria-label="자주 쓰는 항목">
      <option value="">고르지 않고 아래에 직접 입력해도 됩니다</option>
      ${presets.map((p) =>
        `<option value="${esc(p.id)}">${esc(p.title)}${
          p.merchant ? ` — ${esc(p.merchant)}` : ''}</option>`).join('')}
    </select>
  </div>
  <div class="grid cardadd">
    <div class="fld"><label>사용일</label>
      <input type="date" data-f="used_on" value="${defaultDay}"></div>
    <div class="fld"><label>세부 내역</label><input data-f="title"></div>
    <div class="fld"><label>사용자</label>
      <select data-f="spender">${opts(data.users, data.users[0] || '')}</select></div>
    <div class="fld"><label>사용처</label><input data-f="merchant"></div>
    <!-- 금액은 숫자 칸으로 두지 않는다. 카드 명세서에서 '31,100원'을 그대로
         붙여넣으면 숫자 칸은 값을 통째로 버린다. 쉼표는 받아서 떼어 낸다. -->
    <div class="fld"><label>금액</label>
      <input data-f="amount" inputmode="numeric" placeholder="0"></div>
    <div class="fld"><label>처리 계정</label>
      <select data-f="account">
        <option value="">선택 안 함</option>${opts(data.accounts, '')}</select></div>
    <div class="fld"><label>정산상태</label>
      <select data-f="settle">${opts(settleNames, settleNames[0] || '')}</select></div>
    <div class="fld span2"><label>비고</label><input data-f="note"></div>
    <button type="button" class="btn addbtn" data-addfields="cards">추가</button>
  </div>
</div>
<div class="sheet" id="sh-cards"></div>
${SHEET_HELP}
${manageBox({ accounts, users, settles })}
<noscript><p class="note err">이 화면은 자바스크립트가 켜져 있어야 씁니다.</p></noscript>
${jsonBlock('sheet-data', data)}
${SHEET_JS}`
  return page({ title: '법인카드', path: '/cards', body, wide: true })
}
