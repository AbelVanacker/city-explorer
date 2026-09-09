-- The 19 communes of the Brussels-Capital Region.
-- Boundary polygons are NOT stored here: they are only needed client-side for
-- point-in-polygon during upload, so they ship in the app bundle instead
-- (src/data/communes.json, from OpenStreetMap via Nominatim, ODbL).
-- Safe to re-run.

alter table public.communes alter column boundaries drop not null;

insert into public.communes (id, name) values
  ('anderlecht', 'Anderlecht'),
  ('auderghem', 'Auderghem'),
  ('berchem-sainte-agathe', 'Berchem-Sainte-Agathe'),
  ('bruxelles', 'Bruxelles'),
  ('etterbeek', 'Etterbeek'),
  ('evere', 'Evere'),
  ('forest', 'Forest'),
  ('ganshoren', 'Ganshoren'),
  ('ixelles', 'Ixelles'),
  ('jette', 'Jette'),
  ('koekelberg', 'Koekelberg'),
  ('molenbeek-saint-jean', 'Molenbeek-Saint-Jean'),
  ('saint-gilles', 'Saint-Gilles'),
  ('saint-josse-ten-noode', 'Saint-Josse-ten-Noode'),
  ('schaerbeek', 'Schaerbeek'),
  ('uccle', 'Uccle'),
  ('watermael-boitsfort', 'Watermael-Boitsfort'),
  ('woluwe-saint-lambert', 'Woluwe-Saint-Lambert'),
  ('woluwe-saint-pierre', 'Woluwe-Saint-Pierre')
on conflict (id) do update set name = excluded.name;
