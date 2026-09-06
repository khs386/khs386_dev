-- 법인카드 사용 내역. 노션 [법인카드 사용 내역] 탭을 앱으로 옮긴 것이다.
--
-- 금액은 원 단위 정수로만 담는다. 실수로 두면 달 합계에서 오차가 쌓이는데,
-- 정산 서류에 그대로 올라가는 숫자라 한 원도 어긋나면 안 된다.
-- 날짜는 다른 표와 같이 'YYYY-MM-DD' 글자다.

create table if not exists card_expenses (
  id         text primary key,
  used_on    text not null,
  title      text not null,
  spender    text,
  merchant   text,
  amount     integer not null default 0,
  account    text,
  settle     text not null default '지출품의 예정',
  note       text default '',
  created_at text not null default (datetime('now'))
);

-- 화면은 늘 한 달치만 읽는다.
create index if not exists card_expenses_month_idx on card_expenses (used_on);

-- 아래 세 표는 고르는 칸에 나오는 값이다. 화면의 [항목 관리]에서 늘리고 줄인다.
-- 업무 유형(work_types)과 같은 방식이다.

create table if not exists card_accounts (
  name       text primary key,
  sort_order integer not null default 0
);

create table if not exists card_users (
  name       text primary key,
  sort_order integer not null default 0
);

-- 정산상태는 색과 '이 상태면 정산이 끝난 것으로 본다'를 함께 지닌다.
-- done = 1 인 상태만 요약의 '아직 승인되지 않음'에서 빠진다. 이 표시가 있어야
-- 새 상태를 마음대로 만들어도 앱이 끝난 것인지 아닌지 알 수 있다.
create table if not exists card_settles (
  name       text primary key,
  color      text not null default '회색',
  done       integer not null default 0,
  sort_order integer not null default 0
);

-- 되풀이되는 지출. 고르면 사용처·처리 계정·사용자가 함께 채워진다.
create table if not exists card_presets (
  id         text primary key,
  title      text not null,
  merchant   text,
  account    text,
  spender    text,
  sort_order integer not null default 0
);
