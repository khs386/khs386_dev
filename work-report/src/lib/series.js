// 시리즈 개발 단계와 가중치.
// 노션 [시리즈별 개발 현황]의 '총 진행률 (%)' 수식을 그대로 옮긴 것이다.
//   round(초기기획*0.05 + 주제선별*0.10 + 권별구성*0.10 + 본문원고*0.15 + 본문그림*0.25
//       + 부록구성*0.10 + 부록그림*0.10 + 음원녹음*0.05 + 감수*0.05 + 세이펜망작업*0.05)
// 가중치 합은 1.00이다. 비어 있는 단계는 0으로 본다.

export const STAGES = [
  { key: 'plan',         label: '초기 기획',      weight: 0.05 },
  { key: 'topic',        label: '주제 선별',      weight: 0.1 },
  { key: 'volume',       label: '권별 구성',      weight: 0.1 },
  { key: 'text',         label: '본문 원고',      weight: 0.15 },
  { key: 'art',          label: '본문 그림',      weight: 0.25 },
  { key: 'appendix',     label: '부록 구성',      weight: 0.1 },
  { key: 'appendix_art', label: '부록 그림',      weight: 0.1 },
  { key: 'audio',        label: '음원 녹음',      weight: 0.05 },
  { key: 'review',       label: '감수',           weight: 0.05 },
  { key: 'saypen',       label: '세이펜 망 작업', weight: 0.05 },
]

/** 단계가 하나라도 입력돼 있는가. 하나도 없으면 예전에 직접 넣은 총 진행률을 쓴다. */
export function hasStages(row) {
  return STAGES.some((s) => row[s.key] !== null && row[s.key] !== undefined && row[s.key] !== '')
}

/** 총 진행률(%). 노션 수식과 같은 값을 낸다. */
export function seriesTotal(row) {
  if (!row) return 0
  if (!hasStages(row)) return Number(row.total_progress) || 0
  const sum = STAGES.reduce((acc, s) => acc + (Number(row[s.key]) || 0) * s.weight, 0)
  return Math.round(sum)
}
