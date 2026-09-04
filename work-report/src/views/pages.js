// 화면 여섯 개. 서버에서 HTML을 그려 보내고, 폼을 제출하면 처리 후 되돌아온다.
import { page, esc, pill, tag, field, optionalSelect } from './layout.js'
import { dday, koreanDate, koreanWeek, barHeight } from '../lib/report/format.js'
import { SERIES_COLOR, displayStatus } from '../lib/report/colors.js'
import { statusTint, priorityTint, ddayTint } from './ui.js'

export const STATUSES = ['예정', '시작', '진행', '완료', '보류']
export const PRIORITIES = ['높음', '중간', '낮음']
export const SERIES_NAMES = ['꼬마생각뒤집기', '꼬마역사뒤집기', '꼬마 일력', '기타']
export const WORK_TYPES = [
  '꼬마시리즈 개발', '꼬마생각뒤집기 개발', '꼬마역사뒤집기 개발',
  '꼬마과학뒤집기 개발', '기타 업무',
]

const ddayTag = (d) =>
  d === null
    ? '<span class="tag">마감 없음</span>'
    : `<span class="dday" style="color:${ddayTint(d)}">D-${d}</span>`

const notice = (msg, kind) =>
  msg ? `<p class="note${kind ? ' ' + kind : ''}">${msg}</p>` : ''

/* ── 오늘 ───────────────────────────────────────────────── */

export function todayPage({ today, logs, weekly, series, soon, skip, msg }) {
  const stale = series.filter((s) => !s.updated_at)
  const body = `
<div class="head">
  <div><h1>오늘</h1><p>${koreanDate(today)} · ${koreanWeek(today)}</p></div>
  <div class="row">
    <a class="btn" href="/daily">일일 기록하기</a>
    <a class="btn ghost" href="/weekly">주간 현황</a>
  </div>
</div>
${notice(msg, '')}
${skip ? notice(`오늘은 <b>${skip}</b>입니다. 자동 생성은 건너뜁니다.`, 'warn') : ''}
${stale.length ? notice('시리즈 진행률이 아직 입력되지 않았습니다. <a href="/series">지금 입력하기</a>', 'warn') : ''}

<div class="card">
  <div class="chead"><h2>오늘 기록한 업무</h2><span class="count">${logs.length}건</span></div>
  ${
    logs.length
      ? logs.map((l) => `<div class="item">
          <span class="t">${esc(l.title)}</span>
          ${pill(displayStatus(l.status), statusTint(l.status))}
          ${tag(l.progress === null ? '진행률 없음' : l.progress + '%')}
          ${ddayTag(dday(l.deadline, today))}
        </div>`).join('')
      : `<p class="empty">아직 기록이 없습니다. <a href="/daily">일일 기록</a>에서 오늘 진행한 업무를 넣으세요.</p>`
  }
  ${logs.length ? `<div class="row" style="margin-top:14px">
      <a class="btn" href="/reports?kind=daily&date=${today}">일일 보고서 만들기</a></div>` : ''}
</div>

<div class="card">
  <div class="chead"><h2>이번 주 현황</h2>
    <span class="count">전주 실적 ${weekly.prev}건 · 금주 예정 ${weekly.plan}건</span></div>
  ${
    weekly.prev + weekly.plan
      ? `<div class="row"><a class="btn alt" href="/reports?kind=weekly&date=${today}">주간 보고서 만들기</a></div>`
      : `<p class="empty">이번 주 항목이 없습니다. <a href="/weekly">주간 현황</a>에서 채우세요.</p>`
  }
</div>

<div class="card">
  <div class="chead"><h2>마감이 가까운 업무</h2></div>
  ${
    soon.length
      ? soon.map((t) => {
          const d = dday(t.deadline, today)
          return `<div class="item"><span class="t">${esc(t.title)}</span>
            ${tag(t.deadline)}
            <span class="pill" style="background:${ddayTint(d)}">D-${d}</span></div>`
        }).join('')
      : '<p class="empty">마감이 정해진 업무가 없습니다.</p>'
  }
</div>`
  return page({ title: '오늘', path: '/', body })
}

