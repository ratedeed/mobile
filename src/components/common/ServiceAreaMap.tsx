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
  zipCodes?: string[];
  zipGeoData?: any[];
  height?: number;
}

interface ZipArea {
  zip: string;
  coords: { latitude: number; longitude: number }[];
  isPrimary?: boolean;
}

// Zip code prefix → state file mapping (first 2 digits of zip → state)
const ZIP_PREFIX_TO_STATE: Record<string, string> = {
  "00": "ma_massachusetts", "01": "ma_massachusetts", "02": "ma_massachusetts",
  "03": "nh_new_hampshire", "04": "me_maine", "05": "vt_vermont",
  "06": "ct_connecticut", "07": "nj_new_jersey", "08": "nj_new_jersey",
  "09": "puerto_rico", "10": "ny_new_york", "11": "ny_new_york",
  "12": "ny_new_york", "13": "ny_new_york", "14": "ny_new_york",
  "15": "pa_pennsylvania", "16": "pa_pennsylvania", "17": "pa_pennsylvania",
  "18": "pa_pennsylvania", "19": "pa_pennsylvania", "20": "md_maryland",
  "21": "md_maryland", "22": "va_virginia", "23": "va_virginia",
  "24": "wv_west_virginia", "25": "wv_west_virginia", "26": "wv_west_virginia",
  "27": "nc_north_carolina", "28": "nc_north_carolina", "29": "sc_south_carolina",
  "30": "ge_georgia", "31": "ge_georgia", "32": "fl_florida",
  "33": "fl_florida", "34": "fl_florida", "35": "al_alabama",
  "36": "al_alabama", "37": "tn_tennessee", "38": "tn_tennessee",
  "39": "ms_mississippi", "40": "ky_kentucky", "41": "ky_kentucky",
  "42": "ky_kentucky", "43": "oh_ohio", "44": "oh_ohio",
  "45": "oh_ohio", "46": "in_indiana", "47": "in_indiana",
  "48": "mi_michigan", "49": "mi_michigan", "50": "ia_iowa",
  "51": "ia_iowa", "52": "ia_iowa", "53": "wi_wisconsin",
  "54": "wi_wisconsin", "55": "mn_minnesota", "56": "mn_minnesota",
  "57": "sd_south_dakota", "58": "nd_north_dakota", "59": "mt_montana",
  "60": "il_illinois", "61": "il_illinois", "62": "il_illinois",
  "63": "mo_missouri", "64": "mo_missouri", "65": "mo_missouri",
  "66": "ks_kansas", "67": "ks_kansas", "68": "ne_nebraska",
  "69": "ne_nebraska", "70": "la_louisiana", "71": "la_louisiana",
  "72": "ar_arkansas", "73": "ar_arkansas", "74": "ok_oklahoma",
  "75": "tx_texas", "76": "tx_texas", "77": "tx_texas",
  "78": "tx_texas", "79": "tx_texas", "80": "co_colorado",
  "81": "co_colorado", "82": "wy_wyoming", "83": "wy_wyoming",
  "84": "ut_utah", "85": "az_arizona", "86": "az_arizona",
  "87": "nm_new_mexico", "88": "nm_new_mexico", "89": "nv_nevada",
  "90": "ca_california", "91": "ca_california", "92": "ca_california",
  "93": "ca_california", "94": "ca_california", "95": "ca_california",
  "96": "hi_hawaii", "97": "or_oregon", "98": "wa_washington",
  "99": "wa_washington",
};

const mobileStateCache = new Map<string, any[]>();

function simplifyRing(coords: number[][], factor: number = 5): number[][] {
  if (coords.length <= 10) return coords;
  const simplified = coords.filter((_, i) => i % factor === 0);
  if (simplified[0] !== simplified[simplified.length - 1]) {
    simplified.push(simplified[0]);
  }
  return simplified;
}

