import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Polygon } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { AlertTriangle } from 'lucide-react';

// Fix leaflet default markers issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface PolygonVisualizationProps {
  polygon: {
    coordinates: number[][];
    area_ha: number;
    source: string;
  };
  title?: string;
  description?: string;
}

const LeafletVisualization: React.FC<PolygonVisualizationProps> = ({
  polygon,
  title = "Visualizzazione Campo",
  description
}) => {
  // Calculate the center of the polygon for map centering
  const center = useMemo(() => {
    if (!polygon.coordinates.length) return [41.9028, 12.4964]; // Default to Rome
    
    const lats = polygon.coordinates.map(coord => coord[1]);
    const lngs = polygon.coordinates.map(coord => coord[0]);
    
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    
    return [centerLat, centerLng];
  }, [polygon.coordinates]);

  // Convert coordinates to Leaflet format [lat, lng]
  const leafletCoordinates = useMemo(() => {
    return polygon.coordinates.map(coord => [coord[1], coord[0]] as [number, number]);
  }, [polygon.coordinates]);

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
        <div className="h-96 w-full rounded-lg overflow-hidden border">
          <MapContainer
            center={[center[0], center[1]]}
            zoom={14}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            <Polygon
              positions={leafletCoordinates}
              pathOptions={{
                color: 'hsl(var(--primary))',
                fillColor: 'hsl(var(--primary))',
                fillOpacity: 0.3,
                weight: 2
              }}
            />
          </MapContainer>
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

export default LeafletVisualization;