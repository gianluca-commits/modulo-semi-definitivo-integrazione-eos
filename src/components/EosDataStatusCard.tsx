import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Satellite, Info, Calendar, Eye } from "lucide-react";
import { EosSummary } from "@/lib/eos";

interface EosDataStatusCardProps {
  summary?: EosSummary;
  isDemo?: boolean;
  requestedPeriod?: {
    start_date: string;
    end_date: string;
  };
}

export const EosDataStatusCard: React.FC<EosDataStatusCardProps> = ({ 
  summary, 
  isDemo = false,
  requestedPeriod 
}) => {
  const meta = summary?.meta;
  const observationCount = meta?.observation_count || 0;
  const usedFilters = meta?.used_filters;
  const fallbackUsed = meta?.fallback_used;

  const getStatusBadge = () => {
    if (isDemo) {
      return <Badge variant="secondary" className="text-xs">Demo</Badge>;
    }
    if (observationCount > 0) {
      return <Badge variant="default" className="text-xs">Dati Live</Badge>;
    }
    return <Badge variant="outline" className="text-xs">Nessun Dato</Badge>;
  };

  const getStatusColor = () => {
    if (isDemo) return "text-muted-foreground";
    if (observationCount > 0) return "text-primary";
    return "text-destructive";
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Satellite className="w-4 h-4 text-primary" />
          <CardTitle className="text-sm">Stato Chiamata EOS</CardTitle>
          {getStatusBadge()}
        </div>
        <CardDescription className="text-xs">
          Informazioni sulla richiesta dati satellitari
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pt-0 space-y-3">
        {/* Period Info */}
        {requestedPeriod && (
          <div className="flex items-center gap-2 text-xs">
            <Calendar className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">Periodo richiesto:</span>
            <span className="font-mono">
              {requestedPeriod.start_date} → {requestedPeriod.end_date}
            </span>
          </div>
        )}

        {/* Observation Count */}
        <div className="flex items-center gap-2 text-xs">
          <Eye className="w-3 h-3 text-muted-foreground" />
          <span className="text-muted-foreground">Osservazioni satellitari:</span>
          <span className={`font-semibold ${getStatusColor()}`}>
            {observationCount}
          </span>
        </div>

        {/* Used Filters */}
        {usedFilters && (
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="space-y-1">
              <div className="text-muted-foreground">Copertura nubi</div>
              <Badge variant="outline" className="text-xs font-mono">
                ≤{usedFilters.max_cloud_cover_in_aoi}%
              </Badge>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Masking</div>
              <Badge variant="outline" className="text-xs font-mono">
                Livello {usedFilters.cloud_masking_level}
              </Badge>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Escl. coperti</div>
              <Badge variant="outline" className="text-xs font-mono">
                {usedFilters.exclude_cover_pixels ? "Sì" : "No"}
              </Badge>
            </div>
          </div>
        )}

        {/* Status Messages */}
        {fallbackUsed && (
          <Alert className="py-2">
            <Info className="h-3 w-3" />
            <AlertDescription className="text-xs">
              Utilizzati parametri di fallback per ottenere dati
            </AlertDescription>
          </Alert>
        )}

        {observationCount === 0 && !isDemo && (
          <Alert variant="destructive" className="py-2">
            <Info className="h-3 w-3" />
            <AlertDescription className="text-xs">
              Nessuna osservazione satellitare trovata per il periodo e filtri specificati
            </AlertDescription>
          </Alert>
        )}

        {isDemo && (
          <Alert className="py-2">
            <Info className="h-3 w-3" />
            <AlertDescription className="text-xs">
              Utilizzando dati dimostrativi - attiva modalità live per dati reali
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};