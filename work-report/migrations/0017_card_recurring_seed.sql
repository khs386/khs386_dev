-- 노션 21건에 실제로 있던 자동결제 둘.
--
-- 셔터스톡 비고에 "집중 사용 기간(7월~10월)만 구독 예정"이라 적혀 있어 기간을 넣었다.
-- Notion은 끝을 정하지 않았으므로 비워 둔다.
insert or ignore into card_recurring
  (id, title, merchant, amount, account, spender, from_month, to_month, sort_order) values
  ('r-shutter', '셔터스톡 월 요금 자동 결제', '셔터스톡', 342100, '구독', '권호상', '2026-07', '2026-10', 1),
  ('r-notion',  'Notion 월 요금 자동 결제',  'Notion',    39600, '구독', '권호상', NULL,      NULL,      2);
