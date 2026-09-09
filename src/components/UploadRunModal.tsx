import { useState, type ChangeEvent } from 'react';
import { supabase } from '../services/supabase';
import { parseGpx, type ParsedRun } from '../services/gpxParser';
import { extractStreets, samplePoints } from '../services/googleMaps';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
}

export default function UploadRunModal({
  userId,
  onClose,
  onUploaded,
}: {
  userId: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [parsed, setParsed] = useState<ParsedRun | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setParsed(null);
    setFileName(file.name);
    try {
      setParsed(parseGpx(await file.text()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file.');
    }
  }

  async function handleSave() {
    if (!parsed) return;
    setSaving(true);
    setError(null);

    setPhase('Saving run…');
    const { data: run, error: insertError } = await supabase
      .from('runs')
      .insert({
        user_id: userId,
        name: parsed.name,
        date: parsed.date,
        distance: Number(parsed.distance.toFixed(2)),
        duration: parsed.duration,
        gps_coordinates: parsed.points,
      })
      .select('id')
      .single();

    if (insertError) {
      setSaving(false);
      setPhase(null);
      setError(
        insertError.code === '23505'
          ? 'You have already uploaded this run.'
          : insertError.message
      );
      return;
    }

    setPhase('Identifying streets…');
    try {
      const streets = await extractStreets(parsed.points, (done, total) =>
        setProgress({ done, total })
      );

      if (streets.length > 0) {
        const { error: streetError } = await supabase.from('run_streets').insert(
          streets.map((s) => ({
            run_id: run.id,
            user_id: userId,
            place_id: s.placeId,
            name: s.name,
            commune_id: s.communeId,
            start_coord: s.startCoord,
            end_coord: s.endCoord,
          }))
        );
        if (streetError) throw new Error(streetError.message);
      }
    } catch (err) {
      // The run itself is saved; only street extraction failed.
      setSaving(false);
      setPhase(null);
      setProgress(null);
      setError(
        `Run saved, but street identification failed: ${
          err instanceof Error ? err.message : 'unknown error'
        }`
      );
      return;
    }

    setSaving(false);
    onUploaded();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-slate-900">Upload a run</h2>
        <p className="mt-1 text-sm text-slate-500">
          Select a GPX file exported from Strava, Garmin, or any GPS watch.
        </p>

        <label className="mt-5 block cursor-pointer rounded-lg border-2 border-dashed border-slate-300 p-6 text-center hover:border-slate-400">
          <input
            type="file"
            accept=".gpx,application/gpx+xml,text/xml"
            onChange={handleFile}
            className="sr-only"
          />
          <span className="text-sm font-medium text-slate-700">
            {fileName ?? 'Choose a GPX file'}
          </span>
        </label>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {parsed && (
          <dl className="mt-5 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-4 text-sm">
            <div className="col-span-2">
              <dt className="text-xs uppercase tracking-wide text-slate-500">Run</dt>
              <dd className="font-medium text-slate-900">{parsed.name ?? 'Untitled'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Date</dt>
              <dd className="text-slate-900">
                {new Date(parsed.date).toLocaleDateString()}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Points</dt>
              <dd className="text-slate-900">{parsed.points.length.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Distance</dt>
              <dd className="text-slate-900">{parsed.distance.toFixed(2)} km</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Duration</dt>
              <dd className="text-slate-900">{formatDuration(parsed.duration)}</dd>
            </div>
            <div className="col-span-2 border-t border-slate-200 pt-3">
              <dt className="text-xs uppercase tracking-wide text-slate-500">
                Streets to look up
              </dt>
              <dd className="text-slate-900">
                {samplePoints(parsed.points).length.toLocaleString()} lookups
                <span className="text-slate-500"> (sampled every 30 m)</span>
              </dd>
            </div>
          </dl>
        )}

        {saving && (
          <div className="mt-5">
            <p className="text-sm text-slate-700">
              {phase}
              {progress && ` ${progress.done} / ${progress.total}`}
            </p>
            {progress && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-emerald-600 transition-[width]"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!parsed || saving}
            className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save run'}
          </button>
        </div>
      </div>
    </div>
  );
}
