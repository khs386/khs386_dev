export const STATUSES = ['예정', '시작', '진행', '완료', '보류']
export const PRIORITIES = ['높음', '중간', '낮음']
export const SERIES_NAMES = ['꼬마생각뒤집기', '꼬마역사뒤집기', '꼬마 일력', '기타']
export const WORK_TYPES = [
  '꼬마시리즈 개발',
  '꼬마생각뒤집기 개발',
  '꼬마역사뒤집기 개발',
  '꼬마과학뒤집기 개발',
  '기타 업무',
]

/** 브라우저 시간대와 무관하게 한국 기준 오늘 날짜를 얻는다. */
export function todayKST() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
}
