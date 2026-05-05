import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { SvgXml } from 'react-native-svg';

export const SvgImage = ({ uri, width = '100%', height = '100%', style, preserveAspectRatio = 'xMidYMid slice' }: { uri: string, width?: any, height?: any, style?: any, preserveAspectRatio?: string }) => {
  const [xml, setXml] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    const fetchSvg = async () => {
      try {
        if (uri.startsWith('data:image/svg+xml')) {
          const parts = uri.split(',');
          if (parts.length > 1) {
            let decoded = decodeURIComponent(parts.slice(1).join(','));
            // Remove unsupported drop-shadow filters that cause React Native crashes/warnings
            decoded = decoded.replace(/style="filter:\s*drop-shadow\([^"]*\);?"/g, '');
            decoded = decoded.replace(/filter="drop-shadow\([^"]*\)"/g, '');
            if (isMounted) setXml(decoded);
          }
        } else if (uri.startsWith('http')) {
          const response = await fetch(uri);
          let text = await response.text();
          if (text.includes('<svg') && isMounted) {
            // Remove unsupported drop-shadow filters
            text = text.replace(/style="filter:\s*drop-shadow\([^"]*\);?"/g, '');
            text = text.replace(/filter="drop-shadow\([^"]*\)"/g, '');
            setXml(text);
          } else if (isMounted) {
            setXml('error');
          }
        } else if (uri.includes('<svg')) {
          let cleaned = uri;
          cleaned = cleaned.replace(/style="filter:\s*drop-shadow\([^"]*\);?"/g, '');
          cleaned = cleaned.replace(/filter="drop-shadow\([^"]*\)"/g, '');
          if (isMounted) setXml(cleaned);
        } else if (isMounted) {
          setXml('error');
        }
      } catch {
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

  return <SvgXml xml={xml} width={width} height={height} style={style} preserveAspectRatio={preserveAspectRatio} />;
};
