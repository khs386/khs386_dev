-- 업무 유형을 이름이 맞아떨어지는 시리즈에 이어 준다.
--   원격 적용: npm run db:link
--   로컬 적용: npm run db:link:local
--
-- 0007에서 열을 더하는 일과 이어 주는 일을 한 파일에 두었더니, 열이 이미 있는
-- 데이터베이스에서 첫 줄에 멈춰 뒤가 돌지 않았다. 이어 주는 일만 따로 뗀다.
-- 여러 번 돌려도 안전하다 — 이미 이어진 것은 건드리지 않는다.
update work_types
   set series = (
     select s.name from series_progress s
      where replace(s.name, ' ', '') = replace(
              substr(work_types.name, 1, length(work_types.name) - 3), ' ', '')
      limit 1
   )
 where series is null
   and work_types.name like '% 개발';
