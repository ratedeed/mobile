import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking, Platform } from 'react-native';

/**
 * Checks and requests media library (photo) permissions.
 * If permission is denied, displays a friendly alert asking the user to open settings.
 * Returns true if permissions are granted, false otherwise.
 */
export const requestPhotoLibraryPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'web') return true;
  try {
    const { status: currentStatus, canAskAgain } = await ImagePicker.getMediaLibraryPermissionsAsync();
    
    if (currentStatus === 'granted') {
      return true;
    }

    if (currentStatus === 'denied' && !canAskAgain) {
      showSettingsAlert('photo library');
      return false;
    }

    const { status: requestStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (requestStatus === 'granted') {
      return true;
    }

    if (requestStatus === 'denied') {
      showSettingsAlert('photo library');
    }
    return false;
  } catch (error) {
    console.error('Error requesting photo library permission:', error);
    Alert.alert('Permission Error', 'Failed to verify photo library permissions.');
    return false;
  }
};

/**
 * Checks and requests camera permissions.
 * If permission is denied, displays a friendly alert asking the user to open settings.
 * Returns true if permissions are granted, false otherwise.
 */
export const requestCameraPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'web') return true;
  try {
    const { status: currentStatus, canAskAgain } = await ImagePicker.getCameraPermissionsAsync();
    
    if (currentStatus === 'granted') {
      return true;
    }

    if (currentStatus === 'denied' && !canAskAgain) {
      showSettingsAlert('camera');
      return false;
    }

    const { status: requestStatus } = await ImagePicker.requestCameraPermissionsAsync();
    if (requestStatus === 'granted') {
      return true;
    }

    if (requestStatus === 'denied') {
      showSettingsAlert('camera');
    }
    return false;
  } catch (error) {
    console.error('Error requesting camera permission:', error);
    Alert.alert('Permission Error', 'Failed to verify camera permissions.');
    return false;
  }
};

const showSettingsAlert = (featureName: string) => {
  Alert.alert(
    'Permission Required',
    `This app needs access to your ${featureName} to let you upload photos. Please enable it in your device settings.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings() },
    ],
    { cancelable: true }
  );
};
