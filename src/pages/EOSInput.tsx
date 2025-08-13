import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { calculateAreaHa, type PolygonData } from "@/lib/eos";
import { kml as kmlToGeoJSON } from "@tmcw/togeojson";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Calendar as CalendarIcon, Upload, MapPin, Settings, ArrowRight } from "lucide-react";

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
  const startDefault = useMemo(() => {
    const s = new Date(today);
    s.setFullYear(today.getFullYear() - 1);
    return s;
  }, [today]);

  const formatDate = (d: Date) => d.toISOString().slice(0, 10);

  // Form state
  const [crop, setCrop] = useState<string>("sunflower");
  const [irrigation, setIrrigation] = useState<string>("rainfed");
  const [fertilization, setFertilization] = useState<string>("mineral");
  const [plantingDate, setPlantingDate] = useState<string>("");
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({ from: startDefault, to: today });

  // Polygon state
  const [polygonData, setPolygonData] = useState<PolygonData>({ geojson: "", coordinates: [], source: "", area_ha: 0 });
  const [polygonOptions, setPolygonOptions] = useState<{ id: string; label: string; coordinates: [number, number][]; area_ha: number }[]>([]);

  useEffect(() => {
    setMetaTags(
      "Input analisi campo | EOS Agritech",
      "Seleziona coltura, gestione e poligono per analisi satellitare agricola.",
      "/"
    );
  }, []);

  const handleGeoJsonPaste = (raw: string) => {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.type !== "Polygon" || !Array.isArray(parsed.coordinates) || !Array.isArray(parsed.coordinates[0])) {
        throw new Error("Formato GeoJSON non valido: atteso Polygon");
      }
      let coords = parsed.coordinates[0] as [number, number][];
      if (coords.length && (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])) {
        coords = [...coords, coords[0]] as any;
      }
      const area = calculateAreaHa(coords as any);
      setPolygonData({ geojson: JSON.stringify({ type: "Polygon", coordinates: [coords] }, null, 2), coordinates: coords as any, source: "GeoJSON incollato", area_ha: area });
      setPolygonOptions([]);
      toast({ title: "GeoJSON caricato", description: "Poligono valido." });
    } catch (e: any) {
      toast({ title: "Errore GeoJSON", description: e?.message ?? "Errore nel parsing del GeoJSON", variant: "destructive" });
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
      } else {
        throw new Error("Formato file non supportato. Usa .kml, .geojson o .json");
      }

      if (coords && coords.length && (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])) {
        coords = [...coords, coords[0]] as any;
      }
      const geoJson = { type: "Polygon", coordinates: [coords] };
      const area = calculateAreaHa(coords as any);
      setPolygonData({ geojson: JSON.stringify(geoJson, null, 2), coordinates: coords as any, source: name, area_ha: area });
      toast({ title: "File caricato", description: `Poligono rilevato da ${name}` });
    } catch (e: any) {
      toast({ title: "Errore file", description: e?.message ?? "Errore nella lettura del file", variant: "destructive" });
    }
  };

  const handleSubmit = () => {
    if (!polygonData.geojson) {
      toast({ title: "Campo mancante", description: "Seleziona o incolla un poligono del campo.", variant: "destructive" });
      return;
    }

    const start_date = formatDate(dateRange.from || startDefault);
    const end_date = formatDate(dateRange.to || today);

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
            <h1 className="text-2xl font-bold text-foreground">Analisi campo - Input</h1>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 py-8 grid lg:grid-cols-3 gap-6">
        <article className="lg:col-span-2 bg-card rounded-xl border border-border p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">1) Carica o incolla il poligono</h2>
          <div className="flex items-center gap-3 mb-4">
            <label className="inline-flex items-center gap-2 cursor-pointer text-foreground">
              <Upload className="w-4 h-4" />
              <span>File KML / GeoJSON</span>
              <input
                type="file"
                accept=".kml,.geojson,.json,application/json,application/vnd.google-earth.kml+xml"
                className="hidden"
                onChange={(e) => e.target.files && e.target.files[0] && handleFileUpload(e.target.files[0])}
              />
            </label>
          </div>
          <Textarea
            placeholder='Incolla un GeoJSON Polygon (es: {"type":"Polygon","coordinates":[[...]]})'
            className="min-h-[140px]"
            onBlur={(e) => e.target.value && handleGeoJsonPaste(e.target.value)}
          />

          {polygonData.geojson && (
            <div className="mt-4 text-sm text-muted-foreground">
              Selezionato: {polygonData.source || "GeoJSON"} • {polygonData.area_ha} ha
            </div>
          )}

          {polygonOptions.length > 1 && (
            <Accordion type="single" collapsible className="mt-4">
              <AccordionItem value="options">
                <AccordionTrigger>Più poligoni trovati ({polygonOptions.length})</AccordionTrigger>
                <AccordionContent>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {polygonOptions.map((opt) => (
                      <Button key={opt.id} variant="secondary" onClick={() => setPolygonData({ geojson: JSON.stringify({ type: "Polygon", coordinates: [opt.coordinates] }, null, 2), coordinates: opt.coordinates as any, source: polygonData.source || "File", area_ha: opt.area_ha })}>
                        {opt.label} • {opt.area_ha} ha
                      </Button>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </article>

        <aside className="bg-card rounded-xl border border-border p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">2) Parametri agronomici</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-1 text-muted-foreground">Coltura</label>
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
              <label className="block text-sm mb-1 text-muted-foreground">Irrigazione</label>
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
              <label className="block text-sm mb-1 text-muted-foreground">Fertilizzazione</label>
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

            <div>
              <label className="block text-sm mb-1 text-muted-foreground">Data di semina</label>
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                <Input type="date" value={plantingDate} onChange={(e) => setPlantingDate(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1 text-muted-foreground">Intervallo di analisi</label>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={formatDate(dateRange.from || startDefault)} onChange={(e) => setDateRange((p) => ({ ...p, from: new Date(e.target.value) }))} />
                <Input type="date" value={formatDate(dateRange.to || today)} onChange={(e) => setDateRange((p) => ({ ...p, to: new Date(e.target.value) }))} />
              </div>
            </div>

            <Button className="w-full mt-2" onClick={handleSubmit}>
              Vai ai risultati
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>

            <p className="text-xs text-muted-foreground">La chiave API è gestita in modo sicuro su Supabase (nessun input richiesto).</p>
          </div>
        </aside>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-10">
        <div className="bg-secondary/30 border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Settings className="w-4 h-4" />
            Suggerimento: per testare un campo reale di girasole, incolla qui il GeoJSON del poligono. Se non lo hai, carica un KML/GeoJSON dal tuo GIS.
          </div>
        </div>
      </section>
    </main>
  );
};

export default EOSInput;
