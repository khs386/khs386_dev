// 화면 여섯 개. 서버에서 HTML을 그려 보내고, 폼을 제출하면 처리 후 되돌아온다.
import { page, esc, jsq, pill, tag, field, optionalSelect } from './layout.js'
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
      ? '<p class="empty">이번 주 항목이 없습니다. <a href="/weekly">주간업무</a>에서 채우세요.</p>'
      : weekly.plan
        ? ''
        : '<p class="count">금주 예정 업무가 없습니다. <a href="/weekly">주간업무</a>에서 채우세요.</p>'
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
      : `<p class="empty">아직 기록이 없습니다. <a href="/daily">일일업무</a>에서 오늘 진행한 업무를 넣으세요.</p>`
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
  <a class="btn ghost sm" href="/tasks${archived ? '' : '?archived=1'}">
    ${archived ? '진행 중 목록 보기' : `보관함 보기${archivedCount ? ` (${archivedCount})` : ''}`}</a>
</div>
${archived ? '' : form}
<div class="card">
  <div class="chead"><h2>${archived ? '보관함' : '단위업무 목록'}</h2>
    <span class="count">${tasks.length}건</span></div>
  ${
    tasks.length
      ? tasks.map((t) => `<div class="item cols">
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
                  onsubmit="return confirm('&quot;${jsq(t.title)}&quot; 을(를) 지웁니다. 딸린 일일업무 기록도 함께 지워집니다. 계속할까요?')">
              <button class="btn danger sm">삭제</button></form>
          </span>
        </div>`).join('')
      : '<p class="empty">업무가 없습니다.</p>'
  }
</div>
${archived ? '' : workTypeCard(workTypes, seriesNames)}`
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

const savedMark = (on) =>
  on ? '<span class="pill" style="background:var(--green)">저장했습니다</span>' : ''

export function dailyPage({ date, logs, available, hasTasks, skip, saved, today }) {
  const body = `
<div class="head">
  <div><h1>일일업무</h1><p>${koreanDate(date)} 에 진행한 업무와 세부내용을 적습니다.</p></div>
  <form method="get" action="/daily" class="row">
    <input type="date" name="date" value="${date}" style="width:170px" onchange="this.form.submit()">
    <a class="btn" href="/reports?kind=daily&date=${date}">보고서 만들기</a>
  </form>
</div>
${skip ? notice(`${date === today ? '오늘' : '이 날'}은 <b>${skip}</b>입니다. 자동 생성은 건너뜁니다.`, 'warn') : ''}

<div class="card">
  <div class="chead"><h2>업무 추가</h2><span class="count">${logs.length}건 기록됨</span></div>
  <form method="post" action="/daily/add" class="row">
    <input type="hidden" name="date" value="${date}">
    <select name="task_id" class="grow">
      <option value="">업무 목록에서 고르기…</option>
      ${available.map((t) => `<option value="${t.id}">${esc(t.title)}</option>`).join('')}
    </select>
    <button class="btn"${available.length ? '' : ' disabled'}>추가</button>
  </form>
  <form method="post" action="/daily/add-free" class="row" style="margin-top:9px">
    <input type="hidden" name="date" value="${date}">
    <input name="title" class="grow" placeholder="목록에 없는 업무를 직접 적기 (예: 기타 사항)">
    <button class="btn ghost">직접 추가</button>
  </form>
  ${hasTasks ? '' : '<p class="count" style="margin-top:8px">아직 업무가 없습니다. <a href="/tasks">업무 화면</a>에서 먼저 등록하세요.</p>'}
</div>

