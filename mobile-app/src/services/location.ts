import * as Location from 'expo-location';

export interface DeviceLocation {
  lat: number;
  lng: number;
  address: string;
}

export const getCurrentLocation = async (): Promise<DeviceLocation | null> => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    return null;
  }

  const coords = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  const reverse = await Location.reverseGeocodeAsync({
    latitude: coords.coords.latitude,
    longitude: coords.coords.longitude,
  });

  const first = reverse[0];
  const address = first
    ? [first.name, first.street, first.city, first.region].filter(Boolean).join(', ')
    : 'Current location';

  return {
    lat: coords.coords.latitude,
    lng: coords.coords.longitude,
    address,
  };
};
