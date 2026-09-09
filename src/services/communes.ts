import raw from '../data/communes.json';

interface CommuneShape {
  id: string;
  name: string;
  osmId: number;
  ring: [number, number][]; // [lng, lat]
}

const COMMUNES = raw as CommuneShape[];

// Bounding boxes make the common case a couple of comparisons instead of a
// full ray cast against 5,000 vertices.
const BOXES = COMMUNES.map((c) => {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of c.ring) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { commune: c, minLng, maxLng, minLat, maxLat };
});

function inRing(lng: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Commune containing this point, or null if it falls outside Brussels. */
export function locateCommune(lat: number, lng: number): CommuneShape | null {
  for (const box of BOXES) {
    if (lng < box.minLng || lng > box.maxLng || lat < box.minLat || lat > box.maxLat) {
      continue;
    }
    if (inRing(lng, lat, box.commune.ring)) return box.commune;
  }
  return null;
}

export const communeName = (id: string): string | null =>
  COMMUNES.find((c) => c.id === id)?.name ?? null;
