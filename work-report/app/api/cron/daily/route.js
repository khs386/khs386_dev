import { runScheduled } from '../../../../lib/cron.js'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// 평일 18:00 KST. 공휴일·주말이면 건너뛴다.
export async function GET(req) {
  return runScheduled(req, 'daily')
}
