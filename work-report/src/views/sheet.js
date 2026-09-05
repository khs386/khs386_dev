// 일일·주간 입력 화면의 표. 엑셀처럼 칸을 눌러 그 자리에서 고치고, 맨 아랫줄에
// 입력하면 줄이 늘어난다. 저장 단추는 없다 — 칸을 벗어나면 저장한다.
//
// 서버는 표를 그리지 않는다. 줄과 열 이름만 JSON으로 실어 보내고 아래 스크립트가
// 그린다. 그리는 곳이 한 군데뿐이라 고칠 때 어긋날 자리가 없다.

/** <script type="application/json"> 안에 넣을 값. </script>만 막으면 된다. */
export const jsonBlock = (id, data) =>
  `<script type="application/json" id="${id}">` +
  JSON.stringify(data).replace(/</g, '\\u003c') +
  '</script>'

/**
 * 업무를 넣는 카드와 그 아래 표.
 *
 * 고르는 칸은 서버가 비워 두고 스크립트가 채운다. 표에 이미 들어간 업무는
 * 목록에서 빠져야 하는데, 그 목록은 줄이 늘고 줄 때마다 달라지기 때문이다.
 */
export const sheetBox = (id, heading, extra) => `
<div class="card" data-add="${id}">
  <div class="chead">
    <h2>${heading}</h2>
    <div class="row">
      <span class="count" data-count="${id}">0건</span>${extra || ''}
      <span class="shsave" data-save="${id}"><span class="dot"></span><span class="txt">저장됨</span></span>
      <button type="button" class="shretry" data-save-now="${id}" hidden>다시 저장</button>
    </div>
  </div>
  <div class="row">
    <span class="picker row grow">
      <input class="pq" data-pq placeholder="찾기" aria-label="업무 찾기" hidden>
      <select class="grow" data-pick aria-label="업무 목록">
        <option value="">업무 목록에서 선택</option>
      </select>
    </span>
    <button type="button" class="btn" data-addpick>추가</button>
  </div>
  <div class="row" style="margin-top:9px">
    <input class="grow" data-free placeholder="직접 입력 (예: 기타 사항)"
           aria-label="직접 입력할 업무명">
    <button type="button" class="btn ghost" data-addfree>직접 추가</button>
  </div>
</div>
<div class="sheet" id="sh-${id}"></div>`

export const SHEET_HELP = `
<details class="shhelp">
  <summary>표 쓰는 법</summary>
  <ul>
    <li><kbd>클릭</kbd> 칸 선택 — 그대로 타자를 치면 바로 덮어씁니다</li>
    <li><kbd>Enter</kbd> <kbd>더블클릭</kbd> 지금 값을 고쳐 쓰기</li>
    <li><kbd>Tab</kbd> <kbd>Shift+Tab</kbd> 오른쪽 / 왼쪽 칸으로</li>
    <li><kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> 칸 옮겨 다니기</li>
    <li><kbd>Alt+↑</kbd> <kbd>Alt+↓</kbd> 줄 자체를 위아래로 옮기기</li>
    <li><kbd>Delete</kbd> 칸 비우기 · <kbd>Esc</kbd> 고치던 것 되돌리기</li>
    <li><kbd>⌘/Ctrl+V</kbd> 엑셀에서 여러 줄을 그대로 붙여넣기</li>
    <li><kbd>맨 아랫줄</kbd>에 입력하면 새 줄이 생깁니다</li>
    <li>줄 번호에 마우스를 올리면 <kbd>✕</kbd> 가 나오고, 누르면 그 줄을 지웁니다</li>
  </ul>
</details>`

