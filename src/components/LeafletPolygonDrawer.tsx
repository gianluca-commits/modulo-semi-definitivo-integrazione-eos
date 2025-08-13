import React, { useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { useToast } from './ui/use-toast';

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
    const [area, setArea] = useState<number>(0);
    const [isValidPolygon, setIsValidPolygon] = useState(false);
    const [validationError, setValidationError] = useState<string>('');
    const [hasPolygon, setHasPolygon] = useState(false);
    const { toast } = useToast();

    const simulatePolygonDrawing = () => {
      // Simulate a polygon being drawn
      const mockCoordinates = [
        [12.4964, 41.9028],
        [12.5064, 41.9028],
        [12.5064, 41.9128],
        [12.4964, 41.9128],
        [12.4964, 41.9028]
      ];
      
      const mockArea = 1.5; // 1.5 hectares
      
      setArea(mockArea);
      setIsValidPolygon(true);
      setValidationError('');
      setHasPolygon(true);
      
      onPolygonChange({ coordinates: mockCoordinates, area: mockArea });
      
      toast({
        title: "Poligono simulato creato",
        description: `Area: ${mockArea.toFixed(2)} ettari`
      });
    };

    const clearPolygon = () => {
      setArea(0);
      setIsValidPolygon(false);
      setValidationError('');
      setHasPolygon(false);
      onPolygonChange(null);
      
      toast({
        title: "Poligono cancellato",
        description: "Il poligono è stato rimosso"
      });
    };

    useImperativeHandle(ref, () => ({
      flyToLocation: (center: [number, number], bbox?: [number, number, number, number]) => {
        console.log('Flying to location:', center, bbox);
        // This would normally control the map view
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

          <div className="h-96 w-full rounded-lg overflow-hidden border bg-muted flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="text-lg font-medium text-muted-foreground">
                Mappa Temporaneamente Non Disponibile
              </div>
              <div className="text-sm text-muted-foreground">
                La funzionalità di mappa sarà ripristinata presto
              </div>
              <Button onClick={simulatePolygonDrawing} variant="outline">
                Simula Disegno Poligono
              </Button>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            <p>• La mappa interattiva sarà disponibile presto</p>
            <p>• Per ora puoi simulare il disegno di un poligono</p>
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