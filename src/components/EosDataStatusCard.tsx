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
  onRetry?: () => void;
}

export const EosDataStatusCard: React.FC<EosDataStatusCardProps> = ({ 
  summary, 
  isDemo = false,
  requestedPeriod,
  onRetry
}) => {
  const meta = summary?.meta;
  const observationCount = meta?.observation_count || 0;
  const usedFilters = meta?.used_filters;
  const fallbackUsed = meta?.fallback_used;
  const errorCode = meta?.error_code;
  const providerStatus = meta?.provider_status;
  const retryAfter = meta?.retry_after;

  const getStatusBadge = () => {
    if (isDemo) {
      return <Badge variant="secondary" className="text-xs">Demo</Badge>;
    }
    if (errorCode === "RATE_LIMITED" || providerStatus === 429) {
      return <Badge variant="destructive" className="text-xs">Rate Limited</Badge>;
    }
    if (observationCount > 0) {
      return <Badge variant="default" className="text-xs">Dati Live</Badge>;
    }
    if (errorCode) {
      return <Badge variant="destructive" className="text-xs">Errore</Badge>;
    }
    return <Badge variant="outline" className="text-xs">Nessun Dato</Badge>;
  };

  const getStatusColor = () => {
    if (isDemo) return "text-muted-foreground";
    if (errorCode === "RATE_LIMITED" || providerStatus === 429) return "text-orange-600";
    if (observationCount > 0) return "text-primary";
    if (errorCode) return "text-destructive";
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

        {/* Enhanced Error Details */}
        {(errorCode || providerStatus) && (
          <div className="space-y-2 p-2 bg-muted/30 rounded text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Stato provider:</span>
              <Badge variant="outline" className="text-xs font-mono">
                {providerStatus || "N/A"}
              </Badge>
            </div>
            {errorCode && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Codice errore:</span>
                <Badge variant="outline" className="text-xs font-mono">
                  {errorCode}
                </Badge>
              </div>
            )}
            {retryAfter && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Riprova tra:</span>
                <Badge variant="outline" className="text-xs font-mono">
                  {retryAfter}s
                </Badge>
              </div>
            )}
          </div>
        )}

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
            {usedFilters.sensors && (
              <div className="space-y-1 col-span-3">
                <div className="text-muted-foreground">Sensori utilizzati</div>
                <div className="flex gap-1 flex-wrap">
                  {usedFilters.sensors.map((sensor: string) => (
                    <Badge key={sensor} variant="outline" className="text-xs font-mono">
                      {sensor}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
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

        {(errorCode === "RATE_LIMITED" || providerStatus === 429) && (
          <Alert variant="destructive" className="py-2">
            <Info className="h-3 w-3" />
            <AlertDescription className="text-xs flex items-center justify-between">
              <span>Rate limit EOS raggiunto - riprova automaticamente in corso</span>
              {onRetry && (
                <button 
                  onClick={onRetry}
                  className="ml-2 text-xs underline hover:no-underline"
                >
                  Riprova ora
                </button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {observationCount === 0 && !isDemo && !errorCode && (
          <Alert variant="destructive" className="py-2">
            <Info className="h-3 w-3" />
            <AlertDescription className="text-xs flex items-center justify-between">
              <span>Nessuna osservazione satellitare trovata per il periodo e filtri specificati</span>
              {onRetry && (
                <button 
                  onClick={onRetry}
                  className="ml-2 text-xs underline hover:no-underline"
                >
                  Riprova
                </button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {errorCode && errorCode !== "RATE_LIMITED" && (
          <Alert variant="destructive" className="py-2">
            <Info className="h-3 w-3" />
            <AlertDescription className="text-xs flex items-center justify-between">
              <span>Errore nel recupero dati: {errorCode}</span>
              {onRetry && (
                <button 
                  onClick={onRetry}
                  className="ml-2 text-xs underline hover:no-underline"
                >
                  Riprova
                </button>
              )}
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