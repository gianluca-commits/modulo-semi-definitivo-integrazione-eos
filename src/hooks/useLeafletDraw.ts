import { useEffect, useRef } from 'react';
import L from 'leaflet';

interface UseLeafletDrawProps {
  map: L.Map | null;
  featureGroup: L.FeatureGroup | null;
  onCreated?: (e: any) => void;
  onEdited?: (e: any) => void;
  onDeleted?: (e: any) => void;
}

export const useLeafletDraw = ({
  map,
  featureGroup,
  onCreated,
  onEdited,
  onDeleted
}: UseLeafletDrawProps) => {
  const drawControlRef = useRef<any>(null);
  const currentPolygon = useRef<L.Polygon | null>(null);
  const isDrawing = useRef(false);
  const drawingPoints = useRef<L.LatLng[]>([]);

  useEffect(() => {
    if (!map || !featureGroup) return;

    // Simple polygon drawing without leaflet-draw
    const addSimplePolygonDrawing = () => {
      // Add drawing button
      const drawButton = new L.Control({ position: 'topright' });
      
      drawButton.onAdd = function() {
        const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
        div.style.backgroundColor = 'white';
        div.style.backgroundImage = "url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBzdHJva2U9IiMzMzMiIHN0cm9rZS13aWR0aD0iMiIgZmlsbD0ibm9uZSIvPgo8L3N2Zz4K')";
        div.style.backgroundSize = '16px 16px';
        div.style.backgroundRepeat = 'no-repeat';
        div.style.backgroundPosition = 'center';
        div.style.width = '34px';
        div.style.height = '34px';
        div.style.cursor = 'pointer';
        div.title = 'Disegna poligono';
        
        div.onclick = function() {
          startDrawing();
        };
        
        return div;
      };

      const clearButton = new L.Control({ position: 'topright' });
      
      clearButton.onAdd = function() {
        const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
        div.style.backgroundColor = 'white';
        div.style.backgroundImage = "url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTMgNkg1SDE5SDIxVjhIMTlWMTlDMTkgMjAuMSAxOC4xIDIxIDE3IDIxSDdDNS45IDIxIDUgMjAuMSA1IDE5VjhIM1Y2Wk04IDhWMTlIOVY4SDhaIE0xMSA4VjE5SDEyVjhIMTFaTTE0IDhWMTlIMTVWOEgxNFoiIGZpbGw9IiMzMzMiLz4KPHBhdGggZD0iTTkgM0gxNVYxSDlWM1oiIGZpbGw9IiMzMzMiLz4KPC9zdmc+')";
        div.style.backgroundSize = '16px 16px';
        div.style.backgroundRepeat = 'no-repeat';
        div.style.backgroundPosition = 'center';
        div.style.width = '34px';
        div.style.height = '34px';
        div.style.cursor = 'pointer';
        div.title = 'Cancella poligono';
        
        div.onclick = function() {
          clearDrawing();
        };
        
        return div;
      };

      drawButton.addTo(map);
      clearButton.addTo(map);
      
      drawControlRef.current = { drawButton, clearButton };
    };

    const startDrawing = () => {
      if (isDrawing.current) return;
      
      isDrawing.current = true;
      drawingPoints.current = [];
      map.getContainer().style.cursor = 'crosshair';
      
      // Clear existing polygon
      if (currentPolygon.current) {
        featureGroup.removeLayer(currentPolygon.current);
        currentPolygon.current = null;
      }
    };

    const addPoint = (e: L.LeafletMouseEvent) => {
      if (!isDrawing.current) return;
      
      drawingPoints.current.push(e.latlng);
      
      // Add a marker for visual feedback
      const marker = L.circleMarker(e.latlng, {
        radius: 4,
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.8
      }).addTo(map);
      
      // If we have at least 3 points, show the polygon preview
      if (drawingPoints.current.length >= 3) {
        if (currentPolygon.current) {
          featureGroup.removeLayer(currentPolygon.current);
        }
        
        currentPolygon.current = L.polygon(drawingPoints.current, {
          color: '#3b82f6',
          fillColor: '#3b82f6',
          fillOpacity: 0.2,
          weight: 2
        }).addTo(featureGroup);
      }
    };

    const finishDrawing = () => {
      if (!isDrawing.current || drawingPoints.current.length < 3) return;
      
      isDrawing.current = false;
      map.getContainer().style.cursor = '';
      
      // Create final polygon
      if (currentPolygon.current) {
        featureGroup.removeLayer(currentPolygon.current);
      }
      
      currentPolygon.current = L.polygon(drawingPoints.current, {
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.2,
        weight: 2
      }).addTo(featureGroup);
      
      // Remove temporary markers
      map.eachLayer((layer) => {
        if (layer instanceof L.CircleMarker) {
          map.removeLayer(layer);
        }
      });
      
      // Trigger created event
      if (onCreated) {
        onCreated({
          layer: currentPolygon.current,
          layerType: 'polygon'
        });
      }
      
      drawingPoints.current = [];
    };

    const clearDrawing = () => {
      if (currentPolygon.current) {
        featureGroup.removeLayer(currentPolygon.current);
        if (onDeleted) {
          onDeleted({
            layers: [currentPolygon.current]
          });
        }
        currentPolygon.current = null;
      }
      
      if (isDrawing.current) {
        isDrawing.current = false;
        map.getContainer().style.cursor = '';
        drawingPoints.current = [];
        
        // Remove temporary markers
        map.eachLayer((layer) => {
          if (layer instanceof L.CircleMarker) {
            map.removeLayer(layer);
          }
        });
      }
    };

    // Add event listeners
    map.on('click', addPoint);
    map.on('dblclick', finishDrawing);
    
    // Prevent default map double-click zoom
    map.doubleClickZoom.disable();

    addSimplePolygonDrawing();

    // Cleanup
    return () => {
      if (drawControlRef.current) {
        if (drawControlRef.current.drawButton) {
          map.removeControl(drawControlRef.current.drawButton);
        }
        if (drawControlRef.current.clearButton) {
          map.removeControl(drawControlRef.current.clearButton);
        }
      }
      
      map.off('click', addPoint);
      map.off('dblclick', finishDrawing);
      map.doubleClickZoom.enable();
      
      if (currentPolygon.current) {
        featureGroup.removeLayer(currentPolygon.current);
      }
    };
  }, [map, featureGroup, onCreated, onEdited, onDeleted]);

  return {
    drawControl: drawControlRef.current
  };
};