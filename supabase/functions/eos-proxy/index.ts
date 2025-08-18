import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Force 2D coordinates for EOS API compatibility
type Coordinate = [number, number]; // [lon, lat] - strictly 2D

// Utility function to clean coordinates and ensure 2D format
const cleanCoordinates = (coords: any[]): Coordinate[] => {
  console.log('EOS Debug - Input coordinates:', coords.slice(0, 2), '...(truncated)');
  const cleaned = coords.map(coord => {
    if (Array.isArray(coord)) {
      // Force 2D by taking only first two elements
      const cleaned2D: Coordinate = [coord[0], coord[1]];
      if (coord.length > 2) {
        console.log('EOS Debug - Removed elevation from coordinate:', coord, '-> cleaned:', cleaned2D);
      }
      return cleaned2D;
    }
    return coord;
  });
  console.log('EOS Debug - Cleaned coordinates sample:', cleaned.slice(0, 2), '...(truncated)');
  return cleaned;
};
interface PolygonData {
  geojson?: string;
  coordinates?: Coordinate[];
  source?: string;
  area_ha?: number;
}

interface VegetationPoint {
  date: string;
  NDVI: number;
  NDMI: number;
  ReCI?: number; // Red-edge Chlorophyll Index
}

interface VegetationData {
  field_id: string;
  satellite: string;
  time_series: VegetationPoint[];
  analysis: { health_status: string; growth_stage: string };
}

interface WeatherData {
  temperature_avg: number;
  temperature_min: number;
  temperature_max: number;
  precipitation_total: number;
  humidity_avg: number;
  humidity_min: number;
  humidity_max: number;
  wind_speed_avg: number;
  wind_speed_max: number;
  solar_radiation: number;
  sunshine_hours: number;
  cloudiness: number;
  pressure: number;
  growing_degree_days: number;
  heat_stress_index: number;
  cold_stress_index: number;
  water_balance: number;
  evapotranspiration: number;
  alerts: string[];
  forecast?: any[];
  historical_comparison?: any;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { action, polygon, start_date, end_date } = body as {
      action: "vegetation" | "weather" | "summary" | "soil_moisture";
      polygon?: PolygonData;
      start_date?: string;
      end_date?: string;
    };

    const eosKey = Deno.env.get("EOS_DATA_API_KEY");
    const eosStatsBearer = Deno.env.get("EOS_STATISTICS_BEARER");

