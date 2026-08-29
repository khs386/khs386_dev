import { createClient } from '@supabase/supabase-js'

// 빌드(프리렌더) 시 env가 없어도 죽지 않도록 placeholder를 둔다.
// 실제 값은 .env.local / Vercel 환경변수로 주입된다.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

export const supabase = createClient(url, anonKey)
