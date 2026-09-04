// 구글 드라이브에 올릴 권한(refresh token)을 한 번만 받아 온다.
//
//   node scripts/get-google-token.mjs <클라이언트_ID> <클라이언트_보안_비밀>
//
// 브라우저가 열리고 구글 로그인·동의를 거치면 refresh token이 화면에 나온다.
// 안내는 화면(stderr)으로, 토큰만 표준출력(stdout)으로 나가므로 이렇게 바로 등록할 수 있다.
//
//   node scripts/get-google-token.mjs <ID> <비밀> | npx wrangler secret put GOOGLE_REFRESH_TOKEN
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'

const [clientId, clientSecret] = process.argv.slice(2)
if (!clientId || !clientSecret) {
  console.error('사용법: node scripts/get-google-token.mjs <클라이언트_ID> <클라이언트_보안_비밀>')
  process.exit(1)
}

const PORT = 8976
const REDIRECT = `http://127.0.0.1:${PORT}`
const SCOPE = 'https://www.googleapis.com/auth/drive.file'

const authUrl =
  'https://accounts.google.com/o/oauth2/v2/auth?' +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
  })

const page = (msg) =>
  `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>업무보고서</title></head>` +
  `<body style="font-family:-apple-system,sans-serif;padding:60px;text-align:center">` +
  `<h2>${msg}</h2><p style="color:#666">터미널로 돌아가세요.</p></body></html>`

const server = createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')

  if (error) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(page('취소되었습니다.'))
    console.error(`\n동의가 취소되었습니다: ${error}`)
    server.close()
    process.exit(1)
  }
  if (!code) {
    res.writeHead(404).end()
    return
  }

  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT,
        grant_type: 'authorization_code',
      }),
    })
    const json = await r.json()
    if (!r.ok) throw new Error(json.error_description || json.error)
    if (!json.refresh_token) {
      throw new Error(
        'refresh token이 오지 않았습니다. 구글 계정 설정에서 이 앱의 권한을 지우고 다시 실행하세요.'
      )
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(page('연결됐습니다 ✓'))
    console.error('\n✓ 받았습니다. 아래 값이 refresh token입니다.\n')
    process.stdout.write(json.refresh_token)
    server.close()
    process.exit(0)
  } catch (e) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(page('실패했습니다.'))
    console.error(`\n실패: ${e.message}`)
    server.close()
    process.exit(1)
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.error('브라우저에서 구글 로그인 창을 엽니다.')
  console.error('열리지 않으면 아래 주소를 직접 붙여넣으세요.\n')
  console.error(authUrl + '\n')
  spawn('open', [authUrl], { stdio: 'ignore' }).on('error', () => {})
})