export const SHEET_CSS = `
/* ── 시트 ─────────────────────────────────────────────── */
.card:has(+ .sheet){margin-bottom:0; border-bottom-left-radius:0; border-bottom-right-radius:0}
.card + .sheet{border-top:0; border-top-left-radius:0; border-top-right-radius:0;
  margin-bottom:22px}
.shsave{margin-left:2px; font-size:12.5px; color:var(--text-3); display:inline-flex; align-items:center; gap:6px}
.shretry{appearance:none; border:0; background:transparent; color:var(--accent); cursor:pointer;
  font-size:12.5px; padding:2px 3px; text-decoration:underline}
.shretry:hover{opacity:.75}
.shsave .dot{width:7px; height:7px; border-radius:50%; background:var(--green)}
.shsave.busy .dot{background:var(--orange)}
.shsave.bad .dot{background:var(--red)}

.sheet{overflow-x:auto; border:1px solid var(--sep); border-radius:11px;
  background:var(--raised); -webkit-overflow-scrolling:touch}
.sheet table{border-collapse:separate; border-spacing:0; table-layout:fixed; min-width:100%}
.sheet th,.sheet td{border-right:1px solid var(--sep-soft); border-bottom:1px solid var(--sep-soft);
  padding:0; height:34px; overflow:hidden; vertical-align:middle}
.sheet th:last-child,.sheet td:last-child{border-right:0}
.sheet tbody tr:last-child td{border-bottom:0}
.sheet thead th{background:var(--fill); color:var(--text-2); font-size:12px; font-weight:600;
  text-align:left; padding:0 9px; height:32px; letter-spacing:.02em; white-space:nowrap;
  overflow:hidden; text-overflow:ellipsis; border-bottom:1px solid var(--sep)}
.sheet thead th.c{text-align:center}

.sheet td.cell{cursor:cell; position:relative}
.sheet td.cell .v{display:block; padding:0 9px; white-space:nowrap; overflow:hidden;
  text-overflow:ellipsis; font-variant-numeric:tabular-nums}
.sheet td.cell.c .v{text-align:center}
.sheet td.cell .v .ph,.sheet td.cell .v.ph{color:var(--text-3)}
.sheet td.sel{outline:2px solid var(--accent); outline-offset:-2px;
  background:var(--accent-soft); z-index:2}
.sheet tr.hot td{background:color-mix(in srgb,var(--accent) 5%,transparent)}
.sheet tr.hot td.sel{background:var(--accent-soft)}

.sheet td.rn{background:var(--fill); color:var(--text-3); font-size:11.5px; text-align:center;
  font-variant-numeric:tabular-nums; position:relative; user-select:none}
.sheet td.rn .x{position:absolute; inset:0; display:none; align-items:center;
  justify-content:center; color:var(--red); font-size:13px; cursor:pointer; background:var(--fill)}
.sheet tr:hover td.rn .x{display:flex}
.sheet tr.ghost td{background:color-mix(in srgb,var(--fill) 55%,var(--raised))}
.sheet tr.ghost td.rn{color:var(--accent); font-size:14px}
.sheet tr.ghost td.cell .v{color:var(--text-3)}
.sheet .dn{color:var(--text-3); font-size:11px; margin-left:5px}
/* 눌러도 상자가 스스로 바뀌지 않게 한다. 칸이 눌린 것으로 받아 값을 뒤집는다. */
.sheet .shchk{width:15px; height:15px; padding:0; margin:0; border-radius:4px;
  accent-color:var(--accent); pointer-events:none; vertical-align:middle}

.sheet .shbarwrap{display:flex; align-items:center; gap:6px; padding:0 9px}
.sheet .shtrack{display:block; flex:1; height:4px; border-radius:2px; background:var(--sep-soft);
  overflow:hidden}
.sheet .shfill{display:block; height:100%; background:var(--accent); border-radius:2px}
.sheet .shnum{font-size:11.5px; color:var(--text-2); font-variant-numeric:tabular-nums;
  min-width:32px; text-align:right}

/* 고치는 칸은 표 위에 띄운다. 칸(td)은 넘치는 것을 자르므로 안에 두면 잘린다. */
.ed{position:absolute; box-sizing:border-box;
  border:2px solid var(--accent); border-radius:3px; background:var(--raised); color:var(--text);
  font:inherit; letter-spacing:inherit; padding:0 7px; margin:0; outline:0; z-index:55;
  box-shadow:0 6px 22px rgba(0,0,0,.16); resize:none}
textarea.ed{padding:6px 7px; line-height:1.5; white-space:pre-wrap; overflow:auto}
select.ed{padding:0 4px}
.edhint{position:absolute; z-index:56; font-size:12px}
.edhint a{cursor:pointer}

.combo{position:absolute; z-index:60; background:var(--raised); border:1px solid var(--sep);
  border-radius:9px; box-shadow:0 8px 26px rgba(0,0,0,.18); max-height:250px; overflow-y:auto;
  min-width:260px; padding:5px; display:none}
.combo.on{display:block}
.combo .grp{font-size:11px; color:var(--text-3); font-weight:600; padding:6px 9px 3px;
  letter-spacing:.03em}
.combo .op{padding:6px 9px; border-radius:7px; cursor:pointer; font-size:13.5px;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.combo .op.on{background:var(--accent); color:#fff}
.combo .op .s{color:var(--text-3); font-size:11.5px; margin-left:7px}
.combo .op.on .s{color:rgba(255,255,255,.75)}
.combo .free{border-top:1px solid var(--sep-soft); margin-top:4px; padding:7px 9px 3px;
  color:var(--text-2); font-size:12.5px}

.shhelp{margin:18px 0 0; font-size:13px; color:var(--text-2)}
.shhelp summary{cursor:pointer; color:var(--accent); width:max-content}
.shhelp ul{margin:10px 0 0; padding:14px 18px; list-style:none; border:1px solid var(--sep-soft);
  border-radius:11px; background:var(--fill); display:grid; gap:7px 22px;
  grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
.shhelp li{margin:0}
.shhelp kbd{font-family:ui-monospace,'SF Mono',Menlo,monospace; font-size:11.5px;
  background:var(--raised); border:1px solid var(--sep); border-bottom-width:2px;
  border-radius:5px; padding:1px 6px; color:var(--text); white-space:nowrap; margin-right:3px}
`

/* ── 화면에서 도는 스크립트 ────────────────────────────── */

