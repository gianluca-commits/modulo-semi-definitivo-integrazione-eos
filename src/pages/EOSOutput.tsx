import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EosSummary, computeProductivity, getEosSummary, getWeatherSummary, demoVegetation, demoWeather, type PolygonData, type EosConfig, type WeatherData, getOptimalEosParameters } from "@/lib/eos";
import { EosParameterDisplay } from "@/components/EosParameterDisplay";
import { EosDataStatusCard } from "@/components/EosDataStatusCard";
import { HealthStatusCard } from "@/components/HealthStatusCard";
import { WaterStressAlert } from "@/components/WaterStressAlert";
import { AdvancedNDVIChart } from "@/components/AdvancedNDVIChart";
import { VegetationHealthCard } from "@/components/VegetationHealthCard";
import { NitrogenAnalysisCard } from "@/components/NitrogenAnalysisCard";
import { IntelligentAlertsCard } from "@/components/IntelligentAlertsCard";
import { WeatherAnalyticsCard } from "@/components/WeatherAnalyticsCard";
import { SoilMoistureAnalyticsCard } from "@/components/SoilMoistureAnalyticsCard";
import { PhenologyCard } from "@/components/PhenologyCard";
import { YieldForecastCard } from "@/components/YieldForecastCard";
import { analyzeTemporalTrends } from "@/lib/eosAnalysis";
import { generateIntelligentAlerts, AlertsBundle } from "@/lib/intelligentAlerts";
import { analyzeVegetationHealth } from "@/lib/vegetationHealth";
import { analyzePhenology } from "@/lib/phenologyAnalysis";
import { generateComprehensiveYieldAnalysis } from "@/lib/yieldForecast";
import { LineChart, Line, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { BarChart3, ArrowLeft, ThermometerSun, Droplets, Leaf, Activity, Download, AlertCircle, RotateCw } from "lucide-react";
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
  
  const [summary, setSummary] = useState<EosSummary | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [vegetationHealth, setVegetationHealth] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);
  const [usingSaved, setUsingSaved] = useState(false);
  const [alertsBundle, setAlertsBundle] = useState<AlertsBundle | null>(null);
  const [savedBundle, setSavedBundle] = useState<{
    polygon: PolygonData;
    userCfg: any;
    summary: EosSummary;
    exported_at: string;
  } | null>(null);
  const [usePermissiveFilters, setUsePermissiveFilters] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showDemo, setShowDemo] = useState(false);
  const [autoFallback, setAutoFallback] = useState(false);

  // Get optimal profile for UI display - Always call this hook
  const optimalProfile = useMemo(() => {
    if (!polygon) return null;
    const profile = getOptimalEosParameters(polygon);
    return profile;
  }, [polygon]);

  // Always call this hook
  const eosConfig: EosConfig | null = useMemo(() => {
    if (!userCfg) return null;
    const cfg: EosConfig = {
      apiKey: "",
      // handled by Supabase Edge Function secrets
      cropType: userCfg.cropType || "sunflower",
      planting_date: userCfg.planting_date,
      start_date: userCfg.start_date,
      end_date: userCfg.end_date,
      auto_fallback: autoFallback,
      // Only override parameters if using permissive filters manually
      ...(usePermissiveFilters ? {
        max_cloud_cover_in_aoi: 70,
        exclude_cover_pixels: false,
        cloud_masking_level: 0
      } : {})
      // Otherwise let the optimization function handle it automatically
    };
    return cfg;
  }, [userCfg, usePermissiveFilters, autoFallback]);

  // Always call this hook
  const productivity = useMemo(() => computeProductivity(userCfg?.cropType || "sunflower"), [userCfg?.cropType]);

  // Always call this hook
  const demoTs = useMemo(() => demoVegetation().time_series, []);

  // Always call this hook
  const rawTs = useMemo(() => summary?.ndvi_series as any || [], [summary?.ndvi_series]);

  // Always call this hook
  const noRealObs = useMemo(() => !rawTs.length || summary?.meta?.observation_count === 0, [rawTs.length, summary?.meta?.observation_count]);

  // Always call this hook
  const isDemo = useMemo(() => showDemo || noRealObs, [showDemo, noRealObs]);

  // Always call this hook
  const ts = useMemo(() => isDemo && showDemo ? demoTs : rawTs, [isDemo, showDemo, demoTs, rawTs]);

  // Enhanced analysis for the new components - Always call these hooks
  const ndviAnalysis = useMemo(() => {
    if (!ts.length) return null;
    return analyzeTemporalTrends(ts, "NDVI", userCfg?.cropType || "sunflower");
  }, [ts, userCfg?.cropType]);
  const ndmiAnalysis = useMemo(() => {
    if (!ts.length) return null;
    return analyzeTemporalTrends(ts, "NDMI", userCfg?.cropType || "sunflower");
  }, [ts, userCfg?.cropType]);
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

    } catch (e) {
      navigate("/");
    }
  }, [navigate]);
  useEffect(() => {
    const run = async () => {
      if (!polygon || !eosConfig) return;
      setLoading(true);
      try {
        // Fetch both summary and weather data in parallel
        const [sumRes, weatherRes] = await Promise.all([
          getEosSummary(polygon, eosConfig),
          getWeatherSummary(polygon, eosConfig)
        ]);
        
        setSummary(sumRes);
        setWeatherData(weatherRes);
        setUsingSaved(false);
        setShowDemo(false);

        // Auto-suggest fallback if no observations
        const observationCount = sumRes.meta?.observation_count || 0;
        if (observationCount === 0 && !autoFallback) {
          console.info("EOS Debug - Suggesting auto-fallback for better data coverage");
          toast({
            title: "Nessun dato satellitare",
            description: "Considera di attivare 'Fallback automatico' per parametri più permissivi",
            variant: "default",
          });
        }

        // Analyze vegetation health using EOS data
        setIsLoadingHealth(true);
        try {
          console.log("Analyzing vegetation health from EOS data...");
          const healthData = analyzeVegetationHealth(sumRes, eosConfig.cropType, ts);
          console.log("Vegetation health analyzed:", healthData);
          setVegetationHealth(healthData);
        } catch (healthErr) {
          console.error("Error analyzing vegetation health:", healthErr);
          // Don't set error for health analysis, just log it
        } finally {
          setIsLoadingHealth(false);
        }

        // Generate intelligent alerts
        const alerts = generateIntelligentAlerts(sumRes, sumRes.ndvi_series || [], eosConfig.cropType, 250);
        setAlertsBundle(alerts);
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
  if (!polygon || !userCfg) return null;
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
        {/* Polygon Visualization */}
        {polygon && <GoogleMapsVisualization polygon={polygon} title="Campo Analizzato" description={`${polygon.source} • ${userCfg.cropType} • ${polygon.area_ha} ha`} />}

        {/* Unified Field and Parameters Information */}
        <Card>
          <CardHeader>
            <CardTitle>Dettagli campo e parametri</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Field Information */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Campo Analizzato</h3>
              <div className="grid md:grid-cols-4 gap-4 text-sm">
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
                <div>
                  <span className="text-muted-foreground">Coordinate:</span>
                  <p className="font-medium">{polygon.coordinates.length} punti</p>
                </div>
              </div>
            </div>
            
            {/* EOS Parameters */}
            {summary?.meta && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Parametri EOS Utilizzati</h3>
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Max copertura nuvolosa:</span>
                    <p className="font-medium">{summary.meta.used_filters?.max_cloud_cover_in_aoi || 50}%</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Esclusione pixel:</span>
                    <p className="font-medium">{summary.meta.used_filters?.exclude_cover_pixels ? 'Sì' : 'No'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Livello mascheratura:</span>
                    <p className="font-medium">{summary.meta.used_filters?.cloud_masking_level || 1}</p>
                  </div>
                </div>
                {optimalProfile?.description && (
                  <div className="mt-3">
                    <Badge variant="secondary">{optimalProfile.description}</Badge>
                  </div>
                )}
              </div>
            )}
            
            {/* User Configuration */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Impostazioni Utente</h3>
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Irrigazione:</span>
                  <p className="font-medium">{userCfg.irrigation}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Fertilizzazione:</span>
                  <p className="font-medium">{userCfg.fertilization}</p>
                </div>
                {userCfg.planting_date && (
                  <div>
                    <span className="text-muted-foreground">Semina:</span>
                    <p className="font-medium">{userCfg.planting_date}</p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Periodo analisi:</span>
                  <p className="font-medium">{userCfg.start_date} → {userCfg.end_date}</p>
                </div>
              </div>
            </div>

            {/* EOS Data Quality */}
            {summary && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Qualità dati EOS</h3>
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  {summary.ndvi_data?.uniformity_score !== undefined && (
                    <div>
                      <span className="text-muted-foreground">Uniformità NDVI:</span>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="font-medium">{(summary.ndvi_data.uniformity_score * 100).toFixed(1)}%</p>
                        <Badge variant={
                          summary.ndvi_data.uniformity_score >= 0.8 ? "default" : 
                          summary.ndvi_data.uniformity_score >= 0.6 ? "secondary" : 
                          "outline"
                        }>
                          {summary.ndvi_data.uniformity_score >= 0.8 ? "Alta" : 
                           summary.ndvi_data.uniformity_score >= 0.6 ? "Media" : 
                           "Bassa"}
                        </Badge>
                      </div>
                    </div>
                  )}
                  {summary.meta?.observation_count !== undefined && (
                    <div>
                      <span className="text-muted-foreground">Osservazioni satellitari:</span>
                      <p className="font-medium">{summary.meta.observation_count}</p>
                    </div>
                  )}
                  {summary.meta?.sensor_used && (
                    <div>
                      <span className="text-muted-foreground">Sensore utilizzato:</span>
                      <p className="font-medium">{summary.meta.sensor_used}</p>
                    </div>
                  )}
                  {summary.ndmi_data?.critical_threshold !== undefined && (
                    <div>
                      <span className="text-muted-foreground">Soglia critica NDMI:</span>
                      <p className="font-medium">{summary.ndmi_data.critical_threshold.toFixed(2)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Loading Message */}
        {loading && (
          <Alert variant="default">
            <AlertTitle>Caricamento in corso ...</AlertTitle>
            <AlertDescription>Recupero dati da EOS e calcolo degli indici. Attendere...</AlertDescription>
          </Alert>
        )}

        {/* No Observations Alert */}
        {summary?.meta?.observation_count === 0 && !loading && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Nessuna Osservazione Trovata</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>Non sono state trovate osservazioni satellitari per questo campo nel periodo analizzato.</p>
              <div className="mt-2">
                <p className="font-medium">Prova queste soluzioni:</p>
                <div className="mt-3 flex flex-col gap-3">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoFallback}
                      onChange={(e) => setAutoFallback(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">Fallback automatico se non trova dati (usa filtri più permissivi)</span>
                  </label>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => {
                      setRefreshKey(k => k + 1);
                    }}>
                      <RotateCw className="w-4 h-4 mr-1" />
                      Riprova
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => {
                      setUsePermissiveFilters(true);
                      setShowDemo(false);
                      setRefreshKey(k => k + 1);
                    }}>
                      Usa Filtri Estesi
                    </Button>
                  </div>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          {/* EOS Status and Parameter Display */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <EosDataStatusCard 
              summary={summary} 
              isDemo={showDemo}
              requestedPeriod={userCfg ? {
                start_date: userCfg.start_date,
                end_date: userCfg.end_date
              } : undefined}
            />
            
            <EosParameterDisplay 
              summary={summary} 
              optimizationProfile={optimalProfile?.description}
            />
            
            {/* User Configuration Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  Configurazione Utente
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Coltura:</span>
                    <Badge variant="outline" className="text-xs">
                      {userCfg?.cropType === "wheat" ? "Grano" :
                       userCfg?.cropType === "sunflower" ? "Girasole" :
                       userCfg?.cropType === "wine" ? "Vite" :
                       userCfg?.cropType === "olive" ? "Olivo" :
                       userCfg?.cropType || "Non specificato"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Semina:</span>
                    <span className="font-mono">{userCfg?.planting_date || "Non specificata"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Periodo analisi:</span>
                    <span className="font-mono">
                      {userCfg?.start_date} → {userCfg?.end_date}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Filtri permissivi:</span>
                    <Badge variant={usePermissiveFilters ? "default" : "outline"} className="text-xs">
                      {usePermissiveFilters ? "Attivi" : "Standard"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fallback automatico:</span>
                    <Badge variant={autoFallback ? "default" : "outline"} className="text-xs">
                      {autoFallback ? "Attivo" : "Disattivo"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Intelligent Alerts */}
          {alertsBundle && <IntelligentAlertsCard alertsBundle={alertsBundle} />}

          {/* Enhanced KPI cards with Yield Prediction */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {summary?.ndvi_data.current_value != null && <HealthStatusCard ndvi={summary.ndvi_data.current_value} trend={summary.ndvi_data.trend_30_days} cropType={userCfg?.cropType || "sunflower"} temporalAnalysis={ndviAnalysis} isDemo={isDemo} />}
            
            {summary?.ndmi_data.current_value != null && summary && <WaterStressAlert ndmi={summary.ndmi_data.current_value} trend={summary.ndmi_data.trend_14_days} cropType={userCfg?.cropType || "sunflower"} summary={summary} temporalAnalysis={ndmiAnalysis} onIrrigationPlan={() => {
              // TODO: Implement irrigation planning modal
              console.log("Planning irrigation...");
            }} />}

            {/* Vegetation Health Analysis Card */}
            {isLoadingHealth ? <Card className="w-full">
                <CardContent className="p-6">
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                </CardContent>
              </Card> : vegetationHealth ? <VegetationHealthCard analysis={vegetationHealth} cropType={userCfg?.cropType || "sunflower"} /> : summary ? <VegetationHealthCard analysis={analyzeVegetationHealth(summary, userCfg?.cropType || "sunflower", summary?.ndvi_series || [])} cropType={userCfg?.cropType || "sunflower"} /> : <Card className="w-full">
                <CardContent className="p-6">
                  <div className="text-center text-muted-foreground">
                    <p>Analisi salute vegetazione non disponibile</p>
                    <p className="text-sm mt-2">Riprova più tardi</p>
                  </div>
                </CardContent>
              </Card>}
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

          {/* Soil Moisture Analytics */}
          {summary?.soil_moisture && <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-primary">Analisi Umidità Suolo</h2>
              <SoilMoistureAnalyticsCard soilMoisture={summary.soil_moisture} cropType={userCfg?.cropType || "sunflower"} onIrrigationPlan={() => {
              // TODO: Implement irrigation planning modal
              console.log("Planning irrigation from soil moisture...");
            }} />
            </div>}

          {/* Nitrogen Analysis */}
          {ts?.length > 0 && ts[ts.length - 1]?.ReCI && <NitrogenAnalysisCard reci={ts[ts.length - 1].ReCI} previousReci={ts[ts.length - 2]?.ReCI} cropType={userCfg?.cropType || "sunflower"} expectedYield={5} // Default value since we removed yield prediction
          marketPrice={250} />}

          {/* Weather Analytics Section */}
          {(weatherData || showDemo) && (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-primary">Analisi Meteorologica Avanzata</h2>
              <WeatherAnalyticsCard 
                weather={weatherData || demoWeather()} 
                cropType={userCfg?.cropType || "sunflower"} 
              />
            </div>
          )}

          {/* Enhanced NDVI Chart */}
          {ts?.length > 0 && <AdvancedNDVIChart timeSeries={ts} cropType={userCfg?.cropType || "sunflower"} isDemo={isDemo} />}
          
          {!ts?.length && <Card>
              <CardContent className="h-32 flex flex-col items-center justify-center text-muted-foreground space-y-2">
                <p>Nessun dato disponibile per il grafico</p>
                <Button size="sm" variant="secondary" onClick={() => setShowDemo(true)}>
                  Mostra dati di esempio
                </Button>
              </CardContent>
            </Card>}

          {/* Productivity */}
          
        </div>
      </section>
    </main>;
};
export default EOSOutput;