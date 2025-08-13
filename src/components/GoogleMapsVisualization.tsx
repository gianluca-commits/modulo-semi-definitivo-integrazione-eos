import React, { useRef, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from './ui/card';
import { Badge } from './ui/badge';

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
    if (!polygon.coordinates.length) return { lat: 41.9028, lng: 12.4964 }; // Default to Rome
    
    const lats = polygon.coordinates.map(coord => coord[1]);
    const lngs = polygon.coordinates.map(coord => coord[0]);
    
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    
    return { lat: centerLat, lng: centerLng };
  }, [polygon.coordinates]);

  // Convert coordinates to Google Maps format
  const googleMapsCoordinates = useMemo(() => {
    return polygon.coordinates.map(coord => ({ lat: coord[1], lng: coord[0] }));
  }, [polygon.coordinates]);

  useEffect(() => {
    const initializeMap = () => {
      if (!mapRef.current || !window.google?.maps || !googleMapsCoordinates.length) return;

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
        fillOpacity: 0.3,
      });

      polygonPath.setMap(map);

      // Fit bounds to polygon
      const bounds = new google.maps.LatLngBounds();
      googleMapsCoordinates.forEach(coord => bounds.extend(coord));
      map.fitBounds(bounds);
    };

    // Check if Google Maps is already loaded
    if (window.google?.maps) {
      initializeMap();
    } else {
      // Wait for Google Maps to load
      const checkGoogleMaps = setInterval(() => {
        if (window.google?.maps) {
          clearInterval(checkGoogleMaps);
          initializeMap();
        }
      }, 100);

      return () => clearInterval(checkGoogleMaps);
    }
  }, [center, googleMapsCoordinates]);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary">
              {polygon.area_ha.toFixed(2)} ha
            </Badge>
            <Badge variant="outline">
              {polygon.source}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="h-96 w-full rounded-lg overflow-hidden border google-maps-container">
          <div
            ref={mapRef}
            style={{ height: '100%', width: '100%' }}
          />
        </div>
        
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Area:</span> {polygon.area_ha.toFixed(2)} ettari
          </div>
          <div>
            <span className="font-medium">Fonte:</span> {polygon.source}
          </div>
          <div className="col-span-2">
            <span className="font-medium">Punti del poligono:</span> {polygon.coordinates.length}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default GoogleMapsVisualization;