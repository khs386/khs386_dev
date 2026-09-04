import { NextResponse } from 'next/server'
import { adminClient } from './supabaseAdmin.js'
import { generateReport, loadSettings, isSkipDay } from './reportData.js'
import { uploadHtml, driveConfigured } from './drive.js'

/** 오늘 날짜를 한국 시간 기준 'YYYY-MM-DD'로 얻는다 (서버는 UTC로 도는 경우가 많다). */
export function todayKST() {
  const now = new Date(Date.now() + 9 * 3600 * 1000)
  return now.toISOString().slice(0, 10)
}

/** cron 요청 인증. Vercel Cron은 CRON_SECRET을 Bearer로 보낸다. */
export function authorized(req) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // 미설정이면 검사하지 않는다 (로컬 확인용)
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function runScheduled(req, kind) {
  if (!authorized(req)) return NextResponse.json({ error: '권한 없음' }, { status: 401 })
  const url = new URL(req.url)
  const date = url.searchParams.get('date') || todayKST()
  const force = url.searchParams.get('force') === '1'

  const sb = adminClient()
  const settings = await loadSettings(sb)
  const skip = isSkipDay(date, settings.holidays)
  if (skip && !force) {
    return NextResponse.json({ skipped: true, reason: skip, date })
  }

  const { filename, empty } = await generateReport(sb, kind, date)
  if (empty && !force) {
    return NextResponse.json({ skipped: true, reason: '기록된 업무 없음', date })
  }

  let drive = null
  if (driveConfigured()) {
    const { data: report } = await sb
      .from('reports')
      .select('*')
      .eq('kind', kind)
      .eq('report_date', date)
      .maybeSingle()
    const up = await uploadHtml(report.filename, report.html)
    await sb.from('reports').update({ drive_file_id: up.id, drive_link: up.link }).eq('id', report.id)
    drive = up.link
  }
  return NextResponse.json({ ok: true, kind, date, filename, drive })
}
