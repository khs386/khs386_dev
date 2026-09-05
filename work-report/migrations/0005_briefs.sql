-- 모닝브리프를 담는 자리. 하루에 한 건이고, 다시 보내면 덮어쓴다.
-- html 은 브리프 페이지 통째로 (외부 링크·CDN 없는 한 장짜리 문서).
create table if not exists briefs (
  brief_date text primary key,
  html       text not null,
  events     integer,
  todo       integer,
  done       integer,
  headline   text,
  source     text,
  created_at text not null default (datetime('now'))
);
