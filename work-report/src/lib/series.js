// 시리즈 총 진행률.
//
// 단계와 몫은 시리즈마다 다르다. 꼬마 일력에는 본문 그림이 없고, 뒤집기에는 있다.
// 그래서 셈에 쓰는 몫은 코드가 아니라 그 시리즈의 단계 목록에서 온다.
//
// 처음 값은 노션 [시리즈별 개발 현황]의 '총 진행률 (%)' 수식에서 가져왔다
// (migrations/0014_stage_presets_seed.sql). 그 몫으로 세 시리즈가 79 / 40 / 62를 낸다.

/** 단계 이름은 폼 칸 이름으로도 쓰이므로 글자와 숫자, 밑줄만 허용한다. */
export const STAGE_KEY = /^[A-Za-z0-9_]{1,40}$/

/** 새 단계의 열쇠. 이름을 고쳐도 열쇠는 그대로여서 값이 따라 움직인다. */
export const newStageKey = () =>
  's' + crypto.randomUUID().replace(/-/g, '').slice(0, 12)

const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v))

/** 진행률은 0~100 사이. 비어 있으면 아직 손대지 않은 것이라 null로 둔다. */
export const clampPct = (v) =>
  num(v) === null ? null : Math.max(0, Math.min(100, Math.round(Number(v) || 0)))

/** 몫은 0 아래로 내려가지 않는다. */
export const clampWeight = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)))

/** 몫의 합. 100이 아니어도 막지 않는다 — 고치는 도중에는 반드시 어긋난다. */
export const weightSum = (stages) =>
  (stages || []).reduce((a, s) => a + clampWeight(s.weight), 0)

/** 값을 하나라도 넣었는가. 아무것도 넣지 않았으면 예전에 직접 적던 값을 쓴다. */
export const hasValues = (stages) =>
  (stages || []).some((s) => num(s.value) !== null)

/**
 * 총 진행률.
 *
 * 몫의 합으로 나눈다. 합이 100이 아니어도 0~100 안에 머물게 하려는 것이고,
 * 단계를 하나 빼면 그 몫만큼 분모도 줄어 남은 단계의 비중이 커진다 — 애초에
 * 하지 않는 작업이라면 그 편이 실제에 가깝다.
 *
 * fallback은 단계가 생기기 전에 손으로 적어 두던 값(series_progress.total_progress)이다.
 */
export function seriesTotal(stages, fallback = 0) {
  const list = stages || []
  const sum = weightSum(list)
  if (!sum || !hasValues(list)) return Number(fallback) || 0
  const got = list.reduce((a, s) => a + (num(s.value) || 0) * clampWeight(s.weight), 0)
  return Math.round(got / sum)
}