async function fetchStateGeoJSON(stateFile: string): Promise<any[]> {
  if (mobileStateCache.has(stateFile)) {
    return mobileStateCache.get(stateFile)!;
  }
  const url = `https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/${stateFile}_zip_codes_geo.min.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('State fetch failed');
  const data = await res.json();
  const features = data.features || [];
  mobileStateCache.set(stateFile, features);
  return features;
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

async function fetchBoundariesFast(zips: any[]): Promise<ZipArea[]> {
  const results: ZipArea[] = [];
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

  if (validZips.length === 0) return results;

  // 1. Try Backend API first
  try {
    const apiUrl = `${API_BASE_URL}/api/zip-boundaries?zips=${validZips.join(',')}`;
    const res = await fetch(apiUrl);
    if (res.ok) {
      const data = await res.json();
      if (data?.boundaries && Array.isArray(data.boundaries)) {
        for (const b of data.boundaries) {
          if (b.polygon && Array.isArray(b.polygon)) {
            const coords = b.polygon.map((pt: any) => ({ latitude: pt[0], longitude: pt[1] }));
            if (coords.length >= 3) {
              results.push({ zip: b.code, coords });
            }
          }
        }
        if (results.length > 0) return results;
      }
    }
  } catch {}

  // 2. Direct State GeoJSON Fallback
  for (const zip of validZips) {
    try {
      const prefix = zip.substring(0, 2);
      const stateFile = ZIP_PREFIX_TO_STATE[prefix] || "ca_california";
      const features = await fetchStateGeoJSON(stateFile);
      const feature = features.find((f: any) => String(f.properties?.ZCTA5CE10) === zip);
      if (feature?.geometry) {
        const geom = feature.geometry;
        const rawCoords = geom.type === 'Polygon' ? geom.coordinates[0] : geom.coordinates[0]?.[0];
        if (rawCoords && rawCoords.length >= 3) {
          const simplified = simplifyRing(rawCoords, 5);
          const coords = simplified.map((pt: any) => ({ latitude: pt[1], longitude: pt[0] }));
          results.push({ zip, coords });
        }
      }
    } catch {}
  }

  return results;
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

  // Geocode business location
  useEffect(() => {
    let cancelled = false;
    setHasError(false);
    (async () => {
      try {
        let coords: { lat: number; lng: number } | null = null;
        if (latitude && longitude) {
          coords = { lat: latitude, lng: longitude };
        } else if (locationName) {
          coords = await geocodeLocation(locationName);
        }
        if (!cancelled) {
          if (coords) {
            setCenter(coords);
            setHasBusinessLocation(true);
          } else {
            setHasBusinessLocation(false);
          }
        }
      } catch {
        if (!cancelled) {
          setHasBusinessLocation(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [latitude, longitude, locationName]);

  // Load Zip Code Boundary Polygons
  useEffect(() => {
    setHasError(false);

    // 1. Check if prefilled zipGeoData exists
    if (zipGeoData && zipGeoData.length > 0) {
      const prefilled: ZipArea[] = [];
      for (const zc of zipGeoData) {
        if (!zc) continue;
        if (zc.polygon) {
          const geom = zc.polygon;
          let rawRing: any[] | null = null;
          if (Array.isArray(geom)) rawRing = geom;
          else if (geom.type === 'Polygon' && geom.coordinates?.[0]) rawRing = geom.coordinates[0];
          else if (geom.type === 'MultiPolygon' && geom.coordinates?.[0]?.[0]) rawRing = geom.coordinates[0][0];

          if (rawRing) {
            const coords = rawRing.map((pt: any) => {
              if (Array.isArray(pt)) return { latitude: pt[0] > 180 || pt[0] < -180 ? pt[1] : pt[0], longitude: pt[0] > 180 || pt[0] < -180 ? pt[0] : pt[1] };
              return { latitude: pt.lat || pt.latitude, longitude: pt.lng || pt.longitude };
            });
            if (coords.length >= 3) {
              prefilled.push({ zip: zc.zip, coords, isPrimary: zc.isPrimary });
            }
          }
        }
      }
      if (prefilled.length > 0) {
        setZipAreas(prefilled);
        return;
      }
    }

    // 2. Fetch boundary polygons for zipCodes
    if (!zipCodes.length) { setZipAreas([]); return; }
    let cancelled = false;

    (async () => {
      try {
        const fetched = await fetchBoundariesFast(zipCodes);
        if (!cancelled) {
          setZipAreas(fetched);
          if (fetched.length > 0 && !center) {
            const avgLat = fetched[0].coords.reduce((s, c) => s + c.latitude, 0) / fetched[0].coords.length;
            const avgLng = fetched[0].coords.reduce((s, c) => s + c.longitude, 0) / fetched[0].coords.length;
            setCenter({ lat: avgLat, lng: avgLng });
          }
        }
      } catch {
        if (!cancelled) setHasError(true);
      }
    })();

    return () => { cancelled = true; };
  }, [zipCodes.join(','), JSON.stringify(zipGeoData || [])]);

  // Adjust camera to fit all zip boundary polygons
  useEffect(() => {
    if (mapRef.current) {
      const allCoords = zipAreas.flatMap(za => za.coords);
      if (hasBusinessLocation && center) {
        allCoords.push({ latitude: center.lat, longitude: center.lng });
      }
      if (allCoords.length > 0) {
        mapRef.current.fitToCoordinates(allCoords, {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      }
    }
  }, [zipAreas, hasBusinessLocation, center]);

  if (hasError) {
    return (
      <View style={[styles.container, { height }]} className="bg-neutral-100 items-center justify-center rounded-2xl px-4">
        <FontAwesome5 name="exclamation-triangle" size={24} color="#EF4444" />
        <Text className="text-xs text-neutral-500 mt-2 text-center">Could not load service area map</Text>
      </View>
    );
  }

  if (!center) {
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
        mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
      >
        {zipAreas.map((za) => {
          const avgLat = za.coords.reduce((s, c) => s + c.latitude, 0) / za.coords.length;
          const avgLng = za.coords.reduce((s, c) => s + c.longitude, 0) / za.coords.length;

          return (
            <React.Fragment key={za.zip}>
              <Polygon
                coordinates={za.coords}
                fillColor={za.isPrimary ? 'rgba(79, 70, 229, 0.35)' : 'rgba(79, 70, 229, 0.25)'}
                strokeColor="#4F46E5"
                strokeWidth={2}
              />
              {za.zip && (
                <Marker
                  coordinate={{ latitude: avgLat, longitude: avgLng }}
                  tracksViewChanges={false}
                >
                  <Text style={{
                    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
                    fontSize: 11,
                    fontWeight: '800',
                    color: '#312E81',
                    textShadowColor: 'rgba(255, 255, 255, 1)',
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 6,
                  }}>
                    {za.zip}
                  </Text>
                </Marker>
              )}
            </React.Fragment>
          );
        })}

        {hasBusinessLocation && (
          <Marker
            coordinate={{ latitude: center.lat, longitude: center.lng }}
            tracksViewChanges={false}
          >
            <View style={{
              width: 36, height: 36,
              backgroundColor: '#4F46E5',
              borderRadius: 18,
              alignItems: 'center', justifyContent: 'center',
              shadowColor: '#4F46E5', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 2 },
              elevation: 5,
              borderWidth: 3, borderColor: 'white'
            }}>
              <FontAwesome5 name="map-marker-alt" size={14} color="white" solid />
            </View>
          </Marker>
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
});
