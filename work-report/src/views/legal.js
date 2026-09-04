// 구글 OAuth 동의 화면 게시에 필요한 공개 페이지.
// 로그인 없이 열려야 하므로 인증 검사에서 제외한다.

const STYLE = `
body{margin:0;background:#f4f6f5;color:#1b2321;font-size:15.5px;line-height:1.75;
  font-family:'Apple SD Gothic Neo','Malgun Gothic',-apple-system,sans-serif}
main{max-width:720px;margin:0 auto;padding:56px 22px 80px}
h1{font-size:26px;margin:0 0 6px;letter-spacing:-.02em}
.sub{color:#6f817c;font-size:13.5px;margin:0 0 32px}
h2{font-size:17px;margin:30px 0 8px}
p,li{color:#3d4d49}
ul{padding-left:20px}
a{color:#0a7c6e}
.box{background:#fff;border:1px solid #dde5e3;border-radius:12px;padding:20px 24px;margin:18px 0}
footer{margin-top:40px;padding-top:18px;border-top:1px solid #dde5e3;color:#8b9a95;font-size:13px}
`

const shell = (title, body) => `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · 업무보고서</title><style>${STYLE}</style></head>
<body><main>${body}
<footer><a href="/">업무보고서</a> · <a href="/privacy">개인정보처리방침</a> · <a href="/terms">이용약관</a></footer>
</main></body></html>`

const contact = (env) =>
  env.SUPPORT_EMAIL
    ? `<p>문의: <a href="mailto:${env.SUPPORT_EMAIL}">${env.SUPPORT_EMAIL}</a></p>`
    : '<p>문의: 앱 소유자에게 직접 연락해 주세요.</p>'

export function privacyPage(env) {
  return shell('개인정보처리방침', `
<h1>개인정보처리방침</h1>
<p class="sub">업무보고서 (work-report)</p>

<div class="box">
<p><b>이 앱은 한 사람이 자신의 업무보고서를 만들기 위해 쓰는 개인 도구입니다.</b>
회원 가입이 없고, 앱 소유자 외에는 아무도 사용하지 않습니다.</p>
</div>

<h2>다루는 정보</h2>
<ul>
  <li><b>업무 데이터</b> — 사용자가 직접 입력한 업무명, 진행 상태, 진행률, 마감일, 세부내용</li>
  <li><b>생성된 보고서</b> — 위 데이터로 만든 HTML 문서</li>
</ul>
<p>이름·연락처·주소 같은 개인 식별 정보를 따로 수집하지 않으며,
접속 기록을 분석하거나 광고에 쓰지 않습니다. 쿠키는 로그인 상태를 유지하는 용도로만 씁니다.</p>

<h2>구글 계정 권한</h2>
<p>사용자가 허용한 경우에만 구글 드라이브에 보고서 파일을 저장합니다. 사용하는 권한 범위는
<b>이 앱이 직접 만든 파일에만 접근할 수 있는 범위</b>(<code>drive.file</code>)입니다.
드라이브의 다른 파일과 폴더는 읽지도 쓰지도 못합니다.</p>
<p>저장된 파일은 사용자 본인 소유이며, 사용자가 지정한 폴더에 들어갑니다.</p>

<h2>보관과 삭제</h2>
<p>데이터는 Cloudflare D1에 저장됩니다. 사용자는 앱 화면에서 언제든 지울 수 있습니다.
구글 계정 연결은 <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">구글 계정 권한 설정</a>에서
직접 해제할 수 있습니다.</p>

<h2>제3자 제공</h2>
<p>어떤 정보도 다른 사람이나 회사에 제공하거나 판매하지 않습니다.</p>

<h2>문의</h2>
${contact(env)}
`)
}

export function termsPage(env) {
  return shell('이용약관', `
<h1>이용약관</h1>
<p class="sub">업무보고서 (work-report)</p>

<div class="box">
<p>이 앱은 앱 소유자 본인이 쓰기 위해 만든 개인 도구입니다. 일반에 제공하는 서비스가 아닙니다.</p>
</div>

<h2>사용 범위</h2>
<p>앱 소유자만 로그인해 사용합니다. 제3자에게 계정을 제공하지 않습니다.</p>

<h2>보증</h2>
<p>개인이 만들어 쓰는 도구이므로 가동 시간이나 데이터 보존을 보장하지 않습니다.
중요한 보고서는 별도로 내려받아 보관하시기 바랍니다.</p>

<h2>변경</h2>
<p>기능과 약관은 예고 없이 바뀔 수 있습니다.</p>

<h2>문의</h2>
${contact(env)}
`)
}
