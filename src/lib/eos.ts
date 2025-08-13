// EOS service types and demo-mode utilities
import { supabase } from "@/integrations/supabase/client";

export type Coordinate = [number, number]; // [lon, lat]

export interface PolygonData {
  geojson: string;
  coordinates: Coordinate[];
  source: string;
  area_ha: number;
}

export interface EosField {
  id: string;
  name: string;
  area_ha: number;
  crop_type: string;
  coordinates: Coordinate[];
  geojson: string | null;
}

export interface EosConfig {
  apiKey: string;
  cropType: "wheat" | "wine" | "olive" | (string & {});
  start_date?: string;
  end_date?: string;
  // Optional: planting date to enhance phenology context (UI only for now)
  planting_date?: string;
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

// Get available EOS fields
export async function getEosFields(): Promise<EosField[]> {
  const { data, error } = await supabase.functions.invoke("eos-proxy", {
    body: { action: "fields" }
  });

  if (error) {
    console.error("eos-proxy fields error:", error);
    throw new Error(`Failed to fetch EOS fields: ${error.message}`);
  }

  if (!data?.fields) {
    console.warn("eos-proxy fields invalid response", data);
    return [];
  }

  return data.fields as EosField[];
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
    // Return empty result instead of demo
    return {
      field_id: "UNKNOWN",
      satellite: "",
      time_series: [],
      analysis: { health_status: "unknown", growth_stage: "unknown" },
      meta: { reason: "error", observation_count: 0, fallback_used: false },
    };
  }
  if (!data || !("vegetation" in data)) {
    console.warn("eos-proxy vegetation invalid response", data);
    return {
      field_id: "UNKNOWN",
      satellite: "",
      time_series: [],
      analysis: { health_status: "unknown", growth_stage: "unknown" },
      meta: { reason: "invalid_response", observation_count: 0, fallback_used: false },
    };
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
    return { temperature_avg: 0, precipitation_total: 0, alerts: [] };
  }
  if (!data || !("weather" in data)) {
    console.warn("eos-proxy weather invalid response", data);
    return { temperature_avg: 0, precipitation_total: 0, alerts: [] };
  }

  return data.weather as WeatherData;
}

// Unified summary payload from edge function
export interface EosSummary {
  ndvi_data: {
    current_value?: number;
    trend_30_days?: number;
    field_average?: number;
    uniformity_score?: number;
  };
  ndmi_data: {
    current_value?: number;
    water_stress_level?: "none" | "mild" | "moderate" | "severe";
    trend_14_days?: number;
    critical_threshold: number;
  };
  phenology: {
    current_stage?:
      | "germination"
      | "tillering"
      | "jointing"
      | "heading"
      | "flowering"
      | "grain_filling"
      | "maturity"
      | string;
    days_from_planting?: number;
    expected_harvest_days?: number;
    development_rate?: "early" | "normal" | "delayed";
  };
  weather_risks: {
    temperature_stress_days?: number;
    precipitation_deficit_mm?: number;
    frost_risk_forecast_7d?: boolean;
    heat_stress_risk?: "low" | "medium" | "high";
  };
  // Optional NDVI/NDMI time series for charting without extra calls
  ndvi_series?: VegetationPoint[];
  meta?: {
    start_date?: string;
    end_date?: string;
    sensor_used?: string;
    observation_count?: number;
    fallback_used?: boolean;
    used_filters?: {
      max_cloud_cover_in_aoi?: number;
      exclude_cover_pixels?: boolean;
      cloud_masking_level?: number;
    };
  };
}

