-- 시리즈 총 진행률을 단계별 입력으로 계산하도록 칸을 더한다.
--   원격 적용: npm run db:migrate4
--   로컬 적용: npm run db:migrate4:local
--
-- 가중치는 코드(src/lib/series.js)에 있다. 여기서는 값만 담는다.
-- 단계를 하나도 채우지 않은 시리즈는 기존 total_progress 값을 그대로 쓴다.
alter table series_progress add column plan integer;
alter table series_progress add column topic integer;
alter table series_progress add column volume integer;
alter table series_progress add column text integer;
alter table series_progress add column art integer;
alter table series_progress add column appendix integer;
alter table series_progress add column appendix_art integer;
alter table series_progress add column audio integer;
alter table series_progress add column review integer;
alter table series_progress add column saypen integer;
