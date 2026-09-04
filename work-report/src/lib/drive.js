// 구글 드라이브 업로드.
//
// 서비스 계정이 아니라 "사용자 권한 위임"(OAuth refresh token) 방식을 쓴다.
// 서비스 계정은 저장 공간이 0이라 개인 드라이브에 파일을 만들 수 없다
// (Service Accounts do not have storage quota). 사용자 토큰으로 올리면
// 파일이 사용자 소유가 되고 개인 드라이브 폴더에 그대로 저장된다.
//
// 필요한 값 (wrangler secret):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_DRIVE_FOLDER_ID
// refresh token은 scripts/get-google-token.mjs 로 한 번만 받아 둔다.

const TOKEN_URL = 'https://oauth2.googleapis.com/token'

export function driveConfigured(env) {
  return Boolean(
    env.GOOGLE_CLIENT_ID &&
      env.GOOGLE_CLIENT_SECRET &&
      env.GOOGLE_REFRESH_TOKEN &&
      env.GOOGLE_DRIVE_FOLDER_ID
  )
}

/** refresh token으로 짧게 쓰는 access token을 받아 온다. */
async function accessToken(env) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  })
  const json = await res.json()
  if (!res.ok) {
    const hint =
      json.error === 'invalid_grant'
        ? ' (연결이 끊겼습니다. scripts/get-google-token.mjs 로 다시 받아 등록하세요.)'
        : ''
    throw new Error(`구글 토큰 발급 실패: ${json.error_description || json.error}${hint}`)
  }
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

  const meta = existing ? { name: filename } : { name: filename, parents: [folderId] }

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
