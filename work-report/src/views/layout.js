// 화면 공통 껍데기와 작은 조각들. 서버에서 HTML을 그려 보낸다.

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const NAV = [
  ['/', '데일리 브리프'],
  ['/tasks', '단위업무'],
  ['/daily', '일일업무'],
  ['/weekly', '주간업무'],
  ['/series', '개발현황'],
  ['/reports', '보고서'],
]


/**
 * 브라우저 탭·즐겨찾기 아이콘. 글줄이 담긴 문서 모양.
 * 16px로 줄어들면 안쪽 글줄은 뭉개지고 문서 실루엣만 남는다 — 그 상태에서도
 * 알아볼 수 있도록 여백과 모서리를 넉넉히 잡았다.
 */
const ICON_COLOR = '#c0392b'
export const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
<rect width="32" height="32" rx="7" fill="${ICON_COLOR}"/>
<path d="M8 6.5a2 2 0 0 1 2-2h8.5L24 10v15.5a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2z" fill="#ffffff"/>
<path d="M18.5 4.5 24 10h-4a1.5 1.5 0 0 1-1.5-1.5z" fill="${ICON_COLOR}" opacity=".3"/>
<rect x="11.3" y="13" width="9.4" height="2" rx="1" fill="${ICON_COLOR}" opacity=".6"/>
<rect x="11.3" y="17.2" width="9.4" height="2" rx="1" fill="${ICON_COLOR}" opacity=".6"/>
<rect x="11.3" y="21.4" width="5.6" height="2" rx="1" fill="${ICON_COLOR}" opacity=".6"/>
</svg>`

const HEAD_ICON = '<link rel="icon" href="/favicon.svg" type="image/svg+xml">'

const CSS = `
/* 애플 스타일 — 흰 바탕, 머리카락 굵기 구분선, SF 서체, 시스템 색 */
:root{
  --bg:#ffffff; --raised:#ffffff; --fill:#f5f5f7; --sep:#d2d2d7; --sep-soft:#e8e8ed;
  --text:#1d1d1f; --text-2:#6e6e73; --text-3:#86868b;
  --accent:#007aff; --accent-soft:#e8f2ff;
  --green:#34c759; --orange:#ff9500; --red:#ff3b30; --purple:#af52de; --gray:#8e8e93;
  --r:12px;
}
@media (prefers-color-scheme:dark){:root{
  --bg:#000000; --raised:#1c1c1e; --fill:#2c2c2e; --sep:#38383a; --sep-soft:#2c2c2e;
  --text:#f5f5f7; --text-2:#aeaeb2; --text-3:#8e8e93;
  --accent:#0a84ff; --accent-soft:#0a2540;
  --green:#30d158; --orange:#ff9f0a; --red:#ff453a; --purple:#bf5af2; --gray:#8e8e93;
}}

*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{
  margin:0; background:var(--bg); color:var(--text);
  font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Apple SD Gothic Neo',
    'Helvetica Neue','Malgun Gothic',sans-serif;
  font-size:15px; line-height:1.55; letter-spacing:-.01em;
  -webkit-font-smoothing:antialiased;
}
.mono{font-family:ui-monospace,'SF Mono',Menlo,monospace; font-variant-numeric:tabular-nums;
  letter-spacing:0}
a{color:var(--accent); text-decoration:none}
a:hover{text-decoration:underline}

input,select,textarea,button{font:inherit; letter-spacing:inherit}
input,select,textarea{
  padding:8px 11px; border:1px solid var(--sep); border-radius:9px;
  background:var(--raised); color:var(--text); width:100%; transition:border-color .12s,box-shadow .12s;
}
input:focus,select:focus,textarea:focus{
  outline:0; border-color:var(--accent); box-shadow:0 0 0 3.5px color-mix(in srgb,var(--accent) 22%,transparent);
}
textarea{min-height:82px; resize:vertical; line-height:1.65}
select{appearance:none; padding-right:30px;
  background-image:linear-gradient(45deg,transparent 50%,var(--text-3) 50%),
                   linear-gradient(135deg,var(--text-3) 50%,transparent 50%);
  background-position:calc(100% - 15px) 52%, calc(100% - 10px) 52%;
  background-size:5px 5px,5px 5px; background-repeat:no-repeat}

