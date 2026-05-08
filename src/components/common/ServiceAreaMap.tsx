import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import { FontAwesome5 } from '@expo/vector-icons';

interface ServiceAreaMapProps {
  businessName: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  zipCodes?: string[];
  height?: number;
}

async function geocodeLocation(query: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'RateDeed/1.0' } }
    );
    const data = await res.json();
    if (data?.[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {}
  return null;
}

export default function ServiceAreaMap({
  businessName,
  locationName,
  latitude,
  longitude,
  zipCodes = [],
  height = 220,
}: ServiceAreaMapProps) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    latitude && longitude ? { lat: latitude, lng: longitude } : null
  );
  const [loading, setLoading] = useState(!latitude || !longitude);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (latitude && longitude) {
      setCoords({ lat: latitude, lng: longitude });
      setLoading(false);
      return;
    }
    if (!locationName) { setLoading(false); setError(true); return; }

    let cancelled = false;
    (async () => {
      const geo = await geocodeLocation(locationName);
      if (cancelled) return;
      if (geo) setCoords(geo);
      else setError(true);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [latitude, longitude, locationName]);

  if (loading) {
    return (
      <View style={[styles.container, { height }]} className="bg-neutral-100 dark:bg-neutral-800 items-center justify-center rounded-2xl">
        <ActivityIndicator size="small" color="#6366f1" />
        <Text className="text-xs text-neutral-400 mt-2">Loading map...</Text>
      </View>
    );
  }

  if (error || !coords) return null;

  const region = {
    latitude: coords.lat,
    longitude: coords.lng,
    latitudeDelta: 0.06,
    longitudeDelta: 0.06,
  };

  return (
    <View style={{ height, borderRadius: 16, overflow: 'hidden' }}>
      <MapView
        style={StyleSheet.absoluteFillObject}
        initialRegion={region}
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
      >
        {/* CARTO light basemap — same as web */}
        <UrlTile
          urlTemplate="https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          maximumZ={19}
          flipY={false}
        />
        {/* Business pin — indigo color matching web */}
        <Marker
          coordinate={{ latitude: coords.lat, longitude: coords.lng }}
          title={businessName}
          pinColor="#4F46E5"
        />
      </MapView>
      {/* Zip code count badge */}
      {zipCodes.length > 0 && (
        <View className="absolute bottom-2 left-2 bg-white/90 dark:bg-neutral-900/90 rounded-full px-2.5 py-1 flex-row items-center" style={{ gap: 4, elevation: 2 }}>
          <FontAwesome5 name="map" size={9} color="#4F46E5" />
          <Text className="text-[10px] font-medium text-indigo-700 dark:text-indigo-400">
            {zipCodes.length} zip codes served
          </Text>
        </View>
      )}
      {/* Location label */}
      <View className="absolute top-2 left-2 bg-white/90 dark:bg-neutral-900/90 rounded-full px-2.5 py-1 flex-row items-center" style={{ gap: 4, elevation: 2 }}>
        <FontAwesome5 name="map-marker-alt" size={9} color="#4F46E5" />
        <Text className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-400" numberOfLines={1}>
          {businessName}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
});
