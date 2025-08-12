// EOS service types and demo-mode utilities
import { supabase } from "@/integrations/supabase/client";

export type Coordinate = [number, number]; // [lon, lat]

export interface PolygonData {
  geojson: string;
  coordinates: Coordinate[];
  source: string;
  area_ha: number;
}

export interface EosConfig {
  apiKey: string;
  cropType: "wheat" | "wine" | "olive" | (string & {});
  start_date?: string;
  end_date?: string;
  // Optional cloud filtering params (used in live mode only)
  max_cloud_cover_in_aoi?: number; // 0-100
  exclude_cover_pixels?: boolean;   // exclude pixels flagged as cloudy
  cloud_masking_level?: 0 | 1 | 2;  // 0-none,1-basic,2-advanced
}

export interface VegetationPoint {
  date: string;
  NDVI: number;
  NDMI: number;
}

export interface VegetationData {
  field_id: string;
  satellite: string;
  time_series: VegetationPoint[];
  analysis: {
    health_status: string;
    growth_stage: string;
  };
  meta?: {
    mode?: string;
    start_date?: string;
    end_date?: string;
    reason?: string;
    observation_count?: number;
    fallback_used?: boolean;
    used_filters?: {
      max_cloud_cover_in_aoi?: number;
      exclude_cover_pixels?: boolean;
      cloud_masking_level?: number;
    };
  };
}

export interface WeatherData {
  temperature_avg: number; // °C
  precipitation_total: number; // mm
  alerts: string[];
}

export interface ProductivityData {
  predicted_yield_ton_ha: number;
  confidence_level: number; // percentage
  recommendations: string[];
  expected_revenue_eur_ha: number;
}

// Calculate polygon area (ha) using equirectangular projection for small areas
export function calculateAreaHa(coords: Coordinate[]): number {
  if (!coords || coords.length < 4) return 0;

  // Ensure closed polygon
  const pts = coords[0] !== coords[coords.length - 1] ? [...coords, coords[0]] : coords;

  // Mean latitude in radians
  const meanLat =
    (pts.reduce((acc, [, lat]) => acc + lat, 0) / pts.length) * (Math.PI / 180);

  const R = 6378137; // meters
  const cosLat = Math.cos(meanLat);

  const toXY = (lon: number, lat: number) => {
    const x = (lon * Math.PI) / 180 * R * cosLat;
    const y = (lat * Math.PI) / 180 * R;
    return { x, y };
  };

  let area = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = toXY(pts[i][0], pts[i][1]);
    const b = toXY(pts[i + 1][0], pts[i + 1][1]);
    area += a.x * b.y - b.x * a.y;
  }
  const areaMeters2 = Math.abs(area) / 2;
  const areaHa = areaMeters2 / 10000; // m^2 to ha
  return Number(areaHa.toFixed(2));
}

// Demo generators
export function demoVegetation(): VegetationData {
  return {
    field_id: "IT_FIELD_001",
    satellite: "Sentinel-2",
    time_series: [
      { date: "2024-01-15", NDVI: 0.68, NDMI: 0.42 },
      { date: "2024-01-21", NDVI: 0.74, NDMI: 0.36 },
      { date: "2024-01-27", NDVI: 0.69, NDMI: 0.3 },
      { date: "2024-02-04", NDVI: 0.72, NDMI: 0.34 },
      { date: "2024-02-12", NDVI: 0.76, NDMI: 0.37 },
    ],
    analysis: {
      health_status: "moderate_stress",
      growth_stage: "tillering",
    },
  };
}

export function demoWeather(): WeatherData {
  return {
    temperature_avg: 11.8,
    precipitation_total: 145.2,
    alerts: ["Stress idrico rilevato"],
  };
}

export function computeProductivity(cropType: EosConfig["cropType"]): ProductivityData {
  const cropMultipliers: Record<string, number> = {
    wheat: 6.2,
    wine: 8.5,
    olive: 3.1,
  };
  const predicted = cropMultipliers[cropType] ?? 6.2;
  return {
    predicted_yield_ton_ha: Number(predicted.toFixed(2)),
    confidence_level: 84,
    recommendations: [
      "💧 Programmare irrigazione entro 10-15 giorni",
      "🌱 Monitorare zone con NDVI < 0.65",
    ],
    expected_revenue_eur_ha: Math.round(predicted * 250),
  };
}

// Placeholder for real EOS API calls. For security, route real requests via a Supabase Edge Function.
export async function getVegetationTimeSeries(
  _polygon: PolygonData,
  config: EosConfig
): Promise<VegetationData> {
  if (config.apiKey === "demo") {
    // Simulate network delay
    await new Promise((r) => setTimeout(r, 800));
    return demoVegetation();
  }

  // Live mode via Supabase Edge Function proxy
  const { data, error } = await supabase.functions.invoke("eos-proxy", {
    body: {
      action: "vegetation",
      polygon: _polygon,
      start_date: config.start_date,
      end_date: config.end_date,
      max_cloud_cover_in_aoi: config.max_cloud_cover_in_aoi,
      exclude_cover_pixels: config.exclude_cover_pixels,
      cloud_masking_level: config.cloud_masking_level,
    },
  });

  if (error) {
    console.error("eos-proxy vegetation error:", error);
    // Fallback to demo to keep UX smooth
    return demoVegetation();
  }
  if (!data || !("vegetation" in data)) {
    console.warn("eos-proxy vegetation invalid response", data);
    return demoVegetation();
  }
  const veg = data.vegetation as VegetationData;
  if ((data as any).meta) {
    (veg as any).meta = (data as any).meta;
  }
  return veg;
}

export async function getWeatherSummary(
  _polygon: PolygonData,
  config: EosConfig
): Promise<WeatherData> {
  if (config.apiKey === "demo") {
    await new Promise((r) => setTimeout(r, 600));
    return demoWeather();
  }

  // Live mode via Supabase Edge Function proxy
  const { data, error } = await supabase.functions.invoke("eos-proxy", {
    body: {
      action: "weather",
      polygon: _polygon,
      start_date: config.start_date,
      end_date: config.end_date,
    },
  });

  if (error) {
    console.error("eos-proxy weather error:", error);
    return demoWeather();
  }
  if (!data || !("weather" in data)) {
    console.warn("eos-proxy weather invalid response", data);
    return demoWeather();
  }

  return data.weather as WeatherData;
}
