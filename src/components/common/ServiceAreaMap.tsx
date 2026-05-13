import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import MapView, { Marker, UrlTile, Polygon } from 'react-native-maps';
import { FontAwesome5 } from '@expo/vector-icons';

interface ServiceAreaMapProps {
  businessName: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  zipCodes?: string[];
  height?: number;
}

interface ZipArea {
  zip: string;
  coords: { latitude: number; longitude: number }[];
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

  // Fetch zip code polygons
  useEffect(() => {
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
  }, [zipCodes.join(',')]);

  // Zoom to show all areas once polygons are loaded
  useEffect(() => {
    if (zipAreas.length > 0 && mapRef.current) {
      const allCoords = zipAreas.flatMap(za => za.coords);
      if (allCoords.length > 0) {
        mapRef.current.fitToCoordinates(allCoords, {
          edgePadding: { top: 30, right: 30, bottom: 30, left: 30 },
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
        initialRegion={{
          latitude: center.lat,
          longitude: center.lng,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
        scrollEnabled={true}
        zoomEnabled={true}
        rotateEnabled={false}
        pitchEnabled={false}
        showsUserLocation={false}
        showsTraffic={false}
        showsPointsOfInterests={false}
        showsBuildings={false}
        showsIndoors={false}
        toolbarEnabled={false}
        mapType="standard"
      >
        <UrlTile
          urlTemplate="https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
          maximumZ={19}
          flipY={false}
        />

        {zipAreas.map((za) => (
          <Polygon
            key={za.zip}
            coordinates={za.coords}
            fillColor="rgba(79, 70, 229, 0.2)"
            strokeColor="#4F46E5"
            strokeWidth={1.5}
          />
        ))}

        <Marker
          coordinate={{ latitude: center.lat, longitude: center.lng }}
          title={businessName}
          pinColor="#4F46E5"
        />
      </MapView>

      {zipCodes.length > 0 && (
        <View className="absolute bottom-2 left-2 bg-white/90 rounded-full px-2.5 py-1 flex-row items-center" style={{ gap: 4, elevation: 2 }}>
          <FontAwesome5 name="map" size={9} color="#4F46E5" />
          <Text className="text-[10px] font-medium text-indigo-700">
            {zipCodes.length} zip codes served
          </Text>
        </View>
      )}

      <View className="absolute top-2 left-2 bg-white/90 rounded-full px-2.5 py-1 flex-row items-center" style={{ gap: 4, elevation: 2 }}>
        <FontAwesome5 name="map-marker-alt" size={9} color="#4F46E5" />
        <Text className="text-[10px] font-semibold text-indigo-700" numberOfLines={1}>
          {businessName}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
});
