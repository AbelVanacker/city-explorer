# City Explorer MVP — Technical Specification

## DECISIONS LOCKED IN

- **Route import:** Manual GPX upload (add API later)
- **Street identification:** Auto-identify via Google Maps API
- **Regions:** Brussels' 19 communes + city-wide completion
  (this spec originally said 9; Brussels-Capital Region has 19, and all 19 are
  seeded — narrowing to a subset later is just deleting rows)
- **Architecture:** Supabase (Postgres + Auth) + React frontend
- **Hosting:** Vercel (frontend) + Supabase (backend/data)
- **Cost:** Free tier ($0/month for 2 users)

---

## TECH STACK

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React + TypeScript + Vite | Modern, maintainable, works on mobile |
| Maps | Google Maps API | Built-in street data, reverse geocoding |
| Auth | Supabase Auth | Multi-user, no backend auth code needed |
| Database | Supabase Postgres | Relational, SQL aggregation, real-time, free tier |
| Access control | Row Level Security | Per-user isolation enforced in the database |
| File handling | GPX parsing in browser | Upload → parse locally → process |
| Deployment | Vercel (frontend) | Free tier, automatic deploys |

---

## DATA MODEL

Postgres tables. Full DDL, indexes, RLS policies and the signup trigger live in
[`supabase/schema.sql`](./supabase/schema.sql) — run it once in the Supabase SQL Editor.

### `profiles`

Mirrors `auth.users`, created automatically by a signup trigger.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | FK → `auth.users` |
| `email` | text | |
| `display_name` | text | |
| `created_at` | timestamptz | |
| `preferences` | jsonb | `{ cityCenter: {lat, lng}, zoom }` |

### `runs`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid | FK → `auth.users` |
| `date` | timestamptz | |
| `distance` | numeric | km |
| `duration` | integer | seconds |
| `gps_coordinates` | jsonb | `[{ lat, lng, time }, …]` — raw track, not queried |
| `created_at` | timestamptz | |

### `run_streets`

One row per street touched by a run. This is the table that replaces Firestore's
nested `extractedStreets` array, and it is what makes coverage a SQL query
rather than a client-side loop.

| Column | Type | Notes |
|---|---|---|
| `id` | bigserial PK | |
| `run_id` | uuid | FK → `runs` |
| `user_id` | uuid | denormalised from `runs`, for RLS and coverage queries |
| `name` | text | street name |
| `commune_id` | text | FK → `communes` |
| `start_coord` | jsonb | `{ lat, lng }` |
| `end_coord` | jsonb | `{ lat, lng }` |

### `communes`

Reference data. Read-only to signed-in users; seeded via the service role.

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | slug, e.g. `ixelles` |
| `name` | text | e.g. `Ixelles` |
| `boundaries` | jsonb | GeoJSON polygon |

### `commune_streets`

Reference data — the denominator for coverage.

| Column | Type | Notes |
|---|---|---|
| `id` | bigserial PK | |
| `commune_id` | text | FK → `communes` |
| `name` | text | unique per commune |
| `coordinates` | jsonb | `[{ lat, lng }, …]` |

### Coverage: views, not a table

The original Firestore design needed a `userCoverage` document because Firestore
cannot aggregate. Postgres can, so coverage is two views that are always correct
by construction — there is nothing to recalculate and nothing to keep in sync:

- **`user_coverage_by_commune`** — `user_id, commune_id, commune_name, covered, total, percentage`
- **`user_coverage_citywide`** — `user_id, total_streets_covered, total_streets_in_city, percentage_covered`

Both are `security_invoker` views, so RLS on `run_streets` applies and each user
only ever sees their own numbers.

---

## CORE WORKFLOWS

### Workflow 1: User Uploads a Run

```
1. User clicks "Upload Run"
2. Selects GPX file from device
3. App parses GPX → extracts GPS coordinates + metadata
4. For each coordinate, reverse geocode with `google.maps.Geocoder`
   → returns street name + location
   (dedupe consecutive points on the same street before calling)
5. Insert into Supabase:
   - one `runs` row (raw GPS track + metadata)
   - one `run_streets` row per distinct street, with its commune
6. Display success → refresh map
   (no coverage recalculation step — the views handle it)
```

### Workflow 2: User Views Map

