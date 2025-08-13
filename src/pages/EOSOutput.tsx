import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EosSummary, VegetationData, WeatherData, computeProductivity, getEosSummary, getVegetationTimeSeries, getWeatherSummary, type PolygonData, type EosConfig } from "@/lib/eos";
import { LineChart, Line, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { BarChart3, ArrowLeft, ThermometerSun, Droplets, Leaf, Activity } from "lucide-react";

function setMetaTags(title: string, description: string, canonicalPath: string) {
  document.title = title;
  let meta = document.querySelector('meta[name="description"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "description");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", description);
  let link = document.querySelector("link[rel=canonical]") as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  const origin = window.location.origin;
  link.href = `${origin}${canonicalPath}`;
}

const EOSOutput: React.FC = () => {
  const navigate = useNavigate();
  const [polygon, setPolygon] = useState<PolygonData | null>(null);
  const [userCfg, setUserCfg] = useState<any>(null);

  const [veg, setVeg] = useState<VegetationData | null>(null);
  const [meteo, setMeteo] = useState<WeatherData | null>(null);
  const [summary, setSummary] = useState<EosSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const eosConfig: EosConfig | null = useMemo(() => {
    if (!userCfg) return null;
    const cfg: EosConfig = {
      apiKey: "", // handled by Supabase Edge Function secrets
      cropType: userCfg.cropType || "sunflower",
      planting_date: userCfg.planting_date,
      start_date: userCfg.start_date,
      end_date: userCfg.end_date,
      max_cloud_cover_in_aoi: 30,
      exclude_cover_pixels: true,
      cloud_masking_level: 2,
    };
    return cfg;
  }, [userCfg]);

  useEffect(() => {
    setMetaTags(
      "Risultati analisi | EOS Agritech",
      "KPI NDVI/NDMI, fenologia e rischi meteo per il tuo campo.",
      "/output"
    );

    try {
      const p = localStorage.getItem("eos_polygon");
      const c = localStorage.getItem("eos_user_config");
      if (!p || !c) {
        navigate("/");
        return;
      }
      setPolygon(JSON.parse(p));
      setUserCfg(JSON.parse(c));
    } catch (e) {
      navigate("/");
    }
  }, [navigate]);

  useEffect(() => {
    const run = async () => {
      if (!polygon || !eosConfig) return;
      setLoading(true);
      try {
        const [vegRes, metRes, sumRes] = await Promise.all([
          getVegetationTimeSeries(polygon, eosConfig),
          getWeatherSummary(polygon, eosConfig),
          getEosSummary(polygon, eosConfig),
        ]);
        setVeg(vegRes);
        setMeteo(metRes);
        setSummary(sumRes);
        toast({ title: "Analisi completata", description: "Dati aggiornati con successo." });
      } catch (e: any) {
        toast({ title: "Errore analisi", description: e?.message ?? "Errore sconosciuto", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [polygon, eosConfig]);

  const productivity = useMemo(() => computeProductivity(userCfg?.cropType || "sunflower"), [userCfg?.cropType]);

  if (!polygon || !userCfg) return null;

  const ts = veg?.time_series || [];

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-foreground" />
            <h1 className="text-2xl font-bold text-foreground">Risultati analisi</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => navigate("/")}>Nuova analisi</Button>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 py-6 grid lg:grid-cols-3 gap-6">
        <aside className="bg-card rounded-xl border border-border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Impostazioni</h2>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Coltura: <span className="text-foreground font-medium">{userCfg.cropType}</span></p>
            <p>Irrigazione: <span className="text-foreground font-medium">{userCfg.irrigation}</span></p>
            <p>Fertilizzazione: <span className="text-foreground font-medium">{userCfg.fertilization}</span></p>
            {userCfg.planting_date && <p>Semina: <span className="text-foreground font-medium">{userCfg.planting_date}</span></p>}
            <p>Periodo: <span className="text-foreground font-medium">{userCfg.start_date} → {userCfg.end_date}</span></p>
            <p>Area: <span className="text-foreground font-medium">{polygon.area_ha} ha</span></p>
          </div>
        </aside>

        <article className="lg:col-span-2 space-y-6">
          {/* KPI cards */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="border border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground"><Leaf className="w-4 h-4" /> NDVI</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">{summary?.ndvi_data.current_value ?? "-"}</p>
                <p className="text-sm text-muted-foreground">Trend 30gg: {summary?.ndvi_data.trend_30_days != null ? `${summary?.ndvi_data.trend_30_days}%` : "-"}</p>
              </CardContent>
            </Card>
            <Card className="border border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground"><Droplets className="w-4 h-4" /> NDMI / Stress idrico</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">{summary?.ndmi_data.current_value ?? "-"}</p>
                <p className="text-sm text-muted-foreground">Livello: {summary?.ndmi_data.water_stress_level ?? "-"}</p>
              </CardContent>
            </Card>
            <Card className="border border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground"><Activity className="w-4 h-4" /> Fenologia</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">{summary?.phenology.current_stage ?? "-"}</p>
                <p className="text-sm text-muted-foreground">Giorni dalla semina: {summary?.phenology.days_from_planting ?? "-"}</p>
              </CardContent>
            </Card>
            <Card className="border border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground"><ThermometerSun className="w-4 h-4" /> Rischi meteo</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Stress termico: <span className="text-foreground font-medium">{summary?.weather_risks.heat_stress_risk ?? "-"}</span></p>
                <p className="text-sm text-muted-foreground">Deficit precipitazioni: <span className="text-foreground font-medium">{summary?.weather_risks.precipitation_deficit_mm ?? "-"}</span></p>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Andamento NDVI</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              {ts.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={ts} margin={{ left: 12, right: 12, top: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis domain={[0, 1]} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <ReTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }} />
                    <Line type="monotone" dataKey="NDVI" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground">Nessun dato NDVI disponibile nel periodo selezionato.</p>
              )}
            </CardContent>
          </Card>

          {/* Productivity */}
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Resa attesa (nostra stima)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{productivity.predicted_yield_ton_ha} t/ha</p>
              <p className="text-sm text-muted-foreground">Confidenza: {productivity.confidence_level}% • Ricavi stimati: €{productivity.expected_revenue_eur_ha}/ha</p>
              <ul className="list-disc pl-5 mt-2 text-sm text-muted-foreground">
                {productivity.recommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </article>
      </section>

      {loading && (
        <div className="max-w-6xl mx-auto px-4 pb-8 text-sm text-muted-foreground">Caricamento in corso…</div>
      )}
    </main>
  );
};

export default EOSOutput;
