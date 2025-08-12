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
        while (attempts < 18) { // ~108s max
          attempts++;
          const st = await fetch(statusUrl);
          if (!st.ok) {
            const t = await st.text();
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
          await sleep(6000); // Respect 10 RPM rate limit on status endpoint
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
