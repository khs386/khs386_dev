// 구글 드라이브 업로드.
// 워커스는 Node가 아니라 브라우저에 가까운 환경이라 node:crypto를 못 쓴다.
// 서비스 계정 JWT를 WebCrypto로 직접 서명한다.

const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const enc = new TextEncoder()

function b64url(input) {
  const bytes = typeof input === 'string' ? enc.encode(input) : new Uint8Array(input)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** PEM 본문을 꺼내 ArrayBuffer로 바꾼다. */
function pemToBuffer(pem) {
  const body = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '')
  const bin = atob(body)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return buf.buffer
}

export function driveConfigured(env) {
  return Boolean(
    env.GOOGLE_SERVICE_ACCOUNT_EMAIL && env.GOOGLE_PRIVATE_KEY && env.GOOGLE_DRIVE_FOLDER_ID
  )
}

async function accessToken(env) {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = b64url(
    JSON.stringify({
      iss: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      scope: SCOPE,
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    })
  )
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBuffer(env.GOOGLE_PRIVATE_KEY),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(`${header}.${claim}`))
  const jwt = `${header}.${claim}.${b64url(sig)}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`구글 토큰 발급 실패: ${json.error_description || json.error}`)
  return json.access_token
}

/** 폴더 안에 같은 이름의 파일이 있으면 그 id를 돌려준다 (덮어쓰기용). */
async function findExisting(token, folderId, name) {
  const q = encodeURIComponent(
    `name = '${name.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`
  )
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)` +
      `&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) return null
  const json = await res.json()
  return json.files?.[0]?.id || null
}

/** HTML을 지정 폴더에 올린다. 같은 이름이 있으면 내용을 갱신한다. */
export async function uploadHtml(env, filename, html) {
  const folderId = env.GOOGLE_DRIVE_FOLDER_ID
  const token = await accessToken(env)
  const existing = await findExisting(token, folderId, filename)

  const meta = existing
    ? { name: filename }
    : {
        name: filename,
        parents: [folderId],
        ...(env.GOOGLE_DRIVE_ID ? { driveId: env.GOOGLE_DRIVE_ID } : {}),
      }

  const boundary = 'wr' + crypto.randomUUID().replace(/-/g, '')
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(meta)}\r\n` +
    `--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n` +
    `${html}\r\n--${boundary}--`

  const url = existing
    ? `https://www.googleapis.com/upload/drive/v3/files/${existing}?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink`

  const res = await fetch(url, {
    method: existing ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`드라이브 업로드 실패: ${json.error?.message || res.status}`)
  return {
    id: json.id,
    link: json.webViewLink || `https://drive.google.com/file/d/${json.id}/view`,
    updated: Boolean(existing),
  }
}
