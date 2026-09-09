import { useEffect, useMemo, useState } from 'react';
import { GoogleMap, useJsApiLoader, Polyline } from '@react-google-maps/api';
import type { Run } from '../types';

const BRUSSELS = { lat: 50.8467, lng: 4.3525 };
const CONTAINER = { width: '100%', height: '100%' };

const OPTIONS: google.maps.MapOptions = {
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  styles: [
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  ],
};

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-full place-items-center bg-slate-200 p-8 text-center text-sm text-slate-600">
      <p className="max-w-sm">{children}</p>
    </div>
  );
}

export default function MapComponent({
  runs,
  selectedRunId,
  onSelectRun,
}: {
  runs: Run[];
  selectedRunId: string | null;
  onSelectRun: (id: string | null) => void;
}) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey ?? '',
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);

  const paths = useMemo(
    () =>
      runs.map((run) => ({
        id: run.id,
        path: run.gpsCoordinates.map(({ lat, lng }) => ({ lat, lng })),
      })),
    [runs]
  );

  useEffect(() => {
    if (!map) return;
    const points = paths.flatMap((p) => p.path);
    if (points.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    for (const point of points) bounds.extend(point);
    map.fitBounds(bounds, 48);
  }, [map, paths]);

  if (!apiKey) {
    return (
      <Placeholder>
        No Google Maps API key. Add <code>VITE_GOOGLE_MAPS_API_KEY</code> to{' '}
        <code>.env.local</code> and restart the dev server.
      </Placeholder>
    );
  }

  if (loadError) {
    return (
      <Placeholder>
        Google Maps failed to load. This is usually the API key: check that the
        Maps JavaScript API is enabled and that this origin is allowed under the
        key's HTTP referrer restrictions.
      </Placeholder>
    );
  }

  if (!isLoaded) return <Placeholder>Loading map…</Placeholder>;

  return (
    <GoogleMap
      mapContainerStyle={CONTAINER}
      center={BRUSSELS}
      zoom={12}
      options={OPTIONS}
      onLoad={setMap}
      onUnmount={() => setMap(null)}
      onClick={() => onSelectRun(null)}
    >
      {paths.map(({ id, path }) => {
        const selected = id === selectedRunId;
        return (
          <Polyline
            key={id}
            path={path}
            onClick={() => onSelectRun(id)}
            options={{
              strokeColor: selected ? '#0f172a' : '#059669',
              strokeOpacity: selected ? 1 : 0.7,
              strokeWeight: selected ? 5 : 3,
              zIndex: selected ? 2 : 1,
            }}
          />
        );
      })}
    </GoogleMap>
  );
}
