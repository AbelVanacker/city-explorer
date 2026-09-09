import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import type { CitywideCoverage, CommuneCoverage, Run } from '../types';
import MapComponent from './MapComponent';
import StatsBar from './StatsBar';
import UploadRunModal from './UploadRunModal';

export default function Dashboard() {
  const { session, signOut } = useAuth();
  const userId = session?.user.id;

  const [runs, setRuns] = useState<Run[]>([]);
  const [citywide, setCitywide] = useState<CitywideCoverage | null>(null);
  const [communes, setCommunes] = useState<CommuneCoverage[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [runsRes, cityRes, communeRes] = await Promise.all([
      supabase
        .from('runs')
        .select('*, run_streets(count)')
        .order('date', { ascending: false }),
      supabase.from('user_coverage_citywide').select('*').maybeSingle(),
      supabase.from('user_coverage_by_commune').select('*').order('commune_name'),
    ]);

    const failure = runsRes.error ?? cityRes.error ?? communeRes.error;
    if (failure) {
      setError(failure.message);
      setLoading(false);
      return;
    }

    setError(null);
    setRuns(
      (runsRes.data ?? []).map((r) => ({
        id: r.id,
        userId: r.user_id,
        name: r.name ?? null,
        date: r.date,
        distance: Number(r.distance),
        duration: r.duration,
        gpsCoordinates: r.gps_coordinates ?? [],
        createdAt: r.created_at,
        streetCount: r.run_streets?.[0]?.count ?? 0,
      }))
    );

    setCitywide(
      cityRes.data
        ? {
            userId: cityRes.data.user_id,
            totalStreetsCovered: cityRes.data.total_streets_covered,
            totalStreetsInCity: cityRes.data.total_streets_in_city,
            percentageCovered: Number(cityRes.data.percentage_covered ?? 0),
          }
        : null
    );

    setCommunes(
      (communeRes.data ?? []).map((c) => ({
        userId: c.user_id,
        communeId: c.commune_id,
        communeName: c.commune_name,
        covered: c.covered,
        total: c.total,
        percentage: Number(c.percentage ?? 0),
      }))
    );

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 md:px-6">
        <h1 className="shrink-0 font-semibold text-slate-900">City Explorer</h1>
        <div className="flex min-w-0 items-center gap-3 text-sm md:gap-4">
          <button
            onClick={() => setUploadOpen(true)}
            className="shrink-0 whitespace-nowrap rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-800"
          >
            Upload<span className="hidden sm:inline"> run</span>
          </button>
          <span className="hidden truncate text-slate-500 lg:inline">
            {session?.user.email}
          </span>
          <button
            onClick={signOut}
            className="shrink-0 whitespace-nowrap text-slate-900 hover:underline"
          >
            Sign out
          </button>
        </div>
      </header>

      {error && (
        <p className="shrink-0 bg-red-50 px-6 py-2 text-sm text-red-700">
          Could not load your data: {error}
        </p>
      )}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <main className="relative h-[45vh] min-h-0 shrink-0 md:h-auto md:min-w-0 md:flex-1 md:shrink">
          <MapComponent
            runs={runs}
            selectedRunId={selectedRunId}
            onSelectRun={setSelectedRunId}
          />
          {!loading && runs.length === 0 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
              <p className="rounded-full bg-white/95 px-4 py-2 text-sm text-slate-600 shadow-sm">
                No runs yet — upload a GPX file to see your routes here.
              </p>
            </div>
          )}
        </main>
        <StatsBar
          runs={runs}
          citywide={citywide}
          communes={communes}
          selectedRunId={selectedRunId}
          onSelectRun={setSelectedRunId}
          onRunDeleted={load}
        />
      </div>

      {uploadOpen && userId && (
        <UploadRunModal
          userId={userId}
          onClose={() => setUploadOpen(false)}
          onUploaded={() => {
            setUploadOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}
