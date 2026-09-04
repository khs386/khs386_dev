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
:root{
  --ground:#eef3f1;--surface:#fff;--surface-2:#f4f8f6;--line:#dae4e1;--line-soft:#e8efed;
  --ink:#15201e;--ink-2:#42544f;--ink-3:#788c86;
  --accent:#0a7c6e;--accent-soft:#e2f0ec;--alt:#6b5bb8;
  --done:#639922;--going:#378ADD;--warn:#e67e22;--urgent:#e74c3c;--idle:#8b9a95;
}
@media (prefers-color-scheme:dark){:root{
  --ground:#0d1412;--surface:#161f1d;--surface-2:#1b2523;--line:#283532;--line-soft:#212c2a;
  --ink:#e3ebe8;--ink-2:#a8b9b4;--ink-3:#7d918b;
  --accent:#4cbfa6;--accent-soft:#12302a;--alt:#a595e8;
  --done:#8cc63f;--going:#5aa5e8;--warn:#f0954a;--urgent:#f0685a;--idle:#7d918b;
}}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);font-size:15px;line-height:1.6;
  font-family:'Apple SD Gothic Neo','Malgun Gothic',-apple-system,BlinkMacSystemFont,sans-serif}
.mono{font-family:ui-monospace,'SFMono-Regular',Menlo,monospace;font-variant-numeric:tabular-nums}
a{color:var(--accent)}
input,select,textarea,button{font:inherit}
input,select,textarea{padding:7px 10px;border:1px solid var(--line);border-radius:8px;
  background:var(--surface);color:var(--ink);width:100%}
input:focus,select:focus,textarea:focus{outline:2px solid var(--accent);outline-offset:-1px;border-color:var(--accent)}
textarea{min-height:80px;resize:vertical;line-height:1.7}
.container{max-width:1040px;margin:0 auto;padding:20px 16px 80px}
.narrow{max-width:760px}
nav.top{background:var(--surface);border-bottom:1px solid var(--line)}
nav.top .inner{max-width:1040px;margin:0 auto;padding:10px 16px;display:flex;
  align-items:center;gap:5px;flex-wrap:wrap}
.brand{font-weight:800;margin-right:10px;white-space:nowrap}
nav.top a{color:var(--ink-2);text-decoration:none;padding:6px 11px;border-radius:8px;font-size:14px}
nav.top a:hover{background:var(--surface-2)}
nav.top a.on{background:var(--accent-soft);color:var(--accent);font-weight:600}
nav.top .right{margin-left:auto}
.head{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;
  flex-wrap:wrap;margin:8px 0 18px}
.head h1{font-size:21px;margin:0}
.head p{margin:2px 0 0;font-size:13px;color:var(--ink-3)}
.card{background:var(--surface);border:1px solid var(--line);border-radius:12px;
  padding:16px 18px;margin-bottom:14px}
.chead{display:flex;align-items:center;justify-content:space-between;gap:10px;
  flex-wrap:wrap;margin-bottom:12px}
.chead h2{margin:0;font-size:16px}
.count{font-size:12px;color:var(--ink-3)}
.row{display:flex;gap:9px;align-items:center;flex-wrap:wrap}
.row>*{flex:0 0 auto}
.grow{flex:1 1 200px}
.spacer{flex:1 1 auto}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px;margin-bottom:12px}
.fld{display:flex;flex-direction:column;gap:4px}
.fld label{font-size:11.5px;color:var(--ink-3)}
.btn{padding:7px 14px;border:0;border-radius:8px;background:var(--accent);color:#fff;
  font-weight:600;cursor:pointer;width:auto;text-decoration:none;display:inline-block;font-size:14px}
.btn:hover{filter:brightness(1.07)}
.btn.ghost{background:var(--surface);color:var(--ink-2);border:1px solid var(--line)}
.btn.alt{background:var(--alt)}
.btn.danger{background:var(--surface);color:var(--urgent);border:1px solid var(--line)}
.btn.sm{padding:5px 10px;font-size:12.5px}
.btn[disabled]{opacity:.45;cursor:default}
.item{display:flex;gap:9px;align-items:center;flex-wrap:wrap;padding:11px 0;
  border-top:1px solid var(--line-soft)}
.item:first-child{border-top:0}
.item .t{font-weight:600;flex:1 1 190px;min-width:0}
.pill{font-size:11.5px;font-weight:600;padding:2.5px 10px;border-radius:20px;color:#fff;white-space:nowrap}
.tag{font-size:11.5px;padding:2.5px 9px;border-radius:20px;background:var(--surface-2);
  color:var(--ink-2);border:1px solid var(--line);white-space:nowrap}
.dday{font-size:12px;font-weight:700}
.note{padding:10px 14px;border-radius:10px;margin-bottom:14px;font-size:13.5px;
  background:var(--accent-soft);color:var(--ink-2)}
.note.warn{background:color-mix(in srgb,var(--warn) 15%,var(--surface))}
.note.err{background:color-mix(in srgb,var(--urgent) 13%,var(--surface))}
.note b{color:var(--ink)}
.empty{text-align:center;color:var(--ink-3);font-size:13.5px;padding:16px 0}
.bars{display:flex;align-items:flex-end;gap:24px;height:230px;padding:0 8px}
.bar{flex:1;text-align:center;display:flex;flex-direction:column;justify-content:flex-end}
.bar .v{font-size:12.5px;font-weight:700;margin-bottom:6px}
.bar .stem{width:56%;margin:0 auto;border-radius:7px 7px 0 0}
.bar .n{font-size:12px;color:var(--ink-2);margin-top:7px}
iframe.preview{width:100%;height:640px;border:1px solid var(--line);border-radius:10px;background:#fff}
.tabs{display:flex;gap:7px;margin-bottom:14px;flex-wrap:wrap}
.auth{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.auth .card{width:100%;max-width:360px;text-align:center}
form.inline{display:inline}
`

export function page({ title, path, body, narrow }) {
  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${HEAD_ICON}
<title>${esc(title)} · 업무보고서</title><style>${CSS}</style></head>
<body>
<nav class="top"><div class="inner">
<span class="brand">📋 업무보고서</span>
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
<body><main class="auth"><div class="card">
<h1 style="margin:0 0 6px">📋 업무보고서</h1>
<p style="margin:0 0 18px;color:var(--ink-3);font-size:13.5px">일일·주간 보고서를 만들고 드라이브에 저장합니다</p>
${message ? `<p class="note err">${esc(message)}</p>` : ''}
<form method="post" action="/login">
  <input type="password" name="password" placeholder="비밀번호" autofocus required>
  <button class="btn" style="width:100%;margin-top:10px">로그인</button>
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

export function optionalSelect(label, name, value, options) {
  const v = value || ''
  return (
    `<div class="fld"><label>${esc(label)}</label><select name="${name}">` +
    `<option value=""${v === '' ? ' selected' : ''}>선택 안 함</option>` +
    options.map((o) => `<option${o === v ? ' selected' : ''}>${esc(o)}</option>`).join('') +
    `</select></div>`
  )
}