.container{max-width:940px; margin:0 auto; padding:26px 22px 90px}
.narrow{max-width:660px}

/* 내비게이션 */
nav.top{background:var(--bg); border-bottom:1px solid var(--sep-soft);
  position:sticky; top:0; z-index:20}
nav.top .inner{max-width:940px; margin:0 auto; padding:0 22px;
  display:flex; align-items:center; gap:2px; flex-wrap:wrap; min-height:52px}
.brand{font-size:16px; font-weight:600; letter-spacing:-.02em; margin-right:22px; white-space:nowrap}
nav.top a{color:var(--text-2); padding:7px 11px; border-radius:8px; font-size:14px}
nav.top a:hover{color:var(--text); background:var(--fill); text-decoration:none}
nav.top a.on{color:var(--text); font-weight:600}
nav.top .right{margin-left:auto}

/* 화면 머리 */
.head{display:flex; align-items:flex-end; justify-content:space-between;
  gap:16px; flex-wrap:wrap; margin:30px 0 22px}
.head h1{font-size:28px; font-weight:600; letter-spacing:-.028em; margin:0; line-height:1.2}
.head p{margin:5px 0 0; font-size:14px; color:var(--text-3)}

/* 묶음 */
.card{background:var(--raised); border:1px solid var(--sep-soft); border-radius:var(--r);
  padding:18px 20px; margin-bottom:16px}
.chead{display:flex; align-items:center; justify-content:space-between;
  gap:12px; flex-wrap:wrap; margin-bottom:14px}
.chead h2{margin:0; font-size:17px; font-weight:700; letter-spacing:-.02em}
.count{font-size:13px; color:var(--text-3)}
.chead h2 .count{font-weight:400; letter-spacing:0; margin-left:8px}

.row{display:flex; gap:8px; align-items:center; flex-wrap:wrap}
/* 라벨이 위에 붙은 칸과 버튼을 한 줄에 둘 때는 아래를 맞춰야 나란히 보인다. */
.row.bottom{align-items:flex-end; gap:12px}
.chk{display:flex; align-items:center; gap:8px; font-size:13px;
  white-space:nowrap; padding-bottom:9px}
.chk input{width:auto; flex:none}
/* 제목 줄에 얹는 체크는 밑을 맞출 라벨이 없다. */
.chk.flat{padding-bottom:0; margin-right:2px}
.row>*{flex:0 0 auto}
.grow{flex:1 1 200px}
/* 업무 유형 이름 칸. 화면 폭을 다 쓰면 버튼이 멀어져 읽기 나쁘다. */
.wtname{flex:0 1 320px; max-width:320px}
/* 새로 추가하는 자리는 위의 목록과 눈에 띄게 갈라 놓는다. */
.addrow{margin-top:20px; padding-top:16px; border-top:1px solid var(--sep)}
.addrow .lbl{display:block; font-size:12px; color:var(--text-3); margin-bottom:8px}
.spacer{flex:1 1 auto}

.grid{display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
  gap:12px; margin-bottom:14px}
/* 업무 추가/수정 폼 — 고르는 칸 여섯 개를 한 줄에 놓는다. 글이 긴 시리즈·업무
   유형에 자리를 더 주고, 상태·우선순위·진행률은 좁혀 잡는다. 화면이 좁아지면
   보통 격자로 돌아가 접힌다. */
.grid.one-line{grid-template-columns:1.6fr 2fr .92fr .92fr .72fr 1.6fr}
@media (max-width:840px){
  .grid.one-line{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}
}

.fld{display:flex; flex-direction:column; gap:5px}
.fld label{font-size:12px; color:var(--text-3); letter-spacing:0;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis}

