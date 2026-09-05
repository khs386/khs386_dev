-- 브리프의 항목 제목. 숫자만으로는 무슨 일인지 알 수 없어서 제목까지 받아 둔다.
-- {"events":["..."],"todo":["..."],"done":["..."]} 모양의 JSON 한 덩어리.
alter table briefs add column items text;