/* ── 업무 ───────────────────────────────────────────────── */

export function tasksPage({ tasks, editing, archived, msg }) {
  const f = editing || {
    title: '', series: '꼬마생각뒤집기', work_type: '꼬마시리즈 개발',
    priority: '중간', status: '진행', progress: '', deadline: '', is_misc: false,
  }
  const form = `
<div class="card">
  <div class="chead"><h2>${editing ? '업무 수정' : '업무 추가'}</h2></div>
  <form method="post" action="${editing ? `/tasks/${editing.id}/save` : '/tasks/new'}">
    <div class="fld" style="margin-bottom:10px"><label>업무명</label>
      <input name="title" value="${esc(f.title)}" placeholder="예: 꼬마생각 샘플권 감수본 확인" required></div>
    <div class="grid">
      ${optionalSelect('시리즈', 'series', f.series, SERIES_NAMES)}
      ${optionalSelect('업무 유형', 'work_type', f.work_type, WORK_TYPES)}
      ${field('진행 상태', 'status', f.status, { options: STATUSES })}
      ${field('우선순위', 'priority', f.priority, { options: PRIORITIES })}
      ${field('진행률 (%) · 비우면 진행률 바에서 빠집니다', 'progress', f.progress, { type: 'number', min: 0, max: 100 })}
      ${field('마감 시한 · 비우면 D-day를 표시하지 않습니다', 'deadline', f.deadline, { type: 'date' })}
    </div>
    <label class="row" style="margin:4px 0 12px;font-size:13px">
      <input type="checkbox" name="is_misc" value="1"${f.is_misc ? ' checked' : ''} style="width:auto">
      <span>기타 사항으로 표시 (요약 카드 집계에서 제외)</span></label>
    <div class="row">
      <button class="btn">${editing ? '수정 저장' : '추가'}</button>
      ${editing ? '<a class="btn ghost" href="/tasks">취소</a>' : ''}
    </div>
  </form>
</div>`

  const body = `
<div class="head">
  <div><h1>단위 업무</h1><p>보고서에 들어가는 업무 목록입니다. 여기서 상태와 진행률을 관리합니다.</p></div>
  <a class="btn ghost sm" href="/tasks${archived ? '' : '?archived=1'}">
    ${archived ? '진행 중 목록 보기' : '보관함 보기'}</a>
</div>
${notice(msg)}
${archived ? '' : form}
<div class="card">
  <div class="chead"><h2>${archived ? '보관함' : '업무 목록'}</h2>
    <span class="count">${tasks.length}건</span></div>
  ${
    tasks.length
      ? tasks.map((t) => `<div class="item">
          <span class="t">${esc(t.title)}</span>
          ${t.work_type ? tag(t.work_type) : ''}
          ${pill(displayStatus(t.status), statusTint(t.status))}
          ${pill(t.priority, priorityTint(t.priority))}
          ${tag(t.progress === null ? '진행률 없음' : t.progress + '%')}
          ${tag(t.deadline || '마감 없음')}
          ${t.is_misc ? tag('기타') : ''}
          <span class="spacer"></span>
          <a class="btn ghost sm" href="/tasks?edit=${t.id}">수정</a>
          <form method="post" action="/tasks/${t.id}/archive" class="inline">
            <input type="hidden" name="archived" value="${t.archived ? '0' : '1'}">
            <button class="btn ghost sm">${t.archived ? '복구' : '보관'}</button></form>
          <form method="post" action="/tasks/${t.id}/delete" class="inline"
                onsubmit="return confirm('이 업무와 일일 기록을 함께 지웁니다. 계속할까요?')">
            <button class="btn danger sm">삭제</button></form>
        </div>`).join('')
      : '<p class="empty">업무가 없습니다.</p>'
  }
</div>`
  return page({ title: '업무', path: '/tasks', body })
}

/* ── 일일 기록 ──────────────────────────────────────────── */

const savedMark = (on) =>
  on ? '<span class="pill" style="background:var(--green)">저장했습니다</span>' : ''

