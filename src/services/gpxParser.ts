import type { GpsPoint } from '../types';

export interface ParsedRun {
  name: string | null;
  date: string;
  distance: number; // km
  duration: number; // seconds
  points: GpsPoint[];
}

const EARTH_RADIUS_M = 6_371_000;

const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineMeters(a: GpsPoint, b: GpsPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function trackLengthKm(points: GpsPoint[]): number {
  let metres = 0;
  for (let i = 1; i < points.length; i++) {
    metres += haversineMeters(points[i - 1], points[i]);
  }
  return metres / 1000;
}

export function parseGpx(xmlText: string): ParsedRun {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');

  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('That file is not valid XML.');
  }

  const points: GpsPoint[] = [];
  for (const el of Array.from(doc.getElementsByTagName('trkpt'))) {
    const lat = Number(el.getAttribute('lat'));
    const lng = Number(el.getAttribute('lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;

    const time = el.getElementsByTagName('time')[0]?.textContent?.trim();
    const ele = Number(el.getElementsByTagName('ele')[0]?.textContent);

    points.push({
      lat,
      lng,
      ...(time ? { time } : {}),
      ...(Number.isFinite(ele) ? { elevation: ele } : {}),
    });
  }

  if (points.length < 2) {
    throw new Error(
      'No usable track found. This needs a GPX file with a recorded track (<trkpt> points).'
    );
  }

  const times = points
    .map((p) => p.time)
    .filter((t): t is string => Boolean(t))
    .map((t) => Date.parse(t))
    .filter(Number.isFinite);

  const metaTime = doc
    .getElementsByTagName('metadata')[0]
    ?.getElementsByTagName('time')[0]
    ?.textContent?.trim();

  const startMs = times.length ? Math.min(...times) : NaN;
  const date =
    (metaTime && Number.isFinite(Date.parse(metaTime)) ? metaTime : null) ??
    (Number.isFinite(startMs) ? new Date(startMs).toISOString() : new Date().toISOString());

  const duration =
    times.length >= 2 ? Math.round((Math.max(...times) - startMs) / 1000) : 0;

  return {
    name: doc.getElementsByTagName('trk')[0]
      ?.getElementsByTagName('name')[0]
      ?.textContent?.trim() ?? null,
    date,
    distance: trackLengthKm(points),
    duration,
    points,
  };
}
