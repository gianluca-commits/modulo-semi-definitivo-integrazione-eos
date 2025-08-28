import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

// Italian provinces with their official codes
const ITALIAN_PROVINCES = [
  { code: "AG", name: "Agrigento", region: "Sicilia" },
  { code: "AL", name: "Alessandria", region: "Piemonte" },
  { code: "AN", name: "Ancona", region: "Marche" },
  { code: "AO", name: "Aosta", region: "Valle d'Aosta" },
  { code: "AP", name: "Ascoli Piceno", region: "Marche" },
  { code: "AQ", name: "L'Aquila", region: "Abruzzo" },
  { code: "AR", name: "Arezzo", region: "Toscana" },
  { code: "AT", name: "Asti", region: "Piemonte" },
  { code: "AV", name: "Avellino", region: "Campania" },
  { code: "BA", name: "Bari", region: "Puglia" },
  { code: "BG", name: "Bergamo", region: "Lombardia" },
  { code: "BI", name: "Biella", region: "Piemonte" },
  { code: "BL", name: "Belluno", region: "Veneto" },
  { code: "BN", name: "Benevento", region: "Campania" },
  { code: "BO", name: "Bologna", region: "Emilia-Romagna" },
  { code: "BR", name: "Brindisi", region: "Puglia" },
  { code: "BS", name: "Brescia", region: "Lombardia" },
  { code: "BT", name: "Barletta-Andria-Trani", region: "Puglia" },
  { code: "BZ", name: "Bolzano", region: "Trentino-Alto Adige" },
  { code: "CA", name: "Cagliari", region: "Sardegna" },
  { code: "CB", name: "Campobasso", region: "Molise" },
  { code: "CE", name: "Caserta", region: "Campania" },
  { code: "CH", name: "Chieti", region: "Abruzzo" },
  { code: "CI", name: "Carbonia-Iglesias", region: "Sardegna" },
  { code: "CL", name: "Caltanissetta", region: "Sicilia" },
  { code: "CN", name: "Cuneo", region: "Piemonte" },
  { code: "CO", name: "Como", region: "Lombardia" },
  { code: "CR", name: "Cremona", region: "Lombardia" },
  { code: "CS", name: "Cosenza", region: "Calabria" },
  { code: "CT", name: "Catania", region: "Sicilia" },
  { code: "CZ", name: "Catanzaro", region: "Calabria" },
  { code: "EN", name: "Enna", region: "Sicilia" },
  { code: "FC", name: "Forlì-Cesena", region: "Emilia-Romagna" },
  { code: "FE", name: "Ferrara", region: "Emilia-Romagna" },
  { code: "FG", name: "Foggia", region: "Puglia" },
  { code: "FI", name: "Firenze", region: "Toscana" },
  { code: "FM", name: "Fermo", region: "Marche" },
  { code: "FR", name: "Frosinone", region: "Lazio" },
  { code: "GE", name: "Genova", region: "Liguria" },
  { code: "GO", name: "Gorizia", region: "Friuli-Venezia Giulia" },
  { code: "GR", name: "Grosseto", region: "Toscana" },
  { code: "IM", name: "Imperia", region: "Liguria" },
  { code: "IS", name: "Isernia", region: "Molise" },
  { code: "KR", name: "Crotone", region: "Calabria" },
  { code: "LC", name: "Lecco", region: "Lombardia" },
  { code: "LE", name: "Lecce", region: "Puglia" },
  { code: "LI", name: "Livorno", region: "Toscana" },
  { code: "LO", name: "Lodi", region: "Lombardia" },
  { code: "LT", name: "Latina", region: "Lazio" },
  { code: "LU", name: "Lucca", region: "Toscana" },
  { code: "MC", name: "Macerata", region: "Marche" },
  { code: "ME", name: "Messina", region: "Sicilia" },
  { code: "MI", name: "Milano", region: "Lombardia" },
  { code: "MN", name: "Mantova", region: "Lombardia" },
  { code: "MO", name: "Modena", region: "Emilia-Romagna" },
  { code: "MS", name: "Massa-Carrara", region: "Toscana" },
  { code: "MT", name: "Matera", region: "Basilicata" },
  { code: "NA", name: "Napoli", region: "Campania" },
  { code: "NO", name: "Novara", region: "Piemonte" },
  { code: "NU", name: "Nuoro", region: "Sardegna" },
  { code: "OG", name: "Ogliastra", region: "Sardegna" },
  { code: "OR", name: "Oristano", region: "Sardegna" },
  { code: "OT", name: "Olbia-Tempio", region: "Sardegna" },
  { code: "PA", name: "Palermo", region: "Sicilia" },
  { code: "PC", name: "Piacenza", region: "Emilia-Romagna" },
  { code: "PD", name: "Padova", region: "Veneto" },
  { code: "PE", name: "Pescara", region: "Abruzzo" },
  { code: "PG", name: "Perugia", region: "Umbria" },
  { code: "PI", name: "Pisa", region: "Toscana" },
  { code: "PN", name: "Pordenone", region: "Friuli-Venezia Giulia" },
  { code: "PO", name: "Prato", region: "Toscana" },
  { code: "PR", name: "Parma", region: "Emilia-Romagna" },
  { code: "PT", name: "Pistoia", region: "Toscana" },
  { code: "PU", name: "Pesaro e Urbino", region: "Marche" },
  { code: "PV", name: "Pavia", region: "Lombardia" },
  { code: "PZ", name: "Potenza", region: "Basilicata" },
  { code: "RA", name: "Ravenna", region: "Emilia-Romagna" },
  { code: "RC", name: "Reggio Calabria", region: "Calabria" },
  { code: "RE", name: "Reggio Emilia", region: "Emilia-Romagna" },
  { code: "RG", name: "Ragusa", region: "Sicilia" },
  { code: "RI", name: "Rieti", region: "Lazio" },
  { code: "RM", name: "Roma", region: "Lazio" },
  { code: "RN", name: "Rimini", region: "Emilia-Romagna" },
  { code: "RO", name: "Rovigo", region: "Veneto" },
  { code: "SA", name: "Salerno", region: "Campania" },
  { code: "SI", name: "Siena", region: "Toscana" },
  { code: "SO", name: "Sondrio", region: "Lombardia" },
  { code: "SP", name: "La Spezia", region: "Liguria" },
  { code: "SR", name: "Siracusa", region: "Sicilia" },
  { code: "SS", name: "Sassari", region: "Sardegna" },
  { code: "SV", name: "Savona", region: "Liguria" },
  { code: "TA", name: "Taranto", region: "Puglia" },
  { code: "TE", name: "Teramo", region: "Abruzzo" },
  { code: "TN", name: "Trento", region: "Trentino-Alto Adige" },
  { code: "TO", name: "Torino", region: "Piemonte" },
  { code: "TP", name: "Trapani", region: "Sicilia" },
  { code: "TR", name: "Terni", region: "Umbria" },
  { code: "TS", name: "Trieste", region: "Friuli-Venezia Giulia" },
  { code: "TV", name: "Treviso", region: "Veneto" },
  { code: "UD", name: "Udine", region: "Friuli-Venezia Giulia" },
  { code: "VA", name: "Varese", region: "Lombardia" },
  { code: "VB", name: "Verbano-Cusio-Ossola", region: "Piemonte" },
  { code: "VC", name: "Vercelli", region: "Piemonte" },
  { code: "VE", name: "Venezia", region: "Veneto" },
  { code: "VI", name: "Vicenza", region: "Veneto" },
  { code: "VR", name: "Verona", region: "Veneto" },
  { code: "VS", name: "Medio Campidano", region: "Sardegna" },
  { code: "VT", name: "Viterbo", region: "Lazio" },
  { code: "VV", name: "Vibo Valentia", region: "Calabria" },
];

interface ProvinceSelectorProps {
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

export const ProvinceSelector: React.FC<ProvinceSelectorProps> = ({
  value,
  onValueChange,
  className
}) => {
  const groupedProvinces = ITALIAN_PROVINCES.reduce((acc, province) => {
    if (!acc[province.region]) {
      acc[province.region] = [];
    }
    acc[province.region].push(province);
    return acc;
  }, {} as Record<string, typeof ITALIAN_PROVINCES>);

  return (
    <div className={className}>
      <Label htmlFor="province-select">Provincia</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id="province-select">
          <SelectValue placeholder="Seleziona provincia..." />
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          {Object.entries(groupedProvinces)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([region, provinces]) => (
              <div key={region}>
                <div className="px-2 py-1 text-sm font-semibold text-muted-foreground border-b">
                  {region}
                </div>
                {provinces
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((province) => (
                    <SelectItem key={province.code} value={province.code}>
                      {province.name} ({province.code})
                    </SelectItem>
                  ))}
              </div>
            ))}
        </SelectContent>
      </Select>
    </div>
  );
};