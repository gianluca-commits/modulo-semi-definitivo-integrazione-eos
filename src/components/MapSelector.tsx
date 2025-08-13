import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Map, AlertCircle, MapPin, Mouse } from 'lucide-react';
import { GoogleAddressSearch } from './GoogleAddressSearch';
import GoogleMapsPolygonDrawer from './GoogleMapsPolygonDrawer';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';

interface MapSelectorProps {
  onPolygonSelect: (polygon: {
    type: string;
    coordinates: number[][][];
    source: string;
    area: number;
  }) => void;
}

export const MapSelector: React.FC<MapSelectorProps> = ({ 
  onPolygonSelect
}) => {
  const [selectedPolygon, setSelectedPolygon] = useState<{
    type: string;
    coordinates: number[][][];
  } | null>(null);
  const [area, setArea] = useState<number | null>(null);
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const polygonDrawerRef = useRef<{ flyToLocation: (center: [number, number], bbox?: [number, number, number, number]) => void } | null>(null);

  useEffect(() => {
    const fetchGoogleMapsConfig = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('google-maps-config');
        
        if (error) {
          console.error('Error fetching Google Maps config:', error);
        } else if (data?.googleMapsApiKey) {
          setGoogleMapsApiKey(data.googleMapsApiKey);
        }
      } catch (error) {
        console.error('Error calling google-maps-config function:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGoogleMapsConfig();
  }, []);

  const handleLocationSelect = (center: [number, number], bbox?: [number, number, number, number]) => {
    // Fly to the selected location on the map
    if (polygonDrawerRef.current) {
      polygonDrawerRef.current.flyToLocation(center, bbox);
    }
  };

  const handlePolygonChange = (polygon: { coordinates: number[][], area: number } | null) => {
    if (polygon) {
      setSelectedPolygon({
        type: "Polygon",
        coordinates: [polygon.coordinates]
      });
      setArea(polygon.area);

      onPolygonSelect({
        type: "Polygon",
        coordinates: [polygon.coordinates],
        source: "interactive_map",
        area: polygon.area
      });
    } else {
      setSelectedPolygon(null);
      setArea(null);
    }
  };

  const needsGoogleMapsToken = !googleMapsApiKey;

  return (
    <div className="space-y-4">
      {/* Instructions Card - Outside the map */}
      <Card className="bg-muted/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Map className="h-4 w-4 text-primary" />
            Come selezionare il campo
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-medium">1. Cerca l'indirizzo</span>
                <p className="text-muted-foreground">Trova la zona del tuo campo</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Mouse className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-medium">2. Disegna il perimetro</span>
                <p className="text-muted-foreground">Clicca sui vertici del campo</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Caricamento configurazione mappe...
          </AlertDescription>
        </Alert>
      ) : needsGoogleMapsToken ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Google Maps API non disponibile. Usa l'opzione "File" per caricare un file KML/GeoJSON invece.
            <br />
            <Button variant="link" className="h-auto p-0 text-sm" asChild>
              <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">
                Come ottenere una chiave API Google Maps gratuita →
              </a>
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {/* Address Search */}
          <div className="space-y-2">
            <GoogleAddressSearch 
              onLocationSelect={handleLocationSelect}
              googleMapsApiKey={googleMapsApiKey}
            />
          </div>

          {/* Map and Status */}
          <div className="space-y-2">
            <GoogleMapsPolygonDrawer
              ref={polygonDrawerRef}
              onPolygonChange={handlePolygonChange}
            />
            
            {/* Status Bar */}
            {selectedPolygon && area && (
              <div className="flex justify-center">
                <Badge variant="default" className="text-sm">
                  ✓ Campo selezionato: {area.toFixed(2)} ha
                </Badge>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};