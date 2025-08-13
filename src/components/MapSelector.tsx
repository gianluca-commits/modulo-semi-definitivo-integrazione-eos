import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Map, AlertCircle } from 'lucide-react';
import { AddressSearch } from './AddressSearch';
import { PolygonDrawer } from './PolygonDrawer';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface MapSelectorProps {
  onPolygonSelect: (polygon: {
    type: string;
    coordinates: number[][][];
    source: string;
    area: number;
  }) => void;
  mapboxToken?: string;
}

export const MapSelector: React.FC<MapSelectorProps> = ({ 
  onPolygonSelect,
  mapboxToken 
}) => {
  const [selectedPolygon, setSelectedPolygon] = useState<{
    type: string;
    coordinates: number[][][];
  } | null>(null);
  const [area, setArea] = useState<number | null>(null);
  const polygonDrawerRef = useRef<{ flyToLocation: (center: [number, number], bbox?: [number, number, number, number]) => void } | null>(null);

  const handleLocationSelect = (center: [number, number], bbox?: [number, number, number, number]) => {
    // Fly to the selected location on the map
    if (polygonDrawerRef.current) {
      polygonDrawerRef.current.flyToLocation(center, bbox);
    }
  };

  const handlePolygonChange = (polygon: {
    type: string;
    coordinates: number[][][];
  } | null, polygonArea?: number) => {
    setSelectedPolygon(polygon);
    setArea(polygonArea || null);

    if (polygon && polygonArea) {
      onPolygonSelect({
        type: polygon.type,
        coordinates: polygon.coordinates,
        source: "interactive_map",
        area: polygonArea
      });
    }
  };

  const needsMapboxToken = !mapboxToken;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Map className="h-5 w-5 text-primary" />
          Seleziona il Campo sulla Mappa
        </CardTitle>
        <CardDescription>
          Cerca un indirizzo e disegna il perimetro del campo direttamente sulla mappa
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {needsMapboxToken ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Token Mapbox non disponibile. Usa l'opzione "File" per caricare un file KML/GeoJSON invece.
              <br />
              <Button variant="link" className="h-auto p-0 text-sm" asChild>
                <a href="https://docs.mapbox.com/help/how-mapbox-works/access-tokens/" target="_blank" rel="noopener noreferrer">
                  Come ottenere un token Mapbox gratuito →
                </a>
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {/* Address Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Cerca Indirizzo</label>
              <AddressSearch 
                onLocationSelect={handleLocationSelect}
                mapboxToken={mapboxToken}
              />
            </div>

            {/* Map for drawing */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Disegna il Campo</label>
                {selectedPolygon && area && (
                  <Badge variant="default">
                    Area selezionata: {area.toFixed(2)} ha
                  </Badge>
                )}
              </div>
              <PolygonDrawer
                ref={polygonDrawerRef}
                onPolygonChange={handlePolygonChange}
                mapboxToken={mapboxToken}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};