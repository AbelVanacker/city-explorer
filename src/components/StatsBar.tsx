import type { CitywideCoverage, CommuneCoverage, Run } from '../types';
import RunList from './RunList';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-xl font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

export default function StatsBar({
  runs,
  citywide,
  communes,
  selectedRunId,
  onSelectRun,
  onRunDeleted,
}: {
  runs: Run[];
  citywide: CitywideCoverage | null;
  communes: CommuneCoverage[];
  selectedRunId: string | null;
  onSelectRun: (id: string | null) => void;
  onRunDeleted: () => void;
}) {
  const totalDistance = runs.reduce((sum, run) => sum + run.distance, 0);
  const citywidePct = citywide?.percentageCovered ?? 0;
  // commune_streets is the denominator; until it is seeded there is no
  // percentage to show, only a count of what has been run.
  const hasDenominator = (citywide?.totalStreetsInCity ?? 0) > 0;

  return (
    <aside className="flex w-full min-h-0 flex-1 flex-col gap-6 overflow-y-auto border-t border-slate-200 bg-white p-5 md:w-80 md:flex-none md:shrink-0 md:border-l md:border-t-0">
      <section>
        <h2 className="text-sm font-semibold text-slate-900">City-wide</h2>
        {hasDenominator ? (
          <>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-semibold text-slate-900">
                {citywidePct.toFixed(1)}%
              </span>
              <span className="text-sm text-slate-500">covered</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-emerald-600"
                style={{ width: `${Math.min(citywidePct, 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {citywide!.totalStreetsCovered.toLocaleString()} of{' '}
              {citywide!.totalStreetsInCity.toLocaleString()} streets
            </p>
          </>
        ) : (
          <>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-semibold text-slate-900">
                {(citywide?.totalStreetsCovered ?? 0).toLocaleString()}
              </span>
              <span className="text-sm text-slate-500">streets run</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              No percentage yet — that needs the total street count per commune,
              which isn’t loaded.
            </p>
          </>
        )}
      </section>

      <dl className="grid grid-cols-2 gap-4 border-y border-slate-200 py-4">
        <Stat label="Runs" value={String(runs.length)} />
        <Stat label="Distance" value={`${totalDistance.toFixed(1)} km`} />
      </dl>

      <section>
        <h2 className="text-sm font-semibold text-slate-900">By commune</h2>
        {communes.length === 0 ? (
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            No commune data yet. The <code>communes</code> and{' '}
            <code>commune_streets</code> tables need to be seeded with Brussels
            boundaries and street lists before coverage can be calculated.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {communes.map((c) => (
              <li key={c.communeId}>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-700">{c.communeName}</span>
                  <span className="tabular-nums text-slate-500">
                    {c.total > 0
                      ? `${c.percentage.toFixed(1)}%`
                      : `${c.covered} street${c.covered === 1 ? '' : 's'}`}
                  </span>
                </div>
                {c.total > 0 && (
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-emerald-600"
                      style={{ width: `${Math.min(c.percentage, 100)}%` }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="border-t border-slate-200 pt-5">
        <RunList
          runs={runs}
          selectedRunId={selectedRunId}
          onSelectRun={onSelectRun}
          onDeleted={onRunDeleted}
        />
      </div>
    </aside>
  );
}
