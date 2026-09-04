import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { uploadHtml, driveConfigured } from '../../../../lib/drive.js'

export const dynamic = 'force-dynamic'

export async function POST(req) {
  try {
    if (!driveConfigured()) {
      return NextResponse.json(
        { error: '구글 드라이브 환경변수가 설정되지 않았습니다. README의 드라이브 설정을 확인하세요.' },
        { status: 400 }
      )
    }
    const { kind, date } = await req.json()
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        global: { headers: { Authorization: req.headers.get('authorization') || '' } },
        auth: { persistSession: false },
      }
    )
    const { data: user } = await sb.auth.getUser()
    if (!user?.user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

    const { data: report } = await sb
      .from('reports')
      .select('*')
      .eq('kind', kind)
      .eq('report_date', date)
      .maybeSingle()
    if (!report) {
      return NextResponse.json({ error: '먼저 보고서를 생성해 주세요.' }, { status: 404 })
    }

    const { id, link, updated } = await uploadHtml(report.filename, report.html)
    await sb
      .from('reports')
      .update({ drive_file_id: id, drive_link: link })
      .eq('id', report.id)
    return NextResponse.json({ link, updated, filename: report.filename })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
