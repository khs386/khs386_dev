import { createClient } from '@supabase/supabase-js'

// 서버 전용. cron과 드라이브 업로드처럼 로그인 세션이 없는 경로에서만 쓴다.
export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.')
  return createClient(url, key, { auth: { persistSession: false } })
}