export function dailyPage({ date, logs, available, hasTasks, skip, msg, saved }) {
  const body = `
<div class="head">
  <div><h1>일일 기록</h1><p>${koreanDate(date)} 에 진행한 업무와 세부내용을 적습니다.</p></div>
  <form method="get" action="/daily" class="row">
    <input type="date" name="date" value="${date}" style="width:170px" onchange="this.form.submit()">
    <a class="btn" href="/reports?kind=daily&date=${date}">보고서 만들기</a>
  </form>
</div>
${notice(msg)}
${skip ? notice(`${skip}입니다. 자동 생성은 이 날짜를 건너뜁니다.`, 'warn') : ''}

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
    <form method="post" action="/daily/${l.id}/move" class="inline">
      <input type="hidden" name="date" value="${date}"><input type="hidden" name="dir" value="-1">
      <button class="btn ghost sm"${i === 0 ? ' disabled' : ''}>↑</button></form>
    <form method="post" action="/daily/${l.id}/move" class="inline">
      <input type="hidden" name="date" value="${date}"><input type="hidden" name="dir" value="1">
      <button class="btn ghost sm"${i === logs.length - 1 ? ' disabled' : ''}>↓</button></form>
    <form method="post" action="/daily/${l.id}/delete" class="inline">
      <input type="hidden" name="date" value="${date}">
      <button class="btn danger sm">빼기</button></form>
  </div></div>
  <form method="post" action="/daily/${l.id}/save">
    <input type="hidden" name="date" value="${date}">
    <div class="grid">
      ${field('진행 상태', 'status', l.status, { options: STATUSES })}
      ${field('우선순위', 'priority', l.priority, { options: PRIORITIES })}
      ${field('진행률 (%)', 'progress', l.progress, { type: 'number', min: 0, max: 100 })}
      ${field('마감 시한', 'deadline', l.deadline, { type: 'date' })}
    </div>
    <div class="fld" style="margin-bottom:12px">
      <label>세부내용 · 한 줄에 하나씩 적으면 글머리로 들어갑니다</label>
      <textarea name="detail_text" rows="3">${esc((l.detail_lines || []).join('\n'))}</textarea>
    </div>
    <div class="row">
      <button class="btn">저장</button>
      <label class="row" style="font-size:13px">
        <input type="checkbox" name="is_misc" value="1"${l.is_misc ? ' checked' : ''} style="width:auto">
        <span>기타 사항 (요약 카드 집계 제외)</span></label>
    </div>
  </form>
</div>`
      }).join('')
    : '<p class="empty">이 날짜에 기록된 업무가 없습니다.</p>'
}`
  return page({ title: '일일 기록', path: '/daily', body })
}

/* ── 주간 현황 ──────────────────────────────────────────── */

export function weeklyPage({ date, weekStart, items, tasks, msg, saved }) {
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
      <div class="row">${savedMark(saved === it.id)}${d === null ? '' : ddayTag(d)}</div>
    </div>
    <div class="grid">
      ${optionalSelect('업무 유형', 'work_type', it.work_type, WORK_TYPES)}
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
    <div class="row"><button class="btn">저장</button></div>
  </form>
  <form method="post" action="/weekly/${it.id}/delete" style="margin-top:9px">
    <input type="hidden" name="date" value="${date}">
    <button class="btn danger sm">빼기</button>
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
  <div><h1>주간 현황</h1><p>${koreanWeek(date)} · 주 시작 ${weekStart}</p></div>
  <form method="get" action="/weekly" class="row">
    <input type="date" name="date" value="${date}" style="width:170px" onchange="this.form.submit()">
    <a class="btn alt" href="/reports?kind=weekly&date=${date}">보고서 만들기</a>
  </form>
</div>
${notice(msg)}
${section('전주 실적', carry)}
${section('금주 예정')}`
  return page({ title: '주간 현황', path: '/weekly', body })
}

/* ── 시리즈 ─────────────────────────────────────────────── */

