-- 업무 유형을 화면에서 관리할 수 있게 표로 옮긴다.
--   원격 적용: npm run db:migrate3
--   로컬 적용: npm run db:migrate3:local
--
-- 지금까지 코드에 박혀 있던 다섯 가지를 그대로 넣어 둔다.
create table if not exists work_types (
  name       text primary key,
  sort_order integer not null default 0
);

insert or ignore into work_types (name, sort_order) values
  ('꼬마시리즈 개발',     1),
  ('꼬마생각뒤집기 개발', 2),
  ('꼬마역사뒤집기 개발', 3),
  ('꼬마과학뒤집기 개발', 4),
  ('기타 업무',           5);

-- 이미 쓰고 있던 업무의 유형 중 목록에 없는 값도 살려 둔다.
insert or ignore into work_types (name, sort_order)
  select distinct work_type, 90 from tasks
  where work_type is not null and trim(work_type) <> '';
insert or ignore into work_types (name, sort_order)
  select distinct work_type, 91 from weekly_items
  where work_type is not null and trim(work_type) <> '';
