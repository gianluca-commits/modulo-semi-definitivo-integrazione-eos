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
      const vegetation: VegetationData = {
        field_id: "LIVE_FIELD",
        satellite: "Sentinel-2",
        time_series: [
          { date: "2024-03-01", NDVI: 0.62, NDMI: 0.33 },
          { date: "2024-03-10", NDVI: 0.67, NDMI: 0.35 },
          { date: "2024-03-18", NDVI: 0.71, NDMI: 0.38 },
          { date: "2024-03-26", NDVI: 0.69, NDMI: 0.36 },
          { date: "2024-04-03", NDVI: 0.73, NDMI: 0.39 },
        ],
        analysis: { health_status: "normal", growth_stage: "stable" },
      };

      // Filter by requested date range if provided
      const parseTs = (s: string) => new Date(s).getTime();
      const sd = start_date ? parseTs(start_date) : undefined;
      const ed = end_date ? parseTs(end_date) : undefined;
      const filtered = vegetation.time_series.filter((p) => {
        const t = parseTs(p.date);
        if (sd && t < sd) return false;
        if (ed && t > ed) return false;
        return true;
      });
      const series = filtered.length ? filtered : vegetation.time_series;

      // Simple phenology estimation from NDVI trend
      const ndvis = series.map((p) => p.NDVI);
      const last = ndvis[ndvis.length - 1] ?? 0;
      const prev = ndvis[ndvis.length - 2] ?? last;
      const slope = last - prev;
      const max = ndvis.length ? Math.max(...ndvis) : 0;

      let growth_stage = "unknown";
      if (last < 0.2) growth_stage = "dormancy";
      else if (slope > 0.02 && last > 0.3) growth_stage = "green-up";
      else if (Math.abs(last - max) <= 0.05) growth_stage = "peak";
      else if (slope < -0.02 && last < max - 0.1) growth_stage = "senescence";
      else growth_stage = "stable";

      const lastNDMI = series[series.length - 1]?.NDMI ?? 0;
      const health_status = lastNDMI < 0.3 ? "moderate_stress" : "normal";

      const out: VegetationData = {
        ...vegetation,
        time_series: series,
        analysis: { health_status, growth_stage },
      };

      return new Response(
        JSON.stringify({ vegetation: out, meta: { mode: eosKey ? "proxy-ready" : "missing-secret", start_date, end_date } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "weather") {
      const weather: WeatherData = {
        temperature_avg: 12.2,
        precipitation_total: 138.5,
        alerts: ["Stress idrico potenziale"],
      };

      return new Response(
        JSON.stringify({ weather, meta: { mode: eosStatsBearer ? "proxy-ready" : "missing-secret", start_date, end_date } }),
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
