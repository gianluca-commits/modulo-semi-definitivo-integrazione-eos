import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Info, Edit3, Undo2, Plus, Hand } from 'lucide-react';
import { DEFAULT_CENTER, DEFAULT_ZOOM, validatePolygon, polygonToGeoJSON } from '@/lib/mapbox';
import { useToast } from '@/hooks/use-toast';
import { useMapboxStable } from '@/hooks/useMapboxStable';

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
export const PolygonDrawer = React.forwardRef<{
  flyToLocation: (center: [number, number], bbox?: [number, number, number, number]) => void;
}, PolygonDrawerProps>(({
  onPolygonChange,
  mapboxToken,
  initialCenter = DEFAULT_CENTER,
  initialZoom = DEFAULT_ZOOM
}, ref) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const draw = useRef<MapboxDraw | null>(null);
  const [area, setArea] = useState<number | null>(null);
  const [isValidPolygon, setIsValidPolygon] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [drawingMode, setDrawingMode] = useState<'draw_polygon' | 'direct_select' | 'simple_select'>('draw_polygon');
  const [pointCount, setPointCount] = useState(0);
  const [hasPolygon, setHasPolygon] = useState(false);
  const {
    toast
  } = useToast();

  // Handle drawing events - defined outside to be accessible for cleanup
  const handlePolygonUpdate = React.useCallback(() => {
    if (!draw.current) return;
    const data = draw.current.getAll();
    const polygons = data.features.filter(f => f.geometry.type === 'Polygon');
    console.log('Drawing event:', {
      totalFeatures: data.features.length,
      polygons: polygons.length,
      mode: draw.current.getMode()
    });
    if (polygons.length === 0) {
      setArea(null);
      setIsValidPolygon(false);
      setValidationError(null);
      setPointCount(0);
      setHasPolygon(false);
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
    const geometry = polygon.geometry as any;
    const coordinates = geometry.coordinates[0];
    setPointCount(coordinates.length - 1); // -1 because last point equals first point
    setHasPolygon(true);

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
    }
  }, [draw, onPolygonChange, toast]);

  // Use stable map hook to prevent re-initializations
  const {
    map,
    isLoading,
    error,
    isInitialized,
    retry
  } = useMapboxStable(mapContainer, {
    token: mapboxToken,
    center: initialCenter,
    zoom: initialZoom,
    onLoad: () => {
      setupDrawControls();
    },
    onError: errorMsg => {
      console.error('Map initialization error:', errorMsg);
    }
  });

  // Setup draw controls when map is loaded
  const setupDrawControls = React.useCallback(() => {
    if (!map || !isInitialized) return;
    try {
      console.log('Setting up draw controls...');

      // Add navigation controls
      map.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // Initialize drawing tools with some default controls and our custom ones
      draw.current = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
          polygon: true,
          trash: true
        },
        defaultMode: 'draw_polygon',
        userProperties: true,
        clickBuffer: 2,
        touchBuffer: 25
      });
      map.addControl(draw.current, 'top-left');

      // Add event listeners
      map.on('draw.create', handlePolygonUpdate);
      map.on('draw.update', handlePolygonUpdate);
      map.on('draw.delete', handlePolygonUpdate);
      map.on('draw.modechange', (e: any) => {
        console.log('Mode changed to:', e.mode);
        setDrawingMode(e.mode as 'draw_polygon' | 'direct_select' | 'simple_select');
      });
      console.log('Draw controls setup complete. Current mode:', draw.current.getMode());
    } catch (error) {
      console.error('Error setting up draw controls:', error);
    }
  }, [map, isInitialized, handlePolygonUpdate]);

  // Cleanup draw controls when component unmounts
  useEffect(() => {
    return () => {
      if (draw.current && map) {
        try {
          // Remove drawing event listeners
          map.off('draw.create', handlePolygonUpdate);
          map.off('draw.update', handlePolygonUpdate);
          map.off('draw.delete', handlePolygonUpdate);

          // Remove draw control
          if (map.hasControl(draw.current)) {
            map.removeControl(draw.current);
          }
        } catch (e) {
          console.warn('Error cleaning up draw controls:', e);
        }
        draw.current = null;
      }
    };
  }, [map, handlePolygonUpdate]);

  // Expose flyToLocation function to parent via ref
  React.useImperativeHandle(ref, () => ({
    flyToLocation: (center: [number, number], bbox?: [number, number, number, number]) => {
      if (!map) return;
      if (bbox) {
        map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], {
          padding: 50,
          maxZoom: 15
        });
      } else {
        map.flyTo({
          center,
          zoom: 14,
          duration: 1500
        });
      }
    }
  }));

  // Drawing control functions
  const clearPolygon = () => {
    if (draw.current) {
      draw.current.deleteAll();
      setArea(null);
      setIsValidPolygon(false);
      setValidationError(null);
      setPointCount(0);
      setHasPolygon(false);
      onPolygonChange(null);
      setDrawingMode('draw_polygon');
      draw.current.changeMode('draw_polygon');
    }
  };
  const startNewPolygon = () => {
    clearPolygon();
  };
  const enterEditMode = () => {
    if (draw.current && hasPolygon) {
      const data = draw.current.getAll();
      if (data.features.length > 0) {
        const polygonId = data.features[0].id;
        (draw.current as any).changeMode('direct_select', {
          featureId: polygonId
        });
        setDrawingMode('direct_select');
        toast({
          title: "Modalità modifica",
          description: "Trascina i punti per modificare il poligono",
          variant: "default"
        });
      }
    }
  };
  const exitEditMode = () => {
    if (draw.current) {
      draw.current.changeMode('simple_select');
      setDrawingMode('simple_select');
    }
  };
  const undoLastPoint = () => {
    if (draw.current && drawingMode === 'draw_polygon') {
      // This is a limitation of MapboxDraw - we can't easily undo the last point
      // during drawing. We could implement a custom drawing mode for this.
      toast({
        title: "Annulla ultimo punto",
        description: "Per ora, usa 'Nuovo Poligono' per ricominciare",
        variant: "default"
      });
    }
  };
  const retryMapLoad = () => {
    // Clean up draw controls first
    if (draw.current && map) {
      try {
        if (map.hasControl(draw.current)) {
          map.removeControl(draw.current);
        }
        draw.current = null;
      } catch (error) {
        console.warn('Error cleaning up draw controls for retry:', error);
        draw.current = null;
      }
    }

    // Use the stable hook's retry function
    retry();
  };
  return <div className="space-y-4">
      <Card className="relative h-96 overflow-hidden">
        <div ref={mapContainer} className="w-full h-full min-h-96" style={{
        minHeight: '384px'
      }} />
        
        {/* Loading overlay */}
        {isLoading && <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-20">
            <div className="text-center space-y-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground">Caricamento mappa...</p>
            </div>
          </div>}
        
        {/* Error overlay */}
        {error && <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center z-20">
            <div className="text-center space-y-4 p-6">
              <div className="text-destructive">
                <Info className="h-8 w-8 mx-auto mb-2" />
                <p className="font-medium">Errore caricamento mappa</p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </div>
              <Button onClick={retryMapLoad} size="sm" variant="outline">
                Riprova
              </Button>
            </div>
          </div>}
        
        {/* Drawing toolbar */}
        <div className="absolute top-4 left-4 right-4 z-10 space-y-2">
          {/* Info card */}
          

          {/* Simplified control buttons */}
          
        </div>

      </Card>

      {!mapboxToken && <Card className="p-4 border-destructive">
          <div className="flex items-center gap-2 text-destructive">
            <Info className="h-4 w-4" />
            <span className="text-sm font-medium">
              Token Mapbox richiesto per utilizzare la mappa interattiva
            </span>
          </div>
        </Card>}
    </div>;
});

// Export the flyToLocation function so it can be used by parent components
export const useFlyToLocation = (mapRef: React.MutableRefObject<mapboxgl.Map | null>) => {
  return (center: [number, number], bbox?: [number, number, number, number]) => {
    if (!mapRef.current) return;
    if (bbox) {
      mapRef.current.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], {
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