/* 버튼 */
.btn{padding:8px 16px; border:0; border-radius:9px; background:var(--accent); color:#fff;
  font-size:14px; font-weight:500; cursor:pointer; width:auto; display:inline-block;
  text-decoration:none; white-space:nowrap; transition:opacity .12s}
.btn:hover{opacity:.86; text-decoration:none; color:#fff}
.btn.ghost{background:var(--fill); color:var(--accent)}
.btn.ghost:hover{color:var(--accent)}
.btn.alt{background:var(--purple)}
.btn.danger{background:transparent; color:var(--red); padding-left:10px; padding-right:10px}
.btn.danger:hover{background:color-mix(in srgb,var(--red) 12%,transparent)}
.btn.sm{padding:5px 11px; font-size:13px}
/* 글자만 있는 버튼. [수정]처럼 옆의 [삭제]와 짝을 이룰 때 쓴다. */
.btn.plain{background:transparent; color:var(--accent); padding-left:10px; padding-right:10px}
.btn.plain:hover{background:color-mix(in srgb,var(--accent) 11%,transparent)}
.btn[disabled]{opacity:.38; cursor:default}
.btn:focus-visible{outline:3px solid color-mix(in srgb,var(--accent) 45%,transparent); outline-offset:2px}

/* 줄 목록 */
.item{display:flex; gap:9px; align-items:center; flex-wrap:wrap;
  padding:12px 0; border-top:1px solid var(--sep-soft)}
.item:first-child{border-top:0; padding-top:2px}
.item .t{font-weight:500; flex:1 1 200px; min-width:0}

/* 업무 목록 — 딱지 너비가 제각각이라 줄마다 어긋나 보인다. 칸을 정해 세로로 맞춘다.
   딱지는 칸을 꽉 채우고 글자를 가운데 놓아, 줄이 바뀌어도 자리가 흔들리지 않는다. */
.item.cols{display:grid; align-items:center;
  grid-template-columns:minmax(0,1fr) 128px 44px 44px 78px 76px auto}
.item.cols .t{flex:none; min-width:0; word-break:keep-all}
.item.cols .c{min-width:0; display:block}
.item.cols .c>.tag,.item.cols .c>.pill{display:block; text-align:center;
  overflow:hidden; text-overflow:ellipsis; padding-left:4px; padding-right:4px}
.item.cols .acts{display:flex; gap:8px; align-items:center; justify-content:flex-end}
@media (max-width:840px){
  .item.cols{display:flex}
  .item.cols .c{display:contents}
  .item.cols .acts{margin-left:auto}
}

.pill{font-size:12px; font-weight:500; padding:2px 9px; border-radius:20px;
  color:#fff; white-space:nowrap; letter-spacing:0}
.tag{font-size:12px; padding:2px 9px; border-radius:20px; background:var(--fill);
  color:var(--text-2); white-space:nowrap; letter-spacing:0}
.dday{font-size:13px; font-weight:600; letter-spacing:0}

/* 알림 */
/* 저장·삭제 같은 처리가 끝나면 위쪽 가운데에 잠깐 떠오르는 알림 상자 */
.toast{
  position:fixed; left:50%; top:67px; transform:translate(-50%,-14px);
  display:flex; align-items:center; gap:10px; z-index:60;
  max-width:min(540px,calc(100vw - 32px)); padding:12px 18px;
  border-radius:14px; font-size:14px; font-weight:500; line-height:1.45;
  color:var(--text); background:color-mix(in srgb,var(--raised) 84%,transparent);
  -webkit-backdrop-filter:saturate(180%) blur(20px); backdrop-filter:saturate(180%) blur(20px);
  box-shadow:0 12px 36px rgba(0,0,0,.18), 0 0 0 .5px color-mix(in srgb,var(--sep) 70%,transparent);
  opacity:0; transition:opacity .22s ease, transform .22s ease; cursor:default;
}
.toast.show{opacity:1; transform:translate(-50%,0)}
.toast[hidden]{display:none}
.toast .ic{
  flex:none; width:20px; height:20px; border-radius:50%; background:var(--green);
  color:#fff; font-size:12px; font-weight:700; line-height:1;
  display:flex; align-items:center; justify-content:center;
}
.toast.warn .ic{background:var(--orange)}
.toast.err .ic{background:var(--red)}
@media (prefers-reduced-motion:reduce){.toast{transition:none}}

.note{padding:11px 15px; border-radius:10px; margin-bottom:16px; font-size:14px;
  background:var(--fill); color:var(--text-2)}
.note.warn{background:color-mix(in srgb,var(--orange) 14%,var(--bg)); color:var(--text)}
.note.err{background:color-mix(in srgb,var(--red) 12%,var(--bg)); color:var(--text)}
.note b{color:var(--text); font-weight:600}

.empty{text-align:center; color:var(--text-3); font-size:14px; padding:22px 0}

/* 시리즈 막대 */
.bars{display:flex; align-items:flex-end; gap:26px; height:230px; padding:0 6px}
.bar{flex:1; text-align:center; display:flex; flex-direction:column; justify-content:flex-end}
.bar .v{font-size:13px; font-weight:600; margin-bottom:7px; letter-spacing:0}
.bar .stem{width:52%; margin:0 auto; border-radius:8px 8px 0 0}
.bar .n{font-size:13px; color:var(--text-2); margin-top:9px}

/* 모닝브리프 칸 — 숫자 셋과 한 줄 요약 */
.bhead{margin:0 0 12px; font-size:15px; color:var(--text-2); line-height:1.6}
.brow{display:flex; gap:10px; flex-wrap:wrap}
.bnum{flex:1 1 210px; min-width:0; padding:13px 15px; border-radius:10px;
  background:var(--fill); display:flex; flex-direction:column; gap:3px}
.bnum .bl{font-size:12px; color:var(--text-2)}
.bnum .bn{font-size:24px; font-weight:600; letter-spacing:-.02em; line-height:1.15;
  font-variant-numeric:tabular-nums; color:var(--text)}
.bnum ul{margin:6px 0 0; padding:0; list-style:none;
  display:flex; flex-direction:column; gap:5px}
.bnum li{font-size:12.5px; line-height:1.5; color:var(--text-2);
  word-break:keep-all; padding-left:13px; position:relative}
.bnum li::before{content:'·'; position:absolute; left:0; top:-.18em;
  font-size:20px; line-height:1; color:var(--text-3)}
.bnum li.more{color:var(--text-3)}
.bnum li.more::before{content:''}
iframe.brief{width:100%; height:70vh; min-height:420px; border:0;
  background:#fff; display:block; overflow:hidden}
iframe.preview{width:100%; height:640px; border:1px solid var(--sep-soft);
  border-radius:var(--r); background:#fff}

/* 탭 — 애플 세그먼티드 컨트롤 */
.tabs{display:inline-flex; gap:2px; margin-bottom:16px; padding:2px;
  background:var(--fill); border-radius:10px}
.tabs a{padding:6px 15px; border-radius:8px; font-size:14px; font-weight:500; color:var(--text-2)}
.tabs a:hover{text-decoration:none; color:var(--text)}
.tabs a.on{background:var(--raised); color:var(--text);
  box-shadow:0 1px 3px rgba(0,0,0,.09)}

/* 로그인 */
.auth{min-height:100dvh; display:flex; align-items:center; justify-content:center; padding:24px}
.auth-box{width:100%; max-width:320px; text-align:center}
.auth-box h1{font-size:26px; font-weight:600; letter-spacing:-.026em; margin:0 0 6px}
.auth-box p.lead{margin:0 0 26px; color:var(--text-3); font-size:14px}
.auth-box input{text-align:center}

form.inline{display:inline}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
@media (max-width:600px){
  .container{padding:18px 16px 70px}
  .head h1{font-size:24px}
  .bars{gap:14px; height:190px}
}
`

// 처리가 끝나면 주소에 ?msg=... 가 붙어 돌아온다. 그 말을 알림 상자로 띄우고
// 주소에서는 지운다. 새로고침해도 같은 알림이 다시 뜨지 않게 하기 위해서다.
// 글자는 textContent로만 넣는다. 주소에 실려 온 값이라 HTML로 해석하면 안 된다.
const TOAST = `<div id="toast" class="toast" role="status" aria-live="polite" hidden></div>
<script>
(function () {
  var q = new URLSearchParams(location.search)
  var msg = q.get('msg')
  if (!msg) return
  var kind = q.get('t') === 'err' ? 'err' : q.get('t') === 'warn' ? 'warn' : 'ok'
  var box = document.getElementById('toast')
  var ic = document.createElement('span')
  ic.className = 'ic'
  ic.textContent = kind === 'ok' ? '✓' : '!'
  var tx = document.createElement('span')
  tx.textContent = msg
  box.className = 'toast ' + kind
  box.append(ic, tx)
  box.hidden = false
  requestAnimationFrame(function () { box.classList.add('show') })

  var timer
  function hide() {
    clearTimeout(timer)
    box.classList.remove('show')
    setTimeout(function () { box.hidden = true }, 250)
  }
  timer = setTimeout(hide, kind === 'err' ? 6000 : 3000)
  box.addEventListener('click', hide)

  q.delete('msg'); q.delete('t')
  var rest = q.toString()
  history.replaceState(null, '', location.pathname + (rest ? '?' + rest : '') + location.hash)
})()
<\/script>`

export function page({ title, path, body, narrow }) {
  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${HEAD_ICON}
<title>${esc(title)} · 업무관리</title><style>${CSS}</style></head>
<body>
<nav class="top"><div class="inner">
<span class="brand">업무관리</span>
${NAV.map(([h, l]) =>
  `<a href="${h}"${h === path ? ' class="on"' : ''}>${l}</a>`).join('')}
<form method="post" action="/logout" class="right">
  <button class="btn ghost sm">로그아웃</button>
</form>
</div></nav>
<main class="container${narrow ? ' narrow' : ''}">${body}</main>
${TOAST}
</body></html>`
}

export function loginPage(message) {
  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${HEAD_ICON}
<title>로그인 · 업무관리</title><style>${CSS}</style></head>
<body><main class="auth"><div class="auth-box">
<h1>업무관리</h1>
<p class="lead">일일·주간 보고서를 만들고 드라이브에 저장합니다</p>
${message ? `<p class="note err">${esc(message)}</p>` : ''}
<form method="post" action="/login">
  <input type="password" name="password" placeholder="비밀번호" autofocus required>
  <button class="btn" style="width:100%;margin-top:12px">로그인</button>
</form>
</div></main></body></html>`
}

/* 작은 조각들 */

export const pill = (text, color) =>
  text ? `<span class="pill" style="background:${color}">${esc(text)}</span>` : ''

export const tag = (text) => `<span class="tag">${esc(text)}</span>`

export function field(label, name, value, opts = {}) {
  const { type = 'text', options, min, max } = opts
  const v = value === null || value === undefined ? '' : String(value)
  const input = options
    ? `<select name="${name}">${options
        .map((o) => `<option${o === v ? ' selected' : ''}>${esc(o)}</option>`)
        .join('')}</select>`
    : `<input type="${type}" name="${name}" value="${esc(v)}"` +
      `${min !== undefined ? ` min="${min}"` : ''}${max !== undefined ? ` max="${max}"` : ''}>`
  return `<div class="fld"><label>${esc(label)}</label>${input}</div>`
}

/** 비워 둘 수 있는 선택 상자. 목록에 있는 것만 고를 수 있다. */
export function optionalSelect(label, name, value, options) {
  const v = value || ''
  return (
    `<div class="fld"><label>${esc(label)}</label><select name="${name}">` +
    `<option value=""${v === '' ? ' selected' : ''}>선택 안 함</option>` +
    options.map((o) => `<option${o === v ? ' selected' : ''}>${esc(o)}</option>`).join('') +
    `</select></div>`
  )
}
