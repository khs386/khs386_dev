-- 업무보고서 앱 (일일 + 주간)
-- morning-brief와는 별도의 Supabase 프로젝트에서 실행하세요.
-- Supabase 대시보드 → SQL Editor에 아래 전체를 붙여넣고 실행합니다.

-- ── 단위 업무 마스터 ───────────────────────────────────────────
create table tasks (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  series text,                       -- 꼬마생각뒤집기 / 꼬마역사뒤집기 / 꼬마 일력 / 기타
  work_type text,                    -- 업무 유형 (예: 꼬마시리즈 개발)
  priority text not null default '중간' check (priority in ('높음','중간','낮음')),
  status text not null default '예정' check (status in ('예정','시작','진행','완료','보류')),
  progress int check (progress between 0 and 100),
  deadline date,
  is_misc boolean not null default false,   -- "기타 사항" — 요약 카드 집계에서 제외
  archived boolean not null default false,
  created_at timestamptz default now()
);

-- ── 일별 업무 진행 내역 ────────────────────────────────────────
-- 하루치 보고서 = log_date가 그 날인 행 전체. 날짜가 컬럼이라 필터가 어긋나지 않는다.
create table daily_logs (
  id uuid default gen_random_uuid() primary key,
  log_date date not null,
  task_id uuid references tasks(id) on delete cascade,
  title text not null,               -- 기록 시점 업무명 스냅샷
  detail_lines text[] not null default '{}',
  status text not null default '진행',
  priority text not null default '중간',
  progress int check (progress between 0 and 100),
  deadline date,
  is_misc boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz default now(),
  unique (log_date, task_id)
);
create index daily_logs_date_idx on daily_logs (log_date);

-- ── 주간업무 현황 ──────────────────────────────────────────────
create table weekly_items (
  id uuid default gen_random_uuid() primary key,
  week_start date not null,          -- 해당 주 월요일
  kind text not null check (kind in ('전주 실적','금주 예정')),
  task_id uuid references tasks(id) on delete set null,
  title text not null,
  work_type text,
  status text,
  progress int check (progress between 0 and 100),
  due_date date,
  note text,
  output text,
  sort_order int not null default 0,
  created_at timestamptz default now()
);
create index weekly_items_week_idx on weekly_items (week_start, kind);

-- ── 시리즈별 개발 현황 (총 진행률은 직접 입력) ─────────────────
create table series_progress (
  name text primary key,
  total_progress int not null default 0 check (total_progress between 0 and 100),
  sort_order int not null default 0,
  updated_at timestamptz default now()
);

insert into series_progress (name, total_progress, sort_order) values
  ('꼬마생각뒤집기', 0, 1),
  ('꼬마역사뒤집기', 0, 2),
  ('꼬마 일력', 0, 3);

-- ── 생성된 보고서 이력 ─────────────────────────────────────────
create table reports (
  id uuid default gen_random_uuid() primary key,
  kind text not null check (kind in ('daily','weekly')),
  report_date date not null,
  filename text not null,
  html text not null,
  drive_file_id text,                -- 구글 드라이브 업로드 결과
  drive_link text,
  created_at timestamptz default now(),
  unique (kind, report_date)
);

-- ── 앱 설정 (한 행만 사용) ─────────────────────────────────────
create table settings (
  id int primary key default 1 check (id = 1),
  author text not null default '초등콘텐츠사업부 권호상',
  short_author text not null default '권호상',
  footer text not null default '이 보고서는 Notion 업무 관리 데이터를 기반으로 자동 생성되었습니다.',
  holidays text[] not null default array[
    '01-01','01-28','01-29','01-30','03-01','05-05','05-25','06-06','08-15',
    '09-25','09-26','09-27','10-03','10-09','12-25'
  ],
  updated_at timestamptz default now()
);
insert into settings (id) values (1);

-- ── 접근 제어: 로그인한 사용자만 읽고 쓴다 ─────────────────────
alter table tasks enable row level security;
alter table daily_logs enable row level security;
alter table weekly_items enable row level security;
alter table series_progress enable row level security;
alter table reports enable row level security;
alter table settings enable row level security;

create policy "auth tasks" on tasks for all to authenticated using (true) with check (true);
create policy "auth daily_logs" on daily_logs for all to authenticated using (true) with check (true);
create policy "auth weekly_items" on weekly_items for all to authenticated using (true) with check (true);
create policy "auth series_progress" on series_progress for all to authenticated using (true) with check (true);
create policy "auth reports" on reports for all to authenticated using (true) with check (true);
create policy "auth settings" on settings for all to authenticated using (true) with check (true);
