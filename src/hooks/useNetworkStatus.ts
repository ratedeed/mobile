import { useState, useEffect, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';

export const useNetworkStatus = () => {
  const [isConnected, setIsConnected] = useState(true);
  const [isInternetReachable, setIsInternetReachable] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? false);
      setIsInternetReachable(state.isInternetReachable ?? false);
    });

    return () => unsubscribe();
  }, []);

  return { isConnected, isInternetReachable };
};

export const useNetworkCallback = (callback: (isConnected: boolean) => void) => {
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      callback(state.isConnected ?? false);
    });

    return () => unsubscribe();
  }, [callback]);
};
