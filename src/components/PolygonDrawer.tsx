import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Square, Info } from 'lucide-react';
import { 
  MAPBOX_STYLE, 
  DEFAULT_CENTER, 
  DEFAULT_ZOOM,
  validatePolygon,
  calculatePolygonArea,
  polygonToGeoJSON
} from '@/lib/mapbox';
import { useToast } from '@/hooks/use-toast';

// Mapbox CSS now imported globally in index.css

interface PolygonDrawerProps {
  onPolygonChange: (polygon: {
    type: string;
    coordinates: number[][][];
  } | null, area?: number) => void;
  mapboxToken?: string;
  initialCenter?: [number, number];
  initialZoom?: number;
}

export const PolygonDrawer = React.forwardRef<
  { flyToLocation: (center: [number, number], bbox?: [number, number, number, number]) => void },
  PolygonDrawerProps
>(({
  onPolygonChange,
  mapboxToken,
  initialCenter = DEFAULT_CENTER,
  initialZoom = DEFAULT_ZOOM
}, ref) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const draw = useRef<MapboxDraw | null>(null);
  const [area, setArea] = useState<number | null>(null);
  const [isValidPolygon, setIsValidPolygon] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) {
      setIsMapLoading(false);
      if (!mapboxToken) {
        setMapError("Token Mapbox non disponibile");
      }
      return;
    }

    const initializeMap = () => {
      try {
        console.log('Initializing map with token:', mapboxToken.substring(0, 20) + '...');
        
        // Ensure container has dimensions
        const container = mapContainer.current;
        if (!container || container.offsetWidth === 0 || container.offsetHeight === 0) {
          console.warn('Map container has zero dimensions:', { 
            width: container?.offsetWidth, 
            height: container?.offsetHeight 
          });
          setMapError("Container della mappa ha dimensioni non valide");
          setIsMapLoading(false);
          return;
        }

        // Initialize map
        mapboxgl.accessToken = mapboxToken;
        
        map.current = new mapboxgl.Map({
          container: container,
          style: "mapbox://styles/mapbox/satellite-v9",
          center: initialCenter,
          zoom: initialZoom,
          attributionControl: false,
          preserveDrawingBuffer: true
        });

        console.log('Map created, waiting for load event...');
      } catch (error) {
        console.error('Error creating map:', error);
        setMapError(`Errore inizializzazione mappa: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
        setIsMapLoading(false);
        return;
      }
    };

    const setupMapControls = () => {
      if (!map.current) return;
      
      // Wait for map to load before adding controls
      map.current.on('load', () => {
        console.log('Map loaded successfully');
        setIsMapLoading(false);
        setMapError(null);
        
        // Add navigation controls
        if (map.current) {
          map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
          
          // Initialize drawing tools
          draw.current = new MapboxDraw({
            displayControlsDefault: false,
            controls: {
              polygon: true,
              trash: true
            },
            defaultMode: 'draw_polygon'
          });

          map.current.addControl(draw.current, 'top-left');
          
          // Handle drawing events
          const handlePolygonUpdate = () => {
            if (!draw.current) return;

            const data = draw.current.getAll();
            const polygons = data.features.filter(f => f.geometry.type === 'Polygon');

            if (polygons.length === 0) {
              setArea(null);
              setIsValidPolygon(false);
              setValidationError(null);
              onPolygonChange(null);
              return;
            }

            // Only allow one polygon
            if (polygons.length > 1) {
              // Remove all but the last polygon
              const toDelete = polygons.slice(0, -1).map(p => p.id);
              draw.current.delete(toDelete as string[]);
              toast({
                title: "Un solo poligono",
                description: "È possibile disegnare solo un campo alla volta",
                variant: "default"
              });
            }

            const polygon = polygons[polygons.length - 1];
            const geometry = polygon.geometry as any; // MapboxDraw polygon geometry
            const coordinates = geometry.coordinates[0];

            // Validate polygon
            const validation = validatePolygon(coordinates);
            setIsValidPolygon(validation.isValid);
            setValidationError(validation.error || null);
            setArea(validation.area || null);

            if (validation.isValid) {
              const geoJsonPolygon = polygonToGeoJSON(coordinates);
              onPolygonChange(geoJsonPolygon, validation.area);
            } else {
              onPolygonChange(null);
              if (validation.error) {
                toast({
                  title: "Poligono non valido",
                  description: validation.error,
                  variant: "destructive"
                });
              }
            }
          };

          map.current.on('draw.create', handlePolygonUpdate);
          map.current.on('draw.update', handlePolygonUpdate);
          map.current.on('draw.delete', handlePolygonUpdate);
        }
      });

      map.current.on('error', (e) => {
        console.error('Map error:', e);
        setMapError(`Errore caricamento mappa: ${e.error?.message || 'Errore sconosciuto'}`);
        setIsMapLoading(false);
      });
    };

    // Initialize with a small delay to ensure DOM is ready
    setTimeout(() => {
      initializeMap();
      setupMapControls();
    }, 100);


    return () => {
      // Safely cleanup map and drawing controls
      try {
        if (map.current) {
          // Remove all event listeners first
          map.current.off('draw.create', undefined);
          map.current.off('draw.update', undefined);
          map.current.off('draw.delete', undefined);
          map.current.off('load', undefined);
          map.current.off('error', undefined);
          
          // Remove drawing controls if they exist
          if (draw.current && map.current.hasControl(draw.current)) {
            map.current.removeControl(draw.current);
          }
          
          // Remove map
          map.current.remove();
          map.current = null;
        }
        
        draw.current = null;
      } catch (error) {
        console.warn('Error during map cleanup:', error);
        // Force null the references even if cleanup failed
        map.current = null;
        draw.current = null;
      }
    };
  }, [mapboxToken, initialCenter, initialZoom, onPolygonChange, toast]);

  // Expose flyToLocation function to parent via ref
  React.useImperativeHandle(ref, () => ({
    flyToLocation: (center: [number, number], bbox?: [number, number, number, number]) => {
      if (!map.current) return;

      if (bbox) {
        map.current.fitBounds([
          [bbox[0], bbox[1]], 
          [bbox[2], bbox[3]]
        ], { 
          padding: 50,
          maxZoom: 15 
        });
      } else {
        map.current.flyTo({
          center,
          zoom: 14,
          duration: 1500
        });
      }
    }
  }));


  const clearPolygon = () => {
    if (draw.current) {
      draw.current.deleteAll();
      setArea(null);
      setIsValidPolygon(false);
      setValidationError(null);
      onPolygonChange(null);
    }
  };

  const retryMapLoad = () => {
    setIsMapLoading(true);
    setMapError(null);
    
    // Safely cleanup existing map instance
    try {
      if (draw.current) {
        if (map.current && map.current.hasControl(draw.current)) {
          map.current.removeControl(draw.current);
        }
        draw.current = null;
      }
      
      if (map.current) {
        if (map.current.loaded()) {
          map.current.remove();
        }
        map.current = null;
      }
    } catch (error) {
      console.warn('Error during map cleanup for retry:', error);
      map.current = null;
      draw.current = null;
    }
    
    // Force re-initialization by triggering the useEffect
    setTimeout(() => {
      setIsMapLoading(true);
    }, 100);
  };

  return (
    <div className="space-y-4">
      <Card className="relative h-96 overflow-hidden">
        <div 
          ref={mapContainer} 
          className="w-full h-full min-h-96"
          style={{ minHeight: '384px' }}
        />
        
        {/* Loading overlay */}
        {isMapLoading && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-20">
            <div className="text-center space-y-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground">Caricamento mappa...</p>
            </div>
          </div>
        )}
        
        {/* Error overlay */}
        {mapError && (
          <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center z-20">
            <div className="text-center space-y-4 p-6">
              <div className="text-destructive">
                <Info className="h-8 w-8 mx-auto mb-2" />
                <p className="font-medium">Errore caricamento mappa</p>
                <p className="text-sm text-muted-foreground mt-1">{mapError}</p>
              </div>
              <Button 
                onClick={retryMapLoad}
                size="sm"
                variant="outline"
              >
                Riprova
              </Button>
            </div>
          </div>
        )}
        
        {/* Info overlay */}
        <div className="absolute top-4 left-4 right-4 z-10">
          <Card className="p-3 bg-background/95 backdrop-blur-sm">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium mb-1">Come disegnare il campo:</p>
                <p className="text-muted-foreground">
                  Clicca sulla mappa per iniziare a disegnare il perimetro del campo. 
                  Fai doppio click per completare il poligono.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Area display */}
        {area !== null && (
          <div className="absolute bottom-4 left-4 z-10">
            <Badge variant={isValidPolygon ? "default" : "destructive"} className="text-sm">
              Area: {area.toFixed(2)} ha
              {!isValidPolygon && validationError && (
                <span className="ml-2">• {validationError}</span>
              )}
            </Badge>
          </div>
        )}

        {/* Clear button */}
        {area !== null && (
          <div className="absolute bottom-4 right-4 z-10">
            <Button
              size="sm"
              variant="destructive"
              onClick={clearPolygon}
              className="shadow-lg"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Cancella
            </Button>
          </div>
        )}
      </Card>

      {!mapboxToken && (
        <Card className="p-4 border-destructive">
          <div className="flex items-center gap-2 text-destructive">
            <Info className="h-4 w-4" />
            <span className="text-sm font-medium">
              Token Mapbox richiesto per utilizzare la mappa interattiva
            </span>
          </div>
        </Card>
      )}
    </div>
  );
});

// Export the flyToLocation function so it can be used by parent components
export const useFlyToLocation = (mapRef: React.MutableRefObject<mapboxgl.Map | null>) => {
  return (center: [number, number], bbox?: [number, number, number, number]) => {
    if (!mapRef.current) return;

    if (bbox) {
      mapRef.current.fitBounds([
        [bbox[0], bbox[1]], 
        [bbox[2], bbox[3]]
      ], { 
        padding: 50,
        maxZoom: 15 
      });
    } else {
      mapRef.current.flyTo({
        center,
        zoom: 14,
        duration: 1500
      });
    }
  };
};