export async function getEosSummary(
  _polygon: PolygonData,
  config: EosConfig
): Promise<EosSummary> {
  if (config.apiKey === "demo") {
    // Build a synthetic summary from demo data
    const veg = demoVegetation();
    const met = demoWeather();
    const ts = veg.time_series;
    const last = ts[ts.length - 1];
    const toTs = (s: string) => new Date(s).getTime();
    const lastTs = last ? toTs(last.date) : 0;
    const findPrev = (days: number, key: "NDVI" | "NDMI") => {
      if (!ts.length || !lastTs) return undefined as number | undefined;
      const target = lastTs - days * 86400000;
      let prev = ts[0] as any;
      for (const p of ts) {
        if (toTs(p.date) <= target) prev = p;
      }
      return (prev as any)?.[key] as number | undefined;
    };
    const avgInDays = (days: number, key: "NDVI" | "NDMI") => {
      if (!ts.length || !lastTs) return undefined as number | undefined;
      const from = lastTs - days * 86400000;
      const arr = ts.filter((p) => toTs(p.date) >= from);
      const use = arr.length ? arr : ts;
      const sum = use.reduce((a, p) => a + ((p as any)[key] || 0), 0);
      return use.length ? Number((sum / use.length).toFixed(2)) : undefined;
    };
    const pct = (now?: number, prev?: number) => {
      if (now == null || prev == null || prev === 0) return undefined as number | undefined;
      return Number((((now - prev) / Math.abs(prev)) * 100).toFixed(1));
    };

    const ndvi_now = last?.NDVI;
    const ndvi_trend = pct(ndvi_now, findPrev(30, "NDVI"));
    const ndvi_avg = avgInDays(30, "NDVI");
    const ndmi_now = last?.NDMI;
    const ndmi_trend = pct(ndmi_now, findPrev(14, "NDMI"));
    const water_stress = ndmi_now == null ? undefined : ndmi_now < 0.2 ? "severe" : ndmi_now < 0.3 ? "moderate" : ndmi_now < 0.4 ? "mild" : "none";

    // Days from planting
    const planting = config.planting_date ? new Date(config.planting_date) : undefined;
    const ref = config.end_date ? new Date(config.end_date) : new Date();
    const days_from_planting = planting ? Math.max(0, Math.floor((+ref - +planting) / 86400000)) : undefined;

    return {
      ndvi_data: { current_value: ndvi_now, trend_30_days: ndvi_trend, field_average: ndvi_avg, uniformity_score: 0.75 },
      ndmi_data: { current_value: ndmi_now, water_stress_level: water_stress, trend_14_days: ndmi_trend, critical_threshold: 0.3 },
      phenology: { current_stage: veg.analysis.growth_stage, days_from_planting, expected_harvest_days: 200, development_rate: "normal" },
      weather_risks: { temperature_stress_days: undefined, precipitation_deficit_mm: undefined, frost_risk_forecast_7d: false, heat_stress_risk: "low" },
      // expose series for charting
      ndvi_series: ts,
      meta: { start_date: config.start_date, end_date: config.end_date, sensor_used: "Sentinel-2 L2A", observation_count: ts.length, fallback_used: false },
    };
  }

  // Live mode with simple retry/backoff to handle EOS 429 rate limits
  const attemptInvoke = async (attempt: number) => {
    const res = await supabase.functions.invoke("eos-proxy", {
      body: {
        action: "summary",
        polygon: _polygon,
        crop_type: config.cropType,
        planting_date: config.planting_date,
        start_date: config.start_date,
        end_date: config.end_date,
        max_cloud_cover_in_aoi: config.max_cloud_cover_in_aoi,
        exclude_cover_pixels: config.exclude_cover_pixels,
        cloud_masking_level: config.cloud_masking_level,
      },
    });
    return res;
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    const { data, error } = await attemptInvoke(attempt);
    if (!error && data) {
      return data as EosSummary;
    }
    const msg = String((error as any)?.message || "");
    if (msg.includes("429") || msg.toLowerCase().includes("limit")) {
      const backoff = 1000 * attempt * attempt; // 1s, 4s, 9s
      console.warn(`eos-proxy summary rate-limited, retrying in ${backoff}ms (attempt ${attempt})`);
      await new Promise((r) => setTimeout(r, backoff));
      continue;
    }
    console.error("eos-proxy summary error:", error);
    break;
  }
  return {
    ndvi_data: {},
    ndmi_data: { critical_threshold: 0.3 },
    phenology: {},
    weather_risks: {},
    ndvi_series: [],
    meta: { observation_count: 0, fallback_used: false, start_date: config.start_date, end_date: config.end_date },
  };
}

