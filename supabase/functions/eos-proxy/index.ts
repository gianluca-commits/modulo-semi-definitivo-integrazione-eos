import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Coordinate extends Array<number> { 0: number; 1: number }
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
}

interface VegetationData {
  field_id: string;
  satellite: string;
  time_series: VegetationPoint[];
  analysis: { health_status: string; growth_stage: string };
}

interface WeatherData {
  temperature_avg: number;
  precipitation_total: number;
  alerts: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { action, polygon, start_date, end_date } = body as {
      action: "vegetation" | "weather";
      polygon: PolygonData;
      start_date?: string;
      end_date?: string;
    };

    const eosKey = Deno.env.get("EOS_DATA_API_KEY");
    const eosStatsBearer = Deno.env.get("EOS_STATISTICS_BEARER");

    if (!action) {
      return new Response(JSON.stringify({ error: "Missing 'action'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!polygon || (!polygon.geojson && !polygon.coordinates)) {
      return new Response(JSON.stringify({ error: "Invalid polygon" }), {
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
          JSON.stringify({ error: "Missing EOS API key. Please set EOS_DATA_API_KEY in Supabase secrets." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Build GeoJSON geometry from input
      const buildGeometry = () => {
        if (polygon?.coordinates && polygon.coordinates.length >= 4) {
          const coords = polygon.coordinates as unknown as [number, number][];
          const first = coords[0];
          const last = coords[coords.length - 1];
          const ring = first[0] === last[0] && first[1] === last[1] ? coords : [...coords, first];
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

      const sd = start_date ?? new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const ed = end_date ?? new Date().toISOString().slice(0, 10);

      // Read optional filters from request (with safe defaults)
      const maxCloud = typeof (body as any)?.max_cloud_cover_in_aoi === "number"
        ? Math.max(0, Math.min(100, (body as any).max_cloud_cover_in_aoi))
        : 30;
      const excludeCover = typeof (body as any)?.exclude_cover_pixels === "boolean"
        ? (body as any).exclude_cover_pixels
        : true;
      const cml = typeof (body as any)?.cloud_masking_level === "number" ? (body as any).cloud_masking_level : 2;

      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

      // Create statistics task and poll until finished; returns map of date->average
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
          while (attempts < 18) { // ~144s max with 8s interval
            attempts++;
            const st = await fetch(statusUrl);
            if (!st.ok) {
              const t = await st.text();
              if (st.status === 429 || t.includes("limit")) {
                console.error("Stats status 429 - backing off 12s");
                await sleep(12000);
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
            await sleep(8000); // slower polling to respect RPM
          }
        throw new Error("Statistics task timed out");
      };

      // First attempt with requested/default filters
      let fallback_used = false;
      const ndviMap1 = await createAndFetchStats("NDVI", { maxCloud, excludeCover, cml });
      const ndmiMap1 = await createAndFetchStats("NDMI", { maxCloud, excludeCover, cml });

      let ndviMap = ndviMap1;
      let ndmiMap = ndmiMap1;

      const initialDates = Array.from(new Set([...Object.keys(ndviMap1), ...Object.keys(ndmiMap1)]));
      if (initialDates.length === 0) {
        // Retry once with more tolerant filters
        fallback_used = true;
        const tMaxCloud = Math.max(maxCloud, 60);
        const tExclude = false;
        const tCml = 1;
        console.log("EOS stats empty, retrying with tolerant filters", { tMaxCloud, tExclude, tCml });
        ndviMap = await createAndFetchStats("NDVI", { maxCloud: tMaxCloud, excludeCover: tExclude, cml: tCml });
        ndmiMap = await createAndFetchStats("NDMI", { maxCloud: tMaxCloud, excludeCover: tExclude, cml: tCml });
      }

      const allDates = Array.from(new Set([...Object.keys(ndviMap), ...Object.keys(ndmiMap)])).sort();
      const series = allDates.map((d) => ({
        date: d,
        NDVI: Number(ndviMap[d] ?? 0),
        NDMI: Number(ndmiMap[d] ?? 0),
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
        max_cloud_cover_in_aoi: series.length ? (fallback_used ? Math.max(maxCloud, 60) : maxCloud) : maxCloud,
        exclude_cover_pixels: series.length ? (fallback_used ? false : excludeCover) : excludeCover,
        cloud_masking_level: series.length ? (fallback_used ? 1 : cml) : cml,
      };
      const meta = {
        mode: "live",
        start_date: sd,
        end_date: ed,
        observation_count: series.length,
        fallback_used,
        used_filters,
        reason: series.length === 0 ? "no_observations" : undefined,
      };

      console.log("EOS vegetation response", { observation_count: series.length, used_filters, fallback_used });

      return new Response(
        JSON.stringify({ vegetation: out, meta }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "weather") {
      const apiKey = Deno.env.get("EOS_DATA_API_KEY");
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "Missing EOS API key. Please set EOS_DATA_API_KEY in Supabase secrets." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Build GeoJSON geometry
      const buildGeometry = () => {
        if (polygon?.coordinates && polygon.coordinates.length >= 4) {
          const coords = polygon.coordinates as unknown as [number, number][];
          const first = coords[0];
          const last = coords[coords.length - 1];
          const ring = first[0] === last[0] && first[1] === last[1] ? coords : [...coords, first];
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

      const url = `https://api-connect.eos.com/api/cz/backend/forecast-history/?api_key=${apiKey}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geometry, start_date: sd, end_date: ed }),
      });
      if (!resp.ok) {
        const msg = await resp.text();
        throw new Error(`Weather history failed: ${resp.status} ${msg}`);
      }
      const json = await resp.json();
      const days = Array.isArray(json) ? json : [];

      let tempSum = 0;
      let tempCount = 0;
      let precipTotal = 0;
      for (const d of days) {
        const tmin = Number(d.temperature_min);
        const tmax = Number(d.temperature_max);
        if (!Number.isNaN(tmin) && !Number.isNaN(tmax)) {
          tempSum += (tmin + tmax) / 2;
          tempCount += 1;
        }
        const rain = Number(d.rainfall);
        if (!Number.isNaN(rain)) precipTotal += rain;
      }
      const temperature_avg = tempCount ? Number((tempSum / tempCount).toFixed(1)) : 0;
      const precipitation_total = Number(precipTotal.toFixed(1));

      const alerts: string[] = [];
      if (precipitation_total < 10 && temperature_avg > 15) alerts.push("Stress idrico potenziale");

      const weather: WeatherData = { temperature_avg, precipitation_total, alerts };

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

      // Build GeoJSON geometry
      const buildGeometry = () => {
        if (polygon?.coordinates && polygon.coordinates.length >= 4) {
          const coords = polygon.coordinates as unknown as [number, number][];
          const first = coords[0];
          const last = coords[coords.length - 1];
          const ring = first[0] === last[0] && first[1] === last[1] ? coords : [...coords, first];
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

      // Cloud filters
      const maxCloud = typeof (body as any)?.max_cloud_cover_in_aoi === "number" ? Math.max(0, Math.min(100, (body as any).max_cloud_cover_in_aoi)) : 30;
      const excludeCover = typeof (body as any)?.exclude_cover_pixels === "boolean" ? (body as any).exclude_cover_pixels : true;
      const cml = typeof (body as any)?.cloud_masking_level === "number" ? (body as any).cloud_masking_level : 2;

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
        while (attempts < 18) {
          attempts++;
          const st = await fetch(statusUrl);
          if (!st.ok) {
            const t = await st.text();
            if (st.status === 429 || t.includes("limit")) {
              console.error("Summary stats status 429 - backing off 10s");
              await sleep(10000);
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

      // Fetch NDVI/NDMI with fallback
      let fallback_used = false;
      let ndviMap = await createAndFetchStats("NDVI", { maxCloud, excludeCover, cml });
      let ndmiMap = await createAndFetchStats("NDMI", { maxCloud, excludeCover, cml });
      const initialDates = Array.from(new Set([...Object.keys(ndviMap), ...Object.keys(ndmiMap)]));
      if (initialDates.length === 0) {
        fallback_used = true;
        ndviMap = await createAndFetchStats("NDVI", { maxCloud: Math.max(maxCloud, 60), excludeCover: false, cml: 1 });
        ndmiMap = await createAndFetchStats("NDMI", { maxCloud: Math.max(maxCloud, 60), excludeCover: false, cml: 1 });
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
            max_cloud_cover_in_aoi: fallback_used ? Math.max(maxCloud, 60) : maxCloud,
            exclude_cover_pixels: fallback_used ? false : excludeCover,
            cloud_masking_level: fallback_used ? 1 : cml,
          },
        },
      };

      console.log("EOS summary response", { obs: series.length, fallback_used });
      return new Response(JSON.stringify(response), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
