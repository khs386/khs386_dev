-- 0004에서 열로 넣어 둔 단계 진행률을 줄로 옮긴다.
--
-- 시리즈 하나마다 기본 목록 열 줄이 생기고, 값은 옛 열에서 가져온다. 아직 손대지
-- 않은 단계는 null 그대로 옮겨진다 — 0으로 채우면 '안 한 것'과 '0%'가 구별되지
-- 않는다.
--
-- 열쇠가 (series_name, key)라 여러 번 돌려도 같은 줄이 두 번 생기지 않는다.
-- 옮긴 뒤에는 세 시리즈가 79 / 40 / 62를 그대로 내는지 반드시 세어 확인한다.
insert or ignore into series_stages (series_name, key, label, weight, value, sort_order)
select s.name, p.key, p.label, p.weight,
       case p.key
         when 'plan'         then s.plan
         when 'topic'        then s.topic
         when 'volume'       then s.volume
         when 'text'         then s.text
         when 'art'          then s.art
         when 'appendix'     then s.appendix
         when 'appendix_art' then s.appendix_art
         when 'audio'        then s.audio
         when 'review'       then s.review
         when 'saypen'       then s.saypen
       end,
       p.sort_order
  from series_progress s
 cross join stage_presets p;
