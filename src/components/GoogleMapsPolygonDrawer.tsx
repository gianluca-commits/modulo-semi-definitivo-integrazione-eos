import React, { useRef, useEffect, forwardRef, useImperativeHandle, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Square } from 'lucide-react';
import { googleMapsLoader } from '@/lib/googleMapsLoader';

interface PolygonDrawerProps {
  onPolygonChange: (polygon: { coordinates: number[][], area: number } | null) => void;
  initialCenter?: [number, number];
  initialZoom?: number;
}

interface PolygonDrawerRef {
  flyToLocation: (center: [number, number], bbox?: [number, number, number, number]) => void;
}

const GoogleMapsPolygonDrawer = forwardRef<PolygonDrawerRef, PolygonDrawerProps>(
  ({ onPolygonChange, initialCenter = [41.8719, 12.5674], initialZoom = 6 }, ref) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<google.maps.Map | null>(null);
    const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);
    const currentPolygonRef = useRef<google.maps.Polygon | null>(null);
    const [area, setArea] = useState<number | null>(null);
    const [isMapLoaded, setIsMapLoaded] = useState(false);

    useImperativeHandle(ref, () => ({
      flyToLocation: (center: [number, number], bbox?: [number, number, number, number]) => {
        if (!mapInstanceRef.current) return;
        
        if (bbox) {
          const bounds = new google.maps.LatLngBounds(
            { lat: bbox[1], lng: bbox[0] },
            { lat: bbox[3], lng: bbox[2] }
          );
          mapInstanceRef.current.fitBounds(bounds);
        } else {
          mapInstanceRef.current.setCenter({ lat: center[0], lng: center[1] });
          mapInstanceRef.current.setZoom(15);
        }
      }
    }));

    const calculatePolygonArea = (polygon: google.maps.Polygon): number => {
      const path = polygon.getPath();
      const area = google.maps.geometry.spherical.computeArea(path);
      return area / 10000; // Convert from m² to hectares
    };

    const extractCoordinates = (polygon: google.maps.Polygon): number[][] => {
      const path = polygon.getPath();
      const coordinates: number[][] = [];
      
      for (let i = 0; i < path.getLength(); i++) {
        const point = path.getAt(i);
        coordinates.push([point.lng(), point.lat()]);
      }
      
      // Close the polygon by adding the first point at the end
      if (coordinates.length > 0) {
        coordinates.push([...coordinates[0]]);
      }
      
      return coordinates;
    };

    const clearPolygon = () => {
      if (currentPolygonRef.current) {
        currentPolygonRef.current.setMap(null);
        currentPolygonRef.current = null;
        setArea(null);
        onPolygonChange(null);
      }
    };

    const setupPolygonListeners = (polygon: google.maps.Polygon) => {
      const updatePolygonData = () => {
        const newArea = calculatePolygonArea(polygon);
        const coordinates = extractCoordinates(polygon);
        setArea(newArea);
        onPolygonChange({ coordinates, area: newArea });
      };

      polygon.getPath().addListener('set_at', updatePolygonData);
      polygon.getPath().addListener('insert_at', updatePolygonData);
      polygon.getPath().addListener('remove_at', updatePolygonData);
    };

    useEffect(() => {
      const initializeMap = async () => {
        if (!mapRef.current) return;

        try {
          // Wait for Google Maps to be fully loaded
          await googleMapsLoader.load();
          
          // Double check that all required APIs are available
          if (!window.google?.maps?.Map || !window.google?.maps?.MapTypeId || !window.google?.maps?.drawing?.DrawingManager) {
            console.error('Google Maps API not fully loaded');
            return;
          }

          // Initialize map
          const map = new google.maps.Map(mapRef.current, {
            center: { lat: initialCenter[0], lng: initialCenter[1] },
            zoom: initialZoom,
            mapTypeId: google.maps.MapTypeId.SATELLITE,
            mapTypeControl: true,
            streetViewControl: false,
            fullscreenControl: true,
          });

        mapInstanceRef.current = map;

        // Initialize drawing manager
        const drawingManager = new google.maps.drawing.DrawingManager({
          drawingMode: null,
          drawingControl: true,
          drawingControlOptions: {
            position: google.maps.ControlPosition.TOP_CENTER,
            drawingModes: [google.maps.drawing.OverlayType.POLYGON],
          },
          polygonOptions: {
            fillColor: '#3b82f6',
            fillOpacity: 0.3,
            strokeWeight: 2,
            strokeColor: '#1d4ed8',
            clickable: true,
            editable: true,
            zIndex: 1,
          },
        });

        drawingManager.setMap(map);
        drawingManagerRef.current = drawingManager;

        // Handle polygon completion
        google.maps.event.addListener(drawingManager, 'polygoncomplete', (polygon: google.maps.Polygon) => {
          // Clear any existing polygon
          clearPolygon();
          
          // Set the new polygon
          currentPolygonRef.current = polygon;
          
          // Calculate initial area and coordinates
          const polygonArea = calculatePolygonArea(polygon);
          const coordinates = extractCoordinates(polygon);
          setArea(polygonArea);
          onPolygonChange({ coordinates, area: polygonArea });
          
          // Setup listeners for polygon editing
          setupPolygonListeners(polygon);
          
          // Disable drawing mode after polygon is created
          drawingManager.setDrawingMode(null);
        });

          setIsMapLoaded(true);
        } catch (error) {
          console.error('Failed to initialize Google Maps:', error);
        }
      };

      initializeMap();
    }, [initialCenter, initialZoom, onPolygonChange]);

    const startDrawing = () => {
      if (drawingManagerRef.current) {
        drawingManagerRef.current.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
      }
    };

    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Mappa del Campo</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={startDrawing}
                disabled={!isMapLoaded}
              >
                <Square className="h-4 w-4 mr-2" />
                Disegna Campo
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearPolygon}
                disabled={!currentPolygonRef.current}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Cancella
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div 
            ref={mapRef} 
            className="w-full h-[400px] rounded-lg border"
            style={{ minHeight: '400px' }}
          />
          {area && (
            <div className="mt-3 flex justify-center">
              <Badge variant="default">
                Area del campo: {area.toFixed(2)} ha
              </Badge>
            </div>
          )}
          {!isMapLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground">Caricamento mappa...</div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);

GoogleMapsPolygonDrawer.displayName = 'GoogleMapsPolygonDrawer';

export default GoogleMapsPolygonDrawer;