import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateReport } from '../../../../lib/reportData.js'

export const dynamic = 'force-dynamic'

/** 로그인 사용자의 토큰으로 동작하는 클라이언트 (RLS 그대로 적용) */
function clientFrom(req) {
  const auth = req.headers.get('authorization') || ''
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: auth } }, auth: { persistSession: false } }
  )
}

export async function POST(req) {
  try {
    const { kind, date } = await req.json()
    if (!['daily', 'weekly'].includes(kind)) {
      return NextResponse.json({ error: 'kind는 daily 또는 weekly여야 합니다.' }, { status: 400 })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
      return NextResponse.json({ error: '날짜 형식이 올바르지 않습니다.' }, { status: 400 })
    }
    const sb = clientFrom(req)
    const { data: user } = await sb.auth.getUser()
    if (!user?.user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

    const { html, filename, empty } = await generateReport(sb, kind, date)
    return NextResponse.json({ html, filename, empty })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
