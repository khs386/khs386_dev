-- 반복 결제. 달마다 빠짐없이 나가야 하는 지출을 적어 둔다.
--
-- 자동결제는 영수증이 눈에 띄지 않아 조용히 빠진다. 노션에서 옮겨 온 21건에서도
-- 셔터스톡·Notion이 6월 뒤로 끊겨 있었다. 화면이 그 달에 없는 것을 짚어 준다.
--
-- 들어왔는지는 사용처(가맹점)로 가린다. 세부 내역은 달마다 글이 조금씩 달라지지만
-- ("6월 요금", "7월 요금") 가맹점은 그대로이기 때문이다.
create table if not exists card_recurring (
  id         text primary key,
  title      text not null,
  merchant   text not null,
  amount     integer not null default 0,
  account    text,
  spender    text,
  -- 쓰는 기간. 비워 두면 끝이 없다는 뜻이다.
  from_month text,
  to_month   text,
  enabled    integer not null default 1,
  sort_order integer not null default 0
);
