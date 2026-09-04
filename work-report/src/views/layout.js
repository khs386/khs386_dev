// 화면 공통 껍데기와 작은 조각들. 서버에서 HTML을 그려 보낸다.

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const NAV = [
  ['/', '오늘'],
  ['/tasks', '업무'],
  ['/daily', '일일 기록'],
  ['/weekly', '주간 현황'],
  ['/series', '시리즈'],
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
.chead h2{margin:0; font-size:16px; font-weight:600; letter-spacing:-.018em}
.count{font-size:13px; color:var(--text-3)}

.row{display:flex; gap:8px; align-items:center; flex-wrap:wrap}
.row>*{flex:0 0 auto}
.grow{flex:1 1 200px}
.spacer{flex:1 1 auto}

.grid{display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
  gap:12px; margin-bottom:14px}
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
.btn[disabled]{opacity:.38; cursor:default}
.btn:focus-visible{outline:3px solid color-mix(in srgb,var(--accent) 45%,transparent); outline-offset:2px}

/* 줄 목록 */
.item{display:flex; gap:9px; align-items:center; flex-wrap:wrap;
  padding:12px 0; border-top:1px solid var(--sep-soft)}
.item:first-child{border-top:0; padding-top:2px}
.item .t{font-weight:500; flex:1 1 200px; min-width:0}

.pill{font-size:12px; font-weight:500; padding:2px 9px; border-radius:20px;
  color:#fff; white-space:nowrap; letter-spacing:0}
.tag{font-size:12px; padding:2px 9px; border-radius:20px; background:var(--fill);
  color:var(--text-2); white-space:nowrap; letter-spacing:0}
.dday{font-size:13px; font-weight:600; letter-spacing:0}

/* 알림 */
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

export function page({ title, path, body, narrow }) {
  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${HEAD_ICON}
<title>${esc(title)} · 업무보고서</title><style>${CSS}</style></head>
<body>
<nav class="top"><div class="inner">
<span class="brand">업무보고서</span>
${NAV.map(([h, l]) =>
  `<a href="${h}"${h === path ? ' class="on"' : ''}>${l}</a>`).join('')}
<form method="post" action="/logout" class="right">
  <button class="btn ghost sm">로그아웃</button>
</form>
</div></nav>
<main class="container${narrow ? ' narrow' : ''}">${body}</main>
</body></html>`
}

export function loginPage(message) {
  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${HEAD_ICON}
<title>로그인 · 업무보고서</title><style>${CSS}</style></head>
<body><main class="auth"><div class="auth-box">
<h1>업무보고서</h1>
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
