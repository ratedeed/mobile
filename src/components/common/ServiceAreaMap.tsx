import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import MapView, { Marker, Polygon, UrlTile } from 'react-native-maps';
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
  try {
    // Query OpenStreetMap via Overpass API for postal code boundary polygons
    const query = `[out:json][timeout:10];relation["boundary"="postal_code"]["postal_code"="${zip}"];out geom;`;
    const res = await fetch(
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
      { headers: { 'User-Agent': 'RateDeedMobile/1.0' } }
    );
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

    // Fallback: try Nominatim with polygon_geojson
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(zip)}&countrycodes=us&format=geojson&polygon_geojson=1&limit=1`,
      { headers: { 'User-Agent': 'RateDeedMobile/1.0' } }
    );
    const nomData = await nomRes.json();
    const geom = nomData?.features?.[0]?.geometry;
    if (geom?.type === 'Polygon' && geom.coordinates?.[0]) {
      const ring: number[][] = geom.coordinates[0];
      const coords = ring.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
      if (coords.length >= 3) return { zip, coords };
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

  // Geocode the business address
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let coords: { lat: number; lng: number } | null = null;
      if (latitude && longitude) {
        coords = { lat: latitude, lng: longitude };
      } else if (locationName) {
        coords = await geocodeLocation(locationName);
      }
      if (!cancelled) setCenter(coords);
    })();
    return () => { cancelled = true; };
  }, [latitude, longitude, locationName]);

  // Fetch zip code polygons or use zipGeoData
  useEffect(() => {
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
      if (!center && results.length > 0) {
        const avgLat = results[0].coords.reduce((s, c) => s + c.latitude, 0) / results[0].coords.length;
        const avgLng = results[0].coords.reduce((s, c) => s + c.longitude, 0) / results[0].coords.length;
        setCenter({ lat: avgLat, lng: avgLng });
      }
      return;
    }

    if (!zipCodes.length) { setZipAreas([]); return; }
    let cancelled = false;
    (async () => {
      const results: ZipArea[] = [];
      for (const zip of zipCodes) {
        if (cancelled) break;
        const area = await fetchZipArea(zip);
        if (area) results.push(area);
      }
      if (!cancelled) {
        setZipAreas(results);
        if (!center && results.length > 0) {
          const avgLat = results[0].coords.reduce((s, c) => s + c.latitude, 0) / results[0].coords.length;
          const avgLng = results[0].coords.reduce((s, c) => s + c.longitude, 0) / results[0].coords.length;
          setCenter({ lat: avgLat, lng: avgLng });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [zipCodes.join(','), JSON.stringify(zipGeoData || [])]);

  // Zoom to show all areas once polygons are loaded
  useEffect(() => {
    if (zipAreas.length > 0 && mapRef.current) {
      const allCoords = zipAreas.flatMap(za => za.coords);
      if (allCoords.length > 0) {
        mapRef.current.fitToCoordinates(allCoords, {
          edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
          animated: true,
        });
      }
    }
  }, [zipAreas]);

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
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
});



