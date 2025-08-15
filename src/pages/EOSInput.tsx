import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { calculateAreaHa, type PolygonData } from "@/lib/eos";
import { kml as kmlToGeoJSON } from "@tmcw/togeojson";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Calendar as CalendarIcon, Upload, MapPin, Settings, ArrowRight, AlertTriangle, Loader2, AlertCircle, Map } from "lucide-react";
import { MapSelector } from "@/components/MapSelector";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

// Top 10 colture in Italia (indicative)
const TOP_CROPS = [
  { value: "sunflower", label: "Girasole" },
  { value: "wheat", label: "Grano tenero/duro" },
  { value: "corn", label: "Mais" },
  { value: "rice", label: "Riso" },
  { value: "olive", label: "Olivo" },
  { value: "wine", label: "Vite (Uva)" },
  { value: "tomato", label: "Pomodoro" },
  { value: "potato", label: "Patata" },
  { value: "soybean", label: "Soia" },
  { value: "barley", label: "Orzo" },
];

const IRRIGATION_MODES = [
  { value: "rainfed", label: "Secco (Rainfed)" },
  { value: "sprinkler", label: "Pioggia (Sprinkler)" },
  { value: "drip", label: "Goccia (Drip)" },
  { value: "flood", label: "Scorrimento (Flood)" },
];

const FERTILIZATION_MODES = [
  { value: "none", label: "Nessuna" },
  { value: "organic", label: "Organica" },
  { value: "mineral", label: "Minerale" },
  { value: "mixed", label: "Mista" },
  { value: "precision", label: "A rateo variabile" },
];

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