    if (!action) {
      return new Response(JSON.stringify({ 
        error: "Missing 'action'",
        error_code: "MISSING_ACTION",
        provider_status: null
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!polygon || (!polygon.geojson && !polygon.coordinates)) {
      return new Response(JSON.stringify({ 
        error: "Invalid polygon",
        error_code: "INVALID_POLYGON", 
        provider_status: null
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // NOTE: This function is scaffolded. Replace the demo builders below with real EOS API calls using eosKey/eosStatsBearer.
    // Example outline to implement later:
    // const resp = await fetch("https://api.eos.com/...", { headers: { Authorization: `Bearer ${eosKey}` } });
    // const apiData = await resp.json();

    if (action === "vegetation") {
      const apiKey = Deno.env.get("EOS_DATA_API_KEY") || Deno.env.get("EOS_STATISTICS_BEARER");
      if (!apiKey) {
        return new Response(
          JSON.stringify({ 
            error: "Missing EOS API key. Please set EOS_DATA_API_KEY in Supabase secrets.",
            error_code: "MISSING_API_KEY",
            provider_status: null
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Build GeoJSON geometry from input with 2D coordinate cleaning
      const buildGeometry = () => {
        if (polygon?.coordinates && polygon.coordinates.length >= 4) {
          console.log('EOS Debug - Raw polygon coordinates received:', polygon.coordinates.slice(0, 3));
          const coords = cleanCoordinates(polygon.coordinates);
          const first = coords[0];
          const last = coords[coords.length - 1];
          const ring = first[0] === last[0] && first[1] === last[1] ? coords : [...coords, first];
          console.log('EOS Debug - Final ring coordinates sample:', ring.slice(0, 2), '...(truncated)');
          return { type: "Polygon", coordinates: [ring] } as const;
        }
        if (polygon?.geojson) {
          try {
            const parsed = JSON.parse(polygon.geojson);
            if (parsed?.type === "Polygon") return parsed;
            if (parsed?.type === "Feature" && parsed.geometry?.type === "Polygon") return parsed.geometry;
            if (parsed?.type === "FeatureCollection" && parsed.features?.[0]?.geometry?.type === "Polygon") return parsed.features[0].geometry;
          } catch (_) {
            // ignore
          }
        }
        throw new Error("Invalid polygon geometry");
      };

      const geometry = buildGeometry();

      // Dynamic date calculation based on planting_date or fallback
      const sd = start_date ?? new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const ed = end_date ?? new Date().toISOString().slice(0, 10);
      
      console.log('EOS Proxy Debug - Date calculation:', {
        start_date_input: start_date,
        end_date_input: end_date,
        calculated_start: sd,
        calculated_end: ed,
        period_days: Math.floor((new Date(ed).getTime() - new Date(sd).getTime()) / (1000 * 60 * 60 * 24))
      });

      // Read optional filters from request (with optimized defaults for maximum coverage)
      const maxCloud = typeof (body as any)?.max_cloud_cover_in_aoi === "number"
        ? Math.max(0, Math.min(100, (body as any).max_cloud_cover_in_aoi))
        : 90; // High cloud tolerance for maximum image availability
      const excludeCover = typeof (body as any)?.exclude_cover_pixels === "boolean"
        ? (body as any).exclude_cover_pixels
        : true; // Exclude cloudy pixels for quality
      const cml = typeof (body as any)?.cloud_masking_level === "number" ? (body as any).cloud_masking_level : 1; // Moderate masking
      const autoFallback = typeof (body as any)?.auto_fallback === "boolean" ? (body as any).auto_fallback : false;

      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

      // Enhanced multi-index statistics with better error handling
      const createAndFetchMultiStats = async (
        indices: string[],
        filters: { maxCloud: number; excludeCover: boolean; cml: number }
      ): Promise<Record<string, Record<string, number>>> => {
        const createUrl = `https://api-connect.eos.com/api/gdw/api?api_key=${apiKey}`;
        const bodyPayload = {
          type: "mt_stats",
          params: {
            bm_type: indices,
            date_start: sd,
            date_end: ed,
            geometry,
            reference: `lov-${Date.now()}-multi`,
            sensors: ["sentinel2l2a"],
            max_cloud_cover_in_aoi: filters.maxCloud,
            exclude_cover_pixels: filters.excludeCover,
            cloud_masking_level: filters.cml,
            aoi_cover_share_min: 0.1, // Ensure at least 10% AOI coverage
          },
        } as const;

        console.log("EOS Debug - Creating multi-stats task with filters:", filters);

        const createResp = await fetch(createUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyPayload),
        });
        
        if (!createResp.ok) {
          const msg = await createResp.text();
          const errorResponse = {
            error: `Stats task create failed: ${createResp.status} ${msg}`,
            error_code: "EOS_CREATE_FAILED",
            provider_status: createResp.status
          };
          
          if (createResp.status === 429) {
            const retryAfter = createResp.headers.get('Retry-After');
            errorResponse.error_code = "RATE_LIMITED";
            if (retryAfter) {
              console.log(`EOS Rate limited - Retry-After: ${retryAfter}s`);
              (errorResponse as any).retry_after = parseInt(retryAfter);
            }
          }
          
          throw errorResponse;
        }
        const createJson = await createResp.json();
        const taskId = createJson?.task_id as string;
        if (!taskId) {
          throw {
            error: "No task_id from statistics create",
            error_code: "NO_TASK_ID",
            provider_status: 200
          };
        }

        const statusUrl = `https://api-connect.eos.com/api/gdw/api/${taskId}?api_key=${apiKey}`;
        let attempts = 0;
        const maxAttempts = 25; // Increased for better reliability
        
        while (attempts < maxAttempts) {
          attempts++;
          
          try {
            const st = await fetch(statusUrl);
            
            if (!st.ok) {
              const t = await st.text();
              
              if (st.status === 429 || t.includes("limit")) {
                const retryAfter = st.headers.get('Retry-After');
                const backoffTime = retryAfter 
                  ? Math.min(30000, parseInt(retryAfter) * 1000)
                  : Math.min(20000, 3000 + attempts * 1500 + Math.random() * 2000); // Jitter
                
                console.log(`EOS Rate limited on status check - attempt ${attempts}/${maxAttempts}, backing off ${backoffTime}ms`);
                await sleep(backoffTime);
                continue;
              }
              
              throw {
                error: `Stats status failed: ${st.status} ${t}`,
                error_code: "EOS_STATUS_FAILED",
                provider_status: st.status
              };
            }
            
            const stJson = await st.json();
            if (stJson?.result && Array.isArray(stJson.result)) {
              // Parse results by index type for multi-index response
              const resultMap: Record<string, Record<string, number>> = {};
              
              for (const r of stJson.result) {
                if (r?.date && r?.bm_type && (typeof r.average === "number" || typeof r.average === "string")) {
                  const indexType = r.bm_type;
                  if (!resultMap[indexType]) resultMap[indexType] = {};
                  resultMap[indexType][r.date] = Number(r.average);
                }
              }
              
              return resultMap;
            }
            
            // Task still processing
            const pollingDelay = Math.min(12000, 8000 + attempts * 500); // Gradual increase
            await sleep(pollingDelay);
            
          } catch (fetchError: any) {
            if (attempts >= maxAttempts) throw fetchError;
            
            console.warn(`Fetch error on attempt ${attempts}, retrying:`, fetchError?.message);
            await sleep(5000);
          }
        }
        
        throw {
          error: "Statistics task timed out after maximum attempts",
          error_code: "TASK_TIMEOUT",
          provider_status: null
        };
      };

      // Enhanced multi-index request with RECI
      let fallback_used = false;
      let finalFilters = { maxCloud, excludeCover, cml };
      
      try {
        // Single consolidated request for NDVI, NDMI, and RECI
        const multiResult = await createAndFetchMultiStats(["NDVI", "NDMI", "RECI"], finalFilters);
        
        let ndviMap = multiResult.NDVI || {};
        let ndmiMap = multiResult.NDMI || {};
        let reciMap = multiResult.RECI || {};
        
        const initialDates = Array.from(new Set([
          ...Object.keys(ndviMap), 
          ...Object.keys(ndmiMap),
          ...Object.keys(reciMap)
        ]));
        
        if (initialDates.length === 0 && autoFallback) {
          // Fallback with more permissive settings
          fallback_used = true;
          finalFilters = { maxCloud: 90, excludeCover: false, cml: 0 };
          console.log("EOS multi-stats empty, auto-fallback enabled, trying permissive filters:", finalFilters);
          
          const fallbackResult = await createAndFetchMultiStats(["NDVI", "NDMI", "RECI"], finalFilters);
          ndviMap = fallbackResult.NDVI || {};
          ndmiMap = fallbackResult.NDMI || {};
          reciMap = fallbackResult.RECI || {};
        }

        const allDates = Array.from(new Set([
          ...Object.keys(ndviMap), 
          ...Object.keys(ndmiMap),
          ...Object.keys(reciMap)
        ])).sort();
        
        const series = allDates.map((d) => ({
          date: d,
          NDVI: Number(ndviMap[d] ?? 0),
          NDMI: Number(ndmiMap[d] ?? 0),
          ReCI: Number(reciMap[d] ?? 0),
        }));

      // Phenology estimation from NDVI trend
      const ndvis = series.map((p) => p.NDVI);
      const last = ndvis[ndvis.length - 1] ?? 0;
      const prev = ndvis[ndvis.length - 2] ?? last;
      const slope = last - prev;
      const max = ndvis.length ? Math.max(...ndvis) : 0;

      let growth_stage = "unknown";
      if (series.length === 0) {
        growth_stage = "dormancy";
      } else if (last < 0.2) growth_stage = "dormancy";
      else if (slope > 0.02 && last > 0.3) growth_stage = "green-up";
      else if (Math.abs(last - max) <= 0.05) growth_stage = "peak";
      else if (slope < -0.02 && last < max - 0.1) growth_stage = "senescence";
      else growth_stage = "stable";

      const lastNDMI = series[series.length - 1]?.NDMI ?? 0;
      const health_status = lastNDMI < 0.3 ? "moderate_stress" : "normal";

      const out: VegetationData = {
        field_id: "LIVE_FIELD",
        satellite: "Sentinel-2",
        time_series: series,
        analysis: { health_status, growth_stage },
      };

        const used_filters = {
          max_cloud_cover_in_aoi: finalFilters.maxCloud,
          exclude_cover_pixels: finalFilters.excludeCover,
          cloud_masking_level: finalFilters.cml,
          sensors: ["sentinel2l2a"],
          aoi_cover_share_min: 0.1
        };
        
        const meta = {
          mode: "live",
          start_date: sd,
          end_date: ed,
          observation_count: series.length,
          fallback_used,
          used_filters,
          reason: series.length === 0 ? "no_observations" : undefined,
          optimization_used: true, // Using multi-index optimization
          indices_requested: ["NDVI", "NDMI", "RECI"]
        };

        console.log("EOS vegetation response (optimized):", { 
          observation_count: series.length, 
          used_filters, 
          fallback_used, 
          indices: Object.keys(multiResult) 
        });

        return new Response(
          JSON.stringify({ vegetation: out, meta }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
        
      } catch (error: any) {
        console.error("EOS vegetation error:", error);
        
        // Enhanced error response with provider details
        const errorResponse = {
          error: error?.error || error?.message || "Unknown vegetation error",
          error_code: error?.error_code || "VEGETATION_ERROR",
          provider_status: error?.provider_status || null,
          retry_after: error?.retry_after || null
        };
        
        const statusCode = error?.provider_status === 429 ? 429 : 500;
        
        return new Response(
          JSON.stringify(errorResponse),
          { 
            status: statusCode,
            headers: { 
              ...corsHeaders, 
              "Content-Type": "application/json",
              ...(error?.retry_after ? { "Retry-After": error.retry_after.toString() } : {})
            } 
          }
        );
      }
    }

    if (action === "weather") {
      const apiKey = Deno.env.get("EOS_DATA_API_KEY");
      if (!apiKey) {
        return new Response(
          JSON.stringify({ 
            error: "Missing EOS API key. Please set EOS_DATA_API_KEY in Supabase secrets.",
            error_code: "MISSING_API_KEY",
            provider_status: null
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Build GeoJSON geometry with 2D coordinate cleaning (weather endpoint)
      const buildGeometry = () => {
        if (polygon?.coordinates && polygon.coordinates.length >= 4) {
          console.log('EOS Debug - Raw weather coordinates received:', polygon.coordinates.slice(0, 3));
          const coords = cleanCoordinates(polygon.coordinates);
          const first = coords[0];
          const last = coords[coords.length - 1];
          const ring = first[0] === last[0] && first[1] === last[1] ? coords : [...coords, first];
          console.log('EOS Debug - Final weather ring coordinates sample:', ring.slice(0, 2), '...(truncated)');
          return { type: "Polygon", coordinates: [ring] } as const;
        }
        if (polygon?.geojson) {
          try {
            const parsed = JSON.parse(polygon.geojson);
            if (parsed?.type === "Polygon") return parsed;
            if (parsed?.type === "Feature" && parsed.geometry?.type === "Polygon") return parsed.geometry;
            if (parsed?.type === "FeatureCollection" && parsed.features?.[0]?.geometry?.type === "Polygon") return parsed.features[0].geometry;
          } catch (_) {}
        }
        throw new Error("Invalid polygon geometry");
      };
      const geometry = buildGeometry();

      const sd = start_date ?? new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const ed = end_date ?? new Date().toISOString().slice(0, 10);

      try {
        // Enhanced weather API call with better error handling
        const url = `https://api-connect.eos.com/api/cz/backend/forecast-history/?api_key=${apiKey}`;
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ geometry, start_date: sd, end_date: ed }),
        });
        
        if (!resp.ok) {
          const msg = await resp.text();
          const errorResponse = {
            error: `Weather history failed: ${resp.status} ${msg}`,
            error_code: resp.status === 429 ? "RATE_LIMITED" : "WEATHER_API_ERROR",
            provider_status: resp.status
          };
          
          if (resp.status === 429) {
            const retryAfter = resp.headers.get('Retry-After');
            if (retryAfter) {
              (errorResponse as any).retry_after = parseInt(retryAfter);
            }
          }
          
          throw errorResponse;
        }
      const json = await resp.json();
      const days = Array.isArray(json) ? json : [];

      // Enhanced weather data calculation
      let tempSum = 0, tempMin = 999, tempMax = -999;
      let tempCount = 0;
      let precipTotal = 0;
      let humiditySum = 0, humidityMin = 999, humidityMax = -999, humidityCount = 0;
      let windSum = 0, windMax = 0, windCount = 0;
      let solarSum = 0, solarCount = 0;
      let sunshineSum = 0, cloudSum = 0, pressureSum = 0;
      let gddSum = 0;
      let stressDaysCount = 0;

      for (const d of days) {
        const tmin = Number(d.temperature_min);
        const tmax = Number(d.temperature_max);
        if (!Number.isNaN(tmin) && !Number.isNaN(tmax)) {
          tempSum += (tmin + tmax) / 2;
          tempMin = Math.min(tempMin, tmin);
          tempMax = Math.max(tempMax, tmax);
          tempCount += 1;
          
          // Calculate GDD (base temperature 5°C for wheat)
          const avgTemp = (tmin + tmax) / 2;
          gddSum += Math.max(0, avgTemp - 5);
          
          // Count stress days
          if (tmax > 32 || tmin < 5) stressDaysCount++;
        }
        
        const rain = Number(d.rainfall);
        if (!Number.isNaN(rain)) precipTotal += rain;
        
        const humidity = Number(d.humidity);
        if (!Number.isNaN(humidity)) {
          humiditySum += humidity;
          humidityMin = Math.min(humidityMin, humidity);
          humidityMax = Math.max(humidityMax, humidity);
          humidityCount++;
        }
        
        const wind = Number(d.wind_speed);
        if (!Number.isNaN(wind)) {
          windSum += wind;
          windMax = Math.max(windMax, wind);
          windCount++;
        }
        
        const solar = Number(d.solar_radiation);
        if (!Number.isNaN(solar)) {
          solarSum += solar;
          solarCount++;
        }
        
        const sunshine = Number(d.sunshine_hours);
        if (!Number.isNaN(sunshine)) sunshineSum += sunshine;
        
        const clouds = Number(d.cloudiness);
        if (!Number.isNaN(clouds)) cloudSum += clouds;
        
        const pressure = Number(d.pressure);
        if (!Number.isNaN(pressure)) pressureSum += pressure;
      }

      const temperature_avg = tempCount ? Number((tempSum / tempCount).toFixed(1)) : 0;
      const precipitation_total = Number(precipTotal.toFixed(1));
      const humidity_avg = humidityCount ? Number((humiditySum / humidityCount).toFixed(1)) : 0;
      const wind_speed_avg = windCount ? Number((windSum / windCount).toFixed(1)) : 0;
      const solar_radiation = solarCount ? Number((solarSum / solarCount).toFixed(1)) : 0;
      const sunshine_hours = days.length ? Number((sunshineSum / days.length).toFixed(1)) : 0;
      const cloudiness = days.length ? Number((cloudSum / days.length).toFixed(1)) : 0;
      const pressure = days.length ? Number((pressureSum / days.length).toFixed(1)) : 1013;
      const growing_degree_days = Number(gddSum.toFixed(1));
      
      // Calculate stress indices
      const heat_stress_index = tempMax > 32 ? Math.min(100, (tempMax - 32) * 10) : 0;
      const cold_stress_index = tempMin < 5 ? Math.min(100, (5 - tempMin) * 15) : 0;
      
      // Calculate water balance (simplified: precipitation - estimated evapotranspiration)
      const estimatedET = Math.max(0, (temperature_avg - 5) * 0.5 * days.length);
      const water_balance = Number((precipitation_total - estimatedET).toFixed(1));
      const evapotranspiration = Number(estimatedET.toFixed(1));

      // Enhanced alerts
      const alerts: string[] = [];
      if (heat_stress_index > 30) alerts.push("Stress termico elevato rilevato");
      if (cold_stress_index > 20) alerts.push("Rischio stress da freddo");
      if (water_balance < -30) alerts.push("Deficit idrico significativo");
      if (windMax > 15) alerts.push("Venti forti possono causare danni");
      if (precipitation_total > 80) alerts.push("Precipitazioni eccessive - rischio ristagni");

      // Historical comparison (mock data for now)
      const historical_comparison = {
        temperature_vs_normal: Number((temperature_avg - 18).toFixed(1)), // assuming 18°C normal
        precipitation_vs_normal: Number((precipitation_total - 45).toFixed(1)), // assuming 45mm normal
        stress_days_count: stressDaysCount
      };

      // Fetch 7-day forecast
      const forecastUrl = `https://api-connect.eos.com/api/cz/backend/forecast/?api_key=${apiKey}`;
      let forecast = [];
      try {
        const forecastResp = await fetch(forecastUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ geometry, days: 7 }),
        });
        if (forecastResp.ok) {
          const forecastData = await forecastResp.json();
          forecast = (Array.isArray(forecastData) ? forecastData : []).slice(0, 7).map((f: any) => ({
            date: f.date,
            temperature_min: Number(f.temperature_min) || 0,
            temperature_max: Number(f.temperature_max) || 0,
            precipitation: Number(f.rainfall) || 0,
            humidity: Number(f.humidity) || 0,
            wind_speed: Number(f.wind_speed) || 0,
            cloudiness: Number(f.cloudiness) || 0,
            stress_probability: Math.min(100, Math.max(0, 
              (Number(f.temperature_max) > 32 ? 50 : 0) + 
              (Number(f.temperature_min) < 5 ? 30 : 0) +
              (Number(f.wind_speed) > 15 ? 20 : 0)
            ))
          }));
        }
      } catch (e) {
        console.log("Forecast fetch failed:", e);
      }

      const weather: WeatherData = { 
        temperature_avg, 
        temperature_min: tempMin === 999 ? 0 : Number(tempMin.toFixed(1)),
        temperature_max: tempMax === -999 ? 0 : Number(tempMax.toFixed(1)),
        precipitation_total,
        humidity_avg,
        humidity_min: humidityMin === 999 ? 0 : Number(humidityMin.toFixed(1)),
        humidity_max: humidityMax === -999 ? 0 : Number(humidityMax.toFixed(1)),
        wind_speed_avg,
        wind_speed_max: Number(windMax.toFixed(1)),
        solar_radiation,
        sunshine_hours,
        cloudiness,
        pressure,
        growing_degree_days,
        heat_stress_index: Number(heat_stress_index.toFixed(1)),
        cold_stress_index: Number(cold_stress_index.toFixed(1)),
        water_balance,
        evapotranspiration,
        alerts,
        forecast,
        historical_comparison
      };

      return new Response(
        JSON.stringify({ weather, meta: { mode: "live", start_date: sd, end_date: ed } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if ((body as any).action === "summary") {
      const apiKey = Deno.env.get("EOS_DATA_API_KEY") || Deno.env.get("EOS_STATISTICS_BEARER");
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "Missing EOS API key. Please set EOS_DATA_API_KEY in Supabase secrets." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Build GeoJSON geometry with 2D coordinate cleaning (summary endpoint)
      const buildGeometry = () => {
        if (polygon?.coordinates && polygon.coordinates.length >= 4) {
          console.log('EOS Debug - Raw summary coordinates received:', polygon.coordinates.slice(0, 3));
          const coords = cleanCoordinates(polygon.coordinates);
          const first = coords[0];
          const last = coords[coords.length - 1];
          const ring = first[0] === last[0] && first[1] === last[1] ? coords : [...coords, first];
          console.log('EOS Debug - Final summary ring coordinates sample:', ring.slice(0, 2), '...(truncated)');
          return { type: "Polygon", coordinates: [ring] } as const;
        }
        if (polygon?.geojson) {
          try {
            const parsed = JSON.parse(polygon.geojson);
            if (parsed?.type === "Polygon") return parsed;
            if (parsed?.type === "Feature" && parsed.geometry?.type === "Polygon") return parsed.geometry;
            if (parsed?.type === "FeatureCollection" && parsed.features?.[0]?.geometry?.type === "Polygon") return parsed.features[0].geometry;
          } catch (_) {}
        }
        throw new Error("Invalid polygon geometry");
      };
      const geometry = buildGeometry();

      // Dates
      const todayIso = new Date().toISOString().slice(0, 10);
      const planting_date: string | undefined = (body as any).planting_date;
      const providedStart: string | undefined = (body as any).start_date;
      const providedEnd: string | undefined = (body as any).end_date;
      const sd = planting_date || providedStart || new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const ed = providedEnd || todayIso;

      // Cloud filters with optimized defaults for maximum coverage
      const maxCloud = typeof (body as any)?.max_cloud_cover_in_aoi === "number" ? Math.max(0, Math.min(100, (body as any).max_cloud_cover_in_aoi)) : 90; // High cloud tolerance for maximum image availability
      const excludeCover = typeof (body as any)?.exclude_cover_pixels === "boolean" ? (body as any).exclude_cover_pixels : true; // Exclude cloudy pixels for quality
      const cml = typeof (body as any)?.cloud_masking_level === "number" ? (body as any).cloud_masking_level : 1; // Moderate masking
      const autoFallback = typeof (body as any)?.auto_fallback === "boolean" ? (body as any).auto_fallback : false;

      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

      const createAndFetchStats = async (
        indexName: string,
        filters: { maxCloud: number; excludeCover: boolean; cml: number }
      ): Promise<Record<string, number>> => {
        const createUrl = `https://api-connect.eos.com/api/gdw/api?api_key=${apiKey}`;
        const bodyPayload = {
          type: "mt_stats",
          params: {
            bm_type: [indexName],
            date_start: sd,
            date_end: ed,
            geometry,
            reference: `lov-${Date.now()}-${indexName}`,
            sensors: ["sentinel2l2a"],
            max_cloud_cover_in_aoi: filters.maxCloud,
            exclude_cover_pixels: filters.excludeCover,
            cloud_masking_level: filters.cml,
          },
        } as const;

        const createResp = await fetch(createUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyPayload),
        });
        if (!createResp.ok) {
          const msg = await createResp.text();
          throw new Error(`Stats task create failed: ${createResp.status} ${msg}`);
        }
        const createJson = await createResp.json();
        const taskId = createJson?.task_id as string;
        if (!taskId) throw new Error("No task_id from statistics create");

        const statusUrl = `https://api-connect.eos.com/api/gdw/api/${taskId}?api_key=${apiKey}`;
        let attempts = 0;
        while (attempts < 20) { // Increased max attempts
          attempts++;
          const st = await fetch(statusUrl);
          if (!st.ok) {
            const t = await st.text();
            if (st.status === 429 || t.includes("limit")) {
              // Enhanced backoff strategy for summary requests
              const backoffTime = Math.min(20000, 7000 + attempts * 2500); // 7s to 20s escalating
              console.error(`Summary stats status 429 - backing off ${backoffTime}ms (attempt ${attempts})`);
              await sleep(backoffTime);
              continue;
            }
            throw new Error(`Stats status failed: ${st.status} ${t}`);
          }
          const stJson = await st.json();
          if (stJson?.result && Array.isArray(stJson.result)) {
            const map: Record<string, number> = {};
            for (const r of stJson.result) {
              if (r?.date && (typeof r.average === "number" || typeof r.average === "string")) {
                map[r.date] = Number(r.average);
              }
            }
            return map;
          }
          await sleep(8000);
        }
        throw new Error("Statistics task timed out");
      };

      // Fetch NDVI/NDMI with optional auto-fallback
      let fallback_used = false;
      let ndviMap = await createAndFetchStats("NDVI", { maxCloud, excludeCover, cml });
      let ndmiMap = await createAndFetchStats("NDMI", { maxCloud, excludeCover, cml });
      const initialDates = Array.from(new Set([...Object.keys(ndviMap), ...Object.keys(ndmiMap)]));
      if (initialDates.length === 0 && autoFallback) {
        fallback_used = true;
        console.log("EOS summary empty, auto-fallback enabled, trying most permissive filters");
        ndviMap = await createAndFetchStats("NDVI", { maxCloud: 90, excludeCover: false, cml: 0 });
        ndmiMap = await createAndFetchStats("NDMI", { maxCloud: 90, excludeCover: false, cml: 0 });
      }
      const allDates = Array.from(new Set([...Object.keys(ndviMap), ...Object.keys(ndmiMap)])).sort();
      const series = allDates.map((d) => ({ date: d, NDVI: Number(ndviMap[d] ?? 0), NDMI: Number(ndmiMap[d] ?? 0) }));

      // Helper time functions
      const toTs = (ds: string) => new Date(ds).getTime();
      const last = series[series.length - 1];
      const lastTs = last ? toTs(last.date) : 0;
      const withinDays = (t1: number, t2: number, days: number) => Math.abs(t1 - t2) <= days * 86400000;
      const nearestValue = (offsetDays: number, key: "NDVI" | "NDMI"): number | undefined => {
        if (!series.length || !lastTs) return undefined;
        const target = lastTs - offsetDays * 86400000;
        let best: { dt: number; v: number } | null = null;
        for (const p of series) {
          const ts = toTs(p.date);
          const v = (p as any)[key];
          if (typeof v !== "number") continue;
          if (withinDays(ts, target, 7)) {
            const d = Math.abs(ts - target);
            if (!best || d < best.dt) best = { dt: d, v };
          }
        }
        if (best) return best.v;
        // linear interpolation fallback
        let before: any = null, after: any = null;
        for (const p of series) {
          const ts = toTs(p.date);
          if (ts <= target) before = p;
          if (ts > target) { after = p; break; }
        }
        if (before && after) {
          const v1 = (before as any)[key];
          const v2 = (after as any)[key];
          const t1 = toTs(before.date);
          const t2 = toTs(after.date);
          const ratio = (target - t1) / (t2 - t1);
          if (typeof v1 === "number" && typeof v2 === "number") return v1 + (v2 - v1) * ratio;
        }
        return undefined;
      };

      const pct = (now?: number, prev?: number) => {
        if (now == null || prev == null || prev === 0) return undefined;
        return Number((((now - prev) / Math.abs(prev)) * 100).toFixed(1));
      };

      const ndvi_now = last?.NDVI;
      const ndvi_prev30 = nearestValue(30, "NDVI");
      const ndvi_trend = pct(ndvi_now, ndvi_prev30);

      const ndmi_now = last?.NDMI;
      const ndmi_prev14 = nearestValue(14, "NDMI");
      const ndmi_trend = pct(ndmi_now, ndmi_prev14);

      // Average NDVI in last 30d (fallback: whole period)
      let field_avg: number | undefined = undefined;
      if (series.length && lastTs) {
        const from = lastTs - 30 * 86400000;
        const arr = series.filter((p) => toTs(p.date) >= from);
        const use = arr.length >= 2 ? arr : series;
        const sum = use.reduce((a, p) => a + (p.NDVI || 0), 0);
        field_avg = Number((sum / use.length).toFixed(2));
      }

      // Uniformity score (fallback constant)
      const uniformity_score = 0.75;

      // Water stress level
      const water_stress_level = ndmi_now == null
        ? undefined
        : ndmi_now >= 0.4
        ? "none"
        : ndmi_now >= 0.3
        ? "mild"
        : ndmi_now >= 0.2
        ? "moderate"
        : "severe";

      // Phenology estimation
      const plantingTs = planting_date ? new Date(planting_date).getTime() : undefined;
      const endTs = new Date(ed).getTime();
      const days_from_planting = plantingTs ? Math.max(0, Math.floor((endTs - plantingTs) / 86400000)) : undefined;
      const slope = series.length >= 2 ? series[series.length - 1].NDVI - series[series.length - 2].NDVI : 0;
      const maxNdvi = series.length ? Math.max(...series.map((p) => p.NDVI)) : 0;

      let current_stage: string = "stable";
      if (ndvi_now == null) current_stage = "unknown";
      else if (ndvi_now < 0.2 && (days_from_planting ?? 0) < 25) current_stage = "germination";
      else if ((ndvi_now >= 0.2 && ndvi_now < 0.45) || ((days_from_planting ?? 0) >= 25 && (days_from_planting ?? 0) < 60)) current_stage = "tillering";
      else if ((ndvi_now >= 0.45 && ndvi_now < 0.6) || ((days_from_planting ?? 0) >= 60 && (days_from_planting ?? 0) < 90)) current_stage = "jointing";
      else if (ndvi_now >= 0.6 && ndvi_now < 0.7 && slope > 0) current_stage = "heading";
      else if (ndvi_now >= 0.7 && ndvi_now <= 0.8 && Math.abs(ndvi_now - maxNdvi) <= 0.05) current_stage = "flowering";
      else if (ndvi_now >= 0.55 && ndvi_now < 0.7 && slope < 0) current_stage = "grain_filling";
      else if (ndvi_now < 0.4 && (days_from_planting ?? 999) > 120) current_stage = "maturity";

      const crop_type: string = (body as any).crop_type || "wheat";
      const expected_harvest_days = crop_type === "wheat" ? 200 : crop_type === "wine" ? 240 : 300;
      const stageThresholds: Record<string, number> = {
        germination: 0.15,
        tillering: 0.3,
        jointing: 0.5,
        heading: 0.65,
        flowering: 0.75,
        grain_filling: 0.6,
        maturity: 0.35,
        stable: 0.5,
        unknown: 0.5,
      };
      const thr = stageThresholds[current_stage] ?? 0.5;
      let development_rate: "early" | "normal" | "delayed" = "normal";
      if (ndvi_now != null) {
        if (ndvi_now > thr * 1.12) development_rate = "early";
        else if (ndvi_now < thr * 0.88) development_rate = "delayed";
      }

      // Weather risks
      const weatherUrl = `https://api-connect.eos.com/api/cz/backend/forecast-history/?api_key=${apiKey}`;
      // Historical last 30d
      const historyResp = await fetch(weatherUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geometry, start_date: new Date(Date.now() - 30 * 86400000).toISOString().slice(0,10), end_date: todayIso }),
      });
      let history: any[] = [];
      if (historyResp.ok) history = await historyResp.json();

      const precip_30d = history.reduce((acc, d: any) => acc + (Number(d.rainfall) || 0), 0);
      const tmaxArr = history.map((d: any) => Number(d.temperature_max)).filter((n: number) => !Number.isNaN(n));
      const tminArr = history.map((d: any) => Number(d.temperature_min)).filter((n: number) => !Number.isNaN(n));

      const heatThreshold = crop_type === "wheat" ? 30 : crop_type === "wine" ? 35 : 36;
      const temperature_stress_days = history.filter((d: any) => Number(d.temperature_max) > heatThreshold).length;

      // Empirical precipitation target
      const month = new Date().getUTCMonth() + 1;
      const isCold = [11,12,1,2,3].includes(month);
      const target = isCold ? 40 : 70;
      const precipitation_deficit_mm = Number((precip_30d - target).toFixed(1));

      // Forecast next 7 days
      const sevenAhead = new Date(Date.now() + 7 * 86400000).toISOString().slice(0,10);
      const forecastResp = await fetch(weatherUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geometry, start_date: todayIso, end_date: sevenAhead }),
      });
      let forecast: any[] = [];
      if (forecastResp.ok) forecast = await forecastResp.json();

      const frost_risk_forecast_7d = forecast.some((d: any) => Number(d.temperature_min) < 0);
      const hotDays = forecast.filter((d: any) => Number(d.temperature_max) > heatThreshold).length;
      const heat_stress_risk = hotDays >= 4 ? "high" : hotDays >= 2 ? "medium" : "low";

      const response = {
        ndvi_data: {
          current_value: ndvi_now,
          trend_30_days: ndvi_trend,
          field_average: field_avg,
          uniformity_score,
        },
        ndmi_data: {
          current_value: ndmi_now,
          water_stress_level,
          trend_14_days: ndmi_trend,
          critical_threshold: 0.30,
        },
        phenology: {
          current_stage,
          days_from_planting,
          expected_harvest_days,
          development_rate,
        },
        weather_risks: {
          temperature_stress_days,
          precipitation_deficit_mm,
          frost_risk_forecast_7d,
          heat_stress_risk,
        },
        // Include series so the UI can render the NDVI chart without extra calls
        ndvi_series: series,
        meta: {
          start_date: sd,
          end_date: ed,
          sensor_used: "Sentinel-2 L2A",
          observation_count: series.length,
          fallback_used,
          used_filters: {
            max_cloud_cover_in_aoi: fallback_used ? 90 : maxCloud,
            exclude_cover_pixels: fallback_used ? false : excludeCover,
            cloud_masking_level: fallback_used ? 0 : cml,
          },
        },
      };

      console.log("EOS summary response", { obs: series.length, fallback_used });
      
      // Enhanced logging and response for troubleshooting
      if (series.length === 0) {
        console.log(`EOS Debug - No observations found. Field: ${JSON.stringify(polygon.coordinates[0].slice(0, 3))}...`);
        console.log(`EOS Debug - Period: ${sd} to ${ed}, Area: ${polygon.area_ha || 'unknown'} ha`);
        response.meta.suggestions = [
          "Try extending the analysis period (e.g., last 3-6 months)",
          "Use 'Retry with extended filters' to reduce cloud filtering",
          "Verify the field coordinates are correct",
          "Consider that some areas may have limited satellite coverage"
        ];
      }
      
      return new Response(JSON.stringify(response), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Add soil moisture action
    if (action === "soil_moisture") {
      const apiKey = Deno.env.get("EOS_DATA_API_KEY");
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "Missing EOS API key. Please set EOS_DATA_API_KEY in Supabase secrets." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // For demo implementation, generate realistic soil moisture data
      const crop_type = body.crop_type || "wheat";
      const currentMonth = new Date().getMonth() + 1;
      
      // Generate realistic soil moisture based on season and crop
      const generateSoilMoisture = () => {
        // Base values vary by season
        const isSummer = [6, 7, 8].includes(currentMonth);
        const isWinter = [12, 1, 2].includes(currentMonth);
        
        let baseSurface = isSummer ? 15 : isWinter ? 35 : 25;
        let baseRoot = isSummer ? 25 : isWinter ? 45 : 35;
        
        // Add some realistic variation
        baseSurface += (Math.random() - 0.5) * 10;
        baseRoot += (Math.random() - 0.5) * 15;
        
        const fieldCapacity = 45;
        const wiltingPoint = 15;
        const waterDeficit = Math.max(0, (35 - baseRoot) * 0.1);
        const smi = (baseRoot - 30) / 10; // Normalized around 30%
        
        const forecast = Array.from({ length: 7 }, (_, i) => ({
          date: new Date(Date.now() + i * 86400000).toISOString().slice(0, 10),
          surface_moisture: Math.max(10, baseSurface + (Math.random() - 0.5) * 5),
          root_zone_moisture: Math.max(15, baseRoot + (Math.random() - 0.5) * 8),
          stress_probability: Math.max(0, Math.min(100, (40 - baseRoot) * 2)),
          irrigation_need: baseRoot < 25
        }));

        // Irrigation recommendation logic
        let timing: "immediate" | "within_3_days" | "within_week" | "not_needed" = "not_needed";
        let priority: "critical" | "high" | "medium" | "low" = "low";
        let volume = 0;

        if (baseRoot < 20) {
          timing = "immediate";
          priority = "critical";
          volume = 25;
        } else if (baseRoot < 25) {
          timing = "within_3_days";
          priority = "high";
          volume = 20;
        } else if (baseRoot < 30) {
          timing = "within_week";
          priority = "medium";
          volume = 15;
        }

        return {
          surface_moisture: Number(baseSurface.toFixed(1)),
          root_zone_moisture: Number(baseRoot.toFixed(1)),
          soil_moisture_index: Number(smi.toFixed(2)),
          evapotranspiration_actual: 3.2,
          evapotranspiration_potential: 4.1,
          water_deficit: Number(waterDeficit.toFixed(1)),
          drought_stress_level: baseRoot < 20 ? "severe" : baseRoot < 25 ? "moderate" : baseRoot < 30 ? "mild" : "none",
          historical_percentile: Math.max(5, Math.min(95, baseRoot * 2)),
          field_capacity: fieldCapacity,
          wilting_point: wiltingPoint,
          available_water_content: Number(((baseRoot - wiltingPoint) / (fieldCapacity - wiltingPoint) * 100).toFixed(1)),
          forecast_7d: forecast,
          irrigation_recommendation: timing !== "not_needed" ? {
            timing,
            volume_mm: volume,
            priority
          } : undefined
        } as any;
      };

      const soilMoistureData = generateSoilMoisture();

      return new Response(
        JSON.stringify({ soil_moisture: soilMoistureData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }


    return new Response(JSON.stringify({ error: "Unsupported action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("eos-proxy error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
