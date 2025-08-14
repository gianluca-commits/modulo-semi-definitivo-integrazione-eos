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
  // Optional: planting date to enhance phenology context (UI only for now)
  planting_date?: string;
  // Optional cloud filtering params (used in live mode only)
  max_cloud_cover_in_aoi?: number; // 0-100
  exclude_cover_pixels?: boolean;   // exclude pixels flagged as cloudy
  cloud_masking_level?: 0 | 1 | 2;  // 0-none,1-basic,2-advanced
  // Optional: location context for optimal parameter selection
  location?: { lat: number; lng: number; country?: string };
}

// Geographical and seasonal EOS parameter profiles
export interface EosParameterProfile {
  max_cloud_cover_in_aoi: number;
  exclude_cover_pixels: boolean;
  cloud_masking_level: 0 | 1 | 2;
  description: string;
}

export const EOS_PARAMETER_PROFILES: Record<string, EosParameterProfile> = {
  // Italy summer (June-August): minimal cloud cover expected
  "italy_summer": {
    max_cloud_cover_in_aoi: 15,
    exclude_cover_pixels: false,
    cloud_masking_level: 1,
    description: "Italia estate - copertura nuvolosa minima"
  },
  // Italy winter (December-February): more clouds expected
  "italy_winter": {
    max_cloud_cover_in_aoi: 40,
    exclude_cover_pixels: false,
    cloud_masking_level: 1,
    description: "Italia inverno - maggiore copertura nuvolosa"
  },
  // Italy spring/autumn: moderate cloud cover
  "italy_moderate": {
    max_cloud_cover_in_aoi: 25,
    exclude_cover_pixels: false,
    cloud_masking_level: 1,
    description: "Italia primavera/autunno - copertura moderata"
  },
  // Default Europe profile
  "europe_default": {
    max_cloud_cover_in_aoi: 25,
    exclude_cover_pixels: false,
    cloud_masking_level: 1,
    description: "Europa standard - parametri moderati"
  },
  // Fallback profiles for escalation
  "permissive": {
    max_cloud_cover_in_aoi: 60,
    exclude_cover_pixels: false,
    cloud_masking_level: 0,
    description: "Parametri permissivi - fallback"
  },
  "very_permissive": {
    max_cloud_cover_in_aoi: 80,
    exclude_cover_pixels: false,
    cloud_masking_level: 0,
    description: "Parametri molto permissivi - ultimo tentativo"
  }
};

export interface VegetationPoint {
  date: string;
  NDVI: number;
  NDMI: number;
  ReCI?: number; // Red-edge Chlorophyll Index for nitrogen analysis
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
  temperature_min: number; // °C
  temperature_max: number; // °C
  precipitation_total: number; // mm
  humidity_avg: number; // %
  humidity_min: number; // %
  humidity_max: number; // %
  wind_speed_avg: number; // m/s
  wind_speed_max: number; // m/s
  solar_radiation: number; // MJ/m²/day
  sunshine_hours: number; // hours
  cloudiness: number; // %
  pressure: number; // hPa
  growing_degree_days: number; // GDD
  heat_stress_index: number; // 0-100
  cold_stress_index: number; // 0-100
  water_balance: number; // mm (precipitation - evapotranspiration)
  evapotranspiration: number; // mm
  alerts: string[];
  forecast?: WeatherForecast[];
  historical_comparison?: {
    temperature_vs_normal: number; // deviation from historical average
    precipitation_vs_normal: number; // deviation from historical average
    stress_days_count: number; // days with thermal stress
  };
}

export interface WeatherForecast {
  date: string;
  temperature_min: number;
  temperature_max: number;
  precipitation: number;
  humidity: number;
  wind_speed: number;
  cloudiness: number;
  stress_probability: number; // 0-100
}

export interface ProductivityData {
  predicted_yield_ton_ha: number;
  confidence_level: number; // percentage
  recommendations: string[];
  expected_revenue_eur_ha: number;
}

