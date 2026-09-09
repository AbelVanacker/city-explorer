# City Explorer MVP

A web app to track which streets you've covered while running in Brussels. Upload your GPX runs and automatically identify the streets you've run on using Google Maps.

## Quick Links

- **Specification:** See [SPECIFICATION.md](./SPECIFICATION.md)
- **Database schema:** See [supabase/schema.sql](./supabase/schema.sql)
- **Architecture:** Supabase (Postgres + Auth) + React + Google Maps API
- **Deployment:** Vercel (frontend) + Supabase (backend)
- **Cost:** Free tier ($0/month for 2 users)

## Getting Started

### Prerequisites

- Node.js 18+ and npm — [nodejs.org](https://nodejs.org)
- Supabase account
- Google Cloud Console account (for Maps API)

### Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up the database**

   In the Supabase dashboard → SQL Editor → New query, run
   [`supabase/schema.sql`](./supabase/schema.sql), then
   [`supabase/seed_communes.sql`](./supabase/seed_communes.sql) for the 19 communes.

   Then load the coverage denominator: Table Editor → `commune_streets` → Insert →
   Import data from CSV → upload [`supabase/commune_streets.csv`](./supabase/commune_streets.csv).
   Without it every percentage reads 0%.

   Finally, enable the Email provider under Authentication → Providers.

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Fill in your Supabase URL + publishable key and your Google Maps API key.

4. **Start development server**
   ```bash
   npm run dev
   ```
   App will open at http://localhost:3000

## Project Structure

```
city-explorer/
├── index.html              # Vite entry document
├── src/
│   ├── components/        # React components
│   │   ├── LoginPage.tsx
│   │   ├── Dashboard.tsx
│   │   ├── MapComponent.tsx
│   │   ├── UploadRunModal.tsx
│   │   ├── StatsBar.tsx
│   │   └── ...
│   ├── context/
│   │   └── AuthContext.tsx # Session state
│   ├── services/          # API integrations
│   │   ├── supabase.ts    # Supabase client
│   │   ├── googleMaps.ts  # google.maps.Geocoder wrapper
│   │   └── gpxParser.ts   # GPX file parsing
│   ├── types/             # TypeScript types
│   ├── utils/             # Utilities
│   ├── App.tsx            # Main app component
│   └── main.tsx           # Entry point
├── supabase/
│   └── schema.sql         # Tables, views, RLS policies
├── vite.config.ts
├── package.json
└── README.md
```

## Data Model

| Table | Purpose |
|---|---|
| `profiles` | User profile, created on signup by a trigger |
| `runs` | One row per uploaded GPX, with the raw track as jsonb |
| `run_streets` | One row per street touched by a run |
| `communes` | Brussels commune boundaries (reference data) |
| `commune_streets` | Streets per commune — the coverage denominator |

Coverage is not stored. Two views compute it on read:
`user_coverage_by_commune` and `user_coverage_citywide`.

Row Level Security scopes every query to the signed-in user, so the app never
filters by user id and one account can't see another's runs.

## MVP Scope

### Phase 1: Core App (Must Have)
- [ ] Supabase project setup + run `schema.sql`
- [x] React app with authentication (login/register) — written, untested
- [ ] Google Maps integration + display
- [ ] GPX file upload & parsing
- [ ] GPS → street name extraction (Google Geocoding API)
- [ ] Store runs in Supabase
- [ ] Read coverage from the views
- [ ] Display covered streets on map
- [ ] Show completion bars per commune

### Phase 2: Polish (Nice to Have)
- [ ] Run details view
- [ ] Commune detail view
- [ ] Better map styling (colors, heatmaps)
- [ ] Mobile responsiveness refinement

### Phase 3: Future (Skip for MVP)
- [ ] Strava/Garmin API integration
- [ ] Friend sharing / leaderboards
- [ ] Achievements/badges
- [ ] Advanced filters & analytics

## Success Criteria

✅ You can log in with email/password  
✅ You can upload a GPX file  
✅ Streets are automatically extracted and identified  
✅ Map shows all your runs + covered streets  
✅ Completion % is calculated per commune  
✅ Girlfriend can create her own account + see her own map  
✅ You can both access from phone and laptop  
✅ App is deployed (accessible via URL)  

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React + TypeScript + Vite | Modern, maintainable, mobile-friendly |
| Maps | Google Maps API | Built-in street data, reverse geocoding |
| Auth | Supabase Auth | Multi-user, no backend auth code needed |
| Database | Supabase Postgres | Relational, SQL aggregation, real-time, free tier |
| File handling | GPX parsing in browser | Upload → parse locally → process |
| Deployment | Vercel (frontend) | Free tier, automatic deploys |

## Next Steps

1. Run `supabase/schema.sql` in the Supabase SQL Editor
2. Get a Google Maps API key from [Google Cloud Console](https://console.cloud.google.com)
3. Add it to `.env.local`
4. Run `npm install` and `npm run dev`
5. Start building components following the specification

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Google Maps API Documentation](https://developers.google.com/maps/documentation)
- [React Documentation](https://react.dev)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
