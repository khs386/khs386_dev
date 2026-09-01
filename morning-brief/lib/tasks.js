export const PRIORITY_LABEL = { 1: '높음', 2: '보통', 3: '낮음' }
export const STATUS_LABEL = { todo: '예정', doing: '진행', done: '완료', hold: '보류' }

// "내 업무" = 나에게 배정됐거나, 담당자 없이 내가 만든 업무
export function myTaskFilter(uid) {
  return `assignee_id.eq.${uid},and(assignee_id.is.null,created_by.eq.${uid})`
}

export function profileName(profiles, userId) {
  const p = profiles.find((p) => p.user_id === userId)
  return p ? p.name : ''
}
