import { runScheduled } from '../../../../lib/cron.js'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// 금요일 17:00 KST. 공휴일이면 건너뛴다.
export async function GET(req) {
  return runScheduled(req, 'weekly')
}
