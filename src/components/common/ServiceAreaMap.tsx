import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { BouncingDotsLoader } from './BouncingDotsLoader';
import MapView, { Marker, Polygon } from 'react-native-maps';
import { FontAwesome5 } from '@expo/vector-icons';
import { API_BASE_URL } from '../../config';

interface ServiceAreaMapProps {
  businessName: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  zipCodes?: (string | number | any)[];
  zipGeoData?: any[];
  height?: number;
}

interface ZipArea {
  zip: string;
  coords: { latitude: number; longitude: number }[];
  isPrimary?: boolean;
}

const zipMemoryCache = new Map<string, ZipArea[]>();

/**
 * Normalizes raw polygon coordinate arrays from any common format:
 *  - Simple:        [[lat, lng], [lat, lng], ...]
 *  - GeoJSON:       [[lng, lat], [lng, lat], ...]        ← auto-detected & swapped
 *  - Nested ring:   [[[lng, lat], [lng, lat], ...]]      ← unwrapped
 *  - String values: [["34.1", "-118.4"], ...]             ← converted to Number
 *
 * Returns {latitude, longitude}[] guaranteed to have numeric, valid values.
 */
function normalizePolygonCoords(raw: any[]): { latitude: number; longitude: number }[] {
  if (!raw || !Array.isArray(raw) || raw.length === 0) return [];

  // Unwrap nested ring format: [[[...]]] → [[...]]
  let ring = raw;
  while (
    Array.isArray(ring) &&
    ring.length > 0 &&
    Array.isArray(ring[0]) &&
    Array.isArray(ring[0][0])
  ) {
    ring = ring[0];
  }

  return ring
    .filter((pt: any) => Array.isArray(pt) && pt.length >= 2)
    .map((pt: any) => {
      const v0 = Number(pt[0]);
      const v1 = Number(pt[1]);

      if (isNaN(v0) || isNaN(v1)) return null;

      // GeoJSON standard is [longitude, latitude].
      // If |v0| > 90 it MUST be a longitude (latitudes only go -90..90).
      // For US coords, longitudes are -60..-150 so |v0| > 90 → swap.
      const lat = Math.abs(v0) > 90 ? v1 : v0;
      const lng = Math.abs(v0) > 90 ? v0 : v1;

      return { latitude: lat, longitude: lng };
    })
    .filter(
      (c: any): c is { latitude: number; longitude: number } =>
        c !== null &&
        !isNaN(c.latitude) &&
        !isNaN(c.longitude) &&
        Math.abs(c.latitude) <= 90 &&
        Math.abs(c.longitude) <= 180
    );
}

async function geocodeLocation(query: string): Promise<{ lat: number; lng: number } | null> {
  const trimmed = query.trim();
  if (/^\d{5}$/.test(trimmed)) {
    try {
      const res = await fetch(`https://api.zippopotam.us/us/${trimmed}`);
      if (res.ok) {
        const data = await res.json();
        const place = data?.places?.[0];
        if (place?.latitude && place?.longitude) {
          return { lat: parseFloat(place.latitude), lng: parseFloat(place.longitude) };
        }
      }
    } catch {}
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'RateDeedMobile/1.0' } }
    );
    const data = await res.json();
    if (data?.[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {}
  return null;
}

/**
 * Parse the "boundaries" array from either our API or the production fallback.
 * Both return the same shape: { boundaries: [{ code, polygon }] }
 */
function parseBoundariesResponse(data: any): ZipArea[] {
  const results: ZipArea[] = [];
  if (!data?.boundaries || !Array.isArray(data.boundaries)) return results;

  for (const b of data.boundaries) {
    if (!b.polygon || !Array.isArray(b.polygon)) continue;

    const coords = normalizePolygonCoords(b.polygon);
    if (coords.length >= 3) {
      results.push({ zip: b.code || b.zip || 'ZIP', coords });
    }
  }
  return results;
}

async function fetchBoundariesFast(
  zips: any[],
  fallbackLocationName?: string,
  lat?: number,
  lng?: number
): Promise<ZipArea[]> {
  const validZips: string[] = [];

  (zips || []).forEach((z: any) => {
    if (typeof z === 'string' && /^\d{5}$/.test(z.trim())) {
      validZips.push(z.trim());
    } else if (typeof z === 'number' && /^\d{5}$/.test(String(z))) {
      validZips.push(String(z));
    } else if (typeof z === 'object' && z !== null) {
      const val = z.zip || z.name || z.code || z.zipCode;
      if (typeof val === 'string' && /^\d{5}$/.test(val.trim())) {
        validZips.push(val.trim());
      } else if (typeof val === 'number' && /^\d{5}$/.test(String(val))) {
        validZips.push(String(val));
      }
    }
  });

  if (validZips.length === 0 && fallbackLocationName) {
    const match = fallbackLocationName.match(/\b\d{5}\b/);
    if (match) validZips.push(match[0]);
  }

  const cacheKey = validZips.join(',') || `${fallbackLocationName}_${lat}_${lng}`;
  if (zipMemoryCache.has(cacheKey)) {
    return zipMemoryCache.get(cacheKey)!;
  }

  // 1. Try configured API URL (Primary) — zip-based
  if (validZips.length > 0) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/zip-boundaries?zips=${validZips.join(',')}`);
      if (res.ok) {
        const results = parseBoundariesResponse(await res.json());
        if (results.length > 0) {
          zipMemoryCache.set(cacheKey, results);
          return results;
        }
      }
    } catch {}

    // 2. Fallback to production server
    try {
      const res = await fetch(`https://www.ratedeed.com/api/zip-boundaries?zips=${validZips.join(',')}`);
      if (res.ok) {
        const results = parseBoundariesResponse(await res.json());
        if (results.length > 0) {
          zipMemoryCache.set(cacheKey, results);
          return results;
        }
      }
    } catch {}
  }

  // 3. Spatial lookup fallback
  let targetLat = lat;
  let targetLng = lng;
  if ((!targetLat || !targetLng) && fallbackLocationName) {
    const geo = await geocodeLocation(fallbackLocationName);
    if (geo) {
      targetLat = geo.lat;
      targetLng = geo.lng;
    }
  }

  if (targetLat && targetLng) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/zip-boundaries?lat=${targetLat}&lng=${targetLng}`);
      if (res.ok) {
        const results = parseBoundariesResponse(await res.json());
        if (results.length > 0) {
          zipMemoryCache.set(cacheKey, results);
          return results;
        }
      }
    } catch {}

    try {
      const res = await fetch(`https://www.ratedeed.com/api/zip-boundaries?lat=${targetLat}&lng=${targetLng}`);
      if (res.ok) {
        const results = parseBoundariesResponse(await res.json());
        if (results.length > 0) {
          zipMemoryCache.set(cacheKey, results);
          return results;
        }
      }
    } catch {}
  }

  return [];
}

