// 구글 드라이브 업로드. 서비스 계정 JWT를 직접 서명해 액세스 토큰을 받으므로
// googleapis 패키지를 설치하지 않아도 된다. 서버에서만 호출할 것.
import { createSign } from 'node:crypto'

const SCOPE = 'https://www.googleapis.com/auth/drive.file'

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function driveConfigured() {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY &&
      process.env.GOOGLE_DRIVE_FOLDER_ID
  )
}

async function accessToken() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  // Vercel 환경변수는 줄바꿈이 \n 문자열로 들어온다.
  const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  if (!email || !key) throw new Error('구글 서비스 계정 환경변수가 없습니다.')

  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = b64url(
    JSON.stringify({
      iss: email,
      scope: SCOPE,
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    })
  )
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${claim}`)
  const jwt = `${header}.${claim}.${b64url(signer.sign(key))}`

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

/** 폴더 안에서 같은 이름의 파일을 찾는다. 있으면 덮어쓰기 위해 id를 돌려준다. */
async function findExisting(token, folderId, name) {
  const q = encodeURIComponent(`name = '${name.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`)
  const url =
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)` +
    `&supportsAllDrives=true&includeItemsFromAllDrives=true`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return null
  const json = await res.json()
  return json.files?.[0]?.id || null
}

/**
 * HTML을 드라이브 지정 폴더에 올린다. 같은 이름이 있으면 새 파일을 만들지 않고 내용을 갱신한다.
 * @returns {{id: string, link: string, updated: boolean}}
 */
export async function uploadHtml(filename, html) {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID
  if (!folderId) throw new Error('GOOGLE_DRIVE_FOLDER_ID가 없습니다.')
  const token = await accessToken()
  const existing = await findExisting(token, folderId, filename)

  const meta = existing
    ? { name: filename }
    : {
        name: filename,
        parents: [folderId],
        ...(process.env.GOOGLE_DRIVE_ID ? { driveId: process.env.GOOGLE_DRIVE_ID } : {}),
      }

  const boundary = 'wr' + Math.random().toString(36).slice(2)
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
