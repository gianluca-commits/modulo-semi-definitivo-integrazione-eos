import { useRef, useEffect, useCallback, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { validateMapboxToken, isContainerReady } from '@/lib/mapbox';

export interface MapboxStableOptions {
  token?: string;
  center?: [number, number];
  zoom?: number;
  style?: string;
  onLoad?: () => void;
  onError?: (error: string) => void;
}

// Stable map instance manager that prevents unnecessary re-initializations
export const useMapboxStable = (
  containerRef: React.RefObject<HTMLDivElement>,
  options: MapboxStableOptions
) => {
  const map = useRef<mapboxgl.Map | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Stable reference to options to prevent re-initialization
  const optionsRef = useRef(options);
  optionsRef.current = options;
  
  // Track if we're currently initializing to prevent multiple simultaneous inits
  const initializingRef = useRef(false);
  
  const cleanup = useCallback(() => {
    if (map.current) {
      try {
        // Remove all event listeners safely
        const events = ['load', 'error', 'sourcedata', 'styledata'];
        events.forEach(event => {
          try {
            map.current?.off(event as any, undefined as any);
          } catch (e) {
            console.warn(`Failed to remove ${event} listener:`, e);
          }
        });
        
        // Remove controls
        try {
          const container = map.current.getContainer();
          if (container) {
            const controls = container.querySelectorAll('.mapboxgl-control-container');
            controls.forEach(control => {
              try {
                control.remove();
              } catch (e) {
                console.warn('Error removing control:', e);
              }
            });
          }
        } catch (e) {
          console.warn('Error removing controls:', e);
        }
        
        // Remove map with delay to prevent race conditions
        setTimeout(() => {
          try {
            if (map.current && map.current.getContainer()) {
              map.current.remove();
            }
          } catch (e) {
            console.warn('Error removing map:', e);
          } finally {
            map.current = null;
            setIsInitialized(false);
          }
        }, 50);
      } catch (error) {
        console.warn('Error during map cleanup:', error);
        map.current = null;
        setIsInitialized(false);
      }
    }
    initializingRef.current = false;
  }, []);
  
  const initialize = useCallback(async () => {
    const { token, center = [12.4964, 41.9028], zoom = 6, style = 'mapbox://styles/mapbox/satellite-v9' } = optionsRef.current;
    
    // Don't initialize if already initializing or if we don't have what we need
    if (initializingRef.current || !token || !containerRef.current || map.current) {
      return;
    }
    
    // Validate token first
    if (!validateMapboxToken(token)) {
      setError('Token Mapbox non valido');
      return;
    }
    
    // Check container readiness
    if (!isContainerReady(containerRef.current)) {
      setError('Container non pronto');
      return;
    }
    
    initializingRef.current = true;
    setIsLoading(true);
    setError(null);
    
    try {
      // Set access token
      mapboxgl.accessToken = token;
      
      // Create map
      map.current = new mapboxgl.Map({
        container: containerRef.current,
        style,
        center,
        zoom,
        attributionControl: false,
        preserveDrawingBuffer: true,
        renderWorldCopies: false,
        maxZoom: 20,
        minZoom: 1
      });
      
      // Set up load listener
      map.current.once('load', () => {
        setIsLoading(false);
        setIsInitialized(true);
        initializingRef.current = false;
        optionsRef.current.onLoad?.();
      });
      
      // Set up error listener
      map.current.once('error', (e) => {
        const errorMsg = e.error?.message || 'Errore caricamento mappa';
        setError(errorMsg);
        setIsLoading(false);
        initializingRef.current = false;
        optionsRef.current.onError?.(errorMsg);
      });
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Errore inizializzazione mappa';
      setError(errorMsg);
      setIsLoading(false);
      initializingRef.current = false;
      optionsRef.current.onError?.(errorMsg);
    }
  }, [containerRef]);
  
  // Initialize map when token becomes available or container is ready
  useEffect(() => {
    const { token } = optionsRef.current;
    
    // Only initialize if we have a token and don't already have a map
    if (token && !map.current && !initializingRef.current) {
      // Small delay to ensure DOM is ready
      const timeoutId = setTimeout(initialize, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [options.token, initialize]);
  
  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);
  
  const retry = useCallback(() => {
    cleanup();
    setTimeout(initialize, 200);
  }, [cleanup, initialize]);
  
  return {
    map: map.current,
    isLoading,
    error,
    isInitialized,
    retry
  };
};