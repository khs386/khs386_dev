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

const FOLDER_MIME = 'application/vnd.google-apps.folder'
const KIND_NAME = { daily: '일일', weekly: '주간' }

const DRIVE_API = 'https://www.googleapis.com/drive/v3/files'
const SHARED = 'supportsAllDrives=true&includeItemsFromAllDrives=true'

/** 드라이브 검색어에 쓰는 작은따옴표를 막아 준다. */
function quote(name) {
  return name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

/** 폴더 안에서 이름이 같은 항목을 찾는다. 폴더만 찾으려면 folderOnly를 켠다. */
async function findChild(token, parentId, name, folderOnly) {
  const q = encodeURIComponent(
    `name = '${quote(name)}' and '${parentId}' in parents and trashed = false` +
      (folderOnly ? ` and mimeType = '${FOLDER_MIME}'` : '')
  )
  const res = await fetch(`${DRIVE_API}?q=${q}&fields=files(id)&${SHARED}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  const json = await res.json()
  return json.files?.[0]?.id || null
}

/** 하위 폴더를 찾고, 없으면 만든다. */
async function ensureFolder(token, parentId, name) {
  const found = await findChild(token, parentId, name, true)
  if (found) return found
  const res = await fetch(`${DRIVE_API}?${SHARED}&fields=id`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`드라이브 폴더 만들기 실패(${name}): ${json.error?.message || res.status}`)
  return json.id
}

/**
 * 보고서가 들어갈 폴더를 정한다.
 *
 *   업무보고서 / 일일 / 2026 / report_2026-09-04.html
 *   업무보고서 / 주간 / 2026 / weekly_report_2026-09-05.html
 *
 * 설정해 둔 폴더(GOOGLE_DRIVE_FOLDER_ID)가 [업무보고서] 자리다. 그 안에 종류 폴더와
 * 연도 폴더만 만든다.
 *
 * 앱 권한이 drive.file이라 앱이 만들지 않은 폴더는 눈에 보이지 않는다. 그래서 종류·연도
 * 폴더는 앱이 직접 만들어 쓴다. 손으로 만든 같은 이름의 폴더가 옆에 있으면 두 개로
 * 보이므로, 손으로 만든 쪽은 지우고 앱이 만든 폴더를 쓴다.
 */
async function targetFolder(token, env, kind, date) {
  const root = env.GOOGLE_DRIVE_FOLDER_ID
  const byKind = await ensureFolder(token, root, KIND_NAME[kind] || KIND_NAME.daily)
  return await ensureFolder(token, byKind, String(date).slice(0, 4))
}

/** HTML을 종류·연도별 폴더에 올린다. 같은 이름이 있으면 내용을 갱신한다. */
export async function uploadHtml(env, { filename, html, kind, date }) {
  const token = await accessToken(env)
  const folderId = await targetFolder(token, env, kind, date)
  const existing = await findChild(token, folderId, filename, false)

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
