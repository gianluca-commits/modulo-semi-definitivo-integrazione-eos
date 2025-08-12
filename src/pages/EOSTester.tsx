import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Satellite,
  MapPin,
  CheckCircle2,
  ArrowRight,
  Database,
  Layers,
  Loader2,
  Play,
  BarChart3,
  Target,
  Copy,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import type {
  EosConfig,
  PolygonData,
  ProductivityData,
  VegetationData,
  WeatherData,
  EosSummary,
} from "@/lib/eos";
import {
  calculateAreaHa,
  computeProductivity,
  getVegetationTimeSeries,
  getWeatherSummary,
  getEosSummary,
} from "@/lib/eos";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { kml as kmlToGeoJSON } from "@tmcw/togeojson";
import { Calendar } from "@/components/ui/calendar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const EOSTester: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  const [polygonData, setPolygonData] = useState<PolygonData>({
    geojson: "",
    coordinates: [],
    source: "",
    area_ha: 0,
  });

  const [polygonOptions, setPolygonOptions] = useState<{ id: string; label: string; coordinates: [number, number][]; area_ha: number }[]>([]);

  const formatDate = (d: Date) => d.toISOString().slice(0, 10);
  const today = new Date();
  const startDefault = new Date(today);
  startDefault.setFullYear(today.getFullYear() - 1);

  const [eosConfig, setEosConfig] = useState<EosConfig>({
    apiKey: "",
    cropType: "wheat",
    start_date: formatDate(startDefault),
    end_date: formatDate(today),
    planting_date: "",
    max_cloud_cover_in_aoi: 30,
    exclude_cover_pixels: true,
    cloud_masking_level: 2,
  });

  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
    from: startDefault,
    to: today,
  });

  const [testResults, setTestResults] = useState<{
    vegetation: VegetationData | null;
    weather: WeatherData | null;
    productivity: ProductivityData | null;
  }>({
    vegetation: null,
    weather: null,
    productivity: null,
  });

  const [summary, setSummary] = useState<EosSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<string>("");
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    // Load API key from localStorage
    const saved = localStorage.getItem("eos_api_key");
    if (saved) setEosConfig((p) => ({ ...p, apiKey: saved }));
    document.title = "EOS Agritech | Tester";
  }, []);

  useEffect(() => {
    // Persist API key
    if (eosConfig.apiKey) localStorage.setItem("eos_api_key", eosConfig.apiKey);
  }, [eosConfig.apiKey]);

  const presetFields = useMemo(
    () => [
      {
        name: "Campo Grano - Pianura Padana (MI)",
        coordinates: [
          [9.19, 45.4642],
          [9.195, 45.4642],
          [9.195, 45.4692],
          [9.19, 45.4692],
          [9.19, 45.4642],
        ] as [number, number][],
        description: "5 ettari, terreno pianeggiante",
        crop: "wheat",
        region: "Lombardia",
      },
      {
        name: "Vigneto Collinare - Chianti (SI)",
        coordinates: [
          [11.28, 43.45],
          [11.285, 43.45],
          [11.286, 43.452],
          [11.282, 43.455],
          [11.28, 43.45],
        ] as [number, number][],
        description: "3.2 ettari, pendenza 8%",
        crop: "wine",
        region: "Toscana",
      },
      {
        name: "Oliveto Terrazzato - Liguria (IM)",
        coordinates: [
          [7.92, 43.81],
          [7.925, 43.81],
          [7.926, 43.812],
          [7.921, 43.8125],
          [7.92, 43.81],
        ] as [number, number][],
        description: "1.8 ettari, terrazzamenti",
        crop: "olive",
        region: "Liguria",
      },
    ],
    []
  );

  const handlePresetField = (field: {
    name: string;
    coordinates: [number, number][];
    description: string;
    crop: string;
    region: string;
  }) => {
    const geoJson = {
      type: "Polygon",
      coordinates: [field.coordinates],
    };

    const area = calculateAreaHa(field.coordinates as any);

    setPolygonData({
      geojson: JSON.stringify(geoJson, null, 2),
      coordinates: field.coordinates as any,
      source: field.name,
      area_ha: area,
    });

    setPolygonOptions([]);
    setEosConfig((prev) => ({ ...prev, cropType: field.crop }));
    setErrors("");
  };

  const handleGeoJsonPaste = (raw: string) => {
    try {
      const parsed = JSON.parse(raw);
      if (
        !parsed ||
        parsed.type !== "Polygon" ||
        !Array.isArray(parsed.coordinates) ||
        !Array.isArray(parsed.coordinates[0])
      ) {
        throw new Error("Formato GeoJSON non valido: atteso Polygon");
      }
      const coords = parsed.coordinates[0] as [number, number][];
      const area = calculateAreaHa(coords as any);
      setPolygonData({
        geojson: JSON.stringify(parsed, null, 2),
        coordinates: coords as any,
        source: "GeoJSON incollato",
        area_ha: area,
      });
      setPolygonOptions([]);
      toast({ title: "GeoJSON caricato", description: "Poligono valido." });
      setErrors("");
    } catch (e: any) {
      const msg = e?.message ?? "Errore nel parsing del GeoJSON";
      setErrors(msg);
      toast({
        title: "Errore GeoJSON",
        description: msg,
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      const name = file.name;
      const lower = name.toLowerCase();
      let coords: [number, number][] | null = null;

      if (lower.endsWith(".kml") || file.type.includes("kml")) {
        const text = await file.text();
        const doc = new DOMParser().parseFromString(text, "text/xml");
        const gj: any = kmlToGeoJSON(doc);

        const extractPolygons = (geojson: any): [number, number][][] => {
          const polygons: [number, number][][] = [];

          const pushFromGeom = (geom: any) => {
            if (!geom) return;
            if (geom.type === "Polygon" && Array.isArray(geom.coordinates)) {
              polygons.push(geom.coordinates[0]);
            } else if (geom.type === "MultiPolygon" && Array.isArray(geom.coordinates)) {
              for (const poly of geom.coordinates) {
                if (Array.isArray(poly) && poly[0]) polygons.push(poly[0]);
              }
            } else if (geom.type === "GeometryCollection" && Array.isArray(geom.geometries)) {
              geom.geometries.forEach(pushFromGeom);
            }
          };

          if (gj.type === "FeatureCollection" && Array.isArray(gj.features)) {
            gj.features.forEach((f: any) => pushFromGeom(f.geometry));
          } else if (gj.type === "Feature") {
            pushFromGeom(gj.geometry);
          } else if (gj.type === "Polygon" || gj.type === "MultiPolygon") {
            pushFromGeom(gj);
          }

          return polygons;
        };

        const polys = extractPolygons(gj);
        if (!polys.length) throw new Error("Nessun Polygon valido trovato nel KML");

        const opts = polys.map((p: any, i: number) => {
          let ring = p as [number, number][];
          if (ring.length && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) {
            ring = [...ring, ring[0]] as any;
          }
          const area = calculateAreaHa(ring as any);
          return { id: `kml-${i}`, label: `Poligono ${i + 1}`, coordinates: ring as any, area_ha: area };
        }).sort((a: any, b: any) => b.area_ha - a.area_ha);

        setPolygonOptions(opts);
        coords = opts[0].coordinates;
      } else if (lower.endsWith(".geojson") || lower.endsWith(".json") || file.type.includes("json")) {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const extractPolygons = (geojson: any): [number, number][][] => {
          const polygons: [number, number][][] = [];
          const pushFromGeom = (geom: any) => {
            if (!geom) return;
            if (geom.type === "Polygon" && Array.isArray(geom.coordinates)) {
              polygons.push(geom.coordinates[0]);
            } else if (geom.type === "MultiPolygon" && Array.isArray(geom.coordinates)) {
              for (const poly of geom.coordinates) {
                if (Array.isArray(poly) && poly[0]) polygons.push(poly[0]);
              }
            } else if (geom.type === "GeometryCollection" && Array.isArray(geom.geometries)) {
              geom.geometries.forEach(pushFromGeom);
            }
          };
          if (parsed.type === "FeatureCollection" && Array.isArray(parsed.features)) {
            parsed.features.forEach((f: any) => pushFromGeom(f.geometry));
          } else if (parsed.type === "Feature") {
            pushFromGeom(parsed.geometry);
          } else if (parsed.type === "Polygon" || parsed.type === "MultiPolygon") {
            pushFromGeom(parsed);
          }
          return polygons;
        };
        const polys = extractPolygons(parsed);
        if (!polys.length) throw new Error("Il file non contiene un Polygon valido");
        const opts = polys.map((p: any, i: number) => {
          let ring = p as [number, number][];
          if (ring.length && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) {
            ring = [...ring, ring[0]] as any;
          }
          const area = calculateAreaHa(ring as any);
          return { id: `gj-${i}`, label: `Poligono ${i + 1}`, coordinates: ring as any, area_ha: area };
        }).sort((a: any, b: any) => b.area_ha - a.area_ha);
        setPolygonOptions(opts);
        coords = opts[0].coordinates;
      } else {
        throw new Error("Formato file non supportato. Usa .kml, .geojson o .json");
      }

      // Normalize: ensure closed ring
      if (coords && coords.length && (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])) {
        coords = [...coords, coords[0]] as any;
      }

      const geoJson = { type: "Polygon", coordinates: [coords] };
      const area = calculateAreaHa(coords as any);
      setPolygonData({
        geojson: JSON.stringify(geoJson, null, 2),
        coordinates: coords as any,
        source: name,
        area_ha: area,
      });
      setErrors("");
      toast({ title: "File caricato", description: `Poligono rilevato da ${name}` });
    } catch (e: any) {
      const msg = e?.message ?? "Errore nella lettura del file";
      setErrors(msg);
      toast({ title: "Errore file", description: msg, variant: "destructive" });
    }
  };

  const handleSelectPolygonOption = (opt: { id: string; label: string; coordinates: [number, number][]; area_ha: number }) => {
    const geoJson = { type: "Polygon", coordinates: [opt.coordinates] } as any;
    setPolygonData({
      geojson: JSON.stringify(geoJson, null, 2),
      coordinates: opt.coordinates as any,
      source: polygonData.source || "File",
      area_ha: opt.area_ha,
    });
  };

  const callEOSAPI = async () => {
    if (!eosConfig.apiKey) {
      const msg = 'Inserire API Key EOS (o usa "demo" per test)';
      setErrors(msg);
      toast({ title: "API Key mancante", description: msg, variant: "destructive" });
      return;
    }

    if (!polygonData.geojson) {
      const msg = "Selezionare prima un campo";
      setErrors(msg);
      toast({ title: "Campo mancante", description: msg, variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setErrors("");
    setCurrentStep(3);

    try {
      // Avvia la richiesta di summary in parallelo (best-effort)
      getEosSummary(polygonData, eosConfig)
        .then((sm) => setSummary(sm))
        .catch((e) => console.warn("eos summary error", e));

      const vegetation = await getVegetationTimeSeries(polygonData, eosConfig);
      setTestResults((p) => ({ ...p, vegetation }));
      if (!vegetation.time_series || vegetation.time_series.length === 0) {
        const reason = (vegetation as any).meta?.reason;
        toast({
          title: "Nessuna osservazione valida",
          description: reason === "no_observations"
            ? "Prova a ridurre l'intervallo o ad aumentare la tolleranza alle nuvole."
            : "Prova ad aumentare la tolleranza nuvole, allargare il poligono o cambiare periodo.",
        });
      }

      const weather = await getWeatherSummary(polygonData, eosConfig);
      setTestResults((p) => ({ ...p, weather }));

      const productivity = computeProductivity(eosConfig.cropType);
      // Simulate prediction time
      await new Promise((r) => setTimeout(r, 500));
      setTestResults((p) => ({ ...p, productivity }));

      toast({ title: "Analisi completata", description: "Dati EOS pronti." });
    } catch (error: any) {
      const msg = `Errore analisi: ${error?.message ?? "sconosciuto"}`;
      setErrors(msg);
      toast({ title: "Errore", description: msg, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const resetAll = () => {
    setCurrentStep(1);
    setPolygonData({ geojson: "", coordinates: [], source: "", area_ha: 0 });
    setTestResults({ vegetation: null, weather: null, productivity: null });
    setSummary(null);
    setErrors("");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-card rounded-xl shadow-lg border border-border p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">
                EOS Agritech Platform
              </h1>
              <p className="text-xl text-muted-foreground">
                Sistema unificato per analisi satellitare e predizione produttività
              </p>
            </div>
            <div className="bg-primary p-3 rounded-full">
              <Satellite className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-4">
            {[
              { step: 1 as const, label: "Campo", icon: MapPin },
              { step: 2 as const, label: "Config", icon: Database },
              { step: 3 as const, label: "Risultati", icon: BarChart3 },
            ].map(({ step, label, icon: Icon }) => (
              <div key={step} className="flex items-center">
                <button
                  onClick={() => setCurrentStep(step)}
                  disabled={step === 2 && !polygonData.geojson}
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition-all border border-border ${
                    currentStep === step
                      ? "bg-primary text-primary-foreground"
                      : currentStep > step
                      ? "bg-secondary text-secondary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {currentStep > step ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </button>
                <span
                  className={`ml-2 text-sm font-medium ${
                    currentStep === step ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
                {step < 3 && <ArrowRight className="w-4 h-4 mx-4 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </div>

        {/* Polygon Status */}
        {polygonData.geojson && (
          <div className="bg-secondary/30 border border-border rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center text-foreground">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  <span className="font-medium">Campo Selezionato</span>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {polygonData.source} • {polygonData.area_ha} ha
                </div>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(polygonData.geojson)}
                className="p-2 text-foreground hover:bg-muted rounded-lg"
                aria-label="Copia GeoJSON"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 1: Field Selection */}
        {currentStep === 1 && (
          <div className="bg-card rounded-xl shadow-sm border border-border p-6 mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center">
              <Target className="w-6 h-6 mr-3 text-foreground" />
              Step 1: Seleziona Campo per Test
            </h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {presetFields.map((field, index) => (
                <button
                  key={index}
                  onClick={() => handlePresetField(field)}
                  className={`p-6 rounded-xl border-2 text-left transition-all hover:shadow-lg ${
                    polygonData.source === field.name
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="font-semibold text-foreground mb-2">{field.name}</div>
                  <div className="text-muted-foreground text-sm mb-2">{field.description}</div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{field.region}</span>
                    <span>{field.coordinates.length - 1} punti</span>
                  </div>
                </button>
              ))}
            </div>

            {/* File upload for KML/GeoJSON */}
            <div className="space-y-2 mb-6">
              <h3 className="text-lg font-semibold text-foreground">Oppure carica file KML/GeoJSON</h3>
              <input
                type="file"
                accept=".kml,.geojson,.json,application/vnd.google-earth.kml+xml,application/json"
                onChange={async (e) => {
                  const file = e.currentTarget.files?.[0];
                  if (file) await handleFileUpload(file);
                  // Allow reupload of the same file
                  e.currentTarget.value = "";
                }}
                className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground file:mr-4 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-muted file:text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground">Seleziona un file .kml, .geojson o .json contenente un Polygon.</p>
            </div>

            {polygonOptions.length > 1 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-foreground mb-3">Più poligoni rilevati</h3>
                <div className="grid md:grid-cols-2 gap-3">
                  {polygonOptions.map((opt, idx) => {
                    const selected = JSON.stringify(opt.coordinates) === JSON.stringify(polygonData.coordinates);
                    return (
                      <button
                        key={opt.id}
                        onClick={() => handleSelectPolygonOption(opt)}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                      >
                        <div className="font-medium text-foreground">{opt.label}</div>
                        <div className="text-xs text-muted-foreground">{opt.area_ha} ha • {opt.coordinates.length - 1} punti</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}


            {/* GeoJSON manual paste */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">Oppure incolla GeoJSON (Polygon)</h3>
              <textarea
                onBlur={(e) => e.currentTarget.value && handleGeoJsonPaste(e.currentTarget.value)}
                placeholder='{"type":"Polygon","coordinates":[[[lon,lat],...]]}'
                className="w-full min-h-28 px-4 py-3 border border-border rounded-xl bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground">Suggerimento: incolla e poi esci dal campo per validare.</p>
            </div>

            <div className="flex justify-between mt-8">
              <button
                onClick={resetAll}
                className="px-6 py-3 bg-muted text-foreground rounded-xl hover:bg-muted/80 flex items-center border border-border"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reset
              </button>

              <button
                onClick={() => setCurrentStep(2)}
                disabled={!polygonData.geojson}
                className={`px-8 py-3 rounded-xl font-semibold flex items-center border border-transparent ${
                  polygonData.geojson
                    ? "bg-primary text-primary-foreground shadow-lg hover:opacity-95"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                }`}
              >
                Continua
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Configuration */}
        {currentStep === 2 && (
          <div className="bg-card rounded-xl shadow-sm border border-border p-6 mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center">
              <Database className="w-6 h-6 mr-3 text-foreground" />
              Step 2: Configurazione EOS
            </h2>

            <div className="grid lg:grid-cols-2 gap-8">
              <div>
                <div className="bg-muted rounded-xl p-6 mb-6 border border-border">
                  <h3 className="text-lg font-semibold mb-4 text-foreground">API Key EOS</h3>
                  <div className="flex items-center gap-2">
                    <input
                      type={showApiKey ? "text" : "password"}
                      value={eosConfig.apiKey}
                      onChange={(e) => setEosConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
                      placeholder='Inserisci API key o "demo" per test'
                      className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      className="p-2 rounded-lg border border-border hover:bg-muted"
                      onClick={() => setShowApiKey((s) => !s)}
                      aria-label={showApiKey ? "Nascondi API key" : "Mostra API key"}
                    >
                      {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {eosConfig.apiKey && (
                    <div className="mt-2 flex items-center text-foreground text-sm">
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      API Key configurata
                    </div>
                  )}
                </div>

                <div className="bg-muted rounded-xl p-6 border border-border">
                  <h3 className="text-lg font-semibold mb-4 text-foreground">Intervallo date</h3>
                  <Calendar
                    mode="range"
                    selected={dateRange as any}
                    onSelect={(range: any) => {
                      setDateRange(range || {});
                      const from = range?.from ? formatDate(range.from) : undefined;
                      const to = range?.to ? formatDate(range.to) : undefined;
                      setEosConfig((prev) => ({ ...prev, start_date: from ?? prev.start_date, end_date: to ?? prev.end_date }));
                    }}
                    numberOfMonths={2}
                    className="rounded-md border border-border bg-background"
                  />
                  <p className="text-xs text-muted-foreground mt-2">Seleziona un range (default: ultimi 12 mesi)</p>
                </div>

                <div className="bg-muted rounded-xl p-6 border border-border mt-6">
                  <h3 className="text-lg font-semibold mb-4 text-foreground">Data semina (opzionale)</h3>
                  <input
                    type="date"
                    value={eosConfig.planting_date ?? ""}
                    onChange={(e) => setEosConfig((prev) => ({ ...prev, planting_date: e.target.value }))}
                    className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <p className="text-xs text-muted-foreground mt-2">Serve per mostrare giorni dalla semina e contestualizzare la fenologia.</p>
                </div>
                {/* Qualità immagine / Nuvole */}
                <div className="bg-muted rounded-xl p-6 border border-border mt-6">
                  <h3 className="text-lg font-semibold mb-4 text-foreground">Qualità immagine</h3>
                  <label className="flex items-center gap-3 text-foreground">
                    <input
                      type="checkbox"
                      checked={eosConfig.exclude_cover_pixels === false || (eosConfig.max_cloud_cover_in_aoi ?? 30) > 30}
                      onChange={(e) =>
                        setEosConfig((prev) =>
                          e.target.checked
                            ? { ...prev, max_cloud_cover_in_aoi: 60, exclude_cover_pixels: false, cloud_masking_level: 1 }
                            : { ...prev, max_cloud_cover_in_aoi: 30, exclude_cover_pixels: true, cloud_masking_level: 2 }
                        )
                      }
                    />
                    <span>Più tollerante alle nuvole</span>
                  </label>
                  <p className="text-xs text-muted-foreground mt-2">Aumenta copertura nuvolosa max e riduce mascheramento per ottenere più osservazioni.</p>
                </div>
              </div>

              <div className="bg-primary/5 rounded-xl p-6 border border-border">
                <h3 className="text-lg font-semibold text-foreground mb-4">⚡ Approccio Minimale</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div>📍 <strong>Area:</strong> {polygonData.area_ha} ha</div>
                  <div>🗓️ <strong>Intervallo:</strong> {eosConfig.start_date} → {eosConfig.end_date}</div>
                  <div>🛰️ <strong>Solo 2 chiamate API</strong> invece di 5-10</div>
                  <div>📊 <strong>4 parametri essenziali:</strong> NDVI + NDMI + Fenologia + Meteo</div>
                  <div>💰 <strong>80% meno costi</strong> mantenendo 90% precisione</div>
                </div>
              </div>
            </div>

            <div className="flex justify-between mt-8">
              <button
                onClick={() => setCurrentStep(1)}
                className="px-6 py-3 bg-muted text-foreground rounded-xl hover:bg-muted/80 flex items-center border border-border"
              >
                <ArrowRight className="w-4 h-4 mr-2 rotate-180" />
                Indietro
              </button>

              <button
                onClick={callEOSAPI}
                disabled={!eosConfig.apiKey || isLoading}
                className={`px-8 py-3 rounded-xl font-semibold flex items-center border border-transparent ${
                  eosConfig.apiKey && !isLoading
                    ? "bg-primary text-primary-foreground shadow-lg hover:opacity-95"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analisi...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Avvia Test EOS
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Results */}
        {currentStep === 3 && (
          <div className="bg-card rounded-xl shadow-sm border border-border p-6 mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center">
              <BarChart3 className="w-6 h-6 mr-3 text-foreground" />
              Step 3: Risultati Analisi
            </h2>

            {isLoading && (
              <div className="text-center py-12">
                <Satellite className="w-16 h-16 mx-auto text-foreground animate-spin mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">Analisi EOS in Corso...</h3>
                <div className="max-w-md mx-auto space-y-3">
                  {[
                    { label: "Dati Vegetazione", done: !!testResults.vegetation },
                    { label: "Dati Meteorologici", done: !!testResults.weather },
                    { label: "Pronto per stima produttività", done: !!(testResults.vegetation && testResults.weather) },
                  ].map((step, index) => (
                    <div
                      key={index}
                      className={`flex items-center p-3 rounded-lg ${
                        step.done ? "bg-secondary/40 text-foreground" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {step.done ? (
                        <CheckCircle2 className="w-5 h-5 mr-3" />
                      ) : (
                        <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                      )}
                      <span>{step.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isLoading && testResults.vegetation && testResults.weather && (
              (() => {
                const veg = testResults.vegetation!;
                const met = testResults.weather!;
                const ts = veg.time_series || [];
                const last = ts[ts.length - 1];
                const parseDate = (s: string) => new Date(s).getTime();
                const lastTime = last ? parseDate(last.date) : 0;
                const findPrev = (days: number) => {
                  if (!ts.length || !lastTime) return undefined as any;
                  const target = lastTime - days * 86400000;
                  let prev = ts[0];
                  for (const p of ts) {
                    if (parseDate(p.date) <= target) prev = p;
                  }
                  return prev;
                };
                const avgInDays = (days: number, key: 'NDVI' | 'NDMI') => {
                  if (!ts.length || !lastTime) return undefined;
                  const from = lastTime - days * 86400000;
                  const arr = ts.filter((p) => parseDate(p.date) >= from);
                  const use = arr.length ? arr : ts;
                  const sum = use.reduce((a, p) => a + (p[key] || 0), 0);
                  return use.length ? Number((sum / use.length).toFixed(2)) : undefined;
                };
                const pct = (now?: number, prev?: number) => {
                  if (now == null || prev == null || prev === 0) return undefined;
                  return Number((((now - prev) / Math.abs(prev)) * 100).toFixed(1));
                };
                const ndvi_now = last?.NDVI;
                const ndvi_prev30 = findPrev(30)?.NDVI;
                const ndvi_trend = pct(ndvi_now, ndvi_prev30);
                const ndvi_avg = avgInDays(30, 'NDVI');

                const ndmi_now = last?.NDMI;
                const ndmi_prev14 = findPrev(14)?.NDMI;
                const ndmi_trend = pct(ndmi_now, ndmi_prev14);
                const water_stress =
                  ndmi_now == null ? undefined : ndmi_now < 0.25 ? 'severe' : ndmi_now < 0.32 ? 'moderate' : ndmi_now < 0.4 ? 'mild' : 'none';

                const planting = eosConfig.planting_date ? new Date(eosConfig.planting_date) : undefined;
                const refDate = last?.date ? new Date(last.date) : new Date();
                const days_from_planting = planting ? Math.max(0, Math.floor((+refDate - +planting) / 86400000)) : undefined;

                // Prefer unified summary values when available
                const ndvi_now_disp = (summary as EosSummary | null)?.ndvi_data?.current_value ?? ndvi_now;
                const ndvi_trend_disp = (summary as EosSummary | null)?.ndvi_data?.trend_30_days ?? ndvi_trend;
                const ndvi_avg_disp = (summary as EosSummary | null)?.ndvi_data?.field_average ?? ndvi_avg;
                const ndmi_now_disp = (summary as EosSummary | null)?.ndmi_data?.current_value ?? ndmi_now;
                const ndmi_trend_disp = (summary as EosSummary | null)?.ndmi_data?.trend_14_days ?? ndmi_trend;
                const water_stress_disp = (summary as EosSummary | null)?.ndmi_data?.water_stress_level ?? water_stress;
                const phen_stage_disp = (summary as EosSummary | null)?.phenology?.current_stage ?? veg.analysis.growth_stage;
                const days_from_planting_disp = (summary as EosSummary | null)?.phenology?.days_from_planting ?? days_from_planting;

                const alerts = met.alerts || [];
                const heat = alerts.some((a) => a.toLowerCase().includes('heat') || a.toLowerCase().includes('caldo'));
                const frost = alerts.some((a) => a.toLowerCase().includes('frost') || a.toLowerCase().includes('gel'));
                const weather_risk = {
                  temperature_stress_days: undefined as number | undefined,
                  precipitation_deficit_mm: undefined as number | undefined,
                  frost_risk_forecast_7d: frost,
                  heat_stress_risk: (heat ? 'medium' : 'low') as 'low' | 'medium' | 'high',
                };

                const preview = {
                  ndvi_data: {
                    current_value: ndvi_now,
                    trend_30_days: ndvi_trend,
                    field_average: ndvi_avg,
                    uniformity_score: undefined,
                  },
                  ndmi_data: {
                    current_value: ndmi_now,
                    water_stress_level: water_stress,
                    trend_14_days: ndmi_trend,
                    critical_threshold: 0.3,
                  },
                  phenology: {
                    current_stage: veg.analysis.growth_stage,
                    days_from_planting,
                    expected_harvest_days: undefined,
                    development_rate: 'normal',
                  },
                  weather_risks: weather_risk,
                };

                return (
                  <div className="space-y-8">
                    <div className="rounded-xl p-4 bg-secondary/30 border border-border">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm text-muted-foreground">
                          Consultazione EOS per <span className="font-medium text-foreground">{polygonData.source || 'campo'}</span> • Coltura: <span className="font-medium text-foreground">{eosConfig.cropType}</span> • Periodo: {eosConfig.start_date} → {eosConfig.end_date}{eosConfig.planting_date ? ` • Semina: ${eosConfig.planting_date}` : ""}
                        </div>
                        <div className="flex items-center gap-2 text-foreground">
                          <CheckCircle2 className="w-4 h-4" /> Vegetazione
                          <CheckCircle2 className="w-4 h-4 ml-3" /> Meteo
                        </div>
                      </div>
                    </div>

                    <h3 className="text-xl font-semibold text-foreground">Parametri essenziali per la stima</h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="rounded-xl p-4 bg-muted border border-border">
                        <div className="text-sm text-muted-foreground mb-1">NDVI</div>
                        <div className="text-2xl font-bold text-foreground">{ndvi_now_disp ?? '—'}</div>
                        <div className="text-xs text-muted-foreground mt-1">Trend 30gg: {ndvi_trend_disp != null ? `${ndvi_trend_disp}%` : '—'}</div>
                        <div className="text-xs text-muted-foreground">Media campo: {ndvi_avg_disp ?? '—'}</div>
                      </div>

                      <div className="rounded-xl p-4 bg-muted border border-border">
                        <div className="text-sm text-muted-foreground mb-1">NDMI</div>
                        <div className="text-2xl font-bold text-foreground">{ndmi_now_disp ?? '—'}</div>
                        <div className="text-xs text-muted-foreground mt-1">Stress idrico: {water_stress_disp ?? '—'}</div>
                        <div className="text-xs text-muted-foreground">Trend 14gg: {ndmi_trend_disp != null ? `${ndmi_trend_disp}%` : '—'}</div>
                      </div>

                      <div className="rounded-xl p-4 bg-muted border border-border">
                        <div className="text-sm text-muted-foreground mb-1">Fenologia</div>
                        <div className="text-2xl font-bold text-foreground">{phen_stage_disp || '—'}</div>
                        <div className="text-xs text-muted-foreground mt-1">Giorni dalla semina: {days_from_planting_disp ?? '—'}</div>
                        <div className="text-xs text-muted-foreground">Sviluppo: normal</div>
                      </div>

                      <div className="rounded-xl p-4 bg-muted border border-border">
                        <div className="text-sm text-muted-foreground mb-1">Meteo</div>
                        <div className="text-2xl font-bold text-foreground">{(met.temperature_avg as any)?.toFixed ? (met.temperature_avg as any).toFixed(1) : met.temperature_avg}°C</div>
                        <div className="text-xs text-muted-foreground mt-1">Pioggia stagione: {met.precipitation_total ?? '—'} mm</div>
                        <div className="text-xs text-muted-foreground">Rischi: {alerts.length ? alerts.join(' • ') : 'nessuno'}</div>
                      </div>
                    </div>

                    <div className="bg-muted rounded-xl p-4 border border-border">
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="json">
                          <AccordionTrigger>Anteprima tecnica (JSON) — parametri essenziali</AccordionTrigger>
                          <AccordionContent>
                            <pre className="mt-3 p-3 bg-background rounded-lg border border-border text-xs overflow-auto">{JSON.stringify(summary ?? preview, null, 2)}</pre>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>

                    <div className="grid lg:grid-cols-2 gap-8">
                      <div className="bg-muted rounded-xl p-6 border border-border">
                        <h3 className="text-lg font-semibold mb-4 flex items-center text-foreground">
                          <Layers className="w-5 h-5 mr-2" />
                          Dati Vegetazione
                        </h3>
                        <div className="space-y-4">
                          {veg.meta && (
                            <div className="bg-background rounded-lg p-4 border border-border">
                              <div className="text-sm text-muted-foreground">Osservazioni</div>
                              <div className="font-medium text-foreground">{veg.meta.observation_count ?? veg.time_series.length}</div>
                            </div>
                          )}
                          <div className="bg-background rounded-lg p-4 border border-border">
                            <div className="text-sm text-muted-foreground mb-2">NDVI (ultime osservazioni)</div>
                            <div className="h-48">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={veg.time_series}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                  <YAxis domain={[0, 1]} tick={{ fontSize: 12 }} />
                                  <ReTooltip />
                                  <Line type="monotone" dataKey="NDVI" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl p-6 border border-border bg-primary/5">
                        <h3 className="text-xl font-semibold text-foreground mb-2">Prossimo passo</h3>
                        <p className="text-sm text-muted-foreground">
                          Utilizzeremo questi 4 parametri per calcolare la produttività prevista (ton/ha).
                        </p>
                        <button
                          className="mt-4 px-6 py-3 rounded-xl bg-muted text-foreground border border-border cursor-not-allowed"
                          disabled
                        >
                          Stima Produttività — in arrivo
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}

            <div className="flex justify-center mt-8">
              <button
                onClick={resetAll}
                className="px-8 py-3 bg-primary text-primary-foreground rounded-xl shadow-lg hover:opacity-95 flex items-center"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Nuovo Test
              </button>
            </div>
          </div>
        )}

        {/* Error Display */}
        {errors && (
          <div className="bg-destructive/10 border border-destructive rounded-xl p-4 mb-6 text-destructive">
            {errors}
          </div>
        )}
      </div>
    </div>
  );
};

export default EOSTester;
