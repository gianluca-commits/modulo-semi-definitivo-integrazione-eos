import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet-draw';

interface UseLeafletDrawProps {
  map: L.Map | null;
  featureGroup: L.FeatureGroup | null;
  onCreated?: (e: L.DrawEvents.Created) => void;
  onEdited?: (e: L.DrawEvents.Edited) => void;
  onDeleted?: (e: L.DrawEvents.Deleted) => void;
}

export const useLeafletDraw = ({
  map,
  featureGroup,
  onCreated,
  onEdited,
  onDeleted
}: UseLeafletDrawProps) => {
  const drawControlRef = useRef<L.Control.Draw | null>(null);

  useEffect(() => {
    if (!map || !featureGroup) return;

    // Create draw control
    const drawControl = new L.Control.Draw({
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

    // Add control to map
    map.addControl(drawControl);
    drawControlRef.current = drawControl;

    // Add event listeners
    if (onCreated) {
      map.on(L.Draw.Event.CREATED, onCreated);
    }
    if (onEdited) {
      map.on(L.Draw.Event.EDITED, onEdited);
    }
    if (onDeleted) {
      map.on(L.Draw.Event.DELETED, onDeleted);
    }

    // Cleanup function
    return () => {
      if (drawControl && map) {
        map.removeControl(drawControl);
      }
      if (onCreated) {
        map.off(L.Draw.Event.CREATED, onCreated);
      }
      if (onEdited) {
        map.off(L.Draw.Event.EDITED, onEdited);
      }
      if (onDeleted) {
        map.off(L.Draw.Event.DELETED, onDeleted);
      }
    };
  }, [map, featureGroup, onCreated, onEdited, onDeleted]);

  return { drawControl: drawControlRef.current };
};