import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import MapView, { Marker, Polygon } from 'react-native-maps';
import { FontAwesome5 } from '@expo/vector-icons';

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

async function geocodeLocation(query: string): Promise<{ lat: number; lng: number } | null> {
  const trimmed = query.trim();
  // If it's a 5-digit ZIP code, try Zippopotam first as it's faster and reliable
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
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=1`,
      { headers: { 'User-Agent': 'RateDeedMobile/1.0' } }
    );
    const data = await res.json();
    if (data?.[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {}
  return null;
}

async function fetchZipArea(zip: string): Promise<ZipArea | null> {
  // 1. Try Overpass API for boundary polygons
  try {
    const query = `[out:json][timeout:10];relation["boundary"="postal_code"]["postal_code"="${zip}"];out geom;`;
    const res = await fetch(
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
      { headers: { 'User-Agent': 'RateDeedMobile/1.0' } }
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.elements?.[0]?.members) {
        // Combine outer way members into a single polygon ring
        const outerWays = data.elements[0].members
          .filter((m: any) => m.type === 'way' && m.role !== 'inner' && m.geometry)
          .map((m: any) => m.geometry.map((p: any) => ({ latitude: p.lat, longitude: p.lon })));

        if (outerWays.length > 0) {
          // Stitch ways together into one continuous ring
          const stitched = stitchWays(outerWays);
          if (stitched.length >= 3) return { zip, coords: stitched };
        }
      }
    }
  } catch {}

  // 2. Try Nominatim with polygon_geojson fallback
  try {
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(zip)}&countrycodes=us&format=geojson&polygon_geojson=1&limit=1`,
      { headers: { 'User-Agent': 'RateDeedMobile/1.0' } }
    );
    if (nomRes.ok) {
      const nomData = await nomRes.json();
      const feature = nomData?.features?.[0];
      const geom = feature?.geometry;
      const bbox = feature?.bbox;

      if (geom?.type === 'Polygon' && geom.coordinates?.[0]) {
        const ring: number[][] = geom.coordinates[0];
        const coords = ring.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
        if (coords.length >= 3) return { zip, coords };
      } else if (geom?.type === 'MultiPolygon' && geom.coordinates?.[0]?.[0]) {
        const ring: number[][] = geom.coordinates[0][0];
        const coords = ring.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
        if (coords.length >= 3) return { zip, coords };
      } else if (bbox && bbox.length === 4) {
        // Bounding box fallback (swLng, swLat, neLng, neLat)
        const [swLng, swLat, neLng, neLat] = bbox;
        const coords = [
          { latitude: swLat, longitude: swLng },
          { latitude: swLat, longitude: neLng },
          { latitude: neLat, longitude: neLng },
          { latitude: neLat, longitude: swLng }
        ];
        return { zip, coords };
      } else if (geom?.type === 'Point' && geom.coordinates) {
        const [lng, lat] = geom.coordinates;
        const d = 0.015; // ~1.5km radius
        const coords = [
          { latitude: lat - d, longitude: lng - d },
          { latitude: lat - d, longitude: lng + d },
          { latitude: lat + d, longitude: lng + d },
          { latitude: lat + d, longitude: lng - d }
        ];
        return { zip, coords };
      }
    }
  } catch {}

  // 3. Try Zippopotam fallback
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (res.ok) {
      const data = await res.json();
      const place = data?.places?.[0];
      if (place?.latitude && place?.longitude) {
        const lat = parseFloat(place.latitude);
        const lng = parseFloat(place.longitude);
        const d = 0.015;
        const coords = [
          { latitude: lat - d, longitude: lng - d },
          { latitude: lat - d, longitude: lng + d },
          { latitude: lat + d, longitude: lng + d },
          { latitude: lat + d, longitude: lng - d }
        ];
        return { zip, coords };
      }
    }
  } catch {}

  return null;
}