const EOSInput: React.FC = () => {
  const navigate = useNavigate();
  const today = new Date();
  
  const formatDate = (d: Date) => d.toISOString().slice(0, 10);

  // Form state
  const [crop, setCrop] = useState<string>("sunflower");
  const [irrigation, setIrrigation] = useState<string>("rainfed");
  const [fertilization, setFertilization] = useState<string>("mineral");
  const [plantingDate, setPlantingDate] = useState<string>("");
  
  // Polygon state
  const [polygonData, setPolygonData] = useState<PolygonData>({ geojson: "", coordinates: [], source: "", area_ha: 0 });
  const [polygonOptions, setPolygonOptions] = useState<{ id: string; label: string; coordinates: [number, number][]; area_ha: number }[]>([]);
  const [inputMode, setInputMode] = useState<"map" | "file">("map");
  

  // Intelligent date range calculation
  const intelligentDateRange = useMemo(() => {
    const endDate = today;
    let startDate: Date;
    
    if (plantingDate) {
      // If planting date is provided, use it as start (max 12 months ago)
      const planting = new Date(plantingDate);
      const maxStartDate = new Date(today);
      maxStartDate.setMonth(today.getMonth() - 12);
      
      startDate = planting > maxStartDate ? planting : maxStartDate;
    } else {
      // Default: last 90 days (optimal for EOS)
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 90);
    }
    
    return { from: startDate, to: endDate };
  }, [plantingDate, today]);
  
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>(intelligentDateRange);

  // Update date range when planting date changes
  useEffect(() => {
    setDateRange(intelligentDateRange);
  }, [intelligentDateRange]);

  useEffect(() => {
    setMetaTags(
      "Input analisi campo | EOS Agritech",
      "Seleziona coltura, gestione e poligono per analisi satellitare agricola.",
      "/"
    );
  }, []);


  // Handle polygon selection from map - stabilized callback
  const handleMapPolygonSelect = React.useCallback((polygon: {
    type: string;
    coordinates: number[][][];
    source: string;
    area: number;
  }) => {
    const coords = polygon.coordinates[0] as [number, number][];
    setPolygonData({
      geojson: JSON.stringify({ type: polygon.type, coordinates: polygon.coordinates }, null, 2),
      coordinates: coords as any,
      source: polygon.source,
      area_ha: polygon.area
    });
    setPolygonOptions([]);
    setInputMode("map");
    
    toast({ 
      title: "Campo selezionato", 
      description: `Poligono di ${polygon.area.toFixed(2)} ha dalla mappa` 
    });
  }, []);

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
              for (const poly of geom.coordinates) if (Array.isArray(poly) && poly[0]) polygons.push(poly[0]);
            } else if (geom.type === "GeometryCollection" && Array.isArray(geom.geometries)) {
              geom.geometries.forEach(pushFromGeom);
            }
          };
          if (gj.type === "FeatureCollection" && Array.isArray(gj.features)) gj.features.forEach((f: any) => pushFromGeom(f.geometry));
          else if (gj.type === "Feature") pushFromGeom(gj.geometry);
          else if (gj.type === "Polygon" || gj.type === "MultiPolygon") pushFromGeom(gj);
          return polygons;
        };

        const polys = extractPolygons(gj);
        if (!polys.length) throw new Error("Nessun Polygon valido trovato nel KML");
        const opts = polys
          .map((p: any, i: number) => {
            let ring = p as [number, number][];
            if (ring.length && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) ring = [...ring, ring[0]] as any;
            const area = calculateAreaHa(ring as any);
            return { id: `kml-${i}`, label: `Poligono ${i + 1}`, coordinates: ring as any, area_ha: area };
          })
          .sort((a: any, b: any) => b.area_ha - a.area_ha);
        setPolygonOptions(opts);
        coords = opts[0].coordinates;
        setInputMode("file");
      } else if (lower.endsWith(".geojson") || lower.endsWith(".json") || file.type.includes("json")) {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const extractPolygons = (geojson: any): [number, number][][] => {
          const polygons: [number, number][][] = [];
          const pushFromGeom = (geom: any) => {
            if (!geom) return;
            if (geom.type === "Polygon" && Array.isArray(geom.coordinates)) polygons.push(geom.coordinates[0]);
            else if (geom.type === "MultiPolygon" && Array.isArray(geom.coordinates)) for (const poly of geom.coordinates) if (Array.isArray(poly) && poly[0]) polygons.push(poly[0]);
            else if (geom.type === "GeometryCollection" && Array.isArray(geom.geometries)) geom.geometries.forEach(pushFromGeom);
          };
          if (parsed.type === "FeatureCollection" && Array.isArray(parsed.features)) parsed.features.forEach((f: any) => pushFromGeom(f.geometry));
          else if (parsed.type === "Feature") pushFromGeom(parsed.geometry);
          else if (parsed.type === "Polygon" || parsed.type === "MultiPolygon") pushFromGeom(parsed);
          return polygons;
        };
        const polys = extractPolygons(parsed);
        if (!polys.length) throw new Error("Il file non contiene un Polygon valido");
        const opts = polys
          .map((p: any, i: number) => {
            let ring = p as [number, number][];
            if (ring.length && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) ring = [...ring, ring[0]] as any;
            const area = calculateAreaHa(ring as any);
            return { id: `gj-${i}`, label: `Poligono ${i + 1}`, coordinates: ring as any, area_ha: area };
          })
          .sort((a: any, b: any) => b.area_ha - a.area_ha);
        setPolygonOptions(opts);
        coords = opts[0].coordinates;
        setInputMode("file");
      } else {
        throw new Error("Formato file non supportato. Usa .kml, .geojson o .json");
      }

      if (coords && coords.length && (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])) {
        coords = [...coords, coords[0]] as any;
      }
      const geoJson = { type: "Polygon", coordinates: [coords] };
      const area = calculateAreaHa(coords as any);
      setPolygonData({ geojson: JSON.stringify(geoJson, null, 2), coordinates: coords as any, source: name, area_ha: area });
      setInputMode("file");
      toast({ title: "File caricato", description: `Poligono rilevato da ${name}` });
    } catch (e: any) {
      toast({ title: "Errore file", description: e?.message ?? "Errore nella lettura del file", variant: "destructive" });
    }
  };

  // Validate date range for EOS optimization
  const validateDateRange = () => {
    if (!dateRange.from || !dateRange.to) return { isValid: false, warning: "Date mancanti" };
    
    const daysDiff = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff < 30) {
      return { isValid: false, warning: "Intervallo troppo breve (min 30 giorni)" };
    }
    if (daysDiff > 365) {
      return { isValid: false, warning: "Intervallo troppo lungo (max 12 mesi)" };
    }
    if (daysDiff < 60) {
      return { isValid: true, warning: "Intervallo breve - potrebbero esserci meno osservazioni" };
    }
    
    return { isValid: true, warning: null };
  };

  const dateValidation = validateDateRange();

  const handleSubmit = () => {
    if (!polygonData.geojson) {
      toast({ title: "Campo mancante", description: "Seleziona il campo sulla mappa o carica un file.", variant: "destructive" });
      return;
    }

    if (!dateValidation.isValid) {
      toast({ title: "Intervallo date non valido", description: dateValidation.warning, variant: "destructive" });
      return;
    }

    const start_date = formatDate(dateRange.from!);
    const end_date = formatDate(dateRange.to!);

      localStorage.setItem("eos_polygon", JSON.stringify(polygonData));
    localStorage.setItem(
      "eos_user_config",
      JSON.stringify({ cropType: crop, irrigation, fertilization, planting_date: plantingDate, start_date, end_date })
    );

    navigate("/output");
  };


  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MapPin className="w-6 h-6 text-foreground" />
            <h1 className="text-2xl font-bold text-foreground">Analisi Campo - Input</h1>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Campo Selection */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Selezione Campo</h3>
                <div className="flex space-x-2">
                  <Button
                    variant={inputMode === "map" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setInputMode("map")}
                  >
                    <Map className="h-4 w-4 mr-2" />
                    Mappa
                  </Button>
                  <Button
                    variant={inputMode === "file" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setInputMode("file")}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    File
                  </Button>
                </div>
              </div>

              {inputMode === "map" && (
                <MapSelector 
                  onPolygonSelect={handleMapPolygonSelect} 
                />
              )}

              {inputMode === "file" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Carica File</CardTitle>
                    <CardDescription>
                      Carica un file KML o GeoJSON del tuo campo
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <label className="inline-flex items-center gap-2 cursor-pointer text-foreground">
                      <Upload className="w-4 h-4" />
                      <span className="text-sm">Carica KML / GeoJSON</span>
                      <input
                        type="file"
                        accept=".kml,.geojson,.json,application/json,application/vnd.google-earth.kml+xml"
                        className="hidden"
                        onChange={(e) => e.target.files && e.target.files[0] && handleFileUpload(e.target.files[0])}
                      />
                    </label>

                    {polygonOptions.length > 1 && (
                      <Accordion type="single" collapsible>
                        <AccordionItem value="options">
                          <AccordionTrigger className="text-sm">
                            Più poligoni trovati ({polygonOptions.length})
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-2">
                              {polygonOptions.map((opt) => (
                                <Button 
                                  key={opt.id} 
                                  variant="ghost" 
                                  size="sm"
                                  className="w-full text-left justify-start"
                                  onClick={() => {
                                    setPolygonData({ 
                                      geojson: JSON.stringify({ type: "Polygon", coordinates: [opt.coordinates] }, null, 2), 
                                      coordinates: opt.coordinates as any, 
                                      source: polygonData.source || "File", 
                                      area_ha: opt.area_ha 
                                    });
                                    
                                    setInputMode("file");
                                  }}
                                >
                                  {opt.label} • {opt.area_ha.toFixed(2)} ha
                                </Button>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {/* Current selection display */}
            {polygonData.geojson && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Campo Selezionato</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Fonte:</span>
                      <Badge variant="secondary">{polygonData.source}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Area:</span>
                      <Badge variant="default">{polygonData.area_ha.toFixed(2)} ha</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

          </div>
        </div>

        {/* Step 2: Agronomic Parameters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Parametri Agronomici e Date di Analisi
            </CardTitle>
            <CardDescription>
              Configura i dettagli della coltura e l'intervallo di analisi satellitare
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Left column: Crop parameters */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Coltura</label>
                  <Select value={crop} onValueChange={setCrop}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona coltura" />
                    </SelectTrigger>
                    <SelectContent>
                      {TOP_CROPS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Irrigazione</label>
                  <Select value={irrigation} onValueChange={setIrrigation}>
                    <SelectTrigger>
                      <SelectValue placeholder="Modalità di irrigazione" />
                    </SelectTrigger>
                    <SelectContent>
                      {IRRIGATION_MODES.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Fertilizzazione</label>
                  <Select value={fertilization} onValueChange={setFertilization}>
                    <SelectTrigger>
                      <SelectValue placeholder="Modalità di fertilizzazione" />
                    </SelectTrigger>
                    <SelectContent>
                      {FERTILIZATION_MODES.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Right column: Date parameters */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Data di semina (opzionale)</label>
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                    <Input 
                      type="date" 
                      value={plantingDate} 
                      onChange={(e) => setPlantingDate(e.target.value)}
                      placeholder="YYYY-MM-DD"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Se fornita, l'intervallo partirà da questa data
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Intervallo di analisi</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input 
                      type="date" 
                      value={formatDate(dateRange.from!)} 
                      onChange={(e) => setDateRange((p) => ({ ...p, from: new Date(e.target.value) }))} 
                    />
                    <Input 
                      type="date" 
                      value={formatDate(dateRange.to!)} 
                      onChange={(e) => setDateRange((p) => ({ ...p, to: new Date(e.target.value) }))} 
                    />
                  </div>
                  
                  {dateValidation.warning && (
                    <Alert className={`mt-2 ${dateValidation.isValid ? 'border-orange-200' : 'border-destructive'}`}>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        {dateValidation.warning}
                      </AlertDescription>
                    </Alert>
                  )}

                  <p className="text-xs text-muted-foreground mt-1">
                    Intervallo ottimale: 60-365 giorni. Date intelligenti calcolate automaticamente.
                  </p>
                </div>

                <div className="pt-4">
                  <Button 
                    className="w-full" 
                    onClick={handleSubmit}
                    disabled={!polygonData.geojson || !dateValidation.isValid}
                  >
                    Avvia Analisi EOS
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    L'API EOS è gestita in modo sicuro tramite Supabase
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tips section */}
        <Alert>
          <Settings className="h-4 w-4" />
          <AlertDescription>
            <strong>Suggerimenti per una migliore analisi:</strong>
            <ul className="mt-2 space-y-1 text-sm">
              <li>• Usa la mappa interattiva per maggiore precisione</li>
              <li>• Intervalli di 60-90 giorni forniscono i migliori risultati</li>
              <li>• La data di semina aiuta a ottimizzare automaticamente le date</li>
              <li>• Aree tra 1-100 ettari sono ideali per l'analisi EOS</li>
            </ul>
          </AlertDescription>
        </Alert>
      </section>
    </main>
  );
};

export default EOSInput;
