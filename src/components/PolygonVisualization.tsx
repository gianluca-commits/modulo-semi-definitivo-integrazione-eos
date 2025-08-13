import React, { useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MapPin } from "lucide-react";
import { useMapboxStable } from "@/hooks/useMapboxStable";

interface PolygonVisualizationProps {
  polygon: {
    coordinates: [number, number][];
    area_ha: number;
    source: string;
  };
  mapboxToken?: string;
  title?: string;
  description?: string;
}

export const PolygonVisualization: React.FC<PolygonVisualizationProps> = ({
  polygon,
  mapboxToken,
  title = "Campo Analizzato",
  description = "Visualizzazione del poligono del campo"
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);

  // Calculate center from polygon coordinates
  const center: [number, number] = React.useMemo(() => {
    if (!polygon.coordinates.length) return [12.4964, 41.9028];
    
    let minLng = polygon.coordinates[0][0];
    let maxLng = polygon.coordinates[0][0];
    let minLat = polygon.coordinates[0][1];
    let maxLat = polygon.coordinates[0][1];

    polygon.coordinates.forEach(([lng, lat]) => {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    });

    return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
  }, [polygon.coordinates]);

  // Use stable map hook
  const { map, isLoading, error } = useMapboxStable(mapContainer, {
    token: mapboxToken,
    center,
    zoom: 14,
    onLoad: () => {
      setupPolygonVisualization();
    }
  });

  const setupPolygonVisualization = () => {
    if (!map || !polygon.coordinates.length) return;
    
    try {
      // Add navigation controls
      map.addControl(new mapboxgl.NavigationControl(), "top-right");

      // Ensure polygon is closed
      const coords = polygon.coordinates;
      const closedCoords = coords[coords.length - 1][0] === coords[0][0] && 
                          coords[coords.length - 1][1] === coords[0][1] 
                          ? coords 
                          : [...coords, coords[0]];

      // Add polygon source
      map.addSource("field-polygon", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {
            area_ha: polygon.area_ha,
            source: polygon.source
          },
          geometry: {
            type: "Polygon",
            coordinates: [closedCoords]
          }
        }
      });

      // Add polygon fill layer
      map.addLayer({
        id: "field-polygon-fill",
        type: "fill",
        source: "field-polygon",
        paint: {
          "fill-color": "#3b82f6",
          "fill-opacity": 0.3
        }
      });

      // Add polygon outline layer
      map.addLayer({
        id: "field-polygon-outline",
        type: "line",
        source: "field-polygon",
        paint: {
          "line-color": "#1d4ed8",
          "line-width": 2
        }
      });

      // Fit map to polygon bounds with padding
      const bounds = new mapboxgl.LngLatBounds();
      closedCoords.forEach(coord => bounds.extend(coord as [number, number]));
      
      map.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 }
      });
      
    } catch (error) {
      console.error("Error setting up polygon visualization:", error);
    }
  };

  if (!mapboxToken) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              Token Mapbox non disponibile. Visualizzazione mappa disabilitata.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          {title}
        </CardTitle>
        <CardDescription>
          {description} • {polygon.area_ha.toFixed(2)} ha • {polygon.source}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div 
          ref={mapContainer} 
          className="w-full h-64 rounded-lg border" 
          style={{ minHeight: "256px" }}
        />
      </CardContent>
    </Card>
  );
};