import type { GpsPoint, LatLng } from '../types';
import { haversineMeters } from './gpxParser';
import { locateCommune } from './communes';

export interface ExtractedStreet {
  /** Google place_id of the road segment. Language-independent, but Google
   *  issues a different one per segment, so it does NOT identify a street —
   *  stored for reference only. Counting is done on `name`. */
  placeId: string | null;
  name: string;
  communeId: string | null;
  startCoord: LatLng;
  endCoord: LatLng;
}

/** Metres between geocoded samples. Brussels blocks run 80-120 m, so 30 m
 *  cannot skip a street, while cutting a 2,400-point track to under 200 calls. */
export const SAMPLE_METRES = 30;

export function samplePoints(points: GpsPoint[], minMetres = SAMPLE_METRES): GpsPoint[] {
  if (points.length === 0) return [];
  const out = [points[0]];
  for (const p of points) {
    if (haversineMeters(out[out.length - 1], p) >= minMetres) out.push(p);
  }
  return out;
}

/** Brussels streets have both a French and a Dutch name, and Google picks
 *  between them per request. Left unpinned, "Avenue Reine Marie-Henriette" and
 *  "Koningin Maria-Hendrikalaan" count as two separate streets. */
export const GEOCODE_LANGUAGE = 'fr';

// Survives across uploads in a session: repeated runs cover the same streets,
// and an out-and-back passes each point twice.
interface StreetHit {
  placeId: string | null;
  name: string;
}

const cache = new Map<string, StreetHit | null>();
const cacheKey = (lat: number, lng: number) => `${lat.toFixed(4)},${lng.toFixed(4)}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function streetFrom(results: google.maps.GeocoderResult[]): StreetHit | null {
  // Name and place_id must come from the SAME result, or they describe
  // different streets. Prefer the route-typed result; fall back to any result
  // carrying a route component.
  const routeResult = results.find((r) => r.types.includes('route'));
  const source =
    routeResult ??
    results.find((r) => r.address_components.some((c) => c.types.includes('route')));
  if (!source) return null;

  const name = source.address_components.find((c) => c.types.includes('route'))?.long_name;
  if (!name) return null;

  // place_id is stored for reference only: Google issues it per road segment,
  // so it is NOT a stable identity for a street. Counting is done on name.
  return { name, placeId: routeResult?.place_id ?? null };
}

async function geocodeOne(
  geocoder: google.maps.Geocoder,
  point: GpsPoint
): Promise<StreetHit | null> {
  const key = cacheKey(point.lat, point.lng);
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const { results } = await geocoder.geocode({
        location: { lat: point.lat, lng: point.lng },
        language: GEOCODE_LANGUAGE,
      });
      const street = streetFrom(results);
      cache.set(key, street);
      return street;
    } catch (err) {
      const status = (err as { code?: string })?.code ?? String(err);
      if (String(status).includes('ZERO_RESULTS')) {
        cache.set(key, null);
        return null;
      }
      if (attempt === 3) throw err;
      await sleep(400 * 2 ** attempt); // OVER_QUERY_LIMIT backoff
    }
  }
  return null;
}

/**
 * Reverse geocodes a track into the ordered list of streets it covers.
 * Commune comes from the bundled boundary polygons, not from Google: Brussels
 * is bilingual and the API returns French or Dutch names unpredictably.
 */
export async function extractStreets(
  points: GpsPoint[],
  onProgress?: (done: number, total: number) => void
): Promise<ExtractedStreet[]> {
  const sampled = samplePoints(points);
  const geocoder = new google.maps.Geocoder();
  const named: (StreetHit & { communeId: string | null } & LatLng)[] = [];

  let done = 0;
  const CONCURRENCY = 4;

  for (let i = 0; i < sampled.length; i += CONCURRENCY) {
    const batch = sampled.slice(i, i + CONCURRENCY);
    const hits = await Promise.all(batch.map((p) => geocodeOne(geocoder, p)));

    batch.forEach((point, k) => {
      const hit = hits[k];
      if (hit) {
        named.push({
          ...hit,
          communeId: locateCommune(point.lat, point.lng)?.id ?? null,
          lat: point.lat,
          lng: point.lng,
        });
      }
    });

    done += batch.length;
    onProgress?.(Math.min(done, sampled.length), sampled.length);
  }

  // Collapse consecutive samples on the same street into one segment.
  const segments: ExtractedStreet[] = [];
  for (const entry of named) {
    const last = segments[segments.length - 1];
    if (last && last.name === entry.name && last.communeId === entry.communeId) {
      last.endCoord = { lat: entry.lat, lng: entry.lng };
    } else {
      segments.push({
        placeId: entry.placeId,
        name: entry.name,
        communeId: entry.communeId,
        startCoord: { lat: entry.lat, lng: entry.lng },
        endCoord: { lat: entry.lat, lng: entry.lng },
      });
    }
  }
  return segments;
}
