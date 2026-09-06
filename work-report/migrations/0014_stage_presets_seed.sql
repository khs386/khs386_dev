-- 기본 단계 목록. 지금까지 src/lib/series.js에 박혀 있던 값 그대로다.
-- 노션 [시리즈별 개발 현황]의 '총 진행률 (%)' 수식에서 온 몫이고, 이 값으로
-- 세 시리즈가 79 / 40 / 62를 낸다.
insert or ignore into stage_presets (key, label, weight, sort_order) values
  ('plan',         '초기 기획',      5,  1),
  ('topic',        '주제 선별',     10,  2),
  ('volume',       '권별 구성',     10,  3),
  ('text',         '본문 원고',     15,  4),
  ('art',          '본문 그림',     25,  5),
  ('appendix',     '부록 구성',     10,  6),
  ('appendix_art', '부록 그림',     10,  7),
  ('audio',        '음원 녹음',      5,  8),
  ('review',       '감수',           5,  9),
  ('saypen',       '세이펜 망 작업',  5, 10);
