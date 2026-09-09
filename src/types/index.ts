// Coordinates
export interface LatLng {
  lat: number;
  lng: number;
}

export interface GpsPoint extends LatLng {
  time?: string;
  elevation?: number;
}

// profiles
export interface Profile {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
  preferences: {
    cityCenter: LatLng;
    zoom: number;
  };
}

// runs
export interface Run {
  id: string;
  userId: string;
  name: string | null;
  date: string;
  distance: number; // km
  duration: number; // seconds
  gpsCoordinates: GpsPoint[];
  createdAt: string;
  /** Rows in run_streets for this run; 0 means streets were never extracted. */
  streetCount: number;
}

// run_streets
export interface RunStreet {
  id: number;
  runId: string;
  userId: string;
  /** Google place_id — language-independent street identity. */
  placeId: string | null;
  name: string;
  communeId: string | null;
  startCoord: LatLng | null;
  endCoord: LatLng | null;
}

// communes
export interface Commune {
  id: string;
  name: string;
  boundaries: GeoJsonPolygon;
}

// commune_streets
export interface CommuneStreet {
  id: number;
  communeId: string;
  name: string;
  coordinates: LatLng[];
}

export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

// user_coverage_by_commune (view)
export interface CommuneCoverage {
  userId: string;
  communeId: string;
  communeName: string;
  covered: number;
  total: number;
  percentage: number;
}

// user_coverage_citywide (view)
export interface CitywideCoverage {
  userId: string;
  totalStreetsCovered: number;
  totalStreetsInCity: number;
  percentageCovered: number;
}

// GPX
export interface GpxFile {
  metadata?: {
    name?: string;
    desc?: string;
    time?: string;
  };
  tracks: GpxTrack[];
}

export interface GpxTrack {
  name?: string;
  segments: GpxSegment[];
}

export interface GpxSegment {
  points: GpsPoint[];
}

// Google Geocoding
export interface GeocodeResult {
  streetName: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
  placeId?: string;
}
