import { supabase } from './supabase'
import { ymd, addDays, startOfDayISO } from './date'
import { myTaskFilter } from './tasks'

// 오늘자 모닝브리프를 생성(또는 재생성)해 briefs 테이블에 저장한다.
// 내용: 오늘 마감 / 지연 / 어제 완료 / 오늘의 우선순위 Top 3 (모두 "내 업무" 기준)
export async function generateBrief(uid) {
  const today = ymd()

  const { data: open, error: e1 } = await supabase
    .from('tasks')
    .select('id, title, priority, due_date, status')
    .neq('status', 'done')
    .or(myTaskFilter(uid))
  if (e1) throw e1

  const dueToday = open.filter((t) => t.due_date === today)
  const overdue = open.filter((t) => t.due_date && t.due_date < today)

  const { data: doneYesterday, error: e2 } = await supabase
    .from('tasks')
    .select('id, title')
    .eq('status', 'done')
    .or(myTaskFilter(uid))
    .gte('completed_at', startOfDayISO(addDays(new Date(), -1)))
    .lt('completed_at', startOfDayISO(new Date()))
  if (e2) throw e2

  const rank = (t) => (t.due_date && t.due_date < today ? 0 : t.due_date === today ? 1 : 2)
  const top3 = [...open]
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        a.priority - b.priority ||
        (a.due_date || '9999-12-31').localeCompare(b.due_date || '9999-12-31')
    )
    .slice(0, 3)

  const content = {
    due_today: dueToday,
    overdue,
    done_yesterday: doneYesterday || [],
    top3,
  }

  const { data: brief, error: e3 } = await supabase
    .from('briefs')
    .upsert(
      { user_id: uid, brief_date: today, content },
      { onConflict: 'user_id,brief_date' }
    )
    .select()
    .single()
  if (e3) throw e3

  return brief
}
