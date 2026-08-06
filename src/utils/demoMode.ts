import { Platform } from 'react-native';

const FORCE_DEMO = process.env.EXPO_PUBLIC_DEMO_MODE;

let _isDemoMode: boolean | null = null;

export const isDemoMode = (): boolean => {
  if (_isDemoMode !== null) return _isDemoMode;

  if (FORCE_DEMO === 'true') {
    _isDemoMode = true;
  } else {
    _isDemoMode = false;
  }

  return _isDemoMode;
};

export const setDemoMode = (value: boolean): void => {
  _isDemoMode = value;
};

export const requireDemoMode = <T>(real: T, demo: T): T => (isDemoMode() ? demo : real);

