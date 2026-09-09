# City Explorer MVP — Claude Code Setup

## Project Status

**Phase:** Setup & Planning  
**MVP Target:** ~14-22 hours of work

This is a street coverage tracking app for Brussels runners. Users upload GPX files, the app auto-identifies streets via Google Maps, and displays coverage statistics per commune.

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Maps:** Google Maps API (Maps JS + `google.maps.Geocoder`)
- **Backend:** Supabase (Postgres + Auth + Row Level Security)
- **Hosting:** Vercel (frontend) + Supabase (data/auth)
- **Styling:** Tailwind CSS

## Build & Development Commands

```bash
# Install dependencies
npm install

# Development server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Type check only
npm run typecheck
```

## Project Structure

```
src/
├── components/          # React UI components
│   ├── LoginPage.tsx   # Auth page (done)
│   ├── Dashboard.tsx   # Main map view
│   ├── MapComponent.tsx # Google Maps wrapper
│   ├── UploadRunModal.tsx
│   ├── StatsBar.tsx    # Commune coverage stats
│   ├── RunDetailsModal.tsx
│   └── CommuneDetailsModal.tsx
├── context/
│   └── AuthContext.tsx # Session state + signIn/signUp/signOut (done)
├── services/           # API & data logic
│   ├── supabase.ts     # Supabase client (done)
│   ├── googleMaps.ts   # google.maps.Geocoder wrapper
│   └── gpxParser.ts    # GPX file parsing
├── types/              # TypeScript interfaces (done)
├── utils/              # Helper functions
├── App.tsx             # Routes between login and dashboard (done)
└── main.tsx            # React entry point (done)

supabase/
├── schema.sql          # Tables, views, RLS policies, signup trigger
└── seed_communes.sql   # 19 Brussels commune boundaries (OSM/Nominatim, ODbL)
```

## High-Level Architecture

1. **Authentication:** Supabase Auth (email/password)
2. **Data Storage:** Postgres — `profiles`, `runs`, `run_streets`, `communes`, `commune_streets`
3. **Access control:** RLS scopes every query to `auth.uid()`. App code does not filter by user id.
4. **Coverage:** computed by the `user_coverage_by_commune` and `user_coverage_citywide` views — never stored, never recalculated
5. **Maps:** Google Maps JavaScript API for visualization
6. **GPX Processing:** Browser-side parsing + reverse geocoding via Google API

## Conventions

- Never put the Supabase **service role key** in `src/` or any `VITE_*` var — Vite inlines those into the bundle, and it bypasses RLS. Browser code uses the publishable key only.
- New tables need `enable row level security` plus a policy, or they are unreadable (and if RLS is left off, world-readable).
- Read coverage from the views; do not add a denormalised coverage table.
- Brussels-Capital Region has **19** communes. The original spec said 9; that was wrong.
- `runs` has a unique constraint on `(user_id, date)` — a run's start time is its identity. Insert errors with code `23505` mean "already uploaded", not a real failure.
- Reverse geocode with `google.maps.Geocoder`, never the Geocoding REST endpoint — it has no CORS headers and fails from the browser.
- **Street identity is bilingual.** Brussels streets have a French and a Dutch name and Google returns either, even with `language: 'fr'` pinned. Never count `distinct run_streets.name` directly — join to `commune_streets` on `name` / `name_fr` / `name_nl` / `name_osm` so both spellings resolve to one row. `place_id` does NOT work for this: Google issues one per road segment (56 ids for 19 streets on a single 6 km run).
- Parse GPX with `@tmcw/togeojson` + the browser's native `DOMParser`. Do not reinstate `togeojson`/`xmldom` (critical CVEs, and GPX is untrusted input).
- Keep `resolve.dedupe: ['react', 'react-dom']` in `vite.config.ts`. Without it Vite pre-bundles a second React for `@react-google-maps/api` and every map hook throws "Invalid hook call".

## Development Priorities (MVP Phase 1)

1. Run `supabase/schema.sql` in the Supabase SQL Editor
2. ~~Authentication (login/register)~~ — written, not yet run
3. Google Maps basic display
4. GPX upload & parsing
5. Reverse geocoding (GPS coords → street names)
6. Insert runs + run_streets
7. UI components (Dashboard, StatsBar, modals)

## Environment Setup

`.env.local` holds the live Supabase credentials (gitignored). `.env.example` documents
the shape. Google Maps key is still blank — add it before touching geocoding or the map.

## Key Resources

- [Full Specification](./SPECIFICATION.md)
- [Supabase Dashboard](https://supabase.com/dashboard/project/cypqfapxgsbusqujsdzh)
- [Google Cloud Console](https://console.cloud.google.com)
- [React Google Maps Docs](https://react-google-maps-api-docs.vercel.app/)

## Success Metrics (MVP)

✅ Email/password login works  
✅ GPX file upload works  
✅ Streets auto-identified from coordinates  
✅ Map displays runs + covered streets  
✅ Coverage % shown per commune  
✅ Multi-user support (separate accounts)  
✅ Accessible on mobile & desktop  
✅ Deployed to public URL  
