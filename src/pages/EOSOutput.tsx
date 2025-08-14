import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EosSummary, computeProductivity, getEosSummary, demoVegetation, type PolygonData, type EosConfig, getOptimalEosParameters } from "@/lib/eos";
import { EosParameterDisplay } from "@/components/EosParameterDisplay";
import { HealthStatusCard } from "@/components/HealthStatusCard";
import { WaterStressAlert } from "@/components/WaterStressAlert";
import { AdvancedNDVIChart } from "@/components/AdvancedNDVIChart";
import { analyzeTemporalTrends } from "@/lib/eosAnalysis";
import { LineChart, Line, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { BarChart3, ArrowLeft, ThermometerSun, Droplets, Leaf, Activity, Download, AlertCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import GoogleMapsVisualization from "@/components/GoogleMapsVisualization";
import { supabase } from "@/integrations/supabase/client";
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
  const [mapboxToken, setMapboxToken] = useState<string>("");
  const [summary, setSummary] = useState<EosSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [usingSaved, setUsingSaved] = useState(false);
  const [savedBundle, setSavedBundle] = useState<{
    polygon: PolygonData;
    userCfg: any;
    summary: EosSummary;
    exported_at: string;
  } | null>(null);
  const [usePermissiveFilters, setUsePermissiveFilters] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showDemo, setShowDemo] = useState(false);
  // Get optimal profile for UI display
  const optimalProfile = useMemo(() => {
    if (!polygon) return null;
    const profile = getOptimalEosParameters(polygon);
    return profile;
  }, [polygon]);

  const eosConfig: EosConfig | null = useMemo(() => {
    if (!userCfg) return null;
    const cfg: EosConfig = {
      apiKey: "",
      // handled by Supabase Edge Function secrets
      cropType: userCfg.cropType || "sunflower",
      planting_date: userCfg.planting_date,
      start_date: userCfg.start_date,
      end_date: userCfg.end_date,
      // Only override parameters if using permissive filters manually
      ...(usePermissiveFilters ? {
        max_cloud_cover_in_aoi: 70,
        exclude_cover_pixels: false,
        cloud_masking_level: 0
      } : {})
      // Otherwise let the optimization function handle it automatically
    };
    return cfg;
  }, [userCfg, usePermissiveFilters]);
  useEffect(() => {
    setMetaTags("Risultati analisi | EOS Agritech", "KPI NDVI/NDMI, fenologia e rischi meteo per il tuo campo.", "/output");
    try {
      const p = localStorage.getItem("eos_polygon");
      const c = localStorage.getItem("eos_user_config");
      if (!p || !c) {
        navigate("/");
        return;
      }
      setPolygon(JSON.parse(p));
      setUserCfg(JSON.parse(c));
      const last = localStorage.getItem("eos_last_summary");
      if (last) {
        try {
          const parsed = JSON.parse(last);
          const invalid = parsed?.summary?.meta?.fallback_used || parsed?.summary?.meta?.observation_count === 0;
          if (parsed?.summary && !invalid) {
            setSavedBundle(parsed);
          } else {
            localStorage.removeItem("eos_last_summary");
          }
        } catch {}
      }

      // Fetch Mapbox token for visualization
      const fetchMapboxToken = async () => {
        try {
          const {
            data
          } = await supabase.functions.invoke('mapbox-config');
          if (data?.mapboxToken) {
            setMapboxToken(data.mapboxToken);
          }
        } catch (error) {
          console.warn('Failed to fetch Mapbox token for visualization:', error);
        }
      };
      fetchMapboxToken();
    } catch (e) {
      navigate("/");
    }
  }, [navigate]);
  useEffect(() => {
    const run = async () => {
      if (!polygon || !eosConfig) return;
      setLoading(true);
      try {
        const sumRes = await getEosSummary(polygon, eosConfig);
        setSummary(sumRes);
        setUsingSaved(false);
        setShowDemo(false);
        // Persist last successful result for offline/fallback exports (only real observations, no fallback)
        try {
          const obsCount = sumRes?.meta?.observation_count ?? 0;
          const usedFallback = Boolean(sumRes?.meta?.fallback_used);
          if (obsCount > 0 && !usedFallback) {
            localStorage.setItem("eos_last_summary", JSON.stringify({
              polygon,
              userCfg,
              summary: sumRes,
              exported_at: new Date().toISOString()
            }));
          }
        } catch {}
        toast({
          title: "Analisi completata",
          description: "Dati aggiornati con successo."
        });
      } catch (e: any) {
        if (savedBundle?.summary) {
          setSummary(savedBundle.summary);
          setUsingSaved(true);
          toast({
            title: "Nessun dato nuovo",
            description: "Mostro l'ultimo risultato salvato.",
            variant: "default"
          });
        } else {
          toast({
            title: "Errore analisi",
            description: e?.message ?? "Errore sconosciuto",
            variant: "destructive"
          });
        }
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [polygon, eosConfig, refreshKey, savedBundle, userCfg]);
  const productivity = useMemo(() => computeProductivity(userCfg?.cropType || "sunflower"), [userCfg?.cropType]);
  const demoTs = useMemo(() => demoVegetation().time_series, []);
  
  if (!polygon || !userCfg) return null;
  const rawTs = summary?.ndvi_series as any || [];
  const noRealObs = !rawTs.length || summary?.meta?.observation_count === 0;
  const isDemo = showDemo || noRealObs;
  const ts = isDemo && showDemo ? demoTs : rawTs;
  
  // Enhanced analysis for the new components
  const ndviAnalysis = useMemo(() => {
    if (!ts.length) return null;
    return analyzeTemporalTrends(ts, "NDVI", userCfg?.cropType || "sunflower");
  }, [ts, userCfg?.cropType]);
  
  const ndmiAnalysis = useMemo(() => {
    if (!ts.length) return null;
    return analyzeTemporalTrends(ts, "NDMI", userCfg?.cropType || "sunflower");
  }, [ts, userCfg?.cropType]);
  const fileSafe = (s: string) => (s || "").replace(/[^a-z0-9-_]+/gi, "_").toLowerCase();
  const handleExportJSON = () => {
    if (!summary) {
      toast({
        title: "Nessun dato da esportare",
        variant: "destructive"
      });
      return;
    }
    const payload = {
      polygon,
      userCfg,
      summary,
      demo: isDemo,
      exported_at: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json"
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `eos_analisi_${fileSafe(userCfg?.cropType || "campo")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const handleExportCSV = () => {
    if (!ts.length || isDemo) {
      toast({
        title: "Esportazione disabilitata",
        description: "CSV NDVI non disponibile per dati di esempio.",
        variant: "destructive"
      });
      return;
    }
    const rows = [["date", "NDVI", "NDMI"], ...ts.map((p: any) => [p.date, p.NDVI, p.NDMI])];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;"
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ndvi_series_${fileSafe(userCfg?.cropType || "campo")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const handlePrint = () => {
    window.print();
  };
  return <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-foreground" />
            <h1 className="text-2xl font-bold text-foreground">Risultati analisi</h1>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  Esporta
                  <Download className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handlePrint()} disabled={isDemo}>PDF (stampa)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportJSON()}>JSON</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportCSV()} disabled={!ts.length || isDemo}>CSV NDVI</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="secondary" onClick={() => navigate("/")}>Nuova analisi</Button>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Field Information Header */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Campo Analizzato</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Area:</span>
                  <p className="font-medium">{polygon.area_ha} ha</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Fonte:</span>
                  <p className="font-medium">{polygon.source}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Coltura:</span>
                  <p className="font-medium">{userCfg.cropType}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* EOS Parameter Display */}
          <EosParameterDisplay 
            summary={summary} 
            optimizationProfile={optimalProfile?.description}
          />
        </div>

        {/* Polygon Visualization */}
        {polygon && <GoogleMapsVisualization polygon={polygon} title="Campo Analizzato" description={`${polygon.source} • ${userCfg.cropType} • ${polygon.area_ha} ha`} />}

        {(usingSaved || noRealObs) && <Alert variant={usingSaved ? "default" : "destructive"}>
            <AlertTitle>{usingSaved ? "Stai visualizzando l'ultimo risultato salvato" : "Nessun risultato trovato nel periodo"}</AlertTitle>
            <AlertDescription>
              {usingSaved ? "Non sono arrivati dati nuovi. Puoi riprovare ora o esportare i dati salvati." : "Prova ad allargare l'intervallo o a usare filtri più permissivi."}
            </AlertDescription>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => {
            setUsePermissiveFilters(false);
            setShowDemo(false);
            setRefreshKey(k => k + 1);
          }}>Riprova</Button>
              <Button size="sm" onClick={() => {
            setUsePermissiveFilters(true);
            setShowDemo(false);
            setRefreshKey(k => k + 1);
          }}>Riprova con filtri estesi</Button>
            </div>
          </Alert>}

        {summary?.meta?.observation_count === 0 && <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Nessuna Osservazione Trovata</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>Non sono state trovate osservazioni satellitari per questo campo nel periodo analizzato.</p>
              <div className="mt-2">
                <p className="font-medium">Soluzioni suggerite:</p>
                <ul className="list-disc list-inside text-sm mt-1 space-y-1">
                  <li>Estendi il periodo di analisi (es. ultimi 3-6 mesi)</li>
                  <li>Usa "Riprova con filtri estesi" per ridurre i filtri cloud</li>
                  <li>Verifica che le coordinate del campo siano corrette</li>
                </ul>
              </div>
              <Button variant="outline" size="sm" onClick={() => {
            setUsePermissiveFilters(true);
            setShowDemo(false);
            setRefreshKey(k => k + 1);
          }} className="mt-2">
                Riprova con Filtri Estesi
              </Button>
            </AlertDescription>
          </Alert>}

        <div className="grid lg:grid-cols-3 gap-6">
        <aside className="bg-card rounded-xl border border-border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Impostazioni</h2>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Coltura: <span className="text-foreground font-medium">{userCfg.cropType}</span></p>
            <p>Irrigazione: <span className="text-foreground font-medium">{userCfg.irrigation}</span></p>
            <p>Fertilizzazione: <span className="text-foreground font-medium">{userCfg.fertilization}</span></p>
            {userCfg.planting_date && <p>Semina: <span className="text-foreground font-medium">{userCfg.planting_date}</span></p>}
            <p>Periodo: <span className="text-foreground font-medium">{userCfg.start_date} → {userCfg.end_date}</span></p>
            <p>Area: <span className="text-foreground font-medium">{Number(userCfg.area_ha ?? polygon.area_ha).toLocaleString('it-IT', {
                  maximumFractionDigits: 2
                })} ha</span></p>
          </div>
        </aside>

        <article className="lg:col-span-2 space-y-6">
          {/* Enhanced KPI cards */}
          <div className="grid md:grid-cols-2 gap-4">
            {summary?.ndvi_data.current_value != null && (
              <HealthStatusCard
                ndvi={summary.ndvi_data.current_value}
                trend={summary.ndvi_data.trend_30_days}
                cropType={userCfg?.cropType || "sunflower"}
                temporalAnalysis={ndviAnalysis}
                isDemo={isDemo}
              />
            )}
            
            {summary?.ndmi_data.current_value != null && summary && (
              <WaterStressAlert
                ndmi={summary.ndmi_data.current_value}
                trend={summary.ndmi_data.trend_14_days}
                cropType={userCfg?.cropType || "sunflower"}
                summary={summary}
                temporalAnalysis={ndmiAnalysis}
                onIrrigationPlan={() => {
                  // TODO: Implement irrigation planning modal
                  console.log("Planning irrigation...");
                }}
              />
            )}
            <Card className="border border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground"><Activity className="w-4 h-4" /> Fenologia</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">{summary?.phenology.current_stage ? ({
                    germination: "Germinazione",
                    tillering: "Accestimento",
                    jointing: "Levata",
                    heading: "Spigatura",
                    flowering: "Fioritura",
                    grain_filling: "Riempimento granella",
                    maturity: "Maturazione",
                    stable: "Stabile",
                    unknown: "Sconosciuta",
                    dormancy: "Dormienza",
                    "green-up": "Ripresa vegetativa",
                    senescence: "Senescenza"
                  } as any)[summary.phenology.current_stage] ?? summary.phenology.current_stage : "-"}</p>
                <p className="text-sm text-muted-foreground">Giorni dalla semina: {summary?.phenology.days_from_planting ?? "-"}</p>
              </CardContent>
            </Card>
            <Card className="border border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground"><ThermometerSun className="w-4 h-4" /> Rischi meteo</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Stress termico: <span className="text-foreground font-medium">{summary?.weather_risks.heat_stress_risk ? ({
                      low: "Basso",
                      medium: "Medio",
                      high: "Alto"
                    } as any)[summary.weather_risks.heat_stress_risk] : "-"}</span></p>
                <p className="text-sm text-muted-foreground">Deficit precipitazioni: <span className="text-foreground font-medium">{summary?.weather_risks.precipitation_deficit_mm != null ? `${summary.weather_risks.precipitation_deficit_mm.toLocaleString('it-IT', {
                      maximumFractionDigits: 1
                    })} mm` : "-"}</span></p>
              </CardContent>
            </Card>
          </div>

          {/* Enhanced NDVI Chart */}
          {ts?.length > 0 && (
            <AdvancedNDVIChart
              timeSeries={ts}
              cropType={userCfg?.cropType || "sunflower"}
              isDemo={isDemo}
            />
          )}
          
          {!ts?.length && (
            <Card>
              <CardContent className="h-32 flex flex-col items-center justify-center text-muted-foreground space-y-2">
                <p>Nessun dato disponibile per il grafico</p>
                <Button size="sm" variant="secondary" onClick={() => setShowDemo(true)}>
                  Mostra dati di esempio
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Productivity */}
          
        </article>
        </div>
      </section>

      {loading && <div className="max-w-6xl mx-auto px-4 pb-8 text-sm text-muted-foreground">Caricamento in corso…</div>}
    </main>;
};
export default EOSOutput;