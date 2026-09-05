-- 업무 유형이 어느 시리즈에 속하는지 적어 둔다.
--   원격 적용: npm run db:migrate7
--   로컬 적용: npm run db:migrate7:local
--
-- 이름으로 짐작하지 않고 표에 적는다. 시리즈 "꼬마 일력"과 유형 "꼬마일력 개발"처럼
-- 띄어쓰기가 다른 짝이 이미 있어, 이름 규칙으로는 이어지지 않는다.
-- 비워 두면 "공통" — 어느 시리즈에서나 고를 수 있는 유형이다("기타 업무" 같은 것).
alter table work_types add column series text;

-- 지금 있는 것들을 이어 둔다. 시리즈 표에 실제로 있는 이름만 넣는다.
update work_types
   set series = (
     select s.name from series_progress s
      where replace(s.name, ' ', '') = replace(
              substr(work_types.name, 1, length(work_types.name) - 3), ' ', '')
      limit 1
   )
 where series is null
   and work_types.name like '% 개발';
