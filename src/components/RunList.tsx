import { useState } from 'react';
import { supabase } from '../services/supabase';
import type { Run } from '../types';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

export default function RunList({
  runs,
  selectedRunId,
  onSelectRun,
  onDeleted,
}: {
  runs: Run[];
  selectedRunId: string | null;
  onSelectRun: (id: string | null) => void;
  onDeleted: () => void;
}) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeletingId(id);
    setError(null);
    const { error: deleteError } = await supabase.from('runs').delete().eq('id', id);
    setDeletingId(null);
    setConfirmingId(null);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    if (selectedRunId === id) onSelectRun(null);
    onDeleted();
  }

  if (runs.length === 0) {
    return (
      <section>
        <h2 className="text-sm font-semibold text-slate-900">Runs</h2>
        <p className="mt-3 text-xs text-slate-500">
          Nothing uploaded yet. Use “Upload run” to add a GPX file.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-900">
        Runs <span className="font-normal text-slate-500">({runs.length})</span>
      </h2>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <ul className="mt-3 space-y-1">
        {runs.map((run) => {
          const selected = run.id === selectedRunId;
          const confirming = confirmingId === run.id;

          return (
            <li
              key={run.id}
              className={`rounded-lg border p-3 transition-colors ${
                selected
                  ? 'border-slate-900 bg-slate-50'
                  : 'border-transparent hover:bg-slate-50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  onClick={() => onSelectRun(selected ? null : run.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-sm font-medium text-slate-900">
                    {run.name ?? 'Untitled run'}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatDate(run.date)} · {run.distance.toFixed(2)} km ·{' '}
                    {formatDuration(run.duration)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {run.streetCount > 0
                      ? `${run.streetCount} street${run.streetCount === 1 ? '' : 's'}`
                      : 'No streets identified'}
                  </p>
                </button>

                {!confirming && (
                  <button
                    onClick={() => setConfirmingId(run.id)}
                    aria-label={`Delete ${run.name ?? 'run'}`}
                    className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
                    </svg>
                  </button>
                )}
              </div>

              {confirming && (
                <div className="mt-2 flex items-center gap-2 border-t border-slate-200 pt-2">
                  <span className="flex-1 text-xs text-slate-600">Delete this run?</span>
                  <button
                    onClick={() => setConfirmingId(null)}
                    className="rounded px-2 py-1 text-xs text-slate-600 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete(run.id)}
                    disabled={deletingId === run.id}
                    className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {deletingId === run.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
