-- 개발 단계를 시리즈마다 따로 갖게 한다.
--
-- 0004에서는 단계를 series_progress의 열로 두었다(plan, topic, art…). 열은 화면에서
-- 늘리고 줄일 수 없어서, 시리즈마다 다른 단계를 쓸 수가 없었다. 값을 열에서 줄로
-- 옮긴다.
--
-- 옛 열은 지우지 않는다. SQLite에서 열을 지우는 것은 위험하고, 옮긴 값이 맞는지
-- 견줄 원본이 남아 있는 편이 낫다. 며칠 돌려 보고 정리한다.

-- 새로 만드는 시리즈가 물려받을 본. 이것을 고쳐도 이미 있는 시리즈는 바뀌지 않는다.
create table if not exists stage_presets (
  key        text primary key,
  label      text not null,
  weight     integer not null default 0,
  sort_order integer not null default 0
);

-- 시리즈가 실제로 쓰는 단계. 이름도 몫도 시리즈마다 따로다.
-- value는 그 단계의 진행률(0~100), 비워 두면 아직 손대지 않은 것이다.
create table if not exists series_stages (
  series_name text not null,
  key         text not null,
  label       text not null,
  weight      integer not null default 0,
  value       integer,
  sort_order  integer not null default 0,
  primary key (series_name, key)
);

create index if not exists series_stages_order_idx
  on series_stages (series_name, sort_order);