export const SHEET_JS = `<script>
(function () {
'use strict'
var el = document.getElementById('sheet-data')
if (!el) return
var D = JSON.parse(el.textContent)

/* 열 정의. 서버는 이름만 보내고 생김새는 여기서 정한다. */
var COLS = {
  task:    {k:'title',     l:'단위업무명', w:250, t:'task'},
  wtitle:  {k:'title',     l:'업무명',     w:250, t:'task'},
  type:    {k:'work_type', l:'업무 유형',  w:152, t:'pick'},
  status:  {k:'status',    l:'진행 상태',  w:88,  t:'pill', o:D.statuses, a:'c'},
  statusw: {k:'status',    l:'진행 상태',  w:88,  t:'pill', o:D.statusesW, a:'c'},
  prio:    {k:'priority',  l:'우선순위',   w:84,  t:'pill', o:D.priorities, a:'c'},
  pct:     {k:'progress',  l:'진행률',     w:98,  t:'pct',  a:'c'},
  due:     {k:'deadline',  l:'마감 시한',  w:128, t:'date', a:'c'},
  duew:    {k:'due_date',  l:'종결 예정일',w:128, t:'date', a:'c'},
  detail:  {k:'detail_text', l:'세부내용 (줄바꿈 = 글머리 하나)', w:320, t:'multi'},
  misc:    {k:'is_misc',   l:'기타',       w:54,  t:'check', a:'c'},
  output:  {k:'output',    l:'산출물',     w:160, t:'text'},
  note:    {k:'note',      l:'비고',       w:190, t:'text'}
}

var TINT = {예정:'--gray', 시작:'--purple', 진행:'--accent', 완료:'--green', 보류:'--orange',
  종결:'--green', 높음:'--red', 중간:'--orange', 낮음:'--gray'}

var G = {}   // id -> {id, api, kind, cols, rows, move}
D.grids.forEach(function (g) {
  g.cols = g.cols.map(function (n) { return COLS[n] })
  G[g.id] = g
})

function esc (s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
/** 글자를 받는 칸인가. 표 바깥의 칸에 친 글자를 표가 가로채면 안 된다. */
function isField (n) {
  return !!n && !!n.tagName && /^(INPUT|SELECT|TEXTAREA)$/.test(n.tagName)
}
function toast (m) {
  var t = document.getElementById('toast'); if (!t) return
  t.className = 'toast ok'; t.textContent = ''
  var ic = document.createElement('span'); ic.className = 'ic'; ic.textContent = '\u2713'
  var tx = document.createElement('span'); tx.textContent = m
  t.append(ic, tx); t.hidden = false
  requestAnimationFrame(function () { t.classList.add('show') })
  clearTimeout(toast._t)
  toast._t = setTimeout(function () {
    t.classList.remove('show')
    setTimeout(function () { t.hidden = true }, 250)
  }, 2600)
}

/* ── 값 그리기 ─────────────────────────────────────────── */

function pill (v) {
  var c = TINT[v] || '--gray'
  return '<span class="pill" style="background:color-mix(in srgb,var(' + c +
    ') 15%,transparent);color:var(' + c + ')">' + esc(v) + '</span>'
}
function dday (v) {
  if (!v) return null
  var a = new Date(v + 'T00:00:00Z'), b = new Date(D.today + 'T00:00:00Z')
  if (isNaN(a)) return null
  return Math.round((a - b) / 86400000)
}
function fmtDate (v) {
  var p = String(v).split('-')
  if (p.length !== 3) return v
  var d = dday(v)
  return (+p[1]) + '월 ' + (+p[2]) + '일' +
    (d === null ? '' : '<span class="dn">D' + (d < 0 ? '+' + -d : '-' + d) + '</span>')
}

function cellHTML (col, row) {
  var v = row[col.k]
  if (col.t === 'pill') return '<span class="v">' + (v ? pill(v) : '<span class="ph">—</span>') + '</span>'
  if (col.t === 'check') return '<span class="v"><input type="checkbox" class="shchk"' +
    (v ? ' checked' : '') + ' tabindex="-1" aria-label="' + esc(col.l) + '"></span>'
  if (col.t === 'pct') {
    if (v === '' || v === null || v === undefined) return '<span class="v ph">—</span>'
    return '<span class="shbarwrap"><span class="shtrack"><span class="shfill" style="width:' +
      Math.max(0, Math.min(100, +v)) + '%"></span></span><span class="shnum">' + (+v) +
      '%</span></span>'
  }
  if (col.t === 'date') return '<span class="v' + (v ? '' : ' ph') + '">' +
    (v ? fmtDate(v) : '—') + '</span>'
  if (col.t === 'multi') {
    if (!v) return '<span class="v"></span>'
    var ls = String(v).split('\\n').filter(function (x) { return x.trim() })
    return '<span class="v">' + esc(ls[0]) +
      (ls.length > 1 ? ' <span class="ph">+' + (ls.length - 1) + '줄</span>' : '') + '</span>'
  }
  return '<span class="v' + (v ? '' : ' ph') + '">' + (v ? esc(v) : '—') + '</span>'
}

function draw (id) {
  var g = G[id], h = '<table><colgroup><col style="width:38px">'
  g.cols.forEach(function (c) { h += '<col style="width:' + c.w + 'px">' })
  h += '</colgroup><thead><tr><th></th>'
  g.cols.forEach(function (c) {
    h += '<th' + (c.a === 'c' ? ' class="c"' : '') + ' title="' + esc(c.l) + '">' + esc(c.l) + '</th>'
  })
  h += '</tr></thead><tbody>'
  for (var r = 0; r <= g.rows.length; r++) {
    var last = r === g.rows.length, row = last ? {} : g.rows[r]
    h += '<tr' + (last ? ' class="ghost"' : '') + ' data-r="' + r + '"><td class="rn">' +
      (last ? '+' : (r + 1)) + (last ? '' : '<span class="x" title="이 줄 지우기">✕</span>') + '</td>'
    g.cols.forEach(function (c, ci) {
      h += '<td class="cell' + (c.a === 'c' ? ' c' : '') + '" data-c="' + ci + '">' +
        (last
          ? '<span class="v ph">' + (c.t === 'task' ? '여기에 입력하면 줄이 생깁니다' : '') + '</span>'
          : cellHTML(c, row)) + '</td>'
    })
    h += '</tr>'
  }
  document.getElementById('sh-' + id).innerHTML = h + '</tbody></table>'
  var n = document.querySelector('[data-count="' + id + '"]')
  if (n) n.textContent = g.rows.length + '건'
  fillPicker(id)
}
function drawAll () { Object.keys(G).forEach(draw); paint() }

/* ── 업무를 넣는 카드 ──────────────────────────────────── */

/** 고르는 칸을 다시 채운다. 표에 이미 들어간 업무는 뺀다. */
function fillPicker (id) {
  var box = document.querySelector('[data-add="' + id + '"]')
  if (!box) return
  var g = G[id], sel = box.querySelector('[data-pick]'), q = box.querySelector('[data-pq]')
  var pool = tasksFor(g, null)
  var keep = sel.value
  var text = q && !q.hidden ? q.value.trim().toLowerCase() : ''
  var h = '<option value="">업무 목록에서 선택</option>', last = null, open = false
  pool.forEach(function (t) {
    if (text && t.title.toLowerCase().indexOf(text) < 0 &&
        (t.series || '').toLowerCase().indexOf(text) < 0) return
    var s = t.series || ''
    if (s !== last) {
      if (open) h += '</optgroup>'
      last = s; open = !!s
      if (open) h += '<optgroup label="' + esc(s) + '">'
    }
    h += '<option value="' + esc(t.id) + '">' + esc(t.title) + '</option>'
  })
  if (open) h += '</optgroup>'
  sel.innerHTML = h
  sel.value = keep
  // 걸러 낸 첫 후보를 바로 고른다. 한 번 더 누르지 않아도 되게.
  if (!sel.value && text && sel.options.length > 1) sel.selectedIndex = 1
  if (q) q.hidden = pool.length <= 8
  sel.disabled = !pool.length
  box.querySelector('[data-addpick]').disabled = !pool.length
}

/** [저장] — 고치던 칸을 매듭짓고 그 표의 줄을 모두 다시 보낸다. */
function saveAll (id) {
  var g = G[id]
  if (edit && edit.id === id) commit()
  if (!g.rows.length) { mark(id, '', '저장됨'); return }
  g.rows.forEach(function (row) { row._v = (row._v || 0) + 1; save(id, row) })
}

/** 카드에서 넣은 업무를 표 맨 아래에 한 줄로 꽂는다. */
function addRow (id, seed) {
  var g = G[id]
  var row = blank(g)
  row.title = seed.title
  row.task_id = seed.task_id || null
  g.cols.forEach(function (c) { if (c.t === 'pick') row[c.k] = seed.work_type || '' })
  g.rows.push(row)
  draw(id)
  save(id, row)
  // 넣자마자 이어서 적을 수 있게, 손이 갈 칸으로 옮겨 준다.
  var c = 0
  g.cols.forEach(function (cc, i) { if (!c && cc.t === 'multi') c = i })
  if (!c) g.cols.forEach(function (cc, i) { if (!c && cc.t === 'task') c = i + 1 })
  select(id, g.rows.length - 1, Math.min(c, g.cols.length - 1))
}

document.addEventListener('click', function (ev) {
  var sv = ev.target.closest('[data-save-now]')
  if (sv) { saveAll(sv.getAttribute('data-save-now')); return }
  var b = ev.target.closest('[data-addpick],[data-addfree]')
  if (!b || b.disabled) return
  var box = b.closest('[data-add]'), id = box.getAttribute('data-add')
  if (b.hasAttribute('data-addpick')) {
    var s = box.querySelector('[data-pick]')
    if (!s.value) { toast('업무를 고르지 않았습니다.'); s.focus(); return }
    var t = null
    D.tasks.forEach(function (x) { if (x.id === s.value) t = x })
    if (t) addRow(id, {title: t.title, task_id: t.id, work_type: t.work_type})
  } else {
    var f = box.querySelector('[data-free]'), title = f.value.trim()
    if (!title) { toast('업무명을 입력하세요.'); f.focus(); return }
    addRow(id, {title: title, task_id: null, work_type: ''})
    f.value = ''
  }
})
document.addEventListener('input', function (ev) {
  var q = ev.target
  if (q.hasAttribute && q.hasAttribute('data-pq')) fillPicker(q.closest('[data-add]').getAttribute('data-add'))
})
document.addEventListener('keydown', function (ev) {
  if (ev.key !== 'Enter') return
  var t = ev.target
  if (t.hasAttribute && t.hasAttribute('data-free')) {
    ev.preventDefault(); t.closest('[data-add]').querySelector('[data-addfree]').click()
  } else if (t.hasAttribute && (t.hasAttribute('data-pick') || t.hasAttribute('data-pq'))) {
    ev.preventDefault(); t.closest('[data-add]').querySelector('[data-addpick]').click()
  }
})

/* ── 고를 수 있는 값 ───────────────────────────────────── */

/** 단위업무 목록. 일일 화면에서는 그 날 이미 넣은 업무를 빼고 보여 준다. */
function tasksFor (g, row) {
  if (!g.oncePerDay) return D.tasks
  var used = {}
  g.rows.forEach(function (x) { if (x !== row && x.task_id) used[x.task_id] = 1 })
  return D.tasks.filter(function (t) { return !used[t.id] })
}
/** 업무 유형은 시리즈를 따라간다. 딸린 업무가 없으면 시리즈 없는 유형만 고른다. */
function typesFor (row) {
  var s = null
  if (row.task_id) {
    D.tasks.forEach(function (t) { if (t.id === row.task_id) s = t.series || '' })
  }
  return D.types
    .filter(function (t) { return s === null ? true : (!t.series || t.series === s) })
    .map(function (t) { return t.name })
}
function optsFor (g, col, row) {
  if (col.t === 'pick') return typesFor(row)
  return col.o || []
}

/* ── 저장 ──────────────────────────────────────────────── */

var chain = Promise.resolve()
function mark (id, cls, txt) {
  var b = document.querySelector('[data-save="' + id + '"]'); if (!b) return
  b.className = 'shsave' + (cls ? ' ' + cls : '')
  b.querySelector('.txt').textContent = txt
  // [다시 저장]은 못 보낸 것이 있을 때만 내놓는다. 평소에는 누를 일이 없다.
  var r = document.querySelector('[data-save-now="' + id + '"]')
  if (r) r.hidden = cls !== 'bad'
}
function save (id, row) {
  var g = G[id]
  // 이름 없는 새 줄은 아직 보내지 않는다. 서버는 이름 없는 줄을 만들 수 없다.
  if (!row.id && !String(row.title || '').trim()) {
    mark(id, 'busy', '업무명을 입력하면 저장합니다')
    return
  }
  // 한 줄에 대한 요청은 겹치지 않게 한다. 아직 id가 없는 줄에 두 번 보내면
  // 두 번째 요청도 '새 줄'로 읽혀 같은 줄이 두 개 생긴다. (엑셀에서 여러 칸을
  // 한꺼번에 붙여넣으면 실제로 이렇게 된다.)
  if (row._busy) { row._again = true; return }
  row._busy = true
  // 보낸 뒤에도 사람이 계속 고친다. 답이 오는 사이에 값이 바뀌었으면 그 답은
  // 이미 낡은 것이므로 덮어쓰면 안 된다. 그래서 판 번호를 붙여 보낸다.
  var sent = row._v || 0, wasNew = !row.id
  mark(id, 'busy', '저장 중…')
  chain = chain.then(function () {
    var body = {date: D.date, kind: g.kind || '', id: row.id || ''}
    g.cols.forEach(function (c) { body[c.k] = row[c.k] === undefined ? '' : row[c.k] })
    body.task_id = row.task_id || ''
    return fetch(g.api + '/row', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body)
    })
  }).then(function (res) {
    if (!res.ok) throw new Error(res.status)
    return res.json()
  }).then(function (out) {
    if (out.row) {
      var fresh = out.row
      if ((row._v || 0) === sent) {
        // 그 사이 손대지 않았다 — 서버가 정한 값(가져온 직전 기록 같은)을 그대로 받는다.
        Object.keys(fresh).forEach(function (k) { row[k] = fresh[k] })
      } else if (wasNew) {
        // 줄을 만드는 사이에 이어서 적었다 — 적은 것을 살리고 빈 칸만 채운다.
        row.id = fresh.id
        Object.keys(fresh).forEach(function (k) {
          if (k === 'id') return
          var v = row[k]
          if (v === '' || v === null || v === undefined || v === false) row[k] = fresh[k]
        })
      } else {
        // 고치는 사이에 답이 왔다 — 화면에 적힌 것이 최신이다. id만 받는다.
        row.id = fresh.id
        row.prev_detail = fresh.prev_detail
      }
      draw(id); paint()
    }
    mark(id, '', '저장됨')
    if (out.note) toast(out.note)
    row._busy = false
    if (row._again) { row._again = false; save(id, row) }
  }).catch(function () {
    row._busy = false; row._again = false
    mark(id, 'bad', '저장하지 못했습니다')
    toast('저장하지 못했습니다. 연결을 확인하고 다시 입력해 주세요.')
  })
}

function del (id, r) {
  var g = G[id], row = g.rows[r]; if (!row) return
  if (!confirm('"' + (row.title || '이 줄') + '" 을(를) 지웁니다. 계속할까요?')) return
  var gone = g.rows.splice(r, 1)[0]
  if (sel && sel.id === id && sel.r >= g.rows.length) sel.r = g.rows.length
  draw(id); paint()
  if (!gone.id) { mark(id, '', '저장됨'); return }   // 아직 서버에 없던 줄
  mark(id, 'busy', '지우는 중…')
  chain = chain.then(function () {
    return fetch(g.api + '/delete', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({id: gone.id})
    })
  }).then(function () { mark(id, '', '저장됨') })
    .catch(function () { mark(id, 'bad', '지우지 못했습니다') })
}

function moveRow (id, r, dir) {
  var g = G[id]; if (!g.move) return
  var to = r + dir
  if (r >= g.rows.length || to < 0 || to >= g.rows.length) return
  var row = g.rows[r]
  if (!row.id || !g.rows[to].id) return
  g.rows[r] = g.rows[to]; g.rows[to] = row
  sel.r = to; draw(id); paint(); mark(id, 'busy', '저장 중…')
  chain = chain.then(function () {
    return fetch(g.api + '/move', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({id: row.id, dir: dir})
    })
  }).then(function () { mark(id, '', '저장됨') })
    .catch(function () { mark(id, 'bad', '저장하지 못했습니다') })
}

/* ── 칸 고르기 ─────────────────────────────────────────── */

var sel = null, edit = null

function td (id, r, c) {
  var box = document.getElementById('sh-' + id)
  var tr = box && box.querySelector('tr[data-r="' + r + '"]')
  return tr && tr.querySelector('td[data-c="' + c + '"]')
}
function paint () {
  document.querySelectorAll('.sheet td.sel').forEach(function (e) { e.classList.remove('sel') })
  document.querySelectorAll('.sheet tr.hot').forEach(function (e) { e.classList.remove('hot') })
  if (!sel) return
  var t = td(sel.id, sel.r, sel.c); if (!t) return
  t.classList.add('sel'); t.parentElement.classList.add('hot')
  t.setAttribute('tabindex', '0')
  if (!edit && document.activeElement !== t) t.focus({preventScroll: true})
}
function select (id, r, c) {
  if (edit) commit()
  var g = G[id]
  r = Math.max(0, Math.min(g.rows.length, r))
  c = Math.max(0, Math.min(g.cols.length - 1, c))
  document.querySelectorAll('.sheet td[tabindex]').forEach(function (e) {
    e.removeAttribute('tabindex')
  })
  sel = {id: id, r: r, c: c}; paint()
}
function move (dr, dc) {
  if (!sel) return
  var g = G[sel.id], r = sel.r + dr, c = sel.c + dc
  if (c < 0) { c = g.cols.length - 1; r-- }
  if (c > g.cols.length - 1) { c = 0; r++ }
  if (r < 0) { r = 0; c = sel.c }
  if (r > g.rows.length) r = g.rows.length
  select(sel.id, r, c)
}

/* ── 값 넣기 ───────────────────────────────────────────── */

function blank (g) {
  var o = {id: '', task_id: null}
  g.cols.forEach(function (c) { o[c.k] = c.t === 'check' ? false : '' })
  return o
}
function put (id, r, c, val) {
  var g = G[id], col = g.cols[c]
  var isNew = r >= g.rows.length
  if (isNew) g.rows.push(blank(g))
  var row = g.rows[r]
  var was = row[col.k]

  if (col.t === 'pct') {
    var n = String(val).replace(/[^0-9]/g, '')
    row[col.k] = n === '' ? '' : Math.max(0, Math.min(100, +n))
  } else if (col.t === 'check') {
    row[col.k] = !!val
  } else {
    row[col.k] = val
  }

  // 단위업무명 칸은 목록에 있는 이름이면 그 업무에 붙이고, 아니면 직접 입력이 된다.
  // 다만 이름이 그대로면 손대지 않는다 — 보관함으로 옮긴 업무는 목록에 없지만
  // 지난 기록은 그 업무에 붙어 있어야 한다.
  if (col.t === 'task' && String(val) !== String(was == null ? '' : was)) {
    var hit = null
    D.tasks.forEach(function (t) { if (t.title === val) hit = t })
    row.task_id = hit ? hit.id : null
    if (hit) {
      g.cols.forEach(function (cc) {
        if (cc.t === 'pick' && !row[cc.k]) row[cc.k] = hit.work_type || ''
      })
    } else {
      // 시리즈가 사라졌으면 그 시리즈에 매인 유형도 더는 맞지 않는다.
      g.cols.forEach(function (cc) {
        if (cc.t === 'pick' && typesFor(row).indexOf(row[cc.k]) < 0) row[cc.k] = ''
      })
    }
  }
  row._v = (row._v || 0) + 1
  draw(id); paint(); save(id, row)
}

/* ── 고치기 ────────────────────────────────────────────── */

function beginEdit (seed) {
  if (!sel) return
  var g = G[sel.id], col = g.cols[sel.c], t = td(sel.id, sel.r, sel.c); if (!t) return
  var row = sel.r < g.rows.length ? g.rows[sel.r] : blank(g)
  var cur = row[col.k]

  if (col.t === 'check') { put(sel.id, sel.r, sel.c, !cur); return }

  var e, hint = null, wide = 0, tall = 0
  if (col.t === 'pill' || col.t === 'pick') {
    e = document.createElement('select'); e.className = 'ed'
    ;[''].concat(optsFor(g, col, row)).forEach(function (o) {
      var op = document.createElement('option')
      op.value = o; op.textContent = o || '— 선택 안 함 —'
      e.appendChild(op)
    })
    e.value = cur || ''
  } else if (col.t === 'date') {
    e = document.createElement('input'); e.type = 'date'; e.className = 'ed'; e.value = cur || ''
  } else if (col.t === 'multi') {
    e = document.createElement('textarea'); e.className = 'ed'
    wide = 460; tall = 132
    e.value = seed != null ? seed : (cur || '')
    if (row.prev_detail) {
      hint = document.createElement('div')
      hint.className = 'edhint'
      hint.innerHTML = '<a>직전 내용 가져오기</a>'
      hint.querySelector('a').addEventListener('mousedown', function (ev) {
        ev.preventDefault()
        if (e.value.trim() && !confirm('지금 적은 내용을 지우고 직전 내용으로 바꿀까요?')) return
        e.value = row.prev_detail; e.focus()
      })
      document.body.appendChild(hint)
    }
  } else {
    e = document.createElement('input'); e.type = 'text'; e.className = 'ed'
    e.value = seed != null ? seed : (cur || '')
    if (col.t === 'pct') e.inputMode = 'numeric'
    if (col.t === 'task') wide = 340
  }

  document.body.appendChild(e)
  edit = {e: e, hint: hint, cell: t, wide: wide, tall: tall,
          id: sel.id, r: sel.r, c: sel.c, col: col, row: row}
  reposition()
  e.focus()
  if (seed == null && e.select) e.select()
  else if (seed != null && e.setSelectionRange) e.setSelectionRange(e.value.length, e.value.length)

  if (col.t === 'task') openCombo(e, t, tasksFor(g, row))
  if (col.t === 'pill' || col.t === 'pick') {
    e.addEventListener('change', function () { commit(); move(1, 0) })
  }
  e.addEventListener('blur', function () {
    setTimeout(function () { if (edit && edit.e === e) commit() }, 110)
  })
}
/** 고치는 칸을 지금 자리에 맞춰 앉힌다. 표를 밀거나 창이 바뀌면 다시 부른다. */
function reposition () {
  if (!edit) return
  var b = edit.cell.getBoundingClientRect()
  var vw = document.documentElement.clientWidth
  var w = Math.min(Math.max(edit.wide || 0, b.width), vw - 16)
  var left = Math.max(8, Math.min(b.left + window.scrollX, vw - w - 8 + window.scrollX))
  edit.e.style.left = left + 'px'
  edit.e.style.top = (b.top + window.scrollY) + 'px'
  edit.e.style.width = w + 'px'
  edit.e.style.height = (edit.tall || b.height) + 'px'
  if (edit.hint) {
    edit.hint.style.left = left + 'px'
    edit.hint.style.top = (b.top + window.scrollY + (edit.tall || b.height) + 3) + 'px'
  }
}

function tearDown () {
  var e = edit; edit = null; closeCombo()
  if (e.e.parentElement) e.e.parentElement.removeChild(e.e)
  if (e.hint && e.hint.parentElement) e.hint.parentElement.removeChild(e.hint)
  return e
}
function commit () {
  if (!edit) return
  var g = G[edit.id], old = edit.r < g.rows.length ? g.rows[edit.r][edit.col.k] : ''
  var e = tearDown(), v = e.e.value
  if (String(old == null ? '' : old) !== String(v)) put(e.id, e.r, e.c, v)
  else paint()
}
function cancel () { if (edit) { tearDown(); paint() } }

/* ── 업무 목록 ─────────────────────────────────────────── */

var combo = document.createElement('div')
combo.className = 'combo'
document.body.appendChild(combo)
var cList = [], cSel = 0

function openCombo (input, cell, pool) {
  function render () {
    var q = input.value.trim().toLowerCase()
    cList = pool.filter(function (t) {
      return !q || t.title.toLowerCase().indexOf(q) >= 0 ||
        (t.series || '').toLowerCase().indexOf(q) >= 0
    })
    if (cSel >= cList.length) cSel = 0
    var h = '', last = null
    cList.forEach(function (t, i) {
      var s = t.series || '시리즈 없음'
      if (s !== last) { h += '<div class="grp">' + esc(s) + '</div>'; last = s }
      h += '<div class="op' + (i === cSel ? ' on' : '') + '" data-i="' + i + '">' + esc(t.title) +
        (t.work_type ? '<span class="s">' + esc(t.work_type) + '</span>' : '') + '</div>'
    })
    if (!cList.length) h += '<div class="grp">맞는 업무가 없습니다</div>'
    h += '<div class="free">적은 대로 두면 직접 입력한 항목이 됩니다</div>'
    combo.innerHTML = h
    var b = cell.getBoundingClientRect()
    combo.style.left = (b.left + window.scrollX) + 'px'
    combo.style.top = (b.bottom + window.scrollY + 3) + 'px'
    combo.classList.add('on')
  }
  input._render = render
  cSel = 0; render()
  input.addEventListener('input', function () { cSel = 0; render() })
}
function closeCombo () { combo.classList.remove('on'); cList = []; cSel = 0 }
combo.addEventListener('mousedown', function (ev) {
  var op = ev.target.closest('.op'); if (!op || !edit) return
  ev.preventDefault()
  edit.e.value = cList[+op.getAttribute('data-i')].title
  commit(); move(0, 1)
})

/* ── 키 ────────────────────────────────────────────────── */

document.addEventListener('keydown', function (ev) {
  var meta = ev.metaKey || ev.ctrlKey
  var open = combo.classList.contains('on') && cList.length

  if (edit) {
    if (ev.key === 'Escape') { ev.preventDefault(); if (open) closeCombo(); else cancel(); return }
    if (open && (ev.key === 'ArrowDown' || ev.key === 'ArrowUp')) {
      ev.preventDefault()
      cSel = (cSel + (ev.key === 'ArrowDown' ? 1 : cList.length - 1)) % cList.length
      edit.e._render(); return
    }
    if (ev.key === 'Enter') {
      if (edit.col.t === 'multi' && !meta) return   // 세부내용은 Enter가 줄바꿈이다
      ev.preventDefault()
      if (open) edit.e.value = cList[cSel].title
      commit(); move(1, 0); return
    }
    if (ev.key === 'Tab') {
      ev.preventDefault()
      if (open) edit.e.value = cList[cSel].title
      commit(); move(0, ev.shiftKey ? -1 : 1); return
    }
    return
  }

  if (!sel || meta) return
  // 카드의 고르는 칸·직접 입력 칸에서 친 글자는 그 칸의 것이다. 표로 넘기지 않는다.
  if (isField(ev.target)) return

  if (ev.altKey && (ev.key === 'ArrowUp' || ev.key === 'ArrowDown')) {
    ev.preventDefault(); moveRow(sel.id, sel.r, ev.key === 'ArrowUp' ? -1 : 1); return
  }
  if (ev.altKey) return

  switch (ev.key) {
    case 'ArrowDown': ev.preventDefault(); move(1, 0); return
    case 'ArrowUp': ev.preventDefault(); move(-1, 0); return
    case 'ArrowLeft': ev.preventDefault(); move(0, -1); return
    case 'ArrowRight': ev.preventDefault(); move(0, 1); return
    case 'Tab': ev.preventDefault(); move(0, ev.shiftKey ? -1 : 1); return
    case 'Enter': case 'F2': ev.preventDefault(); beginEdit(null); return
    case 'Delete': case 'Backspace':
      ev.preventDefault()
      if (sel.r < G[sel.id].rows.length) {
        put(sel.id, sel.r, sel.c, G[sel.id].cols[sel.c].t === 'check' ? false : '')
      }
      return
    case ' ':
      if (G[sel.id].cols[sel.c].t === 'check') { ev.preventDefault(); beginEdit(null) }
      return
    case 'Escape': return
  }
  if (ev.key.length === 1) {
    var t = G[sel.id].cols[sel.c].t
    ev.preventDefault()
    beginEdit(t === 'pill' || t === 'pick' || t === 'date' ? null : ev.key)
  }
})

/* 엑셀에서 그대로 붙여넣기 */
document.addEventListener('paste', function (ev) {
  if (!sel || edit || isField(ev.target)) return
  var txt = (ev.clipboardData || window.clipboardData).getData('text')
  if (!txt) return
  ev.preventDefault()
  var g = G[sel.id]
  var lines = txt.replace(/\\r/g, '').replace(/\\n$/, '').split('\\n')
  lines.forEach(function (line, ri) {
    line.split('\\t').forEach(function (v, ci) {
      var c = sel.c + ci
      if (c < g.cols.length) put(sel.id, sel.r + ri, c, v.trim())
    })
  })
  toast(lines.length + '줄을 붙여넣었습니다')
})

/* ── 마우스 ────────────────────────────────────────────── */

document.addEventListener('mousedown', function (ev) {
  if (edit && (edit.e.contains(ev.target) ||
      (edit.hint && edit.hint.contains(ev.target)) || combo.contains(ev.target))) return
  var x = ev.target.closest('.sheet td.rn .x')
  if (x) {
    ev.preventDefault()
    del(x.closest('.sheet').id.slice(3), +x.closest('tr').getAttribute('data-r'))
    return
  }
  var cell = ev.target.closest('.sheet td.cell')
  if (!cell) { if (edit) commit(); return }

  var id = cell.closest('.sheet').id.slice(3)
  var r = +cell.closest('tr').getAttribute('data-r'), c = +cell.getAttribute('data-c')
  var same = sel && sel.id === id && sel.r === r && sel.c === c && !edit
  ev.preventDefault()
  select(id, r, c)
  var t = G[id].cols[c].t
  // 목록에서 고르는 칸은 한 번만 눌러도 열린다. 두 번 누를 이유가 없다.
  if (same || t === 'pill' || t === 'pick' || t === 'check' || t === 'task') beginEdit(null)
})
document.addEventListener('dblclick', function (ev) {
  if (ev.target.closest('.sheet td.cell') && !edit) beginEdit(null)
})
window.addEventListener('resize', function () { closeCombo(); reposition() })
window.addEventListener('scroll', reposition, true)

drawAll()
})()
<\/script>`