```
1. User logs in
2. App fetches their runs from `runs`
3. App fetches coverage from `user_coverage_by_commune`
   and `user_coverage_citywide`
4. Google Maps displays:
   - All runs as paths/lines
   - All covered streets highlighted (green or bold)
   - Completion bars per commune (color-coded)
   - City-wide completion %
5. User can:
   - Click a run → see details (date, distance, streets)
   - Click a commune → see % coverage for that area
   - Filter by date range (later feature)
```

### Workflow 3: Multi-User (You + Girlfriend)

```
1. Girlfriend signs up with Supabase Auth
2. A `profiles` row is created automatically by the signup trigger
3. RLS on `runs` and `run_streets` scopes every query to auth.uid()
   — no userId filtering needed in app code, and no way to leak data
4. Coverage views group by user_id, so stats are per-user for free
5. Option to add "friend view" later (relax RLS with a friendships table)
```

---

## GOOGLE MAPS API SETUP

### APIs Needed:

1. **Maps JavaScript API** — Display interactive map
2. **Geocoding API** — Reverse geocode GPS coords → street names
3. **Places API** (optional) — Search for streets/locations

### Reverse geocoding runs through the JS SDK, not REST

Use `google.maps.Geocoder` from the Maps JavaScript API. Do **not** call the
Geocoding REST endpoint (`maps.googleapis.com/maps/api/geocode/json`) from the
browser — it sends no CORS headers, so `fetch`/`axios` calls fail regardless of
key setup. The SDK's `Geocoder` returns the same results, bills against the same
Geocoding API quota, and works with a referrer-restricted key.

```ts
const geocoder = new google.maps.Geocoder();
const { results } = await geocoder.geocode({ location: { lat, lng } });
const street = results[0]?.address_components
  .find(c => c.types.includes('route'))?.long_name;
```

### API Key Setup:

- Create in Google Cloud Console
- Application restrictions → HTTP referrers: `http://localhost:3000/*` + the Vercel domain
- API restrictions → Maps JavaScript API **and** Geocoding API
- The key ships in the JS bundle and is publicly visible; referrer restriction is
  the only thing preventing someone else from spending your quota.
- Cost: First 28,000 calls/month free, then $0.005 per call
- Per run: ~50-100 coordinates = ~$0.00025-0.0005 per run
- Realistic monthly cost for 2 active users: $0-2/month

---

## SUPABASE SETUP

- Project URL and publishable key go in `.env.local` (see `.env.example`)
- The publishable key is safe to ship in the browser — RLS is what protects data,
  so **every table must have RLS enabled**. `schema.sql` does this.
- Free tier: 500 MB database, 50k monthly active users, unlimited API requests.
- Free projects pause after 7 days of no activity; opening the dashboard resumes them.

---

## UI/UX FLOW

### Pages Needed:

#### 1. **Login/Register Page**

- Email + password (Supabase Auth handles this)
- Sign in OR create account
- Redirect to Dashboard

#### 2. **Dashboard / Main Map**

- Large Google Map showing:
  - User's city (centered on Brussels)
  - All runs visualized as paths
  - Streets colored (green = covered, gray = not covered)
- Right sidebar with:
  - Completion stats (city-wide %)
  - Completion bars per commune (19 communes)
  - Total distance, total runs
- Top bar with:
  - "Upload Run" button
  - User profile (logout, settings)

#### 3. **Upload Run Page** (or modal)

- File input (GPX files)
- Show preview of route before processing
- "Confirm Upload" button
- Show processing status (uploading, geocoding, saving)
- Redirect back to map on success

#### 4. **Run Details Page** (optional)

- Click on a run → see:
  - Date, distance, duration
  - List of streets covered
  - Which communes
  - Visual of route on map

#### 5. **Commune Detail Page** (optional)

- Click on a commune bar → see:
  - % coverage
  - List of covered streets
  - List of uncovered streets
  - Visual of that area on map

---

## MVP SCOPE: What We Build First

### Phase 1: Core App (Must Have)

- [ ] Supabase project setup + run `schema.sql`
- [ ] React app with authentication (login/register)
- [ ] Google Maps integration + display
- [ ] GPX file upload & parsing
- [ ] GPS → street name extraction (Google Geocoding API)
- [ ] Store runs + run_streets in Supabase
- [ ] Read coverage from the views
- [ ] Display covered streets on map
- [ ] Show completion bars per commune