${
  logs.length
    ? logs.map((l, i) => {
        const d = dday(l.deadline, date)
        return `<div class="card" id="log-${l.id}">
  <div class="chead"><h2>${esc(l.title)}</h2><div class="row">
    ${savedMark(saved === l.id)}
    ${d === null ? '' : ddayTag(d)}
    <label class="chk flat" title="요약 카드 집계에서 뺍니다">
      <input type="checkbox" name="is_misc" value="1" form="save-${l.id}"${l.is_misc ? ' checked' : ''}
             style="width:auto">
      <span>기타 사항</span></label>
    <form method="post" action="/daily/${l.id}/move" class="inline">
      <input type="hidden" name="date" value="${date}"><input type="hidden" name="dir" value="-1">
      <button class="btn ghost sm"${i === 0 ? ' disabled' : ''}>↑</button></form>
    <form method="post" action="/daily/${l.id}/move" class="inline">
      <input type="hidden" name="date" value="${date}"><input type="hidden" name="dir" value="1">
      <button class="btn ghost sm"${i === logs.length - 1 ? ' disabled' : ''}>↓</button></form>
    <button class="btn plain sm" form="save-${l.id}">저장</button>
    <form method="post" action="/daily/${l.id}/delete" class="inline"
          onsubmit="return confirm('&quot;${jsq(l.title)}&quot; 을(를) 이 날짜에서 지웁니다. 계속할까요?')">
      <input type="hidden" name="date" value="${date}">
      <button class="btn danger sm">삭제</button></form>
  </div></div>
  <form id="save-${l.id}" method="post" action="/daily/${l.id}/save">
    <input type="hidden" name="date" value="${date}">
    <div class="grid">
      ${field('진행 상태', 'status', l.status, { options: STATUSES })}
      ${field('우선순위', 'priority', l.priority, { options: PRIORITIES })}
      ${field('진행률 (%)', 'progress', l.progress, { type: 'number', min: 0, max: 100 })}
      ${field('마감 시한', 'deadline', l.deadline, { type: 'date' })}
    </div>
    <div class="fld" style="margin-bottom:12px">
      <label class="lblrow">세부내용 · 한 줄에 하나씩 적으면 글머리로 들어갑니다
        ${
          // 목록에서 고른 줄에는 늘 자리를 둔다. 가져올 것이 없을 때 글자가 아예
          // 사라지면 기능이 없는 것인지 내용이 없는 것인지 알 수 없다.
          !l.task_id
            ? ''
            : l.prev_detail
              ? `<a href="#" class="prevfill"
                   data-prev="${esc(l.prev_detail).replace(/\n/g, '&#10;')}">직전 내용 가져오기</a>`
              : '<span class="muted">직전 내용 없음</span>'
        }</label>
      <textarea name="detail_text" rows="3">${esc((l.detail_lines || []).join('\n'))}</textarea>
    </div>
  </form>
</div>`
      }).join('')
    : '<p class="empty">이 날짜에 기록된 업무가 없습니다.</p>'
}
<script>
// [직전 내용 가져오기] — 그 업무를 마지막으로 적은 날의 세부내용을 칸에 넣는다.
// 적어 둔 것이 있으면 먼저 물어본다.
document.addEventListener('click', function (e) {
  var a = e.target.closest('a.prevfill')
  if (!a) return
  e.preventDefault()
  var box = a.closest('.fld').querySelector('textarea')
  if (box.value.trim() && !confirm('지금 적은 내용을 지우고 직전 내용으로 바꿀까요?')) return
  box.value = a.getAttribute('data-prev')
  box.focus()
})
<\/script>`
  return page({ title: '일일업무', path: '/daily', body })
}

/* ── 주간업무 ──────────────────────────────────────────── */

export function weeklyPage({ date, weekStart, items, tasks, workTypes, saved }) {
  // 단위업무에서 넣은 항목은 그 업무의 시리즈를 따른다. 직접 적어 넣은 항목은
  // 딸린 시리즈가 없으니 전체 목록에서 고른다.
  const seriesOf = new Map(tasks.map((t) => [t.id, t.series || '']))
  const typesFor = (taskId) => {
    const name = taskId ? seriesOf.get(taskId) : undefined
    return (name === undefined ? workTypes : workTypes.filter((t) => !t.series || t.series === name))
      .map((t) => t.name)
  }
  const byKind = (k) => items.filter((i) => i.kind === k)

  const addForm = (kind) => `
  <form method="post" action="/weekly/add" class="row">
    <input type="hidden" name="date" value="${date}">
    <input type="hidden" name="kind" value="${kind}">
    <select name="task_id" class="grow">
      <option value="">업무 목록에서 고르기…</option>
      ${tasks.map((t) => `<option value="${t.id}">${esc(t.title)}</option>`).join('')}
    </select>
    <button class="btn"${tasks.length ? '' : ' disabled'}>추가</button>
  </form>
  <form method="post" action="/weekly/add-free" class="row" style="margin-top:9px">
    <input type="hidden" name="date" value="${date}">
    <input type="hidden" name="kind" value="${kind}">
    <input name="title" class="grow" placeholder="직접 적기">
    <button class="btn ghost">직접 추가</button>
  </form>`

  const itemCard = (it, kind) => {
    const d = dday(it.due_date, date)
    return `<div class="card" id="item-${it.id}">
  <form method="post" action="/weekly/${it.id}/save">
    <input type="hidden" name="date" value="${date}">
    <div class="chead">
      <input name="title" value="${esc(it.title)}" style="max-width:360px;font-weight:600">
      <div class="row">${savedMark(saved === it.id)}${d === null ? '' : ddayTag(d)}
        <button class="btn plain sm">저장</button>
        <button class="btn danger sm" form="del-${it.id}">삭제</button></div>
    </div>
    <div class="grid">
      ${optionalSelect('업무 유형', 'work_type', it.work_type, typesFor(it.task_id))}
      ${
        kind === '전주 실적'
          ? optionalSelect('진행 상태', 'status', it.status, [...STATUSES, '종결']) +
            field('진행률 (%)', 'progress', it.progress, { type: 'number', min: 0, max: 100 })
          : ''
      }
      ${field('종결 예정일', 'due_date', it.due_date, { type: 'date' })}
    </div>
    <div class="grid">
      ${kind === '전주 실적' ? field('산출물', 'output', it.output) : ''}
      ${field('비고', 'note', it.note)}
    </div>
  </form>
  <!-- 삭제 단추는 제목 줄에 있고, 폼은 저장 폼 밖에 둔다. 폼은 겹칠 수 없다. -->
  <form id="del-${it.id}" method="post" action="/weekly/${it.id}/delete"
        onsubmit="return confirm('&quot;${jsq(it.title)}&quot; 을(를) 이 주에서 지웁니다. 계속할까요?')">
    <input type="hidden" name="date" value="${date}">
  </form>
