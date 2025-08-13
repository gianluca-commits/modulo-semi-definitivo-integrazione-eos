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
  const drawInitialized = useRef(false);

  useEffect(() => {
    if (!map || !featureGroup || drawInitialized.current) return;

    // Dynamic import of leaflet-draw to ensure proper loading
    const initializeDrawing = async () => {
      try {
        // Import leaflet-draw dynamically
        await import('leaflet-draw');
        
        // Wait for next tick to ensure L.Draw is available
        setTimeout(() => {
          if (!(window as any).L?.Draw) {
            console.log('L.Draw not available, adding basic polygon drawing');
            addBasicPolygonDrawing();
            return;
          }

          try {
            const drawControl = new (window as any).L.Control.Draw({
              position: 'topright',
              draw: {
                polygon: {
                  allowIntersection: false,
                  drawError: {
                    color: '#e1e100',
                    message: '<strong>Non puoi disegnare poligoni che si intersecano!</strong>'
                  },
                  shapeOptions: {
                    color: '#3b82f6',
                    fillColor: '#3b82f6',
                    fillOpacity: 0.3,
                    weight: 2
                  }
                },
                polyline: false,
                rectangle: false,
                circle: false,
                marker: false,
                circlemarker: false
              },
              edit: {
                featureGroup: featureGroup,
                remove: true
              }
            });

            map.addControl(drawControl);
            drawControlRef.current = drawControl;

            // Add event listeners with proper event names
            if (onCreated) {
              map.on((window as any).L.Draw.Event.CREATED, onCreated);
            }
            if (onEdited) {
              map.on((window as any).L.Draw.Event.EDITED, onEdited);
            }
            if (onDeleted) {
              map.on((window as any).L.Draw.Event.DELETED, onDeleted);
            }

            drawInitialized.current = true;
          } catch (error) {
            console.error('Error initializing leaflet-draw:', error);
            addBasicPolygonDrawing();
          }
        }, 100);
      } catch (error) {
        console.error('Error loading leaflet-draw:', error);
        addBasicPolygonDrawing();
      }
    };

    // Fallback basic polygon drawing function
    const addBasicPolygonDrawing = () => {
      console.log('Adding fallback polygon drawing');
      // Add a simple button to enable polygon drawing
      const drawButton = new (L as any).Control({ position: 'topright' });
      drawButton.onAdd = function() {
        const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
        div.style.backgroundColor = 'white';
        div.style.width = '30px';
        div.style.height = '30px';
        div.style.cursor = 'pointer';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.justifyContent = 'center';
        div.innerHTML = '🔶';
        div.title = 'Disegna poligono';
        
        let drawingMode = false;
        let currentPolygon: L.Polygon | null = null;
        let points: L.LatLng[] = [];

        div.onclick = function() {
          drawingMode = !drawingMode;
          div.style.backgroundColor = drawingMode ? '#3b82f6' : 'white';
          div.style.color = drawingMode ? 'white' : 'black';
          
          if (drawingMode) {
            map.getContainer().style.cursor = 'crosshair';
            startDrawing();
          } else {
            map.getContainer().style.cursor = '';
            stopDrawing();
          }
        };
        
        const startDrawing = () => {
          points = [];
          map.on('click', onMapClick);
        };
        
        const stopDrawing = () => {
          map.off('click', onMapClick);
          if (currentPolygon && points.length >= 3) {
            // Trigger created event
            if (onCreated) {
              onCreated({ layer: currentPolygon });
            }
          }
          currentPolygon = null;
          points = [];
        };
        
        const onMapClick = (e: L.LeafletMouseEvent) => {
          points.push(e.latlng);
          
          if (currentPolygon) {
            featureGroup.removeLayer(currentPolygon);
          }
          
          if (points.length >= 3) {
            currentPolygon = L.polygon(points, {
              color: '#3b82f6',
              fillColor: '#3b82f6',
              fillOpacity: 0.3,
              weight: 2
            });
            featureGroup.addLayer(currentPolygon);
          }
          
          // Auto-complete on double-click or when clicking close to first point
          if (points.length >= 3) {
            const firstPoint = points[0];
            const distance = e.latlng.distanceTo(firstPoint);
            if (distance < 50) { // 50 meters threshold
              drawingMode = false;
              div.style.backgroundColor = 'white';
              div.style.color = 'black';
              map.getContainer().style.cursor = '';
              stopDrawing();
            }
          }
        };
        
        return div;
      };
      
      map.addControl(drawButton);
      drawControlRef.current = drawButton;
      drawInitialized.current = true;
    };

    initializeDrawing();

    // Cleanup function
    return () => {
      if (drawControlRef.current && map) {
        try {
          map.removeControl(drawControlRef.current);
        } catch (error) {
          console.error('Error removing draw control:', error);
        }
      }
      if (onCreated) {
        map.off('draw:created', onCreated);
      }
      if (onEdited) {
        map.off('draw:edited', onEdited);
      }
      if (onDeleted) {
        map.off('draw:deleted', onDeleted);
      }
      drawInitialized.current = false;
    };
  }, [map, featureGroup, onCreated, onEdited, onDeleted]);

  return { drawControl: drawControlRef.current };
};