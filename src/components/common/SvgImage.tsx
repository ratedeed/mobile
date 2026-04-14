import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { SvgXml } from 'react-native-svg';

export const SvgImage = ({ uri, width = '100%', height = '100%', style }: { uri: string, width?: any, height?: any, style?: any }) => {
  const [xml, setXml] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    const fetchSvg = async () => {
      try {
        if (uri.startsWith('data:image/svg+xml')) {
          const parts = uri.split(',');
          if (parts.length > 1) {
            const decoded = decodeURIComponent(parts.slice(1).join(','));
            if (isMounted) setXml(decoded);
          }
        } else if (uri.startsWith('http')) {
          const response = await fetch(uri);
          let text = await response.text();
          if (text.includes('<svg') && isMounted) {
            // Remove unsupported drop-shadow filters that cause React Native crashes/warnings
            text = text.replace(/style="filter:\s*drop-shadow\([^"]*\);?"/g, '');
            setXml(text);
          } else if (isMounted) {
            console.warn('SvgImage: Fetched content is not a valid SVG:', text.slice(0, 100));
            setXml('error'); // Use a marker to show fallback
          }
        } else if (uri.includes('<svg')) {
          if (isMounted) setXml(uri);
        } else if (isMounted) {
          setXml('error');
        }
      } catch (err) {
        console.error('SvgImage Error fetching URI:', uri, err);
        if (isMounted) setXml('error');
      }
    };

    fetchSvg();
    return () => { isMounted = false; };
  }, [uri]);

  if (xml === 'error') {
    return <View style={[{ width, height, backgroundColor: '#f5f5f5' }, style]} />;
  }

  if (!xml) {
    return (
      <View style={[{ width, height, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' }, style]}>
        <ActivityIndicator size="small" color="#a3a3a3" />
      </View>
    );
  }

  return <SvgXml xml={xml} width={width} height={height} style={style} />;
};
