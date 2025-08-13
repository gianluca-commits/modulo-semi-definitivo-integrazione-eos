import mapboxgl from 'mapbox-gl';

// Mapbox configuration - standardized style for all components
export const MAPBOX_STYLE = 'mapbox://styles/mapbox/satellite-v9';
export const DEFAULT_CENTER: [number, number] = [12.4964, 41.9028]; // Rome, Italy
export const DEFAULT_ZOOM = 6;

// Token validation and initialization
export const validateMapboxToken = (token: string): boolean => {
  return token && token.startsWith('pk.') && token.length > 20;
};

// Safe initialization with validation
export const initializeMapbox = (token: string): boolean => {
  if (!validateMapboxToken(token)) {
    console.error('Invalid Mapbox token format');
    return false;
  }
  
  try {
    mapboxgl.accessToken = token;
    return true;
  } catch (error) {
    console.error('Failed to initialize Mapbox token:', error);
    return false;
  }
};

// Check if container is ready for map
export const isContainerReady = (container: HTMLElement | null): boolean => {
  return !!(container && 
    container.offsetWidth > 0 && 
    container.offsetHeight > 0 &&
    container.isConnected);
};

// Create map with standardized options
export const createMapboxMap = (
  container: HTMLElement,
  token: string,
  center: [number, number] = DEFAULT_CENTER,
  zoom: number = DEFAULT_ZOOM
): mapboxgl.Map | null => {
  if (!initializeMapbox(token)) {
    throw new Error('Failed to initialize Mapbox token');
  }
  
  if (!isContainerReady(container)) {
    throw new Error('Container not ready for map initialization');
  }

  return new mapboxgl.Map({
    container,
    style: MAPBOX_STYLE,
    center,
    zoom,
    attributionControl: false,
    preserveDrawingBuffer: true,
    // Performance optimizations
    renderWorldCopies: false,
    maxZoom: 20,
    minZoom: 1
  });
};

// Geocoding function for address search
export const geocodeAddress = async (query: string, accessToken: string): Promise<{
  suggestions: Array<{
    place_name: string;
    center: [number, number];
    bbox?: [number, number, number, number];
  }>;
}> => {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${accessToken}&country=IT&types=address,place&limit=5`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.status}`);
    }
    
    const data = await response.json();
    return {
      suggestions: data.features.map((feature: any) => ({
        place_name: feature.place_name,
        center: feature.center,
        bbox: feature.bbox,
      })),
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    return { suggestions: [] };
  }
};

// Calculate polygon area in hectares
export const calculatePolygonArea = (coordinates: number[][]): number => {
  // Use shoelace formula for polygon area calculation
  let area = 0;
  const n = coordinates.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += coordinates[i][0] * coordinates[j][1];
    area -= coordinates[j][0] * coordinates[i][1];
  }
  
  area = Math.abs(area) / 2;
  
  // Convert from decimal degrees squared to hectares
  // Approximate conversion factor for Italy (latitude ~42°)
  const latFactor = 111320; // meters per degree at equator
  const lonFactor = latFactor * Math.cos(42 * Math.PI / 180); // adjust for latitude
  const areaMeters = area * latFactor * lonFactor;
  const areaHectares = areaMeters / 10000;
  
  return Math.round(areaHectares * 100) / 100; // round to 2 decimals
};

// Validate polygon for EOS requirements
export const validatePolygon = (coordinates: number[][]): {
  isValid: boolean;
  error?: string;
  area?: number;
} => {
  if (coordinates.length < 3) {
    return { isValid: false, error: "Il poligono deve avere almeno 3 punti" };
  }
  
  const area = calculatePolygonArea(coordinates);
  
  if (area < 0.1) {
    return { isValid: false, error: "L'area minima è 0.1 ettari" };
  }
  
  if (area > 1000) {
    return { isValid: false, error: "L'area massima è 1000 ettari" };
  }
  
  return { isValid: true, area };
};

// Convert polygon to GeoJSON format for EOS
export const polygonToGeoJSON = (coordinates: number[][]): {
  type: string;
  coordinates: number[][][];
} => {
  // Ensure the polygon is closed
  const closedCoords = [...coordinates];
  if (closedCoords[0][0] !== closedCoords[closedCoords.length - 1][0] || 
      closedCoords[0][1] !== closedCoords[closedCoords.length - 1][1]) {
    closedCoords.push(closedCoords[0]);
  }
  
  return {
    type: "Polygon",
    coordinates: [closedCoords]
  };
};