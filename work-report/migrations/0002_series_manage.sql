-- 시리즈를 직접 추가·삭제할 수 있게 색 칸을 더한다.
--   원격 적용: npm run db:migrate
--   로컬 적용: npm run db:migrate:local
--
-- 기존 세 시리즈는 보고서에 쓰던 고정색을 그대로 채워 넣는다.
alter table series_progress add column color text;

update series_progress set color = '#378ADD' where name = '꼬마생각뒤집기' and color is null;
update series_progress set color = '#e67e22' where name = '꼬마역사뒤집기' and color is null;
update series_progress set color = '#9b59b6' where name = '꼬마 일력'      and color is null;
