import React, { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MapPin } from "lucide-react";
import { createMapboxMap, isContainerReady, validateMapboxToken } from "@/lib/mapbox";

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
  const map = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!mapboxToken || !mapContainer.current || !polygon.coordinates.length) {
      return;
    }

    try {
      // Validate token and container
      if (!validateMapboxToken(mapboxToken)) {
        console.error('Invalid Mapbox token for visualization');
        return;
      }

      const container = mapContainer.current;
      if (!isContainerReady(container)) {
        console.warn('Container not ready for polygon visualization');
        return;
      }
      
      // Calculate bounds from polygon coordinates
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

      const center: [number, number] = [
        (minLng + maxLng) / 2,
        (minLat + maxLat) / 2
      ];

      // Create map using standardized function
      map.current = createMapboxMap(container, mapboxToken, center, 14);

      map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

      map.current.on("load", () => {
        if (!map.current) return;

        // Ensure polygon is closed
        const coords = polygon.coordinates;
        const closedCoords = coords[coords.length - 1][0] === coords[0][0] && 
                            coords[coords.length - 1][1] === coords[0][1] 
                            ? coords 
                            : [...coords, coords[0]];

        // Add polygon source
        map.current.addSource("field-polygon", {
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
        map.current.addLayer({
          id: "field-polygon-fill",
          type: "fill",
          source: "field-polygon",
          paint: {
            "fill-color": "#3b82f6",
            "fill-opacity": 0.3
          }
        });

        // Add polygon outline layer
        map.current.addLayer({
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
        
        map.current.fitBounds(bounds, {
          padding: { top: 50, bottom: 50, left: 50, right: 50 }
        });
      });

    } catch (error) {
      console.error("Error initializing polygon visualization map:", error);
    }

    return () => {
      // Proper cleanup following Mapbox best practices
      try {
        if (map.current) {
          // Remove all event listeners
          const eventsToRemove = ['load', 'error', 'sourcedata', 'styledata'];
          eventsToRemove.forEach(event => {
            try {
              map.current?.off(event as any, undefined as any);
            } catch (e) {
              console.warn(`Failed to remove ${event} listener:`, e);
            }
          });
          
          // Remove navigation control if it exists
          try {
            const controls = map.current.getContainer().querySelectorAll('.mapboxgl-control-container');
            controls.forEach(control => {
              try {
                control.remove();
              } catch (e) {
                console.warn('Error removing control:', e);
              }
            });
          } catch (e) {
            console.warn('Error removing controls:', e);
          }
          
          // Remove map with timeout to prevent race conditions
          setTimeout(() => {
            try {
              if (map.current && map.current.getContainer()) {
                map.current.remove();
              }
            } catch (e) {
              console.warn('Error removing visualization map:', e);
            } finally {
              map.current = null;
            }
          }, 50);
        }
      } catch (error) {
        console.warn('Error during polygon visualization cleanup:', error);
        map.current = null;
      }
    };
  }, [mapboxToken, polygon]);

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