export interface YieldPredictionResponse {
  predicted_yield_ton_ha: number;
  confidence_level: number;
  yield_class: string;
  factors: {
    ndvi_impact: number;
    ndmi_impact: number;
    data_points: number;
  };
  historical_comparison: {
    vs_average: number;
  };
  recommendations: string[];
  meta: {
    crop_type: string;
    analysis_date: string;
    data_source: string;
    time_series_length: number;
  };
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

// Detect optimal EOS parameters based on polygon location and current season
export function getOptimalEosParameters(polygon: PolygonData): EosParameterProfile {
  // Extract location from polygon
  const coords = polygon.coordinates;
  if (!coords || coords.length === 0) {
    return EOS_PARAMETER_PROFILES.europe_default;
  }

  // Calculate centroid
  const sumLat = coords.reduce((sum, [, lat]) => sum + lat, 0);
  const sumLng = coords.reduce((sum, [lng]) => sum + lng, 0);
  const centroidLat = sumLat / coords.length;
  const centroidLng = sumLng / coords.length;

  // Determine if it's in Italy (rough bounds)
  const isItaly = centroidLat >= 35.0 && centroidLat <= 47.5 && 
                  centroidLng >= 6.0 && centroidLng <= 19.0;

  if (!isItaly) {
    return EOS_PARAMETER_PROFILES.europe_default;
  }

  // Determine season for Italy
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12

  // Italian seasons with cloud patterns:
  // Summer (June-August): 6,7,8 - minimal clouds
  // Winter (December-February): 12,1,2 - more clouds
  // Spring/Autumn: 3,4,5,9,10,11 - moderate
  
  if (month >= 6 && month <= 8) {
    return EOS_PARAMETER_PROFILES.italy_summer;
  } else if (month === 12 || month <= 2) {
    return EOS_PARAMETER_PROFILES.italy_winter;
  } else {
    return EOS_PARAMETER_PROFILES.italy_moderate;
  }
}

// Apply EOS parameters with intelligent fallback
export function applyEosParametersWithFallback(config: EosConfig, polygon: PolygonData): EosConfig {
  const optimal = getOptimalEosParameters(polygon);
  
  return {
    ...config,
    max_cloud_cover_in_aoi: config.max_cloud_cover_in_aoi ?? optimal.max_cloud_cover_in_aoi,
    exclude_cover_pixels: config.exclude_cover_pixels ?? optimal.exclude_cover_pixels,
    cloud_masking_level: config.cloud_masking_level ?? optimal.cloud_masking_level,
    location: polygon.coordinates?.length ? {
      lat: polygon.coordinates.reduce((sum, [, lat]) => sum + lat, 0) / polygon.coordinates.length,
      lng: polygon.coordinates.reduce((sum, [lng]) => sum + lng, 0) / polygon.coordinates.length
    } : undefined
  };
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
    temperature_min: 8.2,
    temperature_max: 15.4,
    precipitation_total: 145.2,
    humidity_avg: 72.5,
    humidity_min: 65.0,
    humidity_max: 80.0,
    wind_speed_avg: 3.2,
    wind_speed_max: 8.1,
    solar_radiation: 15.3,
    sunshine_hours: 6.8,
    cloudiness: 45.2,
    pressure: 1013.5,
    growing_degree_days: 156.7,
    heat_stress_index: 12.5,
    cold_stress_index: 8.3,
    water_balance: -32.1,
    evapotranspiration: 177.3,
    alerts: ["Stress idrico rilevato"],
    historical_comparison: {
      temperature_vs_normal: -2.3,
      precipitation_vs_normal: 25.8,
      stress_days_count: 3
    }
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
    return demoWeather();
  }
  if (!data || !("weather" in data)) {
    console.warn("eos-proxy weather invalid response", data);
    return demoWeather();
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
  weather?: WeatherData;
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
    // Optimization metadata
    optimization_used?: boolean;
    attempt_number?: number;
    escalation_used?: boolean;
    escalation_level?: string;
    all_attempts_failed?: boolean;
    suggestions?: string[];
  };
}