### Phase 2: Polish (Nice to Have)

- [ ] Run details view
- [ ] Commune detail view
- [ ] Better map styling (colors, heatmaps)
- [ ] Mobile responsiveness refinement
- [ ] Performance optimization

### Phase 3: Future (Skip for MVP)

- [ ] Strava/Garmin API integration
- [ ] Friend sharing / leaderboards
- [ ] Achievements/badges
- [ ] Historical data imports
- [ ] Advanced filters & analytics

---

## IMPLEMENTATION BREAKDOWN

### To Build:

**Frontend Components:**
1. `LoginPage` — Supabase Auth UI
2. `Dashboard` — Main map view
3. `UploadRunModal` — File upload interface
4. `MapComponent` — Google Maps wrapper with street visualization
5. `StatsBar` — Coverage stats + completion bars
6. `RunDetailsModal` — View details of a single run
7. `CommuneDetailsModal` — View details of a commune

**Services:**
1. `supabase.ts` — client, auth helpers, queries
2. `gpxParser.ts` — GPX parsing (browser-side)
3. `googleMaps.ts` — `google.maps.Geocoder` wrapper (batching, dedupe, retry)
4. Commune mapping logic (point-in-polygon against `communes.boundaries`)

**Data Setup:**
1. Brussels communes GeoJSON (download from OSM or government open data)
2. Brussels streets data (from OSM)
3. Seed script inserting both via the service role key (never in the browser)

---

## DEPENDENCIES & LIBRARIES

**Frontend:**
- `react` — UI framework
- `@react-google-maps/api` — Map integration
- `@supabase/supabase-js` — Auth + Postgres client
- `@tmcw/togeojson` — GPX parsing. Feed it a `Document` from the browser's native
  `DOMParser`. The older `togeojson` package is unmaintained and pulls in `xmldom`,
  which has open critical CVEs — relevant here because GPX files are untrusted input.
- `tailwindcss` — Styling

**Backend (Supabase, all managed):**
- Postgres + PostgREST (built-in)
- Supabase Auth (built-in)

---

## ENVIRONMENT VARIABLES NEEDED

```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
VITE_GOOGLE_MAPS_API_KEY=xxx
```

Vite only exposes vars prefixed `VITE_` to the browser bundle.

The service role key is **not** listed here on purpose — it bypasses RLS and must
never reach the browser. Keep it out of the repo; use it only in local seed scripts.

---

## ESTIMATED COMPLEXITY

| Task | Complexity | Time (Estimate) |
|------|-----------|-----------------|
| Supabase setup + auth | Low | 1-2 hours |
| Google Maps basic map | Low | 1-2 hours |
| GPX parsing + geocoding | Medium | 3-4 hours |
| Schema + queries | Low | 1-2 hours |
| Commune/street seed data | Medium | 2-3 hours |
| UI components + styling | Medium | 4-6 hours |
| Testing + refinement | Low | 2-3 hours |
| **Total** | **Medium** | **~14-22 hours of work** |

---

## NEXT STEPS

1. **Supabase project** — created ✅
   - Run `supabase/schema.sql` in the SQL Editor
   - Enable Email auth (Authentication → Providers)

2. **Get Google Maps API key**
   - Google Cloud Console → create API key
   - Enable: Maps JavaScript API, Geocoding API
   - Add to `.env.local`

3. **Install and run**
   - `npm install`
   - `npm run dev`

4. **Build order**
   - Auth (login/register)
   - Map component
   - GPX upload + geocoding
   - Coverage display

5. **Download Brussels data**
   - Commune boundaries (GeoJSON)
   - Street names per commune
   - Seed into `communes` / `commune_streets`

---

## SUCCESS CRITERIA (For MVP)

✅ You can log in with email/password  
✅ You can upload a GPX file  
✅ Streets are automatically extracted and identified  
✅ Map shows all your runs + covered streets  
✅ Completion % is calculated per commune  
✅ Girlfriend can create her own account + see her own map  
✅ You can both access from phone and laptop  
✅ App is deployed (accessible via URL)  

If all 8 are true, MVP is done.
