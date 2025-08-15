import React, { useRef, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { googleMapsLoader } from '@/lib/googleMapsLoader';
interface PolygonVisualizationProps {
  polygon: {
    coordinates: number[][];
    area_ha: number;
    source: string;
  };
  title?: string;
  description?: string;
}
const GoogleMapsVisualization: React.FC<PolygonVisualizationProps> = ({
  polygon,
  title = "Visualizzazione Campo",
  description
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);

  // Calculate the center of the polygon for map centering
  const center = useMemo(() => {
    if (!polygon.coordinates.length) return {
      lat: 41.9028,
      lng: 12.4964
    }; // Default to Rome

    const lats = polygon.coordinates.map(coord => coord[1]);
    const lngs = polygon.coordinates.map(coord => coord[0]);
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    return {
      lat: centerLat,
      lng: centerLng
    };
  }, [polygon.coordinates]);

  // Convert coordinates to Google Maps format
  const googleMapsCoordinates = useMemo(() => {
    return polygon.coordinates.map(coord => ({
      lat: coord[1],
      lng: coord[0]
    }));
  }, [polygon.coordinates]);
  useEffect(() => {
    const initializeMap = async () => {
      if (!mapRef.current || !googleMapsCoordinates.length) return;
      try {
        // Wait for Google Maps to be fully loaded
        await googleMapsLoader.load();

        // Double check that all required APIs are available
        if (!window.google?.maps?.Map || !window.google?.maps?.MapTypeId || !window.google?.maps?.Polygon) {
          console.error('Google Maps API not fully loaded for visualization');
          return;
        }

        // Initialize map
        const map = new google.maps.Map(mapRef.current, {
          center: center,
          zoom: 14,
          mapTypeId: google.maps.MapTypeId.SATELLITE,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
          gestureHandling: 'cooperative'
        });
        mapInstanceRef.current = map;

        // Create polygon
        const polygonPath = new google.maps.Polygon({
          paths: googleMapsCoordinates,
          strokeColor: 'hsl(var(--primary))',
          strokeOpacity: 1,
          strokeWeight: 2,
          fillColor: 'hsl(var(--primary))',
          fillOpacity: 0.3
        });
        polygonPath.setMap(map);

        // Fit bounds to polygon
        const bounds = new google.maps.LatLngBounds();
        googleMapsCoordinates.forEach(coord => bounds.extend(coord));
        map.fitBounds(bounds);
      } catch (error) {
        console.error('Failed to initialize Google Maps visualization:', error);
      }
    };
    initializeMap();
  }, [center, googleMapsCoordinates]);
  return <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="h-96 w-full rounded-lg overflow-hidden border google-maps-container">
          <div ref={mapRef} style={{
          height: '100%',
          width: '100%'
        }} />
        </div>
        
        
      </CardContent>
    </Card>;
};
export default GoogleMapsVisualization;