export async function getYieldPrediction(polygon: PolygonData, config: EosConfig): Promise<YieldPredictionResponse> {
  if (config.apiKey === "demo") {
    console.log("Demo mode enabled, generating mock yield prediction");
    
    return {
      predicted_yield_ton_ha: 6.8,
      confidence_level: 82,
      yield_class: 'good',
      factors: {
        ndvi_impact: 78.5,
        ndmi_impact: 65.2,
        data_points: 12,
      },
      historical_comparison: {
        vs_average: 15.3,
      },
      recommendations: [
        "Condizioni favorevoli per buona produttività",
        "Monitorare irrigazione nelle prossime settimane",
        "Ottimizzare fertilizzazione per massimizzare resa"
      ],
      meta: {
        crop_type: config.cropType,
        analysis_date: new Date().toISOString(),
        data_source: "Demo Data",
        time_series_length: 12,
      },
    };
  }

  console.log("Fetching yield prediction via Supabase function");
  
  try {
    const response = await supabase.functions.invoke('eos-proxy', {
      body: {
        action: 'yield_prediction',
        polygon,
        start_date: config.start_date,
        end_date: config.end_date,
        crop_type: config.cropType,
      },
    });

    if (response.error) throw new Error(response.error.message);
    
    return response.data as YieldPredictionResponse;
  } catch (error) {
    console.warn("Yield prediction failed, returning demo data", error);
    
    return {
      predicted_yield_ton_ha: 5.2,
      confidence_level: 65,
      yield_class: 'average',
      factors: {
        ndvi_impact: 60.0,
        ndmi_impact: 55.0,
        data_points: 8,
      },
      historical_comparison: {
        vs_average: -10.3,
      },
      recommendations: [
        "Dati limitati - verificare connessione API",
        "Considerare analisi più approfondita",
        "Monitorare sviluppo vegetativo"
      ],
      meta: {
        crop_type: config.cropType,
        analysis_date: new Date().toISOString(),
        data_source: "Fallback Demo Data",
        time_series_length: 8,
      },
    };
  }
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

  // Apply optimal parameters based on location and season
  const optimizedConfig = applyEosParametersWithFallback(config, _polygon);
  
  // Enhanced retry mechanism with escalating parameters
  const attemptInvoke = async (attempt: number, useEscalation = false) => {
    let requestConfig = optimizedConfig;
    
    if (useEscalation) {
      // Use increasingly permissive parameters for fallback attempts
      if (attempt === 2) {
        const permissive = EOS_PARAMETER_PROFILES.permissive;
        requestConfig = {
          ...optimizedConfig,
          max_cloud_cover_in_aoi: permissive.max_cloud_cover_in_aoi,
          exclude_cover_pixels: permissive.exclude_cover_pixels,
          cloud_masking_level: permissive.cloud_masking_level,
        };
      } else if (attempt >= 3) {
        const veryPermissive = EOS_PARAMETER_PROFILES.very_permissive;
        requestConfig = {
          ...optimizedConfig,
          max_cloud_cover_in_aoi: veryPermissive.max_cloud_cover_in_aoi,
          exclude_cover_pixels: veryPermissive.exclude_cover_pixels,
          cloud_masking_level: veryPermissive.cloud_masking_level,
        };
      }
    }

    const res = await supabase.functions.invoke("eos-proxy", {
      body: {
        action: "summary",
        polygon: _polygon,
        crop_type: requestConfig.cropType,
        planting_date: requestConfig.planting_date,
        start_date: requestConfig.start_date,
        end_date: requestConfig.end_date,
        max_cloud_cover_in_aoi: requestConfig.max_cloud_cover_in_aoi,
        exclude_cover_pixels: requestConfig.exclude_cover_pixels,
        cloud_masking_level: requestConfig.cloud_masking_level,
      },
    });
    return res;
  };

  // Try with optimal parameters first, then escalate
  for (let attempt = 1; attempt <= 4; attempt++) {
    const useEscalation = attempt > 1;
    const { data, error } = await attemptInvoke(attempt, useEscalation);
    
    if (!error && data) {
      // Add metadata about which parameters were used
      if (data.meta) {
        data.meta.optimization_used = true;
        data.meta.attempt_number = attempt;
        if (useEscalation) {
          data.meta.escalation_used = true;
          data.meta.escalation_level = attempt === 2 ? "permissive" : "very_permissive";
        }
      }
      return data as EosSummary;
    }
    
    const msg = String((error as any)?.message || "");
    if (msg.includes("429") || msg.toLowerCase().includes("limit")) {
      // Increased backoff for rate limiting: 3s, 8s, 15s, 25s
      const backoff = attempt <= 2 ? 3000 * attempt : 5000 * attempt; 
      console.warn(`eos-proxy summary rate-limited, retrying in ${backoff}ms (attempt ${attempt}${useEscalation ? ', using escalated parameters' : ''})`);
      await new Promise((r) => setTimeout(r, backoff));
      continue;
    }
    
    console.error(`eos-proxy summary error on attempt ${attempt}:`, error);
    if (attempt < 4) {
      // Brief pause before escalation
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  
  return {
    ndvi_data: {},
    ndmi_data: { critical_threshold: 0.3 },
    phenology: {},
    weather_risks: {},
    ndvi_series: [],
    meta: { 
      observation_count: 0, 
      fallback_used: false, 
      start_date: optimizedConfig.start_date, 
      end_date: optimizedConfig.end_date,
      optimization_used: true,
      all_attempts_failed: true
    },
  };
}

