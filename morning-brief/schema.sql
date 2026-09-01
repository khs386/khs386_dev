-- 모닝브리프 업무관리 앱 (소규모 팀용)
-- Supabase 대시보드 → SQL Editor에서 아래 전체를 실행하세요

-- 팀원 프로필 (가입 시 자동 생성됨)
create table profiles (
  user_id uuid primary key references auth.users on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

-- 프로젝트 (2단계에서 사용 예정, 테이블만 미리 준비)
create table projects (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  color text,
  created_by uuid not null default auth.uid() references auth.users,
  created_at timestamptz default now()
);

-- 업무 (팀 전체 공유, 담당자 배정 가능)
create table tasks (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo','doing','done','hold')),
  priority int not null default 2 check (priority between 1 and 3), -- 1 높음 / 2 보통 / 3 낮음
  due_date date,
  assignee_id uuid references auth.users on delete set null,
  created_by uuid not null default auth.uid() references auth.users,
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- 모닝브리프 (사용자별, 하루 1건)
create table briefs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  brief_date date not null,
  content jsonb not null,
  created_at timestamptz default now(),
  unique (user_id, brief_date)
);

alter table profiles enable row level security;
alter table projects enable row level security;
alter table tasks enable row level security;
alter table briefs enable row level security;

-- 로그인한 팀원은 프로필·프로젝트·업무를 함께 보고 편집합니다
create policy "team read profiles" on profiles
  for select to authenticated using (true);
create policy "own profile insert" on profiles
  for insert to authenticated with check (user_id = auth.uid());
create policy "own profile update" on profiles
  for update to authenticated using (user_id = auth.uid());

create policy "team projects" on projects
  for all to authenticated using (true) with check (true);
create policy "team tasks" on tasks
  for all to authenticated using (true) with check (true);

-- 브리프는 본인 것만
create policy "own briefs" on briefs
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
