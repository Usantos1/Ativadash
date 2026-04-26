export interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
  ipAddress?: string;
}

export const getLocationAndIP = async (): Promise<LocationData> => {
  return new Promise(async (resolve, reject) => {
    try {
      // Get IP address first
      let ipAddress: string | undefined;
      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        ipAddress = ipData.ip;
      } catch (error) {
        console.warn('Could not fetch IP address:', error);
      }

      // Request geolocation permission
      if (!navigator.geolocation) {
        reject(new Error('Geolocalização não é suportada neste navegador'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          // Try to get address from coordinates
          let address: string | undefined;
          try {
            // Using OpenCage Geocoding API (free tier)
            const geocodeResponse = await fetch(
              `https://api.opencagedata.com/geocode/v1/json?q=${latitude}+${longitude}&key=demo&language=pt&limit=1`
            );
            const geocodeData = await geocodeResponse.json();
            
            if (geocodeData.results && geocodeData.results.length > 0) {
              address = geocodeData.results[0].formatted;
            }
          } catch (error) {
            console.warn('Could not get address from coordinates:', error);
            address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
          }

          resolve({
            latitude,
            longitude,
            address,
            ipAddress
          });
        },
        (error) => {
          let errorMessage = 'Erro ao obter localização';
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Permissão de localização negada. É necessário permitir o acesso à localização para registrar o ponto.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Localização indisponível.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Tempo limite para obter localização excedido.';
              break;
          }
          
          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000, // Increased for mobile
          maximumAge: 30000 // Reduced cache for better accuracy
        }
      );
    } catch (error) {
      reject(error);
    }
  });
};

export const requestLocationPermission = async (): Promise<boolean> => {
  if (!navigator.geolocation) {
    return false;
  }

  try {
    const permission = await navigator.permissions.query({ name: 'geolocation' });
    
    if (permission.state === 'granted') {
      return true;
    }
    
    if (permission.state === 'prompt') {
      // Try to get location to trigger permission request
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve(true),
          () => resolve(false),
          { timeout: 5000 }
        );
      });
    }
    
    return false;
  } catch (error) {
    console.error('Error checking location permission:', error);
    return false;
  }
};