export default function ServiceAreaMap({
  businessName,
  locationName,
  latitude,
  longitude,
  zipCodes = [],
  zipGeoData = [],
  height = 220,
}: ServiceAreaMapProps) {
  const mapRef = useRef<MapView>(null);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(
    latitude && longitude ? { lat: latitude, lng: longitude } : null
  );
  const [zipAreas, setZipAreas] = useState<ZipArea[]>([]);
  const [hasBusinessLocation, setHasBusinessLocation] = useState(
    latitude && longitude ? true : false
  );
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);

  // Load Zip Code Boundary Polygons
  useEffect(() => {
    setHasError(false);
    setIsLoading(true);

    // Prefilled zipGeoData check
    if (zipGeoData && zipGeoData.length > 0) {
      const prefilled: ZipArea[] = [];
      for (const zc of zipGeoData) {
        if (!zc || !zc.polygon) continue;
        const geom = zc.polygon;
        let rawRing: any[] | null = null;

        if (Array.isArray(geom)) {
          rawRing = geom;
        } else if (geom.type === 'Polygon' && geom.coordinates?.[0]) {
          rawRing = geom.coordinates[0];
        } else if (geom.type === 'MultiPolygon' && geom.coordinates?.[0]?.[0]) {
          rawRing = geom.coordinates[0][0];
        }

        if (rawRing) {
          const coords = normalizePolygonCoords(rawRing);
          if (coords.length >= 3) {
            prefilled.push({ zip: zc.zip, coords, isPrimary: zc.isPrimary });
          }
        }
      }
      if (prefilled.length > 0) {
        setZipAreas(prefilled);
        if (!center) {
          const avgLat = prefilled[0].coords.reduce((s, c) => s + c.latitude, 0) / prefilled[0].coords.length;
          const avgLng = prefilled[0].coords.reduce((s, c) => s + c.longitude, 0) / prefilled[0].coords.length;
          setCenter({ lat: avgLat, lng: avgLng });
        }
        setIsLoading(false);
        return;
      }
    }

    (async () => {
      try {
        const fetched = await fetchBoundariesFast(zipCodes, locationName, latitude, longitude);
        if (fetched && fetched.length > 0) {
          setZipAreas(fetched);
          if (!center) {
            const avgLat = fetched[0].coords.reduce((s, c) => s + c.latitude, 0) / fetched[0].coords.length;
            const avgLng = fetched[0].coords.reduce((s, c) => s + c.longitude, 0) / fetched[0].coords.length;
            setCenter({ lat: avgLat, lng: avgLng });
          }
        } else if (locationName && !center) {
          const geo = await geocodeLocation(locationName);
          if (geo) setCenter(geo);
        }
      } catch {
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [JSON.stringify(zipCodes || []), locationName, latitude, longitude, JSON.stringify(zipGeoData || [])]);

  // Geocode business location if needed
  useEffect(() => {
    if (!center && locationName) {
      (async () => {
        const geo = await geocodeLocation(locationName);
        if (geo) {
          setCenter(geo);
          setHasBusinessLocation(true);
        }
      })();
    }
  }, [locationName, center]);

  // Set up ready timer fallback in case onMapReady doesn't fire
  useEffect(() => {
    if (!isLoading && center) {
      const timer = setTimeout(() => {
        setIsMapReady(true);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setIsMapReady(false);
    }
  }, [isLoading, center]);

  // Adjust camera to fit all zip boundary polygons
  useEffect(() => {
    if (mapRef.current && isMapReady && zipAreas.length > 0) {
      const allCoords = zipAreas.flatMap(za => za.coords);
      if (hasBusinessLocation && center) {
        allCoords.push({ latitude: center.lat, longitude: center.lng });
      }
      if (allCoords.length > 0) {
        setTimeout(() => {
          mapRef.current?.fitToCoordinates(allCoords, {
            edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
            animated: true,
          });
        }, 300);
      }
    }
  }, [zipAreas, hasBusinessLocation, center, isMapReady]);

  if (hasError) {
    return (
      <View style={[styles.container, { height }]} className="bg-neutral-100 items-center justify-center rounded-2xl px-4">
        <FontAwesome5 name="exclamation-triangle" size={24} color="#EF4444" />
        <Text className="text-xs text-neutral-500 mt-2 text-center">Could not load service area map</Text>
      </View>
    );
  }

  if (isLoading || !center) {
    return (
      <View style={[styles.container, { height }]} className="bg-neutral-100 items-center justify-center rounded-2xl">
        <BouncingDotsLoader size="small" color="#4F46E5" />
        <Text className="text-xs text-neutral-400 mt-2">Loading map...</Text>
      </View>
    );
  }

  return (
    <View style={{ height, width: '100%', borderRadius: 16, overflow: 'hidden' }}>
      <MapView
        ref={mapRef}
        style={{ height, width: '100%' }}
        minZoomLevel={4}
        maxZoomLevel={14}
        initialRegion={{
          latitude: center.lat,
          longitude: center.lng,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }}
        scrollEnabled={true}
        zoomEnabled={true}
        rotateEnabled={false}
        pitchEnabled={false}
        showsUserLocation={false}
        showsTraffic={false}
        showsPointsOfInterest={false}
        showsBuildings={false}
        showsIndoors={false}
        toolbarEnabled={false}
        mapType="standard"
        onMapReady={() => setIsMapReady(true)}
      >
        {isMapReady && (
          <>
            {zipAreas.map((za) => {
              // STRICT DATA SCRUB: Force every coordinate to be a valid Float.
              // Polygons will silently crash the draw call if they receive a string.
              const safeCoords = za.coords
                .map(c => ({
                  latitude: parseFloat(String(c.latitude)),
                  longitude: parseFloat(String(c.longitude))
                }))
                .filter(c => !isNaN(c.latitude) && !isNaN(c.longitude)); // Remove corrupted points

              // Polygons MUST have at least 3 valid points to render a shape
              if (safeCoords.length < 3) return null;

              return (
                <Polygon
                  key={`poly-${za.zip}`}
                  coordinates={safeCoords}
                  // Use 8-digit Hex instead of rgba() for better Android compatibility
                  // #6366F1 = Indigo, 66 = ~40% Opacity
                  fillColor="#6366F166"
                  strokeColor="#4F46E5"
                  strokeWidth={Platform.OS === 'android' ? 2 : 3} // Thinner stroke on Android prevents rendering artifacts
                  zIndex={1}
                  geodesic={true} // Helps the map engine draw smooth lines on spherical projections
                />
              );
            })}

            {zipAreas.map((za) => {
              if (!za.zip) return null;

              const avgLat = za.coords.reduce((s, c) => s + c.latitude, 0) / za.coords.length;
              const avgLng = za.coords.reduce((s, c) => s + c.longitude, 0) / za.coords.length;
              const labelLat = avgLat + 0.0035;

              return (
                <Marker
                  key={`marker-${za.zip}`}
                  coordinate={{ latitude: labelLat, longitude: avgLng }}
                  tracksViewChanges={false}
                  anchor={{ x: 0.5, y: 1 }}
                  zIndex={2}
                >
                  <View style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: 'rgba(79, 70, 229, 0.4)',
                    shadowColor: '#000',
                    shadowOpacity: 0.15,
                    shadowRadius: 3,
                    shadowOffset: { width: 0, height: 1 },
                    elevation: 3,
                  }}>
                    <Text style={{
                      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
                      fontSize: 10,
                      fontWeight: '800',
                      color: '#4F46E5',
                    }}>
                      {za.zip}
                    </Text>
                  </View>
                </Marker>
              );
            })}

            {hasBusinessLocation && (
              <Marker
                coordinate={{ latitude: center.lat, longitude: center.lng }}
                tracksViewChanges={false}
                anchor={{ x: 0.5, y: 0.5 }}
                zIndex={3}
              >
                <View style={{
                  width: 36, height: 36,
                  backgroundColor: '#4F46E5',
                  borderRadius: 18,
                  alignItems: 'center', justifyContent: 'center',
                  shadowColor: '#4F46E5', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 2 },
                  elevation: 6,
                  borderWidth: 3, borderColor: 'white'
                }}>
                  <FontAwesome5 name="map-marker-alt" size={14} color="white" solid />
                </View>
              </Marker>
            )}
          </>
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
});