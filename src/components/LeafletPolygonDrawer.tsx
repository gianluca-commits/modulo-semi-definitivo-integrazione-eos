import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import { MapContainer, TileLayer, FeatureGroup, useMap } from 'react-leaflet';
import L, { LatLng } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { useToast } from './ui/use-toast';
import { calculatePolygonArea, validatePolygon } from '@/lib/mapbox';
import { useLeafletDraw } from '@/hooks/useLeafletDraw';

// Fix leaflet default markers issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface PolygonDrawerProps {
  onPolygonChange: (polygon: { coordinates: number[][], area: number } | null) => void;
  initialCenter?: [number, number];
  initialZoom?: number;
}

export interface PolygonDrawerRef {
  flyToLocation: (center: [number, number], bbox?: [number, number, number, number]) => void;
}

const LeafletPolygonDrawer = forwardRef<PolygonDrawerRef, PolygonDrawerProps>(
  ({ onPolygonChange, initialCenter = [41.9028, 12.4964], initialZoom = 6 }, ref) => {
    const mapRef = useRef<L.Map | null>(null);
    const featureGroupRef = useRef<L.FeatureGroup | null>(null);
    const [area, setArea] = useState<number>(0);
    const [isValidPolygon, setIsValidPolygon] = useState(false);
    const [validationError, setValidationError] = useState<string>('');
    const [hasPolygon, setHasPolygon] = useState(false);
    const { toast } = useToast();

    const processPolygon = (layer: L.Layer) => {
      if (layer instanceof L.Polygon) {
        const latLngs = layer.getLatLngs()[0] as LatLng[];
        const coordinates = latLngs.map(latlng => [latlng.lng, latlng.lat]);
        
        const validation = validatePolygon(coordinates);
        setIsValidPolygon(validation.isValid);
        setValidationError(validation.error || '');
        
        if (validation.isValid && validation.area) {
          setArea(validation.area);
          setHasPolygon(true);
          onPolygonChange({
            coordinates,
            area: validation.area
          });
          toast({
            title: "Poligono valido",
            description: `Area: ${validation.area.toFixed(2)} ettari`
          });
        } else {
          setArea(0);
          setHasPolygon(false);
          onPolygonChange(null);
          toast({
            title: "Poligono non valido",
            description: validation.error,
            variant: "destructive"
          });
        }
      }
    };

    const handleCreated = useCallback((e: L.DrawEvents.Created) => {
      const layer = e.layer;
      if (featureGroupRef.current) {
        // Clear existing polygons (only allow one)
        featureGroupRef.current.clearLayers();
        featureGroupRef.current.addLayer(layer);
        processPolygon(layer);
      }
    }, []);

    const handleEdited = useCallback((e: L.DrawEvents.Edited) => {
      const layers = e.layers;
      layers.eachLayer((layer: L.Layer) => {
        processPolygon(layer);
      });
    }, []);

    const handleDeleted = useCallback((e: L.DrawEvents.Deleted) => {
      setArea(0);
      setIsValidPolygon(false);
      setValidationError('');
      setHasPolygon(false);
      onPolygonChange(null);
      toast({
        title: "Poligono eliminato",
        description: "Il poligono è stato rimosso dalla mappa"
      });
    }, [onPolygonChange, toast]);

    const clearPolygon = () => {
      if (featureGroupRef.current) {
        featureGroupRef.current.clearLayers();
        setArea(0);
        setIsValidPolygon(false);
        setValidationError('');
        setHasPolygon(false);
        onPolygonChange(null);
        toast({
          title: "Poligono eliminato",
          description: "Il poligono è stato rimosso dalla mappa"
        });
      }
    };

    // MapController component to initialize map references and drawing controls
    const MapController = () => {
      const map = useMap();
      
      useEffect(() => {
        mapRef.current = map;
      }, [map]);

      // Add drawing controls to the map
      useLeafletDraw({
        map: map,
        featureGroup: featureGroupRef.current,
        onCreated: handleCreated,
        onEdited: handleEdited,
        onDeleted: handleDeleted
      });

      return null;
    };

    useImperativeHandle(ref, () => ({
      flyToLocation: (center: [number, number], bbox?: [number, number, number, number]) => {
        if (mapRef.current) {
          if (bbox) {
            const bounds = L.latLngBounds(
              L.latLng(bbox[1], bbox[0]),
              L.latLng(bbox[3], bbox[2])
            );
            mapRef.current.fitBounds(bounds, { padding: [20, 20] });
          } else {
            mapRef.current.setView([center[1], center[0]], 14);
          }
        }
      }
    }));

    return (
      <Card className="p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Disegna il Campo</h3>
            {hasPolygon && (
              <Button onClick={clearPolygon} variant="outline" size="sm">
                Cancella Poligono
              </Button>
            )}
          </div>

          {validationError && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">{validationError}</p>
            </div>
          )}

          {isValidPolygon && (
            <Badge variant="default" className="mb-2">
              Area: {area.toFixed(2)} ettari
            </Badge>
          )}

          <div className="h-96 w-full rounded-lg overflow-hidden border">
            <MapContainer
              center={[initialCenter[1], initialCenter[0]]}
              zoom={initialZoom}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FeatureGroup
                ref={(ref) => {
                  featureGroupRef.current = ref;
                }}
              >
                {/* Drawing controls will be added programmatically */}
              </FeatureGroup>
              <MapController />
            </MapContainer>
          </div>

          <div className="text-sm text-muted-foreground">
            <p>• Usa il controllo di disegno poligono (🔶) per tracciare il perimetro del campo</p>
            <p>• Clicca per aggiungere punti, doppio click per completare il poligono</p>
            <p>• Usa gli strumenti di modifica (✏️) per aggiustare la forma</p>
            <p>• Area minima: 0.1 ettari, massima: 1000 ettari</p>
          </div>
        </div>
      </Card>
    );
  }
);

LeafletPolygonDrawer.displayName = 'LeafletPolygonDrawer';

export default LeafletPolygonDrawer;

// Hook for external components to control the map
export const useFlyToLocation = () => {
  const ref = useRef<PolygonDrawerRef>(null);
  
  const flyToLocation = (center: [number, number], bbox?: [number, number, number, number]) => {
    ref.current?.flyToLocation(center, bbox);
  };
  
  return { ref, flyToLocation };
};