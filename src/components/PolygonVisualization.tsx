import React, { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MapPin } from "lucide-react";

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
      // Initialize map
      mapboxgl.accessToken = mapboxToken;
      
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

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/satellite-v9",
        center,
        zoom: 14,
        dragPan: true,
        scrollZoom: true,
        doubleClickZoom: true,
        touchZoomRotate: true,
        preserveDrawingBuffer: true
      });

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
      try {
        if (map.current) {
          // Remove event listeners
          map.current.off('load', undefined);
          
          // Remove map
          map.current.remove();
          map.current = null;
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