export function seriesPage({ series, palette, msg }) {
  // 폭을 잡아 주지 않으면 한 줄에 안 들어가고 아래로 접힌다
  const colorSelect = (name, value) =>
    `<select name="color" style="width:104px" aria-label="${esc(name)} 색">` +
    palette
      .map(([label, hex]) =>
        `<option value="${hex}"${hex === value ? ' selected' : ''}>${label}</option>`)
      .join('') +
    `</select>`

  const body = `
<div class="head"><div><h1>시리즈별 개발 현황</h1>
  <p>보고서 오른쪽 세로 막대에 쓰이는 총 진행률입니다.</p></div></div>
${notice(msg)}

<div class="card">
  <div class="chead"><h2>진행률</h2><span class="count">${series.length}개</span></div>
  ${
    series.length
      ? `<form method="post" action="/series">
    ${series.map((s, i) => `
    <div class="item">
      <input type="hidden" name="name" value="${esc(s.name)}">
      <span class="t">${esc(s.name)}</span>
      <input type="number" name="progress" min="0" max="100" value="${s.total_progress}"
             style="width:88px" aria-label="${esc(s.name)} 진행률">
      ${colorSelect(s.name, s.color)}
      <span class="count">${s.updated_at ? s.updated_at.slice(0, 10) : '미입력'}</span>
      <button class="btn ghost sm" formaction="/series/move" name="move" value="${esc(s.name)}:-1"
              formnovalidate${i === 0 ? ' disabled' : ''}>↑</button>
      <button class="btn ghost sm" formaction="/series/move" name="move" value="${esc(s.name)}:1"
              formnovalidate${i === series.length - 1 ? ' disabled' : ''}>↓</button>
      <button class="btn danger sm" formaction="/series/delete" name="remove" value="${esc(s.name)}"
              formnovalidate
              onclick="return confirm('${esc(s.name)} 을(를) 지울까요? 보고서 막대에서 빠집니다.')">삭제</button>
    </div>`).join('')}
    <div class="row" style="margin-top:16px"><button class="btn">저장</button></div>
  </form>`
      : '<p class="empty">시리즈가 없습니다. 아래에서 추가하세요.</p>'
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

<div class="card">
  <div class="chead"><h2>미리보기</h2>
    <span class="count">보고서에 이렇게 들어갑니다</span></div>
  ${
    series.length
      ? `<div class="bars">
    ${series.map((s) => {
      const c = s.color || SERIES_COLOR[s.name] || '#378ADD'
      return `<div class="bar">
        <div class="v" style="color:${c}">${s.total_progress}%</div>
        <div class="stem" style="background:${c};height:${barHeight(s.total_progress)}px"></div>
        <div class="n">${esc(s.name)}</div></div>`
    }).join('')}
  </div>`
      : '<p class="empty">표시할 시리즈가 없습니다.</p>'
  }
</div>`
  return page({ title: '시리즈', path: '/series', body, narrow: true })
}

/* ── 보고서 ─────────────────────────────────────────────── */

export function reportsPage({ kind, date, report, history, msg, msgKind, driveReady }) {
  const body = `
<div class="head"><div><h1>보고서</h1>
  <p>${kind === 'daily' ? koreanDate(date) : koreanWeek(date)}</p></div></div>
${notice(msg, msgKind)}

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
        <div class="chead"><h2>미리보기</h2><span class="count mono">${esc(report.filename)}</span></div>
        <iframe class="preview" title="보고서 미리보기" src="/reports/preview?kind=${kind}&date=${date}"></iframe>
        ${report.drive_link ? `<p class="count" style="margin-top:9px">
          드라이브에 저장됨 · <a href="${esc(report.drive_link)}" target="_blank" rel="noreferrer">열기</a></p>` : ''}
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
          ${r.drive_link ? `<a class="tag" href="${esc(r.drive_link)}" target="_blank" rel="noreferrer">드라이브</a>` : ''}
          <span class="spacer"></span>
          <a class="btn ghost sm" href="/reports?kind=${r.kind}&date=${r.report_date}">열기</a>
        </div>`).join('')
      : '<p class="empty">이력이 없습니다.</p>'
  }
</div>`
  return page({ title: '보고서', path: '/reports', body })
}
