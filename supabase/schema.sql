-- City Explorer schema
-- Run in the Supabase SQL Editor (Dashboard > SQL Editor > New query).

-- ---------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now(),
  preferences jsonb not null default
    '{"cityCenter": {"lat": 50.8467, "lng": 4.3525}, "zoom": 12}'::jsonb
);

create table public.communes (
  id text primary key,
  name text not null,
  -- Nullable: boundary polygons ship in the app bundle (src/data/communes.json)
  -- because point-in-polygon runs client-side during upload, not in SQL.
  boundaries jsonb
);

-- The coverage denominator, imported from OpenStreetMap (see commune_streets.csv).
-- Brussels streets are bilingual, so both language names are kept: Google returns
-- either one, and matching on a single name silently double-counts.
create table public.commune_streets (
  id bigserial primary key,
  commune_id text not null references public.communes on delete cascade,
  name text not null,      -- canonical: the French name where OSM has one
  name_fr text,
  name_nl text,
  name_osm text,           -- OSM's combined "Avenue X - Xlaan" form
  coordinates jsonb,       -- unused by coverage; kept for later map rendering
  unique (commune_id, name)
);

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text,
  date timestamptz not null,
  distance numeric(6, 2) not null,
  duration integer not null,
  gps_coordinates jsonb not null,
  created_at timestamptz not null default now(),
  -- A run's start time is its identity: re-uploading the same GPX would
  -- otherwise silently double the user's distance.
  constraint runs_user_date_unique unique (user_id, date)
);

-- One row per street touched by a run. user_id is denormalised from runs so
-- coverage queries and RLS checks never need the join.
create table public.run_streets (
  id bigserial primary key,
  run_id uuid not null references public.runs on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  -- Reference only. Google issues a place_id per road SEGMENT, so it is not a
  -- street identity: one 6 km run produced 56 place_ids across 19 streets.
  -- Counting is done on name, which over-counts where Google returns the Dutch
  -- name for a street it usually names in French. Fixing that properly needs
  -- the OSM name:fr / name:nl pairs that commune_streets will carry.
  place_id text,
  name text not null,
  commune_id text references public.communes on delete set null,
  start_coord jsonb,
  end_coord jsonb
);

create index runs_user_id_date_idx on public.runs (user_id, date desc);
create index run_streets_user_commune_idx on public.run_streets (user_id, commune_id);
create index commune_streets_commune_idx on public.commune_streets (commune_id);
create index commune_streets_name_idx    on public.commune_streets (name);
create index commune_streets_name_fr_idx on public.commune_streets (name_fr);
create index commune_streets_name_nl_idx on public.commune_streets (name_nl);
create index run_streets_name_idx        on public.run_streets (name);

-- ---------------------------------------------------------------
-- Coverage views
-- ---------------------------------------------------------------

-- Coverage counts matched commune_streets rows, not raw run_streets names, so a
-- street the user ran under its Dutch name and its French name counts once.
create view public.user_coverage_by_commune
with (security_invoker = true) as
select
  rs.user_id,
  c.id   as commune_id,
  c.name as commune_name,
  count(distinct cs.id) as covered,
  tot.total,
  round(count(distinct cs.id) * 100.0 / nullif(tot.total, 0), 1) as percentage
from public.communes c
cross join lateral (
  select count(*) as total
  from public.commune_streets
  where commune_id = c.id
) tot
join public.run_streets rs on rs.commune_id = c.id
join public.commune_streets cs
  on cs.commune_id = c.id
 and rs.name in (cs.name, cs.name_fr, cs.name_nl, cs.name_osm)
group by rs.user_id, c.id, c.name, tot.total;

create view public.user_coverage_citywide
with (security_invoker = true) as
select
  rs.user_id,
  count(distinct cs.id) as total_streets_covered,
  (select count(*) from public.commune_streets) as total_streets_in_city,
  round(
    count(distinct cs.id) * 100.0
      / nullif((select count(*) from public.commune_streets), 0),
    1
  ) as percentage_covered
from public.run_streets rs
join public.commune_streets cs
  on cs.commune_id = rs.commune_id
 and rs.name in (cs.name, cs.name_fr, cs.name_nl, cs.name_osm)
group by rs.user_id;

-- ---------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------

alter table public.profiles        enable row level security;
alter table public.runs            enable row level security;
alter table public.run_streets     enable row level security;
alter table public.communes        enable row level security;
alter table public.commune_streets enable row level security;

create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own runs" on public.runs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own run streets" on public.run_streets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Reference data: readable by any signed-in user, writable only via the
-- service role (seed scripts), which bypasses RLS.
create policy "read communes" on public.communes
  for select to authenticated using (true);

create policy "read commune streets" on public.commune_streets
  for select to authenticated using (true);

-- ---------------------------------------------------------------
-- Create a profile row whenever someone signs up
-- ---------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
