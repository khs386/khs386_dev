-- 업무보고서 앱 — D1(SQLite) 스키마
--   원격 적용: npm run db:init
--   로컬 적용: npm run db:init:local
--
-- SQLite에는 배열·불리언·타임스탬프 타입이 따로 없어서 아래처럼 담는다.
--   배열   → JSON 문자열 (detail_lines)
--   불리언 → 0 / 1
--   날짜   → 'YYYY-MM-DD' 문자열, 시각은 ISO 문자열

create table if not exists tasks (
  id          text primary key,
  title       text not null,
  series      text,
  work_type   text,
  priority    text not null default '중간',
  status      text not null default '예정',
  progress    integer,
  deadline    text,
  is_misc     integer not null default 0,
  archived    integer not null default 0,
  created_at  text not null default (datetime('now'))
);

create table if not exists daily_logs (
  id           text primary key,
  log_date     text not null,
  task_id      text references tasks(id) on delete cascade,
  title        text not null,
  detail_lines text not null default '[]',
  status       text not null default '진행',
  priority     text not null default '중간',
  progress     integer,
  deadline     text,
  is_misc      integer not null default 0,
  sort_order   integer not null default 0,
  created_at   text not null default (datetime('now'))
);
create index if not exists daily_logs_date_idx on daily_logs (log_date, sort_order);

create table if not exists weekly_items (
  id          text primary key,
  week_start  text not null,
  kind        text not null,
  task_id     text references tasks(id) on delete set null,
  title       text not null,
  work_type   text,
  status      text,
  progress    integer,
  due_date    text,
  note        text default '',
  output      text default '',
  sort_order  integer not null default 0,
  created_at  text not null default (datetime('now'))
);
create index if not exists weekly_items_week_idx on weekly_items (week_start, kind, sort_order);

create table if not exists series_progress (
  name           text primary key,
  total_progress integer not null default 0,
  sort_order     integer not null default 0,
  updated_at     text
);

insert or ignore into series_progress (name, total_progress, sort_order) values
  ('꼬마생각뒤집기', 0, 1),
  ('꼬마역사뒤집기', 0, 2),
  ('꼬마 일력',      0, 3);

create table if not exists reports (
  id            text primary key,
  kind          text not null,
  report_date   text not null,
  filename      text not null,
  html          text not null,
  drive_file_id text,
  drive_link    text,
  created_at    text not null default (datetime('now'))
);
create unique index if not exists reports_kind_date_idx on reports (kind, report_date);

create table if not exists settings (
  id         integer primary key check (id = 1),
  footer     text not null default '이 보고서는 업무 관리 데이터를 기반으로 자동 생성되었습니다.',
  holidays   text not null default '["01-01","01-28","01-29","01-30","03-01","05-05","05-25","06-06","08-15","09-25","09-26","09-27","10-03","10-09","12-25"]',
  updated_at text
);
insert or ignore into settings (id) values (1);