function stitchWays(ways: { latitude: number; longitude: number }[][]): { latitude: number; longitude: number }[] {
  if (ways.length === 0) return [];
  if (ways.length === 1) return ways[0];

  const result = [...ways[0]];
  const remaining = ways.slice(1);

  while (remaining.length > 0) {
    const last = result[result.length - 1];
    let found = false;

    for (let i = 0; i < remaining.length; i++) {
      const way = remaining[i];
      const first = way[0];
      const lastPt = way[way.length - 1];

      if (Math.abs(last.latitude - first.latitude) < 0.0001 && Math.abs(last.longitude - first.longitude) < 0.0001) {
        result.push(...way.slice(1));
        remaining.splice(i, 1);
        found = true;
        break;
      }
      if (Math.abs(last.latitude - lastPt.latitude) < 0.0001 && Math.abs(last.longitude - lastPt.longitude) < 0.0001) {
        result.push(...way.slice(0, -1).reverse());
        remaining.splice(i, 1);
        found = true;
        break;
      }
    }

    if (!found) break;
  }

  return result;
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

  // Geocode the business address
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
            if (!latitude && !longitude && (!zipCodes || zipCodes.length === 0) && (!zipGeoData || zipGeoData.length === 0)) {
              setHasError(true);
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setHasBusinessLocation(false);
          if ((!zipCodes || zipCodes.length === 0) && (!zipGeoData || zipGeoData.length === 0)) {
            setHasError(true);
          }
        }
      }
    })();
    return () => { cancelled = true; };
  }, [latitude, longitude, locationName, zipCodes.join(','), JSON.stringify(zipGeoData || [])]);

  // Fetch zip code polygons or use zipGeoData
  useEffect(() => {
    setHasError(false);
    if (zipGeoData && zipGeoData.length > 0) {
      const results: ZipArea[] = [];
      for (const zc of zipGeoData) {
        if (!zc) continue;
        
        // 1. Try exact polygon geojson coordinates
        if (zc.polygon) {
          const geom = zc.polygon;
          if (geom.type === 'Polygon' && geom.coordinates?.[0]) {
            const coords = geom.coordinates[0].map(([lng, lat]: [number, number]) => ({ latitude: lat, longitude: lng }));
            if (coords.length >= 3) {
              results.push({ zip: zc.zip, coords, isPrimary: zc.isPrimary });
              continue;
            }
          } else if (geom.type === 'MultiPolygon' && geom.coordinates?.[0]?.[0]) {
            const coords = geom.coordinates[0][0].map(([lng, lat]: [number, number]) => ({ latitude: lat, longitude: lng }));
            if (coords.length >= 3) {
              results.push({ zip: zc.zip, coords, isPrimary: zc.isPrimary });
              continue;
            }
          }
        }
        
        // 2. Fallback to rectangular bounding box
        if (zc.bounds) {
          const [sw, ne] = zc.bounds;
          const padding = 0.004; // Add padding similar to web version
          results.push({
            zip: zc.zip,
            isPrimary: zc.isPrimary,
            coords: [
              { latitude: sw[0] - padding, longitude: sw[1] - padding },
              { latitude: sw[0] - padding, longitude: ne[1] + padding },
              { latitude: ne[0] + padding, longitude: ne[1] + padding },
              { latitude: ne[0] + padding, longitude: sw[1] - padding }
            ]
          });
        }
      }
      setZipAreas(results);
      if (results.length > 0) {
        setCenter(currentCenter => {
          if (currentCenter) return currentCenter;
          const avgLat = results[0].coords.reduce((s, c) => s + c.latitude, 0) / results[0].coords.length;
          const avgLng = results[0].coords.reduce((s, c) => s + c.longitude, 0) / results[0].coords.length;
          return { lat: avgLat, lng: avgLng };
        });
      }
      return;
    }

    if (!zipCodes.length) { setZipAreas([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const results: ZipArea[] = [];
        for (const zip of zipCodes) {
          if (cancelled) break;
          const area = await fetchZipArea(zip);
          if (area) results.push(area);
        }
        if (!cancelled) {
          setZipAreas(results);
          if (results.length > 0) {
            setCenter(currentCenter => {
              if (currentCenter) return currentCenter;
              const avgLat = results[0].coords.reduce((s, c) => s + c.latitude, 0) / results[0].coords.length;
              const avgLng = results[0].coords.reduce((s, c) => s + c.longitude, 0) / results[0].coords.length;
              return { lat: avgLat, lng: avgLng };
            });
          } else {
            setCenter(currentCenter => {
              if (!currentCenter) {
                setHasError(true);
              }
              return currentCenter;
            });
          }
        }
      } catch (err) {
        if (!cancelled) {
          setCenter(currentCenter => {
            if (!currentCenter) {
              setHasError(true);
            }
            return currentCenter;
          });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [zipCodes.join(','), JSON.stringify(zipGeoData || [])]);

  // Zoom to show all areas once polygons are loaded
  useEffect(() => {
    if (mapRef.current) {
      const allCoords = zipAreas.flatMap(za => za.coords);
      if (hasBusinessLocation && center) {
        allCoords.push({ latitude: center.lat, longitude: center.lng });
      }
      if (allCoords.length > 0) {
        mapRef.current.fitToCoordinates(allCoords, {
          edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
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
        <ActivityIndicator size="small" color="#6366f1" />
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
        maxZoomLevel={13}
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
        {zipAreas.map((za) => (
          <Polygon
            key={za.zip}
            coordinates={za.coords}
            fillColor={za.isPrimary ? 'rgba(79, 70, 229, 0.35)' : 'rgba(79, 70, 229, 0.18)'}
            strokeColor="#4F46E5"
            strokeWidth={1}
          />
        ))}

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