</div>`
  }

  const section = (kind, extra) => `
<div class="card">
  <div class="chead"><h2>${kind}</h2><div class="row">
    <span class="count">${byKind(kind).length}건</span>${extra || ''}</div></div>
  ${addForm(kind)}
</div>
${byKind(kind).map((i) => itemCard(i, kind)).join('') ||
  `<p class="empty">${kind} 항목이 없습니다.</p>`}`

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
${section('전주 실적', carry)}
${section('금주 예정')}`
  return page({ title: '주간업무', path: '/weekly', body })
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
    : '<p class="empty">시리즈가 없습니다. 아래 [시리즈 추가]에서 넣으세요.</p>'
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

export function reportsPage({ kind, date, report, history, driveReady }) {
  const body = `
<div class="head"><div><h1>보고서</h1>
  <p>${kind === 'daily' ? koreanDate(date) : koreanWeek(date)}</p></div></div>

<div class="card">
  <div class="tabs">
    <a class="${kind === 'daily' ? 'on' : ''}" href="/reports?kind=daily&date=${date}">일일</a>
    <a class="${kind === 'weekly' ? 'on' : ''}" href="/reports?kind=weekly&date=${date}">주간</a>
  </div>
  <form method="get" action="/reports" class="row" style="margin-bottom:9px">
    <input type="hidden" name="kind" value="${kind}">
    <input type="date" name="date" value="${date}" style="width:170px" onchange="this.form.submit()">
  </form>
  <div class="row">
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
          <span class="count mono">${esc(report.filename)}</span></div>
        <iframe class="preview" title="보고서 미리보기" src="/reports/preview?kind=${kind}&date=${date}"></iframe>
        ${report.drive_link ? `<p class="count" style="margin-top:10px">드라이브에 저장됨 ·
          <a href="${esc(report.drive_link)}" target="_blank" rel="noreferrer">파일 열기</a></p>` : ''}
      </div>`
    : '<p class="empty">아직 만들어진 보고서가 없습니다. 날짜를 고르고 "보고서 만들기"를 누르세요.</p>'
}

<div class="card">
  <div class="chead"><h2>생성 이력</h2><span class="count">최근 30건</span></div>
  ${
    history.length
      ? history.map((r) => `<div class="item">
          ${tag(r.kind === 'daily' ? '일일' : '주간')}
          <span class="t mono" style="font-size:13px">${esc(r.filename)}</span>
          ${tag(r.report_date)}
          <a class="tag" href="/reports/preview?kind=${r.kind}&date=${r.report_date}"
             target="_blank" rel="noreferrer">보기</a>
          ${r.drive_link ? `<a class="tag" href="${esc(r.drive_link)}" target="_blank" rel="noreferrer">드라이브</a>` : ''}
          <span class="spacer"></span>
          <a class="btn ghost sm" href="/reports?kind=${r.kind}&date=${r.report_date}">열기</a>
        </div>`).join('')
      : '<p class="empty">이력이 없습니다.</p>'
  }
</div>`
  return page({ title: '보고서', path: '/reports', body })
}
