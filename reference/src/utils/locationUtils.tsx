import React, { useState, useEffect } from 'react';

// Utility to convert coordinates to address using multiple APIs as fallback
export const getAddressFromCoordinates = async (lat: number, lng: number): Promise<string> => {
  console.log('[LocationUtils] Buscando endereço para:', lat, lng);
  
  // Tentar primeiro com Nominatim (OpenStreetMap)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        signal: controller.signal,
        headers: {
          'User-Agent': 'PrimeCamp/1.0',
          'Accept-Language': 'pt-BR,pt;q=0.9'
        }
      }
    );
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      console.log('[LocationUtils] Resposta Nominatim:', data);
      
      if (data && data.display_name) {
        console.log('[LocationUtils] Endereço encontrado:', data.display_name);
        return data.display_name;
      }
      
      // Tentar construir endereço manualmente
      if (data && data.address) {
        const addr = data.address;
        const parts = [];
        if (addr.road) parts.push(addr.road);
        if (addr.house_number) parts.push(addr.house_number);
        if (addr.neighbourhood || addr.suburb) parts.push(addr.neighbourhood || addr.suburb);
        if (addr.city || addr.town || addr.village) parts.push(addr.city || addr.town || addr.village);
        if (addr.state) parts.push(addr.state);
        
        if (parts.length > 0) {
          const constructed = parts.join(', ');
          console.log('[LocationUtils] Endereço construído:', constructed);
          return constructed;
        }
      }
    }
  } catch (error: any) {
    console.warn('[LocationUtils] Erro Nominatim:', error.name === 'AbortError' ? 'Timeout' : error.message);
  }

  // Fallback: Tentar com BigDataCloud (gratuito, sem API key)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=pt`,
      {
        signal: controller.signal
      }
    );
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      console.log('[LocationUtils] Resposta BigDataCloud:', data);
      
      if (data && data.locality) {
        const parts = [];
        if (data.street) parts.push(data.street);
        if (data.locality) parts.push(data.locality);
        if (data.city) parts.push(data.city);
        if (data.principalSubdivision) parts.push(data.principalSubdivision);
        if (data.countryName) parts.push(data.countryName);
        
        if (parts.length > 0) {
          const address = parts.join(', ');
          console.log('[LocationUtils] Endereço BigDataCloud:', address);
          return address;
        }
      }
    }
  } catch (error: any) {
    console.warn('[LocationUtils] Erro BigDataCloud:', error.name === 'AbortError' ? 'Timeout' : error.message);
  }

  // Último fallback: coordenadas formatadas
  console.warn('[LocationUtils] Usando coordenadas como fallback');
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
};

// Component to display location with address lookup
export const LocationDisplay = ({ location }: { location: string | object | null | undefined }) => {
  // Converter location para string se for objeto
  const locationString = React.useMemo(() => {
    if (!location) return '';
    if (typeof location === 'string') return location;
    if (typeof location === 'object') {
      // Se for objeto com latitude e longitude
      if ('latitude' in location && 'longitude' in location) {
        return `${location.latitude}, ${location.longitude}`;
      }
      // Tentar converter para string
      return JSON.stringify(location);
    }
    return String(location);
  }, [location]);

  const [address, setAddress] = useState<string>(locationString);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    const loadAddress = async () => {
      if (locationString && locationString.includes(',')) {
        const [lat, lng] = locationString.split(',').map(coord => parseFloat(coord.trim()));
        
        if (!isNaN(lat) && !isNaN(lng)) {
          setLoading(true);
          setAddress(locationString); // Mostrar coordenadas enquanto carrega
          
          try {
            // Timeout total de 7 segundos (4s Nominatim + 3s BigDataCloud)
            const addr = await Promise.race([
              getAddressFromCoordinates(lat, lng),
              new Promise<string>(resolve => setTimeout(() => {
                console.warn('[LocationDisplay] Timeout na busca de endereço');
                resolve(locationString);
              }, 7000))
            ]);
            
            // Só atualizar se o endereço for diferente das coordenadas
            if (addr && addr !== locationString) {
              setAddress(addr);
            } else {
              setAddress(locationString);
            }
          } catch (error) {
            console.error('[LocationDisplay] Erro ao carregar endereço:', error);
            setAddress(locationString); // Fallback para coordenadas originais
          } finally {
            setLoading(false);
          }
        } else {
          setAddress(locationString);
        }
      } else {
        setAddress(locationString || 'Localização não disponível');
      }
    };

    loadAddress();
  }, [locationString]);

  if (loading) {
    return <span className="text-muted-foreground">Carregando endereço...</span>;
  }

  return (
    <span className="text-sm" title={locationString}>
      {address.length > 50 ? `${address.substring(0, 50)}...` : address}
    </span>
  );
};

// Hook version for use in components
export const useLocationAddress = (coordinates: string) => {
  const [address, setAddress] = useState<string>(coordinates);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    const loadAddress = async () => {
      if (coordinates && coordinates.includes(',')) {
        const [lat, lng] = coordinates.split(',').map(coord => parseFloat(coord.trim()));
        
        if (!isNaN(lat) && !isNaN(lng)) {
          setLoading(true);
          try {
            const addr = await getAddressFromCoordinates(lat, lng);
            setAddress(addr);
          } catch (error) {
            console.error('Failed to load address:', error);
          } finally {
            setLoading(false);
          }
        }
      }
    };

    loadAddress();
  }, [coordinates]);

  return { address, loading };
};