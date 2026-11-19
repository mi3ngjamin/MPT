-- One net-worth snapshot per user per calendar day.
-- The client upserts today's row on load. Earlier rows are the trend.

create unique index if not exists net_worth_snapshots_user_day_uniq
  on public.net_worth_snapshots (user_id, snapshot_date);
