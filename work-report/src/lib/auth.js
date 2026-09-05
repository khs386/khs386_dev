// 로그인. 혼자 쓰는 앱이라 비밀번호 하나와 서명 쿠키로 충분하다.
// workers.dev 주소에는 Cloudflare Access를 걸 수 없어 앱 안에서 처리한다.

const COOKIE = 'wr_session'
const MAX_AGE = 60 * 60 * 24 * 30 // 30일

const enc = new TextEncoder()

function b64url(bytes) {
  let s = ''
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(message)))
}

/** 길이가 달라도 같은 시간이 걸리도록 비교한다. */
function safeEqual(a, b) {
  const x = enc.encode(a)
  const y = enc.encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  }
  return diff === 0
}

export async function makeSessionCookie(env) {
  const exp = Date.now() + MAX_AGE * 1000
  const sig = await hmac(env.SESSION_SECRET, String(exp))
  const value = `${exp}.${sig}`
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`
}

export const clearSessionCookie = () =>
  `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`

export async function isLoggedIn(req, env) {
  if (!env.SESSION_SECRET) return false
  const raw = req.headers.get('cookie') || ''
  const m = new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`).exec(raw)
  if (!m) return false
  const [exp, sig] = m[1].split('.')
  if (!exp || !sig) return false
  if (Number(exp) < Date.now()) return false
  return safeEqual(sig, await hmac(env.SESSION_SECRET, exp))
}

export function checkPassword(env, given) {
  if (!env.APP_PASSWORD) return false
  return safeEqual(String(given || ''), env.APP_PASSWORD)
}

/**
 * 모닝브리프를 넣을 때 쓰는 전용 열쇠.
 *
 * 앱 비밀번호와는 따로 둔다. 이 열쇠로 할 수 있는 일은 브리프를 넣는 것 하나뿐이라,
 * 새어 나가도 업무 기록을 읽거나 고치지는 못한다.
 */
export function checkBriefToken(env, given) {
  if (!env.BRIEF_TOKEN) return false
  return safeEqual(String(given || ''), env.BRIEF_TOKEN)
}
